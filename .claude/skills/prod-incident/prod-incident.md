# /prod-incident — Production Incident Response Playbook

> Activate: khi production có lỗi (API 404/500, tính năng đột ngột mất, user không đăng nhập được).
> Stack: Go backend + Docker Compose + Nginx + PostgreSQL/Redis trên VPS.
> Always check container state + git state trước khi làm bất cứ điều gì.

---

## When to Trigger

- User báo lỗi trên production (404, 500, tính năng không hoạt động)
- API endpoint đột ngột trả về sai status code
- Login / auth flow bị lỗi
- Tính năng đã deploy nhưng không hoạt động trên prod

---

## Incident Pattern Registry

Có 4 pattern phổ biến. Chẩn đoán theo thứ tự — Pattern 1 hay gặp nhất.

---

### Pattern 1 — Binary Out of Sync (backend chạy code cũ)

**Triệu chứng:**
- Route mới → 404 (route không tồn tại trong binary cũ)
- Route cũ → 500 (schema mismatch giữa code cũ và DB mới)
- Backend healthy nhưng tính năng đã deploy vẫn không hoạt động
- Logs không có request nào đến route đó

**Root cause:** `git checkout <tag>` nhiều lần trên prod VPS khiến `main` branch bị tụt về commit cũ. Docker image được build từ `main` → binary thiếu route/handler mới.

**Verify:**
```bash
# Check commit main đang ở đâu
ssh <prod-vps> "cd /opt/<app>/<backend-repo> && git log --oneline -3 && git tag --sort=-creatordate | head -3"

# So sánh với stable tag
ssh <prod-vps> "cd /opt/<app>/<backend-repo> && git log --oneline <stable-tag>..HEAD"
# Nếu output RỖNG → HEAD đang ở trước stable tag → đây là root cause

# Check reflog để hiểu lịch sử checkout
ssh <prod-vps> "cd /opt/<app>/<backend-repo> && git reflog --oneline -10"
```

**Fix:**
```bash
# 1. Checkout đúng stable tag
ssh <prod-vps> "cd /opt/<app>/<backend-repo> && git checkout <stable-tag>"

# 2. Verify code có route/handler bị thiếu
ssh <prod-vps> "cd /opt/<app>/<backend-repo> && grep -r '<missing-route>' internal/"

# 3. Rebuild image (cần explicit prod deploy approval trước)
ssh <prod-vps> "cd /opt/<app>/infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache api"

# 4. Restart container (chỉ api, không touch db/redis)
ssh <prod-vps> "cd /opt/<app>/infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps api"

# 5. Fix permanent: reset main về đúng stable tag
ssh <prod-vps> "cd /opt/<app>/<backend-repo> && git checkout main && git reset --hard <stable-tag>"
```

**Prevention:**
- Sau mỗi lần `git checkout <tag>` trên prod → `git checkout main` ngay
- Trước khi build image: `git log --oneline -1` để confirm đang ở đúng commit
- Không bao giờ build từ `main` nếu `main` chưa được verify

---

### Pattern 2 — Container Down / Crashed

**Triệu chứng:**
- Tất cả API routes → 502 Bad Gateway (nginx không connect được backend)
- Health check fail

**Verify:**
```bash
ssh <prod-vps> "cd /opt/<app>/infra && docker compose ps"
# api container không ở trạng thái "Up" hoặc status "Restarting"

ssh <prod-vps> "cd /opt/<app>/infra && docker compose logs api --tail 30"
# Tìm panic, OOM, crash message
```

**Fix:**
```bash
# Nếu container đang restart loop → check logs trước
ssh <prod-vps> "cd /opt/<app>/infra && docker compose logs api --tail 50 2>&1 | grep -i 'panic\|fatal\|error'"

# Restart container
ssh <prod-vps> "cd /opt/<app>/infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps api"

# Nếu vẫn crash → check env vars
ssh <prod-vps> "docker exec <app>-api-1 env | grep -E 'DB_|REDIS_|JWT_'"
```

---

### Pattern 3 — DB / Redis Connection Issue

**Triệu chứng:**
- API routes return 500 (không phải 404)
- Backend container đang chạy (healthy)
- Login return 500 INTERNAL_ERROR
- Logs có `connection refused` hoặc `dial tcp`

**Verify:**
```bash
# Check DB container
ssh <prod-vps> "docker exec <app>-db-1 pg_isready -U <dbuser>"

# Check Redis
ssh <prod-vps> "docker exec <app>-redis-1 redis-cli ping"

# Check từ trong api container
ssh <prod-vps> "docker exec <app>-api-1 wget -qO- http://localhost:8080/health"
```

**Fix:**
```bash
# Restart DB (cẩn thận — check host-path volume trước)
ssh <prod-vps> "docker inspect <app>-db-1 --format '{{range .Mounts}}{{.Type}} {{.Source}}{{println}}{{end}}'"
# Phải thấy host-path /opt/<app>/data/postgres, không phải named volume

ssh <prod-vps> "cd /opt/<app>/infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart db"
ssh <prod-vps> "cd /opt/<app>/infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart redis"
```

---

### Pattern 4 — Nginx Routing Broken

**Triệu chứng:**
- Một số routes 404, một số 200
- Static assets load được nhưng API fail
- Nginx logs không có request đến `/api/`

