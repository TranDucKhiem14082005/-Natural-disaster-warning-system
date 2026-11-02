# CI/CD with GitHub Packages — Portable Reference

Document để **tái sử dụng quy trình CI/CD → GitHub Packages (GHCR) → auto-deploy
VPS** cho project bất kỳ. Stack mặc định trong blueprint này:
**Docker Compose multi-service (API + frontend apps) + GHCR + SSH deploy**.
Có thể adapt sang K8s / managed PaaS (xem section 9 Discovery Questionnaire).

> Output cuối: mỗi service có 1 Dockerfile → mỗi push code chỉ build lại
> service đổi → image lên `ghcr.io/<owner>/<image>` → 1 workflow deploy tự SSH
> vào VPS, `git pull` + `docker compose pull/up -d` + migrate DB, không cần tay.

---

## 1. Architecture tổng thể

```
┌──────────────┐  push   ┌─────────────────────────────┐
│ Local commit  ├────────▶│ GitHub repo (main branch)   │
└──────────────┘         └───────────┬─────────────────┘
                                      │ paths-filtered trigger
                    ┌─────────────────┼─────────────────┐
                    ▼                                   ▼
        ┌───────────────────────┐         ┌───────────────────────┐
        │ publish-backend.yml   │         │ publish-frontend.yml  │
        │ docker build+push     │         │ matrix: app1/app2/... │
        └───────────┬───────────┘         └───────────┬───────────┘
                    │ push image                       │ push image
                    ▼                                   ▼
            ghcr.io/<owner>/<image-a>:main   ghcr.io/<owner>/<image-b>:main ...
                    │                                   │
                    └────────────┬──────────────────────┘
                                 │ workflow_run (on success)
                                 ▼
                       ┌───────────────────┐
                       │   deploy.yml      │
                       │  SSH into VPS     │
                       └─────────┬─────────┘
                                 ▼
                    ┌────────────────────────────┐
                    │ VPS: /opt/<project>          │
                    │ git pull (deploy key, RO)   │
                    │ docker compose pull         │
                    │ docker compose up -d        │
                    │ migrate + seed              │
                    └────────────────────────────┘
```

**Core principles:**
1. **Mỗi service 1 package GHCR**, build độc lập, chỉ rebuild khi đổi code của chính nó (`paths:` filter).
2. **2 keypair SSH riêng biệt, KHÔNG dùng key cá nhân**:
   - Key A (`gh-actions → VPS`): private nằm trong GitHub Secrets, public nằm trong `authorized_keys` của VPS — cho phép CI SSH vào VPS để deploy.
   - Key B (`VPS → GitHub`): private nằm trên VPS, public nằm trong GitHub repo **Deploy Keys (read-only)** — cho phép VPS `git clone`/`pull` repo mà không có quyền viết.
3. **Image build từ source trên CI, không build trên VPS** — VPS chỉ pull image đã build sẵn (`docker-compose.prod.yml` dùng `image:` thay vì `build:`).
4. **`workflow_run` chain** — deploy workflow không tự đứng độc lập, nó **lắng nghe** kết quả của các workflow build, chỉ chạy khi build thành công.
5. **Secrets sinh ngẫu nhiên cho `.env` production** (Postgres password, JWT secret, ...) — không bao giờ dùng giá trị default của `.env.example`.
6. **Packages public nếu source không nhạy cảm** → VPS pull image không cần `docker login`, giảm 1 bước auth.

---

## 2. GitHub setup

### 2.1 Repo (nếu hợp nhất nhiều repo con thành 1 repo)

```bash
cd <thư mục chứa các service như sibling folders>
git init
git branch -M main
echo "node_modules/
dist/
.env
.DS_Store" > .gitignore
git add .
git commit -m "Initial commit: unify services into one repo for GitHub Packages CI/CD"
git remote add origin git@github.com:<owner>/<repo>.git
git push -u origin main
```

> Verify trước khi commit: không có `.env` thật, không có `node_modules` nào bị stage (`git status --short | grep -iE '\.env$|node_modules'`).

### 2.2 Workflow build & push 1 service (Dockerfile đơn)

`.github/workflows/docker-publish-<service>.yml`:

```yaml
name: Publish <Service> Docker image

on:
  push:
    branches: [main]
    paths:
      - "<ServiceDir>/**"
      - ".github/workflows/docker-publish-<service>.yml"
    tags: ["v*.*.*"]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/<image-name>

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha
      - uses: docker/build-push-action@v5
        with:
          context: ./<ServiceDir>
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

> `secrets.GITHUB_TOKEN` (tự động có sẵn, không cần tạo) đủ quyền push package khi `permissions.packages: write` được khai báo.

### 2.3 Nhiều service cùng repo, build context khác nhau → dùng `matrix`

Áp dụng khi 1 monorepo frontend có nhiều app, hoặc app cần build context = root
(monorepo workspaces) khác với Dockerfile path:

```yaml
strategy:
  matrix:
    include:
      - app: user
        context: Frontend          # root vì cần packages/ui chung
        dockerfile: Frontend/apps/user/Dockerfile
        image: <prefix>-frontend-user
      - app: landing
        context: Frontend/apps/landing  # standalone, không cần root
        dockerfile: Frontend/apps/landing/Dockerfile
        image: <prefix>-landing
