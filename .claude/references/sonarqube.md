# SonarQube — Self-hosted Code Quality Setup (Go + React)

> Activate: khi project cần static code analysis, code coverage tracking, quality gate trước khi merge.
> Stack: SonarQube Community Edition (self-hosted, Docker) + Go backend + React frontend, chung 1 VPS hoặc tách dev/prod theo `multi-app-infra.md`.

---

## 1. Kiến trúc

```
┌─────────────────────────────────────────────────────────┐
│  CI (GitHub Actions) hoặc Local dev machine              │
│   ┌────────────────────┐   ┌────────────────────┐       │
│   │ go test -coverprofile│   │ npm test -- --coverage│   │
│   └──────────┬───────────┘   └──────────┬───────────┘   │
│              │ lcov/cobertura            │ lcov          │
│              └────────────┬──────────────┘               │
│                    sonar-scanner CLI                      │
└────────────────────────────┬──────────────────────────────┘
                             │ HTTP POST analysis report
                             ▼
                ┌─────────────────────────────┐
                │ SonarQube Server (Docker)    │
                │  - Web UI :9000              │
                │  - PostgreSQL (metadata)     │
                │  - Elasticsearch (bundled)   │
                └─────────────────────────────┘
                             │
                             ▼
                  Quality Gate pass/fail
                  → block merge nếu fail (CI status check)
```

**Nguyên tắc cốt lõi:**
1. SonarQube Community Edition là **miễn phí**, đủ cho static analysis + coverage — không cần Developer/Enterprise edition trừ khi cần branch analysis hoặc PR decoration nâng cao.
2. **Mỗi module (Go backend, React frontend) là 1 project key riêng** trên SonarQube — dễ theo dõi quality gate độc lập, dễ set rule riêng theo ngôn ngữ.
3. **Coverage phải sinh ra TRƯỚC khi chạy sonar-scanner** — SonarQube không tự chạy test, chỉ đọc report có sẵn (lcov, cobertura).
4. **Quality Gate là gate thật** — set ngưỡng (coverage, duplications, code smells) và chặn merge nếu fail, không chỉ hiển thị cho vui.
5. **Không expose port 9000 ra Internet** — chỉ dùng nội bộ VPS hoặc qua Nginx + basic auth, giống pattern Prometheus trong `monitoring.md`.

---

## 2. Docker Compose — SonarQube Server

### 2.1 `docker-compose.yml` (thêm vào infra hiện có)

```yaml
volumes:
  sonarqube_data:
  sonarqube_extensions:
  sonarqube_logs:
  sonarqube_db_data:

services:
  sonarqube:
    image: sonarqube:10-community
    container_name: <app>-sonarqube
    depends_on:
      sonarqube_db:
        condition: service_healthy
    environment:
      SONAR_JDBC_URL: jdbc:postgresql://sonarqube_db:5432/sonar
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: ${SONAR_DB_PASSWORD}
    volumes:
      - sonarqube_data:/opt/sonarqube/data
      - sonarqube_extensions:/opt/sonarqube/extensions
      - sonarqube_logs:/opt/sonarqube/logs
    ports:
      - "127.0.0.1:9000:9000"   # chỉ bind localhost — không expose ra ngoài
    networks: [<app>-net]
    restart: unless-stopped
    ulimits:
      nofile: { soft: 131072, hard: 131072 }
      nproc: { soft: 8192, hard: 8192 }

  sonarqube_db:
    image: postgres:16-alpine
    container_name: <app>-sonarqube-db
    environment:
      POSTGRES_USER: sonar
      POSTGRES_PASSWORD: ${SONAR_DB_PASSWORD}
      POSTGRES_DB: sonar
    volumes:
      - sonarqube_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sonar"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [<app>-net]
    restart: unless-stopped
```

> **Production:** đổi sang host-path volume thay vì named volume (xem `docker.md` Section 13) để dữ liệu sống sót qua `docker compose down`.

```yaml
# docker-compose.prod.yml override
services:
  sonarqube:
    volumes:
      - /opt/<app>/sonarqube/data:/opt/sonarqube/data
      - /opt/<app>/sonarqube/extensions:/opt/sonarqube/extensions
      - /opt/<app>/sonarqube/logs:/opt/sonarqube/logs
  sonarqube_db:
    volumes:
      - /opt/<app>/sonarqube/postgres:/var/lib/postgresql/data
```

### 2.2 Host kernel requirement (Elasticsearch bundled trong SonarQube cần)

```bash
# Bắt buộc trên Linux host — SonarQube sẽ crash nếu thiếu
sudo sysctl -w vm.max_map_count=524288
sudo sysctl -w fs.file-max=131072

# Persist sau reboot
echo "vm.max_map_count=524288" | sudo tee -a /etc/sysctl.conf
echo "fs.file-max=131072" | sudo tee -a /etc/sysctl.conf
```

### 2.3 Host-path setup (prod)

```bash
mkdir -p /opt/<app>/sonarqube/{data,extensions,logs,postgres}
chown -R 1000:1000 /opt/<app>/sonarqube/data /opt/<app>/sonarqube/extensions /opt/<app>/sonarqube/logs
chown -R 999:999 /opt/<app>/sonarqube/postgres
```

