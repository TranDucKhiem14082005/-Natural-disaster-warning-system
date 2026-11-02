# /cicd — Production-Standard CI/CD Pipeline

> *"Code that isn't on main doesn't exist in prod. A pipeline that doesn't pass doesn't get merged."*

Assumed stack: **GitHub Actions + Docker + GHCR + VPS (SSH deploy)**. Applicable to Go/Node/Python backends + React/Next.js frontends — only the `test`/`build` steps change per stack.

---

## 1. Overall Architecture

```
┌──────────┐  push branch   ┌─────────────────────────────────────────────────────────┐
│  LOCAL   │ ─────────────► │                         GITHUB                          │
│ Dev      │                │                                                          │
│ feature/*│                │  feature/* ──PR──► dev ──PR──► main                     │
└──────────┘                │       │              │            │                      │
                            │       ▼              ▼            ▼                      │
                            │  ┌─────────┐   ┌─────────┐  ┌─────────────┐             │
                            │  │ ci.yml  │   │ ci.yml  │  │ ci.yml      │             │
                            │  │ lint    │   │ lint    │  │ lint+test   │             │
                            │  │ test    │   │ test    │  │ +build dry  │             │
                            │  └────┬────┘   └────┬────┘  └──────┬──────┘             │
                            │       │ must pass    │ must pass    │ must pass           │
                            │       ▼              ▼              ▼                     │
                            │  Branch Protection (PR + status checks + no force push)  │
                            │                                      │ merge               │
                            │                                      ▼                     │
                            │                            ┌────────────────────┐         │
                            │                            │ deploy.yml         │         │
                            │                            │ ① version (semver) │         │
                            │                            │ ② test (gate)      │         │
                            │                            │ ③ build → GHCR     │         │
                            │                            │ ④ git tag          │         │
                            │                            │ ⑤ migrate DB       │         │
                            │                            │ ⑥ deploy VPS       │         │
                            │                            │ ⑦ health check     │         │
                            │                            │ ⑧ notify           │         │
                            │                            │ ⑨ auto-rollback    │         │
                            │                            └─────────┬──────────┘         │
                            └──────────────────────────────────────┼────────────────────┘
                                                                    │
                                          ┌─────────────────────────┴──────────────┐
                                          ▼ push images                            ▼ git tag
                            ┌───────────────────────────────────┐      ┌─────────────────────┐
                            │  GHCR (ghcr.io/<owner>/<repo>)    │      │  Stable release tag  │
                            │  backend:vX.Y.Z  frontend:vX.Y.Z  │      │  rollback anchor      │
                            │  + :latest  + :buildcache         │      └─────────────────────┘
                            └─────────────────┬───────────────────┘
                                              │ docker pull vX.Y.Z
                                              ▼
                            ┌───────────────────────────────────────────────────┐
                            │                      VPS                          │
                            │  Nginx (SSL) → backend / frontend / admin         │
                            │  Docker Compose (api, web, db, redis, nginx)      │
                            │  Health check → rollback on failure               │
                            └───────────────────────────────────────────────────┘
```

**Core principles:**
1. **Never deploy straight from `main` HEAD without a tag** — always deploy by semver tag (`vX.Y.Z`).
2. **CI gate before merge** — a PR that doesn't pass test/lint cannot be merged (enforced by branch protection).
3. **CD gate before going to prod** — the deploy job must re-run tests (don't trust the PR's CI alone), build the image, then deploy.
4. **Every deploy must end with a health check** — a failed health check means immediate auto-rollback or alert.
5. **All secrets live in GitHub Secrets / Environments** — no hardcoding, no committing `.env`.
6. **Concurrency control** — never allow 2 deploys to run in parallel on the same environment.

---

## 2. Branch Strategy

| Branch | Purpose | Deploy target | Protection |
|--------|----------|-------------|------------|
| `main` | Production code | Prod VPS (via tag) | Full — PR required, status checks, no force-push, no delete |
| `dev` | Integration / staging | Dev VPS (optional auto-deploy) | PR required, status checks |
| `feature/*` | New features | — | None |
| `fix/*` | Bug fixes | — | None |
| `hotfix/*` | Emergency prod fixes | Prod (via PR straight into main) | PR required, may skip dev |