steps:
  - uses: docker/build-push-action@v5
    with:
      context: ./${{ matrix.context }}
      file: ./${{ matrix.dockerfile }}
      build-args: |               # chỉ cần nếu có NEXT_PUBLIC_*/VITE_* bake build-time
        NEXT_PUBLIC_SITE_URL=http://<vps-ip>:<port>
```

**Gotcha:** biến `NEXT_PUBLIC_*` / `VITE_*` được **bake vào bundle lúc build**, không
phải runtime — nếu IP/domain VPS đổi, phải build lại image, không chỉ deploy lại.

### 2.4 Deploy Key cho VPS đọc repo (read-only)

```bash
ssh-keygen -t ed25519 -f ./deploy_key -N "" -C "<project>-deploy-key-readonly"
gh repo deploy-key add ./deploy_key.pub --repo <owner>/<repo> --title "<project>-vps-readonly"
```

Copy private key lên VPS, trỏ host `github.com` dùng key này trong `~/.ssh/config`:

```bash
scp ./deploy_key root@<vps-ip>:/root/.ssh/github_deploy_key
ssh root@<vps-ip> "chmod 600 /root/.ssh/github_deploy_key"
ssh root@<vps-ip> "cat >> /root/.ssh/config <<'EOF'

Host github.com
  HostName github.com
  User git
  IdentityFile /root/.ssh/github_deploy_key
  IdentitiesOnly yes
EOF
chmod 600 /root/.ssh/config"
```

### 2.5 Deploy key cho GitHub Actions SSH vào VPS

```bash
ssh-keygen -t ed25519 -f ./ci_to_vps -N "" -C "github-actions-deploy-<project>"
ssh root@<vps-ip> "echo '$(cat ./ci_to_vps.pub)' >> /root/.ssh/authorized_keys"

gh secret set VPS_SSH_KEY --repo <owner>/<repo> < ./ci_to_vps
gh secret set VPS_HOST --repo <owner>/<repo> -b "<vps-ip>"
gh secret set VPS_USER --repo <owner>/<repo> -b "root"
```

> **Không** dùng key SSH cá nhân của dev cho bước này — tạo key riêng, scope hẹp,
> dễ revoke (`gh secret remove` + xoá dòng trong `authorized_keys`) mà không ảnh
> hưởng quyền truy cập cá nhân của ai.

### 2.6 Workflow deploy (chain theo `workflow_run`)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  workflow_run:
    workflows:
      - "Publish <Service A> Docker image"
      - "Publish <Service B> Docker image"
    types: [completed]
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    if: ${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            set -e
            cd /opt/<project>
            git pull --ff-only
            cd <InfraDir>
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
            docker compose -f docker-compose.prod.yml exec -T api <migrate-command>
            docker compose -f docker-compose.prod.yml exec -T api <seed-command>   # nếu có RBAC/lookup data
            docker image prune -f
```

**Lý do `workflow_run` thay vì gộp deploy step vào cùng workflow build:** khi có
nhiều service build song song (matrix/nhiều workflow độc lập), deploy chỉ cần
chạy 1 lần sau khi tất cả build xong, không phải N lần.

---

## 3. VPS setup (lần đầu, làm tay 1 lần)

```bash
# 1. Cài Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# 2. Clone repo qua deploy key (section 2.4)
mkdir -p /opt/<project> && cd /opt/<project>
git clone git@github.com:<owner>/<repo>.git .

# 3. Tạo .env production với secrets ngẫu nhiên — KHÔNG copy nguyên .env.example
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 16   # DB password
# ... điền vào <InfraDir>/.env, chmod 600

# 4. Pull image + chạy lần đầu
cd <InfraDir>
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec api <migrate-command>
docker compose -f docker-compose.prod.yml exec api <seed-command>
```

### 3.1 `docker-compose.prod.yml` — dùng image GHCR, không build

Khác biệt cốt lõi với compose file dev (build từ source):

```yaml
services:
  api:
    image: ghcr.io/${GHCR_OWNER:-<owner>}/<image-backend>:${IMAGE_TAG:-main}
    env_file: [.env]
    ports: ["4000:4000"]
  frontend-x:
    image: ghcr.io/${GHCR_OWNER:-<owner>}/<image-frontend>:${IMAGE_TAG:-main}
    ports: ["8080:80"]
```

