---
description: Hardening checklist VPS — 5 mandatory rules before going prod (SSH key, firewall, fail2ban, non-root app, reverse proxy). Each item has CHECK + FIX + VERIFY.
---

# /harden — VPS Hardening

> *"No matter how clean the code is, if the server is exposed it counts for 0."*

Scope: VPS server (Ubuntu, `root@<your-server>`). Do NOT touch app code — only adjust OS + nginx + docker.

Rules when running:
1. Each principle → CHECK first, FIX next, VERIFY last.
2. Every SSH/firewall change → **keep 1 old SSH session open** to avoid locking yourself out.
3. Back up the config file before editing (`cp /etc/X /etc/X.bak-$(date +%F)`).

---

## 1️⃣ SSH key + disable password / root login

**WHY:** Password brute-force is attack vector #1 on a public VPS. Key authentication + disabling direct root blocks 99% of bots.

**CHECK** (what is enabled):
```bash
ssh my-vps 'grep -rh -E "(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication)" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null'
```

> ⚠️ **STOP if the server only has the `root` user** — you must create a deploy user + verify login works BEFORE touching the SSH config. If locked out, you must use the VPS provider's web console to recover (there is no other shortcut).

**PRE-FIX — create a deploy user (required if it does not exist yet):**
```bash
# Run on the VPS, replace 'deploy' with the username you want
ssh my-vps 'adduser --disabled-password --gecos "" deploy && \
  mkdir -p /home/deploy/.ssh && \
  cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys && \
  chown -R deploy:deploy /home/deploy/.ssh && \
  chmod 700 /home/deploy/.ssh && \
  chmod 600 /home/deploy/.ssh/authorized_keys && \
  usermod -aG sudo deploy'

# Verify login works with the new user FROM A DIFFERENT TERMINAL before continuing:
ssh -i ~/.ssh/<your-key> deploy@<vps-ip> "whoami"
# Must print "deploy" — if you cannot get in then STOP, do not do the next step.

# After verifying OK, update ~/.ssh/config on the local machine to use the deploy user:
# Host my-vps
#   User deploy   ← change from root to deploy
#   ...
# Test the new alias: ssh my-vps "whoami"  — must print "deploy"
```

**FIX (only do this after verifying the deploy user login works):**
```bash
# Remove stale files from cloud-init if there is a conflict:
ssh my-vps 'ls /etc/ssh/sshd_config.d/'
# If any file has PermitRootLogin yes → remove it: rm /etc/ssh/sshd_config.d/<file>

# Patch 50-cloud-init.conf if present (it overrides PasswordAuthentication):
ssh my-vps 'grep -l "PasswordAuthentication yes" /etc/ssh/sshd_config.d/*.conf 2>/dev/null | \
  xargs -I{} sed -i "s/PasswordAuthentication yes/PasswordAuthentication no/" {}'

# Only use prohibit-password (do NOT use no) — root can still get in with a key,
# avoiding locking yourself out if the deploy user has a problem.
ssh my-vps 'cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak-$(date +%F) && \
  sed -i "s/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/" /etc/ssh/sshd_config && \
  sed -i "s/^#*PasswordAuthentication.*/PasswordAuthentication no/" /etc/ssh/sshd_config && \
  sed -i "s/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/" /etc/ssh/sshd_config && \
  sshd -t && systemctl reload ssh'
# Use "systemctl reload ssh" (Ubuntu) — do NOT use "reload sshd" (the service does not exist on Ubuntu 22+)
```

**VERIFY — immediately after reload, from a NEW terminal:**
```bash
# Test that root can still get in with a key:
ssh -i ~/.ssh/<your-key> root@<vps-ip> "echo root-ok"

# Test that password is rejected:
ssh -o PreferredAuthentications=password root@<vps-ip> "echo loged" 2>&1 | tail -2
# Must report "Permission denied (publickey)" — no more password prompt.
```