**Tag convention:**

| Tag | Meaning | Trigger |
|-----|---------|---------|
| `vX.Y.Z-rc.N` | Release candidate — tested on dev | Manual tag after merging into `dev` |
| `vX.Y.Z` | Stable — approved for prod | Manual tag after QA passes on rc |

> Versioning follows [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`. Breaking change → bump MAJOR. New feature → bump MINOR. Bug fix → bump PATCH.

---

## 3. Branch Protection Rules (mandatory for `main`)

```yaml
# Settings → Branches → Branch protection rules → main

✅ Require a pull request before merging
  ✅ Require approvals (≥ 1)
  ✅ Dismiss stale approvals when new commits are pushed
  ✅ Require review from Code Owners (if CODEOWNERS exists)

✅ Require status checks to pass before merging
  ✅ Require branches to be up to date before merging
  - lint
  - test-backend
  - test-frontend
  - build-check

✅ Require conversation resolution before merging

✅ Do not allow force pushes
✅ Do not allow deletions
✅ Include administrators        # don't let admins bypass — avoid "careless self-merges"
```

---

## 4. CI Workflow — `ci.yml` (runs on every PR)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [main, dev]   # gives a status check on direct pushes too (hotfix)

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true   # new commit pushed to PR → cancel the old run, saves CI minutes

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Lint backend
        run: |
          cd backend && npm ci && npm run lint
      - name: Lint frontend
        run: |
          cd frontend && npm ci && npm run lint

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
        working-directory: backend
      - name: Run tests with coverage
        run: npm test -- --coverage
        working-directory: backend
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          directory: backend/coverage
          fail_ci_if_error: false

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
        working-directory: frontend
      - run: npm test -- --coverage
        working-directory: frontend
      - name: Build check
        run: npm run build
        working-directory: frontend

  build-check:
    needs: [lint, test-backend, test-frontend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Dry-run Docker build (no push)
        run: |
          docker build -t backend:ci-check ./backend
          docker build -t frontend:ci-check ./frontend

  security-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - name: Trivy vulnerability scan (filesystem)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: .
          severity: CRITICAL,HIGH
          exit-code: 0   # change to 1 to block the PR on severe vulnerabilities
```

**Why is each job separate?**
- Runs in parallel → faster feedback (lint finishes in 30s, no need to wait for a 5-minute test run).
- Status checks in branch protection point to each job individually → developers know exactly what failed.
- `build-check` ensures the Dockerfile isn't broken even if the app doesn't need a real build in CI yet.

---

## 5. CD Workflow — `deploy.yml` (runs on push to `main`)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:        # allows manual trigger for re-deploys

concurrency:
  group: deploy-production
  cancel-in-progress: false  # do NOT cancel an in-flight deploy — avoid a half-finished deploy

permissions:
  contents: write    # needed to push the git tag
  packages: write    # needed to push images to GHCR

env:
  REGISTRY: ghcr.io
  BACKEND_IMAGE: ghcr.io/${{ github.repository }}/backend
  FRONTEND_IMAGE: ghcr.io/${{ github.repository }}/frontend

jobs:
  # ① Version — compute the new version based on the latest tag
  version:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Compute next version
        id: version
        run: |
          LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
          VERSION=$(echo "$LATEST_TAG" | awk -F. '{print $1"."$2"."$3+1}')
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          echo "📦 Deploying version: $VERSION"

  # ② Test gate — do NOT trust the PR's own CI, re-run before building the image
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: backend/package-lock.json }
      - run: npm ci && npm test
        working-directory: backend

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: frontend/package-lock.json }
      - run: npm ci && npm test
        working-directory: frontend

  # ③ Build & push image (build only — do NOT deploy if tests fail; `needs` enforces this)
  build-backend:
    needs: [version, test-backend]
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: |
            ${{ env.BACKEND_IMAGE }}:${{ needs.version.outputs.version }}
            ${{ env.BACKEND_IMAGE }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  build-frontend:
    needs: [version, test-frontend]
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: |
            ${{ env.FRONTEND_IMAGE }}:${{ needs.version.outputs.version }}
            ${{ env.FRONTEND_IMAGE }}:latest
          build-args: |
            NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ④ Git tag — only tag AFTER a successful build, never before
  tag:
    needs: [version, build-backend, build-frontend]
    runs-on: ubuntu-latest
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Create and push tag
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git tag -a ${{ needs.version.outputs.version }} -m "Release ${{ needs.version.outputs.version }}"
          git push origin ${{ needs.version.outputs.version }}

  # ⑤ Migrate DB — BEFORE restarting the container, so the schema is ready for the new code
  migrate:
    needs: [version, tag]
    runs-on: ubuntu-latest
    environment: production   # attach an Environment to apply protection rules (required reviewers) if needed
    steps:
      - name: Run DB migration on VPS
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/app
            docker compose run --rm api npx prisma migrate deploy
            # or: docker compose exec -T api ./migrate up   (Go/golang-migrate)

  # ⑥ Deploy VPS — pull the new image + restart the container, do NOT touch db/redis
  deploy:
    needs: [version, build-backend, build-frontend, tag, migrate]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to VPS via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            set -e
            cd /opt/app
            echo "${{ secrets.GHCR_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

            export TAG=${{ needs.version.outputs.version }}
            docker compose pull api web

            # Zero-downtime: recreate only the changed services, NEVER --force-recreate db/redis
            docker compose up -d --no-deps api web

            docker image prune -f

  # ⑦ Health check — the final gate, failure triggers a rollback
  health-check:
    needs: [deploy]
    runs-on: ubuntu-latest
    steps:
      - name: Wait for service to be ready
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            for i in $(seq 1 10); do
              if curl -fsS http://localhost:8000/health; then
                echo "✅ Healthy"
                exit 0
              fi
              echo "⏳ Retry $i/10..."
              sleep 5
            done
            echo "❌ Health check failed after 10 retries"
            exit 1

  # ⑧ Auto-rollback — only runs when health-check fails
  rollback:
    needs: [version, health-check]
    if: failure()
    runs-on: ubuntu-latest
    steps:
      - name: Rollback to previous stable tag
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/app
            PREV_TAG=$(git -C /opt/app/repo tag --sort=-creatordate | sed -n '2p')
            export TAG=$PREV_TAG
            docker compose pull api web
            docker compose up -d --no-deps api web
            echo "🔙 Rolled back to $PREV_TAG"

  # ⑨ Notify — always runs (success or failure), reports to Telegram/Slack
  notify:
    needs: [version, deploy, health-check, rollback]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Send Telegram notification
        uses: appleboy/telegram-action@master
        with:
          to: ${{ secrets.TELEGRAM_CHAT_ID }}
          token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          format: markdown
          message: |
            ${{ needs.health-check.result == 'success' && '✅' || '❌' }} *Deploy ${{ needs.version.outputs.version }}*

            Repository: `${{ github.repository }}`
            Branch: `${{ github.ref_name }}`
            Commit: `${{ github.sha }}`
            Health check: *${{ needs.health-check.result }}*
            Rollback: *${{ needs.rollback.result || 'not triggered' }}*

            [View run](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})