- Nếu VPS **chưa có domain** → bỏ gateway/nginx Host-routing, expose từng service
  qua port riêng (giống README dev). Có domain → bật lại nginx gateway + Cloudflare/SSL.
- `IMAGE_TAG` mặc định `main` (đè bản cũ liên tục). Muốn rollback theo version
  → đổi build workflow để tag theo Git SHA hoặc Git tag `vX.Y.Z`, rồi set
  `IMAGE_TAG` cụ thể trong `.env` khi cần pin version.

---

## 4. Quy trình code feature mới (sau khi đã setup xong)

```
1. Code trong <ServiceDir>/
2. git add . && git commit -m "..." && git push origin main
3. (tự động) GitHub Actions build & push image nếu path khớp filter
4. (tự động) deploy.yml trigger qua workflow_run khi build thành công
5. (tự động) VPS: git pull + docker compose pull/up -d + migrate + seed
```

Không cần SSH tay, không cần build tay — trừ khi:
- Đổi biến `NEXT_PUBLIC_*`/build-time env → phải sửa workflow build-args, không
  chỉ sửa `.env` trên VPS (xem 2.3 gotcha).
- Thêm service mới → cần Dockerfile mới + entry mới trong `docker-compose.prod.yml`
  + (nếu khác path) workflow build mới + thêm tên workflow đó vào
  `deploy.yml`'s `workflows:` list.

---

## 5. Checklist setup cho project mới

- [ ] Repo GitHub đã có (hoặc hợp nhất nhiều repo con thành 1)
- [ ] `.gitignore` che `.env`, `node_modules`, build artifacts — verify trước commit đầu
- [ ] Mỗi service có Dockerfile build độc lập (kiểm tra build context đúng nếu cần file chung — vd monorepo workspaces)
- [ ] 1 workflow `docker-publish-<service>.yml` mỗi service, `paths:` filter đúng thư mục
- [ ] Nếu nhiều app cùng loại (nhiều frontend) → dùng `matrix` thay vì N file riêng
- [ ] Deploy Key (read-only) cho VPS → GitHub, add qua `gh repo deploy-key add`
- [ ] CI deploy key (VPS access) riêng, KHÔNG dùng key cá nhân — add vào `authorized_keys` + `gh secret set`
- [ ] `docker-compose.prod.yml` dùng `image:` từ GHCR, không `build:`
- [ ] `.env` production sinh secrets ngẫu nhiên, không copy `.env.example`, `chmod 600`
- [ ] VPS: cài Docker, clone repo, pull image, chạy migrate + seed lần đầu
- [ ] `deploy.yml` với `workflow_run` trigger trỏ đúng tên workflow build
- [ ] Test end-to-end: trigger build workflow → verify deploy tự chạy → curl health endpoint của từng service
- [ ] Document IP/port mapping (hoặc domain) trong README cho người sau

---

## 6. Trade-offs đã chọn

| Decision | Alternative | Lý do chọn |
|---|---|---|
| `workflow_run` chain build → deploy | Gộp build+deploy 1 job | Nhiều service build song song, deploy chỉ cần chạy 1 lần sau khi tất cả xong |
| 2 SSH key riêng (CI→VPS, VPS→GitHub) | Dùng 1 key cá nhân cho mọi chiều | Tách quyền: VPS chỉ đọc GitHub, CI chỉ ghi VPS qua deploy — dễ revoke độc lập |
| Image tag `main` (đè liên tục) | Tag theo SHA/semver | Đơn giản cho project nhỏ; **đánh đổi mất khả năng rollback theo version** |
| Pull image build sẵn trên VPS | Build từ source trên VPS | VPS nhỏ (RAM thấp) không đủ build nhiều image cùng lúc; build trên CI runner mạnh hơn |
| GHCR packages public | Private + `docker login` trên VPS | Source không chứa secret nhạy cảm; bớt 1 bước auth khi pull |
| `paths:` filter theo service | Build tất cả mỗi lần push | Tiết kiệm CI minutes, deploy nhanh hơn khi chỉ đổi 1 phần |
| Secrets `.env` sinh random mỗi VPS | Copy `.env.example` | Tránh dùng password mặc định public trong source |

---

## 7. Discovery Questionnaire — khảo sát project đích

Mỗi project khác nhau. Trước khi áp blueprint, khảo sát đáp án các câu dưới.

### A. Source & build

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| A1 | Mỗi service đã có Dockerfile chưa? | Chưa có → phải viết mới trước khi viết workflow |
| A2 | Frontend có build-time env (`NEXT_PUBLIC_*`, `VITE_*`) bake vào bundle không? | Có → phải pass đúng `build-args` matching IP/domain đích, đổi IP phải build lại |
| A3 | Monorepo workspaces (npm/pnpm/yarn workspaces, Nx, Turborepo)? | Build context phải = root monorepo, không phải app dir riêng |
| A4 | Ngôn ngữ/runtime gì? (Node/Go/Python/Java/.NET) | Ảnh hưởng base image, multi-stage build pattern |