**Verify:**
```bash
# Test trực tiếp từ backend container (bypass nginx)
ssh <prod-vps> "docker exec <app>-api-1 wget -qO- --post-data='{}' --header='Content-Type: application/json' http://localhost:8080/api/auth/login"

# Nếu backend trả đúng → nginx bị lỗi routing
# Check nginx config đang dùng
ssh <prod-vps> "docker exec <app>-nginx-1 nginx -T 2>&1 | grep -A5 'location /api'"
```

**Fix:**
```bash
# Reload nginx (không restart)
ssh <prod-vps> "docker exec <app>-nginx-1 nginx -s reload"

# Nếu config sai → update nginx.prod.conf và reload
```

---

## Step-by-Step Diagnosis Flow

```
Production có lỗi
        ↓
Step 1 — Xác định scope
  curl https://<domain>/api/health  → 200? 502? 404?
        ↓
Step 2 — Check containers
  docker compose ps  → tất cả "Up (healthy)"?
        ↓
Step 3 — Test bypass nginx
  docker exec api wget http://localhost:8080/api/<route>
  ├─ 404 → Pattern 1 (binary cũ) hoặc Pattern 4 (nginx)
  ├─ 500 → Pattern 3 (DB/Redis) hoặc code bug
  └─ 200 → Pattern 4 (nginx routing)
        ↓
Step 4 — Check git state (nếu Pattern 1)
  git log --oneline -3
  git log --oneline <stable-tag>..HEAD  → rỗng = HEAD trước stable tag
        ↓
Step 5 — Fix theo pattern tương ứng
        ↓
Step 6 — Verify sau fix
  curl https://<domain>/api/<affected-route>
  curl https://<domain>/api/auth/login -d '{"email":"wrong","password":"x"}'
  → phải trả 401 INVALID_CREDENTIALS (không phải 500 hay 404)
```

---

## Quick Diagnostic Commands

```bash
# All-in-one: check containers + git state + test health
ssh <prod-vps> "
  echo '=== Containers ===' &&
  cd /opt/<app>/infra && docker compose ps &&
  echo '=== Backend git ===' &&
  cd /opt/<app>/<backend-repo> && git log --oneline -3 &&
  echo '=== Health ===' &&
  docker exec <app>-api-1 wget -qO- http://localhost:8080/health
"

# Test specific route trực tiếp trên backend
ssh <prod-vps> "docker exec <app>-api-1 wget -qO- \
  --post-data='{\"email\":\"test@test.com\"}' \
  --header='Content-Type: application/json' \
  http://localhost:8080/api/auth/forgot-password"

# Kiểm tra image build từ commit nào (so với container đang chạy)
ssh <prod-vps> "docker inspect <app>-api-1 --format 'Created: {{.Created}} | Image: {{.Config.Image}}'"
```

---

## Adapter Rules — Đổi khi clone sang app mới

| Item | Đổi sang |
|---|---|
| SSH alias | SSH alias của app mới |
| App path | `/opt/<app>/` |
| Infra folder | `<app>-infra` |
| Container prefix | `<app>-api-1` |
| Backend repo | `<app>-backend` |
| Stable tag | stable tag hiện tại của app |
| DB container | `<app>-db-1` |
| DB user | DB user của app mới |
| DB name | DB name của app mới |

## Những gì KHÔNG cần đổi

- Toàn bộ git diagnosis commands (generic)
- Docker compose flag `-f docker-compose.yml -f docker-compose.prod.yml`
- `--no-deps api` flag khi restart (không bao giờ restart db/redis cùng lúc)
- Thứ tự: diagnose → verify → fix → verify lại

---

## Production Deploy Gate (MANDATORY)

Trước khi thực hiện bất kỳ fix nào trên prod:

1. **Diagnose trước** — không làm gì khi chưa biết root cause
2. **Báo cáo findings** — nói rõ root cause và fix plan
3. **Chờ approval** — user phải nói **"đồng ý triển khai lên production"**
4. **Confirm lần nữa** nếu fix là rebuild + restart container
5. **Verify sau fix** — test endpoint bị ảnh hưởng trước khi báo xong

**Exception:** Kiểm tra logs (read-only SSH) không cần approval. Chỉ cần approval khi:
- Rebuild Docker image
- Restart container
- Thay đổi file trên VPS
- Chạy migration

---

## Checklist Sau Khi Fix

- [ ] Endpoint bị ảnh hưởng trả đúng status code
- [ ] `docker compose ps` — tất cả containers Up (healthy)
- [ ] Backend logs không có ERROR trong 2 phút sau restart
- [ ] `main` branch trên prod VPS đang ở đúng stable tag
- [ ] Update deploy baseline (version history + git state)

---

## Lessons Learned từ Incidents Thực Tế

### Pattern 1 — Example (2026-06-11)

- **Incident:** `POST /api/auth/forgot-password` → 404, `POST /api/auth/login` → 500 trên prod
- **Root cause:** Reflog cho thấy `git checkout v2.22.0` → `git checkout main` → `main` vẫn ở `v2.0.0`. Docker image build từ `main` → binary thiếu route forgot-password.
- **Signal:** `git log --oneline <stable-tag>..HEAD` rỗng = HEAD trước stable tag
- **Fix:** checkout stable tag → rebuild image → restart api → reset `main` về stable tag
- **Time to fix:** ~20 phút (build image ~15 phút + restart + verify ~5 phút)
- **Prevention added:** Sau mỗi deploy workflow, chạy `git log --oneline -1` để confirm commit trước khi build