```

**Important fixes compared to a basic pipeline:**

| Common problem | Fix in the pipeline above |
|---|---|
| Tag created before the build → garbage tag if the build fails | `tag` job only runs after `build-backend` + `build-frontend` succeed |
| Migration runs after the container has already restarted → new code hits the old schema | `migrate` job runs BEFORE `deploy`, sitting between `tag` and `deploy` |
| Deploy fails silently, nobody notices | `health-check` retries 10 times x 5s, failure → exit code 1 → triggers `rollback` |
| No automatic rollback | `rollback` job only runs `if: failure()` after `health-check`, picks the immediately preceding tag |
| 2 deploys run in parallel and clobber each other | `concurrency: group: deploy-production, cancel-in-progress: false` |
| Slow Docker build cache | `cache-from/cache-to: type=gha` (built-in GitHub Actions cache, faster than registry cache) |
| Secrets/permissions too broad | `permissions:` declared minimally at the workflow level, overridden per-job only when `packages: write` is needed |
| No review gate for prod deploys | `environment: production` — configure Required reviewers in Settings → Environments |

---

## 6. GitHub Environments (manual gate for prod)

```
Settings → Environments → New environment → "production"

✅ Required reviewers: [tech lead, devops]   # deploy must be approved by someone before it runs
✅ Wait timer: 0-5 minutes (per policy)
✅ Deployment branches: only allow from `main`