### B. Registry & packages

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| B1 | GHCR, Docker Hub, ECR, hay registry riêng (Harbor/Nexus)? | Login action + secret khác nhau (`docker/login-action` registry field) |
| B2 | Package public hay phải private? | Private → VPS cần `docker login` với PAT scope `read:packages` |
| B3 | Cần multi-arch build (arm64 cho M-series Mac/ARM server)? | Thêm `docker/setup-buildx-action` + `platforms: linux/amd64,linux/arm64` |

### C. Deploy target

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| C1 | VPS đơn (Docker Compose) hay cluster (K8s/Swarm/ECS)? | K8s → deploy step là `kubectl set image` / Helm upgrade, không phải SSH+compose |
| C2 | 1 VPS hay nhiều (dev + prod riêng)? | Cần workflow input/branch để chọn target, secrets riêng từng env |
| C3 | VPS đã có gì chạy sẵn chưa (services khác, port conflict)? | Phải khảo sát port đang dùng trước khi map port mới |
| C4 | Domain + SSL hay chỉ IP? | Domain → cấu hình nginx gateway + Cloudflare/Let's Encrypt; IP-only → route theo port |

### D. Database & state

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| D1 | Migration tool gì? (Prisma/golang-migrate/Flyway/Alembic) | Lệnh migrate trong deploy script khác nhau |
| D2 | Có seed data bắt buộc (RBAC roles, lookup tables)? | Quên seed → app lỗi runtime dù deploy "thành công" (xem ví dụ "Roles are not seeded yet") |
| D3 | DB managed (RDS/Cloud SQL) hay container cùng VPS? | Managed → không cần volume DB trong compose, connection string khác |
| D4 | Backup/restore đã có chưa? | Nên có trước khi auto-deploy production thật (xem BACKUP-FEATURE-BLUEPRINT.md) |

### E. Bảo mật / vận hành

| # | Câu hỏi | Tại sao quan trọng |
|---|---------|---------------------|
| E1 | Ai có quyền approve trước khi deploy prod? | Cần thêm GitHub `environment` với required reviewers, không auto-deploy thẳng |
| E2 | Cần rollback nhanh không? | Đổi tag `main` → tag theo SHA/semver + giữ N image cũ |
| E3 | Có audit log / thông báo khi deploy (Slack/Telegram)? | Thêm step `curl webhook` cuối `deploy.yml` |
| E4 | SSH host key đã pin (known_hosts) chưa, hay VPS có thể rebuild? | Rebuild → host key đổi → cần xác nhận thủ công trước khi tiếp tục (tránh MITM) |

---

## 8. Adaptation checklist (per target project)

```
[ ] A1 Dockerfile mỗi service       → viết mới nếu thiếu
[ ] A2 Build-time env               → build-args đúng IP/domain đích
[ ] A3 Monorepo workspaces          → build context = root, không phải app dir
[ ] B1 Registry                     → đổi registry field + login action
[ ] B2 Private package              → thêm docker login trên VPS với PAT
[ ] C1 Deploy target                → SSH+compose vs kubectl/Helm
[ ] C2 Multi-env (dev/prod)         → secrets riêng + workflow input chọn target
[ ] C4 Domain/SSL                   → nginx gateway + Cloudflare/Let's Encrypt config
[ ] D1 Migration command            → đổi lệnh trong deploy.yml script
[ ] D2 Seed step                    → thêm/bỏ bước seed sau migrate
[ ] E1 Approval gate                → GitHub environment + required reviewers
[ ] E2 Rollback strategy            → tag theo SHA/semver thay vì `main`
[ ] E3 Notification                 → webhook step cuối deploy.yml
```

---

## 9. Reusable interview prompt

Khi áp dụng cho project mới, hỏi trước khi code:

> Em đang định setup CI/CD build Docker image → GitHub Packages → auto-deploy
> VPS cho project này. Trước khi làm, em cần biết:
> - Mỗi service đã có Dockerfile chưa, build context có cần root monorepo không?
> - Frontend có biến `NEXT_PUBLIC_*`/`VITE_*` bake build-time không, IP/domain đích là gì?
> - Deploy đích là VPS đơn (Docker Compose) hay cluster?
> - Package cần public hay private trên registry?
> - Migration tool + có cần seed data bắt buộc không?
> - Có cần approval gate trước khi deploy prod không, hay auto-deploy thẳng từ `main`?
> - VPS đã có gì chạy sẵn (port nào đang dùng)?
>
> Em cần đáp án các câu trên trước khi viết workflow.