### 2.4 Nginx reverse proxy (nội bộ, basic auth)

```nginx
location /sonarqube/ {
    auth_basic           "SonarQube";
    auth_basic_user_file /etc/nginx/sonar_auth;
    proxy_pass http://sonarqube:9000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_http_version 1.1;
}
```

```bash
htpasswd -cb nginx/sonar_auth sonar_user <strong-password>
```

> Nếu cần URL gốc `/` thay vì `/sonarqube/`, set `SONAR_WEB_CONTEXT=/sonarqube` trong env của container và sửa `sonar.host.url` tương ứng trong `sonar-project.properties`.

---

## 3. First-time Setup (UI)

1. Truy cập `http://127.0.0.1:9000` (hoặc qua SSH tunnel: `ssh -L 9000:127.0.0.1:9000 my-vps`)
2. Login mặc định: `admin` / `admin` → bắt buộc đổi password ngay
3. **My Account → Security → Generate Token** → đặt tên `ci-scanner` → lưu lại (chỉ hiện 1 lần)
4. Tạo project key cho từng module:
   - **Administration → Projects → Create Project** → `<app>-backend` và `<app>-frontend`
   - Hoặc để sonar-scanner tự tạo khi chạy lần đầu (Local Scanner method)
5. **Quality Gates → Create** (hoặc dùng "Sonar way" mặc định) → set điều kiện (xem Section 6)

---

## 4. Backend (Go) — sonar-project.properties

**File:** `backend/sonar-project.properties`

```properties
sonar.projectKey=<app>-backend
sonar.projectName=<App> Backend
sonar.sources=.
sonar.exclusions=**/*_test.go,**/vendor/**,**/mocks/**,**/migrations/**
sonar.tests=.
sonar.test.inclusions=**/*_test.go
sonar.go.coverage.reportPaths=coverage.out
sonar.go.golangci-lint.reportPaths=golangci-lint-report.xml
sonar.sourceEncoding=UTF-8
```

### Sinh coverage report trước khi scan

```bash
cd backend
go test ./... -coverprofile=coverage.out -covermode=atomic

# Optional: golangci-lint report (SonarQube đọc được report XML dạng checkstyle)
golangci-lint run --out-format checkstyle ./... > golangci-lint-report.xml || true
```

---

## 5. Frontend (React) — sonar-project.properties

**File:** `frontend/sonar-project.properties`

```properties
sonar.projectKey=<app>-frontend
sonar.projectName=<App> Frontend
sonar.sources=src
sonar.exclusions=**/*.test.{js,jsx,ts,tsx},**/node_modules/**,**/dist/**,**/*.stories.{js,jsx,ts,tsx}
sonar.tests=src
sonar.test.inclusions=**/*.test.{js,jsx,ts,tsx}
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.typescript.lcov.reportPaths=coverage/lcov.info
sonar.sourceEncoding=UTF-8
```

### Sinh coverage report trước khi scan

```bash
cd frontend
npm test -- --coverage --watchAll=false
# Jest mặc định xuất ra coverage/lcov.info nếu coverageReporters có "lcov"
```

**Jest config cần có** (`jest.config.js` hoặc `package.json`):
```json
{
  "coverageReporters": ["lcov", "text"]
}
```

---

## 6. Quality Gate — Ngưỡng đề xuất

| Điều kiện | Ngưỡng đề xuất | Lý do |
|---|---|---|
| Coverage on New Code | >= 70% | Bắt buộc code mới phải có test, không touch nợ kỹ thuật cũ |
| Duplicated Lines on New Code | < 3% | Hạn chế copy-paste |
| Maintainability Rating on New Code | A | Code smell ở mức chấp nhận được |
| Reliability Rating on New Code | A | Không có bug nghiêm trọng |
| Security Rating on New Code | A | Không có lỗ hổng nghiêm trọng |
| Security Hotspots Reviewed | 100% | Bắt buộc review thủ công mọi hotspot |

> Áp dụng **"on New Code"** (không phải toàn bộ codebase) — tránh chặn merge vì nợ kỹ thuật cũ chưa kịp dọn. Sửa dần qua thời gian.

---

## 7. Chạy Scanner — Local / CI

### 7.1 Cài sonar-scanner CLI

```bash
# Linux/Mac
brew install sonar-scanner
# hoặc tải binary: https://docs.sonarsource.com/sonarqube/latest/analyzing-source-code/scanners/sonarscanner/
```

### 7.2 Chạy thủ công (local dev)

```bash
cd backend
go test ./... -coverprofile=coverage.out -covermode=atomic
sonar-scanner \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=<TOKEN_FROM_STEP_3>

cd ../frontend
npm test -- --coverage --watchAll=false
sonar-scanner \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=<TOKEN_FROM_STEP_3>
```

### 7.3 GitHub Actions — quality gate chặn merge