`prohibit-password` = root can still get in with a KEY (no need to lock yourself out right away), only password is blocked. Once you have:
1. Gotten used to the deploy user (already updated `~/.ssh/config` to the deploy user)
2. Deploy scripts no longer use `root`

...only then change to `PermitRootLogin no` to fully lock down root SSH.

> 💡 **After having a deploy user:** add it to the `docker` group immediately (see Section 6) so the user can run `docker` / `docker compose` without `sudo`. If you skip this step, every deploy command needs root or a sudo password.

---

## 2️⃣ Firewall — only open 22, 80, 443

**WHY:** Every extra exposed port = 1 attack surface. Postgres (5432), Redis (6379), MinIO (9000) must bind to `127.0.0.1` or the docker network, do NOT expose to the Internet.

**CHECK** (ports listening to the Internet):
```bash
ssh my-vps 'ss -tlnp | grep -v "127.0.0.1\|::1" | sort -k4'
# Only :22 :80 :443 should appear. Any other port (5432, 9000, 8080...) is a LEAK.
```

**FIX (ufw):**
```bash
ssh my-vps 'ufw default deny incoming && ufw default allow outgoing && \
  ufw allow 22/tcp && ufw allow 443/tcp && \
  ufw --force enable'
# Port 80: only open if not using Cloudflare. Prod behind Cloudflare → only 443 needed.
```

If you see postgres/redis exposed: edit `docker-compose.yml` — change `ports: ["5432:5432"]` to `ports: ["127.0.0.1:5432:5432"]` or remove `ports:` entirely (use the internal network only). Restart the service after editing.

> ⚠️ **Docker bypasses UFW** — `ufw enable` is not enough! Docker adds its own iptables rules to the `DOCKER` chain, going straight past the `INPUT` chain that UFW manages. You must also install `ufw-docker` to patch this hole.

**FIX (ufw-docker — required if using Docker):**
```bash
# Install ufw-docker
ssh my-vps 'sudo wget -O /usr/local/bin/ufw-docker \
  https://github.com/chaifeng/ufw-docker/raw/master/ufw-docker && \
  sudo chmod +x /usr/local/bin/ufw-docker && \
  sudo ufw-docker install && \
  sudo systemctl restart ufw'

# Only allow the nginx container to the internet (do not allow db/redis/api):
ssh my-vps 'sudo ufw-docker allow <nginx-container-name> 80'
ssh my-vps 'sudo ufw-docker allow <nginx-container-name> 443'
# Find the container name: docker ps --format "{{.Names}}" | grep nginx
```

**VERIFY:**
```bash
ssh my-vps 'ufw status numbered && ufw-docker status'
# From another machine — test that internal ports are blocked:
curl -sI -m 5 http://<vps-ip>:5432   # → timeout = OK
curl -sI -m 5 http://<vps-ip>:6379   # → timeout = OK
curl -sI -m 5 http://<vps-ip>:8080   # → timeout = OK (if api is not nginx)
# Through nginx it must be OK:
curl -sI https://<your-domain.com>/api/health
```

---

## 3️⃣ Fail2ban — auto-ban brute force

**WHY:** SSH keys are already very secure but bots still scan and spam logs → fail2ban auto-bans IPs to reduce noise + block other vectors (nginx 401/404 flood).

**CHECK:**
```bash
ssh my-vps 'systemctl is-active fail2ban 2>&1; fail2ban-client status 2>&1 | head -10'
```

**FIX:**
```bash
ssh my-vps 'apt-get update -q && apt-get install -y fail2ban && \
  cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = 22
backend = systemd

[nginx-botsearch]
enabled = true
logpath = /var/log/nginx/access.log
EOF
  systemctl enable --now fail2ban && fail2ban-client status sshd'
```

**VERIFY:**
```bash
ssh my-vps 'fail2ban-client status sshd; tail -20 /var/log/fail2ban.log'
# You should see "Currently banned" increase over time (bots scan SSH continuously).
```

---