Secrets specific to the "production" environment:
  VPS_HOST, VPS_USER, VPS_SSH_KEY, GHCR_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
```

> When a job has `environment: production`, GitHub **pauses that job** waiting for approval if Required reviewers are set — this is the final manual gate before touching prod, independent of CI tests.

---

## 7. GHCR Registry

### Image Naming Convention
```
ghcr.io/{owner}/{repo}/{service}:{version}

ghcr.io/myorg/myproject/backend:v1.21.6
ghcr.io/myorg/myproject/frontend:v1.21.6
```

### Image Tags

| Tag | Description |
|-----|-------|
| `vX.Y.Z` | Specific version (immutable) — used for deploy + rollback |
| `latest` | Most recent stable build — do NOT use for production deploys (no pinned version = no precise rollback) |

### Manual Rollback (when done by hand, without the workflow)

```bash
ssh user@vps
cd /opt/app
export TAG=v1.21.5
docker compose pull api web
docker compose up -d --no-deps api web
curl -f http://localhost:8000/health
```

---

## 8. Pre-deploy Checklist

- [ ] Branch protection on `main` has all 8 items from Section 3 enabled
- [ ] GitHub Environment `production` has Required reviewers
- [ ] All secrets are set: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `GHCR_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- [ ] Base `docker-compose.yml` has NO named volume for the DB (see `docker.md` Section 13) — host-path only
- [ ] Health endpoint `/health` returns 200 within < 5s after container start
- [ ] Migration command matches the ORM/tool in use (Prisma/golang-migrate/Alembic/...)
- [ ] Rollback job has been tested at least once on dev before trusting it in prod
- [ ] `.dockerignore` excludes `.git`, `node_modules`, `.env` (see `docker.md` Section 12)

---

## 9. Anti-patterns (avoid)

| Wrong | Right |
|-----|------|
| Tagging the version BEFORE build/test | Tag ONLY AFTER build + test pass |
| Deploying straight from `main` HEAD without a tag | Always deploy a specific `vX.Y.Z`, easy to roll back |
| Using `:latest` to deploy prod | Pin a specific version — `:latest` is for reference only |
| No health check after deploy | Always retry the health check + auto-rollback on failure |
| Migration runs AFTER the container restarts | Migration runs BEFORE, ensuring the schema is ready |
| `docker compose up -d --force-recreate` (everything) | Only `--no-deps <service>` — never recreate db or redis |
| Allowing 2 deploys to run in parallel | `concurrency: group: deploy-production` |
| Hardcoded secrets in the workflow YAML | Everything through `secrets.*` / `vars.*` |
| No required reviewer for prod | GitHub Environment + Required reviewers |
| Trusting CI passing on the PR is enough, 100% trust on merge | CD still re-runs tests before building the image (double gate) |

---

## 10. Related References

- VPS / Docker Compose / Nginx / Systemd details → [`docker.md`](../references/docker.md)
- Manual Dev → Prod deploy process when CI/CD isn't set up yet → [`deploy-workflow.md`](../references/deploy-workflow.md)
- Hardening the VPS before opening traffic → `/harden`
- Setting up SSH key + GitHub deploy → `/ssh-vps`