```yaml
# .github/workflows/sonarqube.yml
name: SonarQube Analysis

on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [main, dev]

jobs:
  sonar-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }   # cần full history cho blame/new-code analysis
      - uses: actions/setup-go@v5
        with: { go-version: '1.23' }
      - name: Run tests with coverage
        working-directory: backend
        run: go test ./... -coverprofile=coverage.out -covermode=atomic
      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@v4
        with:
          projectBaseDir: backend
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
      - name: Quality Gate check
        uses: SonarSource/sonarqube-quality-gate-action@master
        timeout-minutes: 5
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  sonar-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Run tests with coverage
        working-directory: frontend
        run: npm ci && npm test -- --coverage --watchAll=false
      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@v4
        with:
          projectBaseDir: frontend
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
      - name: Quality Gate check
        uses: SonarSource/sonarqube-quality-gate-action@master
        timeout-minutes: 5
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

**Secrets cần thêm vào GitHub repo:**
```
SONAR_TOKEN     = token tạo ở Section 3 (dùng riêng 1 token cho CI, không dùng token cá nhân)
SONAR_HOST_URL  = https://<your-domain>/sonarqube  (hoặc IP nếu chưa có domain — KHÔNG dùng localhost vì runner GitHub ở ngoài VPS)
```

> Nếu SonarQube chạy nội bộ trên VPS không public — cần self-hosted GitHub Actions runner đặt trên cùng VPS/network, hoặc mở Nginx proxy có basic auth ra ngoài tạm thời cho CI gọi vào.

**Wire vào Branch Protection** (xem `cicd.md` Section 3): thêm `sonar-backend` và `sonar-frontend` vào danh sách required status checks.

---

## 8. Upgrade / Maintenance

```bash
# Backup trước khi upgrade — bắt buộc
docker compose exec sonarqube_db pg_dump -U sonar sonar > sonar_backup_$(date +%F).sql

# Upgrade: đổi tag image → up lại
# sonarqube:10-community → sonarqube:25.x-community (check changelog trước khi nhảy version lớn)
docker compose pull sonarqube
docker compose up -d --no-deps sonarqube
# UI sẽ tự hiện "Database migration required" → bấm Upgrade trong Admin UI
```

---

## 9. Checklist Setup

```
Infra
- [ ] vm.max_map_count + fs.file-max đã set trên host (Section 2.2)
- [ ] sonar-compose service thêm vào docker-compose.yml + prod override host-path
- [ ] SONAR_DB_PASSWORD sinh random, không commit vào git
- [ ] Port 9000 chỉ bind 127.0.0.1, không expose ra Internet
- [ ] Nginx proxy + basic auth nếu cần truy cập từ ngoài VPS

SonarQube UI
- [ ] Đổi password admin mặc định
- [ ] Tạo token CI riêng (không dùng token cá nhân) → lưu vào GitHub Secrets
- [ ] Tạo project key cho backend + frontend
- [ ] Set Quality Gate theo Section 6 (hoặc dùng Sonar way mặc định trước, siết dần sau)

Backend (Go)
- [ ] sonar-project.properties tại root backend
- [ ] go test -coverprofile sinh ra coverage.out đúng path khai báo
- [ ] (optional) golangci-lint report tích hợp

Frontend (React)
- [ ] sonar-project.properties tại root frontend
- [ ] jest coverageReporters có "lcov"
- [ ] npm test -- --coverage sinh ra coverage/lcov.info đúng path khai báo

CI/CD
- [ ] SONAR_TOKEN + SONAR_HOST_URL trong GitHub Secrets
- [ ] Workflow sonarqube.yml chạy trên mọi PR vào main/dev
- [ ] Quality Gate action chặn merge khi fail
- [ ] sonar-backend + sonar-frontend thêm vào Branch Protection required checks
```

---

## 10. Anti-patterns

- Expose port 9000 ra Internet không auth — leak toàn bộ source code quality data + có thể bị brute-force admin.
- Chạy sonar-scanner mà không sinh coverage report trước — Quality Gate sẽ luôn báo "No coverage info" dù code có test đầy đủ.
- Set Quality Gate áp dụng cho toàn bộ codebase thay vì "on New Code" — chặn merge vô tận vì nợ kỹ thuật cũ chưa kịp dọn.
- Dùng named Docker volume cho `sonarqube_db_data` trên prod — mất toàn bộ lịch sử phân tích khi `docker compose down -v`.
- Dùng chung 1 token cá nhân cho CI và local dev — khó revoke độc lập khi cần.
- Bỏ qua `vm.max_map_count` — container Elasticsearch bundled bên trong SonarQube sẽ crash loop ngay khi khởi động.
- Nhảy nhiều major version cùng lúc khi upgrade (vd: 9.x → 25.x thẳng) — phải đọc changelog, có thể cần qua bước trung gian.

---

## 11. Khi nào dùng /sonarqube (reference này)

- Project cần track code quality/coverage theo thời gian, không chỉ chạy lint một lần.
- Cần quality gate chặn merge tự động trong CI/CD (`cicd.md`).
- Muốn audit security hotspot + code smell tập trung cho team nhiều người.
- Không cần nếu team nhỏ, dùng eslint/golangci-lint + CI test pass là đủ — SonarQube thêm overhead vận hành (thêm 1 service phải maintain + backup).