## 4️⃣ App does NOT run as root

**WHY:** A container gets exploited → the attacker has the container user's privileges. If that user is root → a bind-mount escape to the host becomes feasible.

**CHECK** (which user each container runs as):
```bash
ssh my-vps 'for c in $(docker ps --format "{{.Names}}"); do \
  echo -n "$c: "; docker inspect $c --format "{{.Config.User}}"; done'
# Empty "" or "root"/"0" = running as root. A username or UID > 0 = OK.
```

**FIX** (in `<your-app>/Dockerfile`):
```dockerfile
# Add before CMD/ENTRYPOINT:
RUN addgroup -S app && adduser -S -G app app
USER app
```

The official Postgres + MinIO images already run non-root. The official Nginx runs as root for port 80 (necessary). You only need to handle `api` + `cron` + custom services.

Bonus: run the docker daemon rootless (`dockerd-rootless-setuptool.sh install`) if you want paranoid mode. Tradeoff: some volume mount + network config differs. **Not recommended to retrofit prod** — only when building new.

**VERIFY** (after rebuild):
```bash
ssh my-vps 'docker exec <app-api-container> whoami'
# Must print "app", not "root".
```

---

## 5️⃣ Reverse proxy nginx — do NOT expose the app port

**WHY:** The app handles SSL/HTTP/2/compression worse than nginx and exposes the internal port. Nginx also adds rate-limit + cache + centralized access log.

**CHECK** (whether the api exposes a port):
```bash
ssh my-vps 'docker ps --format "{{.Names}}\t{{.Ports}}" | grep -v "127.0.0.1\|0.0.0.0:80\|0.0.0.0:443"'
# Only nginx may have 0.0.0.0:80/443. api/db... must NOT have a port mapping to 0.0.0.0.
```

**FIX** (in `docker-compose.prod.yml` for the api service):
```yaml
api:
  # ports: ["8080:8080"]    # ❌ REMOVE
  expose: ["8080"]            # ✅ internal docker network only
```

The nginx upstream `proxy_pass http://api:8080;` is already in place — no app host port is exposed.

**VERIFY:**
```bash
# From the Internet, a direct curl to port 8080 must fail:
curl -sI -m 5 http://<your-domain.com>:8080/health
# → "Connection refused" or timeout = OK.
# Through nginx it must be 200:
curl -sI https://<your-domain.com>/api/v1/health
```

---

## 6️⃣ Docker group — deploy user does not need sudo docker

**WHY:** After creating the deploy user (Section 1), that user by default has no permission to run `docker`. If not added to the `docker` group, every `docker compose build/up` needs `sudo` — requiring a password or NOPASSWD sudoers. Adding to the `docker` group is the cleanest way: no sudo, no NOPASSWD, the deploy script runs directly.

> ⚠️ **Security note:** The `docker` group = de facto host root privileges (can mount `/` into a container). Only add a trusted deploy user. Do not add regular/untrusted users.

**CHECK** (whether the deploy user is in the docker group yet):
```bash
ssh my-vps 'groups <deploy-user>'
# If "docker" is in the list → already OK.
# If not → it needs to be added.

# Check whether docker actually runs:
ssh my-vps 'docker ps' 2>&1 | head -3
# "permission denied while trying to connect to the Docker daemon socket" → no permission yet
```

**FIX:**
```bash
# Add the deploy user to the docker group (run as root):
ssh -i ~/.ssh/<root-key> root@<vps-ip> 'usermod -aG docker <deploy-user> && groups <deploy-user>'
# The result must show: <deploy-user> : <deploy-user> sudo users docker

# Fix .git ownership if the repo was cloned by root (deploy user cannot git pull):
ssh -i ~/.ssh/<root-key> root@<vps-ip> '
  chown -R <deploy-user>:docker /opt/<app>/<repo>/.git
  chmod -R g+w /opt/<app>/<repo>/.git
'
# Apply to all repos: backend, frontend, infra, admin
```

**VERIFY — from a NEW session (a group change only takes effect in a new session):**
```bash
# Open a new terminal, SSH as the deploy user:
ssh my-vps 'docker ps --format "table {{.Names}}\t{{.Status}}"'
# You must see the container list, with no "permission denied"

# Verify git pull works:
ssh my-vps 'git -C /opt/<app>/<repo> fetch --tags --dry-run 2>&1'
# No "Permission denied" → OK

# Verify docker compose build works:
ssh my-vps 'docker compose -f /opt/<app>/infra/docker-compose.yml ps' 2>&1 | head -5
```

**Why a new session is needed:**
Group membership is read at login. The current session still uses the old groups until you log out/log in again. No need to reboot the server — just `exit` then SSH back in.

---

## Quick audit one-liner

Run the whole block to check the status of all 6 items:
```bash
ssh my-vps 'echo "=== 1. SSH ===" && grep -rh -E "^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication)" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/ 2>/dev/null; \
  echo; echo "=== 2. UFW ==="; ufw status | head; ufw-docker status 2>/dev/null | head -5; \
  echo; echo "=== 3. Fail2ban ==="; systemctl is-active fail2ban; fail2ban-client status 2>&1 | head -5; \
  echo; echo "=== 4. Container user ==="; for c in $(docker ps --format "{{.Names}}"); do printf "%-20s %s\n" "$c" "$(docker inspect $c --format "{{.Config.User}}")"; done; \
  echo; echo "=== 5. Port leak ==="; ss -tlnp | grep -v "127.0.0.1\|::1" | awk "{print \$4}" | sort -u; \
  echo; echo "=== 6. Docker group ==="; groups <deploy-user>; docker ps --format "{{.Names}}" 2>&1 | head -3'
```

---

## Anti-patterns ❌

- Disabling SSH password BEFORE verifying key login → locks yourself out. Always keep the old session open + test in a new terminal.
- Using `PermitRootLogin no` when the server only has the `root` user and no deploy user has been created → complete lockout, recoverable only via the VPS provider's web console.
- Adding `AuthenticationMethods publickey` to the config while `50-cloud-init.conf` sets `PasswordAuthentication yes` → conflict, the SSH daemon rejects the key even though the fingerprint is correct.
- Using `systemctl reload sshd` on Ubuntu 22+ — the service does not exist, use `systemctl reload ssh`.
- Not checking `/etc/ssh/sshd_config.d/` before editing — a drop-in file overrides the main config without you knowing.
- `ufw enable` on the SSH session you are using before `allow 22` → drops the connection entirely.
- Exposing `0.0.0.0:5432` "for dev convenience" → leaks the DB to the Internet. Use an SSH tunnel: `ssh -L 5432:localhost:5432 my-vps`.
- Installing fail2ban then forgetting to check `findtime/maxretry` → bans too aggressively, accidentally bans the office IP.
- Changing the Dockerfile to USER app but forgetting to chmod the volume mount → the app crashes writing logs because it has no permission.
- `docker run --privileged` for debugging convenience → grants host root to the container. Do not use in prod.
- Not adding the deploy user to the `docker` group → every deploy needs a sudo password or NOPASSWD sudoers → exposes attack surface.
- Cloning the repo as root then deploying as the deploy user → `.git/` owned by root, `git fetch/pull` fails with "Permission denied". Fix: `chown -R <deploy-user>:docker .git && chmod -R g+w .git`.
- Adding a regular user (not the deploy script) to the `docker` group → that user can run `docker run -v /:/host --rm -it ubuntu chroot /host` = host root.
- Expecting a group change to take effect immediately in the current session → it does not. You must open a new SSH session.

---

## When to run /harden

- The first time setting up a new VPS.
- After seeing heavy bot scans in the nginx/sshd logs.
- Before opening public traffic (e.g. running a large ad campaign).
- Periodic audit every 3 months.

No need to run on every deploy — this is one-shot per server lifetime + periodic audit.
