---
name: ha
description: High-availability VPS playbook for active/passive failover of any Docker Compose app (any language/stack), orchestrated by Jenkins pipelines (not bash+cron). Use when setting up HA/standby/failover/replication for a self-managed VPS app, or when asked to "clone HA from Diary App" / "setup Jenkins HA failover".
---

# /ha — High Availability VPS Playbook (Jenkins-Orchestrated Failover)

> Activate: khi user muốn setup active/passive HA cho app Docker Compose (bất kỳ stack/ngôn ngữ
> nào) trên VPS tự quản, muốn automate failover bằng Jenkins (không phải bash script + cron thô),
> hoặc nói "clone HA từ Diary App" / "setup Jenkins HA failover".
> **This skill file is self-contained** — everything needed to build the same system on a new
> project is inlined below (architecture, working Jenkinsfile patterns, every gotcha, adapter
> rules). No external file needs to travel with it. If working inside the Diary App repo itself,
> `diary-data/plans/HA_JENKINS_FAILOVER_SPEC.md` and `HA_FAILOVER_VALIDATION_REPORT.md` have the
> full chronological incident history for deep-dive reference only — not required to apply this
> skill elsewhere.

> **Use Jenkins pipelines, not a plain-crontab bash-script design** (`health_check.sh` /
> `promote.sh` / `rejoin.sh` / `watch_rejoin.sh`, one physical copy per VPS). The structural
> problem with that approach: **failover logic living as hand-edited files on the untrusted hosts
> it's supposed to protect, exercised only during real outages** — drift between copies goes
> unnoticed until the moment it matters most. Build the 3-4 Jenkins pipelines below instead; the
> bash design is not reproduced here except where explicitly marked historical at the bottom of
> this file, kept only to show what NOT to build.

---

## When to Trigger

- User nói: "setup HA", "high availability", "standby server", "failover", "replication", "Jenkins HA"
- User nói: "clone HA từ Diary App", "clone Jenkins failover"
- Task liên quan: PostgreSQL streaming replication, Redis replica, automated promote/rejoin, split-brain prevention

---

## Architecture

**The core idea:** two independent loops run forever on Jenkins, each with one narrow job. Neither
loop needs the other to be working correctly, and neither needs a human in the loop for the common
cases. A third pipeline (`ha-promote`) does the actual work when one of the loops decides
something needs to happen; it doesn't run on a schedule itself.

```
   ┌──────────────────────────┐         ┌──────────────────────────┐
   │   FAST LOOP (1 min)      │         │   SLOW LOOP (5 min)      │
   │   ha-watchdog            │         │   ha-rejoin              │
   │                          │         │                          │
   │   "Is PRIMARY alive?"    │         │   "Is STANDBY healthy?"  │
   └───────────┬──────────────┘         └───────────┬──────────────┘
               │ no, 2x in a row                     │ no
               ▼                                     ▼
      ┌───────────────────┐                  rebuild STANDBY from
      │   ha-promote       │                  scratch, in place,
      │  (one-shot job,    │                  no human involved
      │  not scheduled)    │
      └──────────┬─────────┘
               │
               ▼
      STANDBY becomes new PRIMARY,
      DNS flips, old PRIMARY is now
      whatever ha-rejoin finds next
```

Why two loops instead of one combined "check everything" job: **the fast loop only ever needs to
answer one yes/no question** (is the thing serving traffic right now actually alive), so it can run
every minute cheaply. The slow loop does real work when it finds something wrong (stop a stack,
`pg_basebackup`, rejoin Redis) — running that every minute would be wasteful and pointless, since
recovering a standby doesn't need to happen within seconds the way detecting a dead primary does.

### Walkthrough: steady state (nothing wrong)

- `ha-watchdog` fires every minute, resolves the current PRIMARY's real IP, curls it directly,
  gets `200`, resets its fail-counter to 0, exits quietly. No Telegram message (avoid spamming a
  channel every single minute when everything is fine).
- `ha-rejoin` fires every 5 minutes, resolves PRIMARY vs. the other known node (the "candidate"),
  checks if the candidate is already a healthy replica (`pg_is_in_recovery()=t`) — it is — and
  exits as a no-op. Also unconditionally re-checks the replication-port firewall rules exist (see
  the networking section below) and re-applies them if they've silently gone missing.
- Both loops run forever, doing effectively nothing, until one of two things changes.

### Walkthrough: PRIMARY dies

```
t=0 min   Node A (PRIMARY) goes down

t=1 min   ha-watchdog check #1 — non-200
          fail_count = 1 — Telegram "⚠️ FAIL #1"

t=2 min   ha-watchdog check #2 — non-200
          fail_count = 2, threshold reached — Telegram "⚠️ escalating"
          → triggers ha-promote (runs on node B)

          ha-promote stages, in order:
            1. Resolve Hosts          — who is PRIMARY/STANDBY right now?
            2. Split-brain Guard      — is node A REALLY dead?
                                          still 200 → ABORT, Telegram "⚠️ aborted", stop here
                                          genuinely dead → continue
            3. Verify SSL Certs       — certs present on node B?
            4. Promote & Start Standby — pg_ctl promote, REPLICAOF NO ONE,
                                          start api/web/admin/nginx on node B
            5. Mark New Primary       — HA_NODE_ROLE=primary,
                                          restart policies → unless-stopped
            6. Update DNS             — A record now points to node B
            7. Health Check           — confirm 200 on node B

t≈2-3 min Telegram "✅ failover complete" — node B is now serving traffic
```

1. `ha-watchdog`'s next check gets a non-200 (or times out). Fail-count → 1. Telegram: "⚠️ FAIL #1."
2. One minute later, still down. Fail-count → 2, past the escalation threshold. Telegram:
   "⚠️ escalating." `ha-watchdog` triggers `ha-promote` (`build job: 'ha-promote', wait: false`)
   and starts a cooldown so it won't re-trigger a second promote while the first is still running.
3. `ha-promote` resolves hosts again itself (never trusts `ha-watchdog`'s view blindly), re-checks
   the "dead" primary is genuinely still dead (the split-brain guard) — if it's actually still
   alive, `ha-promote` aborts loudly rather than creating two writable primaries.
4. Assuming it's genuinely dead: promote Postgres, promote Redis, start the standby's app tier,
   flip `HA_NODE_ROLE`/restart policies to primary, flip DNS to the new primary's IP, confirm
   health. Telegram: "✅ failover complete."
5. Total time from dead-primary to serving-again: roughly the two watchdog checks (~1-2 min) plus
   however long `ha-promote` itself takes (seconds, since it's mostly starting already-built
   containers and flipping config, not building anything).

### Walkthrough: the dead node comes back

This is the part a plain bash+cron design gets wrong most often — a human has to remember to run
the recovery script, and during a real incident that's exactly the kind of thing that gets missed.

```
t=0 min   Node A (the old, now-dead PRIMARY) reboots / comes back online

          Containers with restart: unless-stopped start on their own —
          independent of anything HA-related. Node A may come back still
          believing it's PRIMARY (stale HA_NODE_ROLE). Dangerous by default
          — this is exactly what the two Defense-in-Depth fixes prevent.

t≤5 min   ha-rejoin's next scheduled run (cron: H/5 * * * *) picks up node A

          ha-rejoin stages, in order:
            1. Resolve Hosts             — node B is PRIMARY, node A is the candidate
            2. Ensure Primary Firewall   — re-check/re-apply replication firewall rules
            3. Check Candidate Reachable — node A responds → continue
            4. Check Recovery State     — pg_is_in_recovery() on node A?
                                            't' (already healthy replica) → no-op, stop here
                                            'f' (broken/stale)            → continue
            5. Stop Candidate Stack      — stop node A's entire stack (api/web/admin/nginx/db/redis)
            6. Rebuild Replica           — back up old data dir, fresh pg_basebackup from node B,
                                            set HA_NODE_ROLE=standby BEFORE starting db
            7. Rejoin Redis              — REPLICAOF node B
            8. Mark Candidate as STANDBY — all restart policies → "no" on node A

t≈5-10min Telegram "✅ rejoin complete" — node A is a healthy standby again,
          full 2-node redundancy restored, zero manual clicks
```

1. The old primary reboots. Whatever Docker containers have `restart: unless-stopped` come back up
   on their own, independent of anything HA-related — **this is dangerous by default**, because a
   node that comes back with a stale idea of its own role can start serving as a second writable
   primary next to whichever node it wasn't. (This is exactly what the two Defense-in-Depth fixes
   further down exist to prevent.)
2. Within 5 minutes, `ha-rejoin`'s next scheduled run resolves hosts, finds this node reachable but
   NOT a healthy replica (`pg_is_in_recovery()` is `f`, or the node is just generally in a broken
   state) — so it decides real work is needed.
3. It stops the node's entire stack, backs up its old data directory, runs a fresh `pg_basebackup`
   from the current primary, rejoins Redis as a replica, and marks the node `HA_NODE_ROLE=standby`
   with every app-tier restart policy set to `no` (so it never independently starts its app tier
   again on some future reboot).
4. No human clicked anything. The system is back to full 2-node redundancy on its own, usually
   within one `ha-rejoin` cycle of the node becoming reachable again.

### The pieces

```
JENKINS (same instance already running any CI/CD deploy pipeline, e.g. deploy-prod)

  ha-watchdog   (cron: * * * * * — every ~1 min)
    → resolves current PRIMARY's real IP via Cloudflare API (not DNS/dig — proxied domains
      resolve to CF edge IPs, not the origin)
    → curl --resolve <domain>:443:<primary-ip> https://<domain>/health  (direct-to-origin,
      bypasses any CDN/proxy cache that could mask a real outage)
    → fail-count state file lives on JENKINS' OWN DISK, not on either prod node
    → 1st failure: Telegram warning. 2nd CONSECUTIVE failure (past a cooldown): trigger ha-promote

  ha-promote    (no required params — auto-resolves everything; can also be triggered manually)
    → Resolve Hosts → Split-brain Guard → Verify SSL Certs → Promote & Start Standby
      → Mark New Primary → Update DNS → Health Check

  ha-rejoin     (cron: H/5 * * * * — self-triggering, safe to run unconditionally/repeatedly)
    → Resolve Hosts → Ensure Primary Firewall (self-heal) → Check Candidate Reachable
      → Check Recovery State (no-op if already a healthy replica) → Stop Candidate Stack
      → Rebuild Replica (pg_basebackup) → Rejoin Redis → Mark Candidate as STANDBY
      → Trigger MinIO Sync (if applicable)

  ha-minio-sync (cron: H/5 * * * * — only if the app uses MinIO/object storage; optional)
    → Resolve Hosts → rsync (no --delete) PRIMARY's data dir → STANDBY, over SSH

  notify-telegram (shared downstream job — every terminal path of every job above calls it)
```

Every job's terminal path — success, failure, abort, no-op, skip — sends a Telegram message.
No silent exits. This directly fixes the root incident: a watchdog that stops working and nobody
notices until a real outage.

`HA_NODE_ROLE` (`primary` | `standby`), set per-node in that node's own `.env` (NOT synced by git —
it's node-local state, not app config), is the single source of truth for "what is this node right
now." Every other HA mechanism — restart policies, the Postgres startup guard — derives from it.

---

## Data Replication Layer — One-Time Setup (What Jenkins Actually Orchestrates)

This is the underlying mechanism — how the two databases actually stay in sync — as opposed to
everything above, which only decides *when* to use it (promote/rejoin). Set it up once, manually,
the same way regardless of what triggers promote/rejoin around it. `ha-rejoin`'s "Rebuild Replica"
stage runs this same `pg_basebackup` command programmatically every time it self-heals a node —
read this section first to understand what that stage is actually doing under the hood.

### PostgreSQL streaming replication

```bash
# 1. Replication user (on whichever node is PRIMARY)
docker exec -u postgres <db-container> psql -c "
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD '<repl-password>';
"

# 2. pg_hba.conf — allow the other known VPS IP
echo "host replication replicator <STANDBY_IP>/32 md5" >> pg_hba.conf

# 3. postgresql.conf
wal_level = replica
max_wal_senders = 10      # keep this generous — see Gotcha below on duplicate settings
wal_keep_size = 64MB
hot_standby = on

# 4. pg_basebackup on the STANDBY/candidate — external published port, not the internal
#    container port (see docker-compose.yml's db service: "${DB_EXTERNAL_PORT:-5435}:5432")
docker run --rm \
  -v <data-dir>:/var/lib/postgresql/data \
  -e PGPASSWORD=<repl-password> \
  postgres:16-alpine \
  pg_basebackup -h <primary-ip> -p <primary-external-db-port> -U replicator \
    -D /var/lib/postgresql/data -Fp -Xs -R -P --checkpoint=fast
```

`-R` auto-creates `standby.signal` + `primary_conninfo` in `postgresql.auto.conf`. **Gotcha (real,
hit repeatedly):** if `postgresql.auto.conf` already has a `primary_conninfo` line from a previous,
differently-directioned setup, `-R` appends a second one rather than replacing it — Postgres uses
the LAST one (its own last-wins behavior for duplicate settings), so a stale value can silently
coexist with the fresh correct one until something breaks. Always strip to the last line:

```bash
grep -v "primary_conninfo" postgresql.auto.conf > /tmp/base.conf
grep "primary_conninfo" postgresql.auto.conf | tail -1 >> /tmp/base.conf
mv /tmp/base.conf postgresql.auto.conf
```

Same duplicate-setting trap applies to any setting appended to `postgresql.conf` more than once
(e.g. `max_wal_senders`) — don't append if the setting already exists; `sed` to replace instead.

### Redis replication

```bash
docker exec <redis-container> redis-cli REPLICAOF <primary-internal-or-published-ip> <redis-port>
docker exec <redis-container> redis-cli INFO replication | grep 'role\|master_link_status'
# Expect: role:slave, master_link_status:up (briefly "down" right after REPLICAOF — resync
# in progress, not a fault; poll a few times before declaring failure)
```

`REPLICAOF` does not persist across a Redis container restart — must be re-issued every time the
container (re)starts as standby. `ha-rejoin`'s "Rejoin Redis" stage does this every run.

---

## Jenkins Pipeline: `ha-promote`

Fires when the current PRIMARY is confirmed dead. Auto-resolves everything — no required build
parameters — so it's safe for `ha-watchdog` to trigger blind.

```groovy
pipeline {
    agent any

    options {
        // A promote run that doesn't restore health could otherwise be re-triggered
        // by ha-watchdog before this run finishes — two overlapping promotes racing
        // (DNS flip, split-brain guard, container start) is worse than queuing.
        disableConcurrentBuilds()
    }

    environment {
        DOMAIN          = '<domain>'
        INFRA_DIR       = '<path-to-infra-dir-on-vps>'
        DB_CONTAINER    = '<app>-infra-db-1'
        REDIS_CONTAINER = '<app>-infra-redis-1'
        API_CONTAINER   = '<app>-infra-api-1'
        WEB_CONTAINER   = '<app>-infra-web-1'
        ADMIN_CONTAINER = '<app>-infra-admin-1'    // drop if no admin panel
        NGINX_CONTAINER = '<app>-infra-nginx-1'
        // Roles swap after failover — CF A record always points to current PRIMARY.
        KNOWN_VPS_1 = '<primary-ip>'
        KNOWN_VPS_2 = '<standby-ip>'
    }

    stages {
        stage('Resolve Hosts') {
            // Query Cloudflare API for the A record's current content (NOT `dig` — a proxied
            // domain resolves to CF edge IPs, not the real origin). Validate the result against
            // the known 2-IP pool; error out rather than guess if it doesn't match — this is the
            // same "Resolve Hosts" pattern already used by any CI/CD deploy pipeline in this repo.
        }

        stage('Split-brain Guard') {
            // curl --resolve <domain>:443:<resolved-primary-ip> https://<domain>/health directly
            // by IP. If it STILL answers 200, abort loudly (declarative `when` + an
            // env.ABORT_PROMOTE flag + currentBuild.result = 'UNSTABLE', not error()) rather than
            // promoting the standby into a second writable primary.
        }

        stage('Verify SSL Certs') {
            // Confirm fullchain.pem / privkey.pem exist on the candidate BEFORE promoting/starting
            // nginx. Placed here deliberately — ahead of Promote & Start — so a missing-cert gap
            // fails loudly before nginx crash-loops mid-incident, not after.
        }

        stage('Promote & Start Standby') {
            // On the candidate: check pg_is_in_recovery() first — skip pg_ctl promote if already
            // promoted (idempotent; a legacy watchdog or manual intervention may have gotten there
            // first), otherwise pg_ctl promote + poll for recovery=f. redis-cli REPLICAOF NO ONE.
            // docker compose up -d --no-deps <FULL app-tier service list> — do NOT restart/recreate
            // db or redis here; promote acts on the already-running process.
        }

        stage('Mark New Primary') {
            // Flip HA_NODE_ROLE=primary + ALL app-tier restart-policy vars to unless-stopped in
            // the candidate's .env, AND `docker update --restart=unless-stopped` on the already-
            // running containers (not just the file — takes effect immediately, survives even
            // before the next recreate).
        }

        stage('Update DNS') {
            // Cloudflare API PATCH the A record to the candidate's IP.
        }

        stage('Health Check') {
            // Direct-IP health check against the new primary — confirm 200 before declaring success.
        }
    }

    post {
        success  { /* notify-telegram: ✅ success, both resolved IPs, new PRIMARY */ }
        unstable { /* notify-telegram: ⚠️ aborted — split-brain guard, both IPs, no state changed */ }
        failure  { /* notify-telegram: ❌ failure, which stage, manual intervention required */ }
    }
}
```

**Why `disableConcurrentBuilds()`:** without it, if a promote doesn't actually restore health,
`ha-watchdog`'s fail-counter reaches 2 again in ~2 more minutes and re-triggers `ha-promote` with
no concurrency guard — two overlapping promotes (racing DNS flips, container starts) is a worse
failure mode than simply queuing the second attempt.

---

## Jenkins Pipeline: `ha-watchdog`

Cron-based health checker — this job's entire purpose is to be the thing that notices, running
somewhere that can't be taken down by the same failure it's watching for.

```groovy
pipeline {
    agent any
    options { disableConcurrentBuilds() }

    triggers {
        // NOT 'H/1 * * * *'. Found LIVE on this project's Jenkins instance that the "H" hash
        // form with step=1 in the minute field degrades to firing once per HOUR, not once per
        // minute (confirmed via build timestamps exactly 3600s apart), while H/5 on a different
        // job correctly fired every 5 min on the same instance. Explicit '* * * * *' has no hash
        // ambiguity, and there's no load-spreading benefit to lose at 1-minute granularity anyway
        // (nothing smaller to spread across). If in doubt on a new Jenkins instance, test with
        // '* * * * *' first and confirm real build timestamps ~60s apart before trusting `H/1`.
        cron('* * * * *')
    }

    environment {
        DOMAIN            = '<domain>'
        STATE_DIR         = '/var/jenkins_home/ha-state'      // Jenkins' OWN disk, not a prod node
        FAIL_COUNT_FILE   = '/var/jenkins_home/ha-state/fail_count'
        LAST_TRIGGER_FILE = '/var/jenkins_home/ha-state/last_trigger'
        COOLDOWN_SECONDS  = '300'   // don't re-fire ha-promote more than once per window
        KNOWN_VPS_1 = '<primary-ip>'
        KNOWN_VPS_2 = '<standby-ip>'
    }

    stages {
        stage('Resolve Primary') { /* same Cloudflare-API pattern as ha-promote */ }

        stage('Check Health') {
            // curl --resolve <domain>:443:<resolved-primary-ip> https://<domain>/health — direct
            // to the real origin IP, NEVER the bare public domain. A CDN/proxy layer can serve a
            // stale/cached 200 while the real origin is fully down — found live, genuinely masked
            // an outage in this project once, and is the reason the 2-consecutive-failure
            // threshold was never reliably reached until this fix.
            //
            // code == 200:
            //   failCount > 0 → reset to 0, notify-telegram → recovered
            //   else → no message (avoid spam on steady-state healthy)
            // code != 200:
            //   failCount += 1
            //   failCount == 1 → notify-telegram ⚠️ FAIL #1
            //   failCount >= 2 && cooldown clear → reset counter, write last_trigger,
            //                                       notify-telegram ⚠️ escalating,
            //                                       build job: 'ha-promote', wait: false
            //   failCount >= 2 && still in cooldown → skip, log only
        }
    }
}
```

---

## Jenkins Pipeline: `ha-rejoin`

**This is the biggest value-add over the old bash-script approach.** The old design (`rejoin.sh`)
was manual-trigger-only and required a human to remember to run it after every node came back —
which is exactly the kind of thing that gets forgotten during a real incident. `ha-rejoin` fixed
this by being both idempotent (safe to run blind, repeatedly) and self-triggering (its own cron).

```groovy
pipeline {
    agent any
    options { disableConcurrentBuilds() }

    triggers {
        // Self-healing: this job is already idempotent (no-ops on "already a healthy replica",
        // skips on "unreachable") — the only thing missing was someone remembering to click
        // Build Now after a node came back stale. This happened for real, twice in one day, on
        // both nodes, before this trigger was added. H/5 matches ha-minio-sync's cadence;
        // rejoin is heavier than ha-watchdog's health check so it doesn't need per-minute polling.
        cron('H/5 * * * *')
    }

    environment {
        INFRA_DIR       = '<path-to-infra-dir-on-vps>'
        DB_CONTAINER    = '<app>-infra-db-1'
        REDIS_CONTAINER = '<app>-infra-redis-1'
        API_CONTAINER   = '<app>-infra-api-1'
        WEB_CONTAINER   = '<app>-infra-web-1'
        ADMIN_CONTAINER = '<app>-infra-admin-1'
        NGINX_CONTAINER = '<app>-infra-nginx-1'
        DATA_DIR = '<host-path-to-postgres-data-dir>'
        DB_PORT     = '<primary-external-db-port>'
        REDIS_PORT  = '<primary-external-redis-port>'
        KNOWN_VPS_1 = '<primary-ip>'
        KNOWN_VPS_2 = '<standby-ip>'
    }

    stages {
        stage('Resolve Hosts') { /* → RESOLVED_PRIMARY, RESOLVED_CANDIDATE (the other known IP) */ }

        stage('Ensure Primary Firewall') {
            // Runs UNCONDITIONALLY every time, not gated on NEEDS_REJOIN — see the firewall
            // gotcha section below. Self-heals the DOCKER-USER iptables rules for Postgres/Redis
            // replication ports, because these were found to silently NOT persist across reboots
            // or container recreation.
        }

        stage('Check Candidate Reachable') {
            // SSH probe only. If unreachable → notify-telegram ℹ️ skipped, exit cleanly. No error.
        }

        stage('Check Recovery State') {
            when { expression { env.SKIP_REASON == null } }
            // pg_is_in_recovery() on the candidate.
            // 't' → already a healthy replica. notify-telegram ℹ️ no-op. Exit cleanly.
            //       This idempotency is what makes it safe to run unconditionally on a schedule.
            // 'f' (or unreachable db) → NEEDS_REJOIN = true, proceed.
        }

        stage('Stop Candidate Stack') {
            when { expression { env.NEEDS_REJOIN == 'true' } }
            // Full stack stop: api web admin nginx db redis — not a partial subset.
        }

        stage('Rebuild Replica') {
            when { expression { env.NEEDS_REJOIN == 'true' } }
            // 1. Back up old data dir (mv, not rm — recoverable if something goes wrong)
            // 2. pg_basebackup from RESOLVED_PRIMARY's external port
            // 3. Clean stale primary_conninfo duplicate lines — keep only the LAST one
            //    (matches Postgres's own last-wins behavior for duplicate settings)
            // 4. *** Set HA_NODE_ROLE=standby in the candidate's .env BEFORE starting db ***
            //    — this ordering is load-bearing. See "ha-db-guard.sh" section below: the
            //    guard refuses to start Postgres as standby unless HA_NODE_ROLE already agrees
            //    with standby.signal, which pg_basebackup -R just created in this same step.
            // 5. docker compose up -d --no-deps db, poll pg_is_in_recovery()=t
        }

        stage('Rejoin Redis') {
            when { expression { env.NEEDS_REJOIN == 'true' } }
            // Start redis, REPLICAOF <primary-ip> <port>, poll for master_link_status:up
        }

        stage('Mark Candidate as STANDBY') {
            when { expression { env.NEEDS_REJOIN == 'true' } }
            // Idempotent re-confirmation: HA_NODE_ROLE=standby + ALL app-tier restart-policy
            // vars set to "no" in .env, AND docker update --restart=no on the running
            // containers — must cover every app-tier service, not just db/redis (see the
            // restart-policy gotcha below).
        }

        stage('Trigger MinIO Sync') {
            when { expression { env.NEEDS_REJOIN == 'true' } }
            // build job: 'ha-minio-sync', wait: false — don't make a freshly-rejoined candidate
            // wait up to 5 min for the next scheduled sync; only if the app uses object storage
            // that needs node-to-node sync.
        }
    }

    post {
        success { /* notify-telegram: varies by SKIP_REASON — skipped / no-op / full success */ }
        failure { /* notify-telegram: ❌ failure, candidate may be left in a partial state */ }
    }
}
```

---

## The Two Critical Defense-in-Depth Fixes

These are the most valuable, hard-won parts of this whole skill — both were root-caused only after
the same class of split-brain incident recurred multiple times in one day on real hardware.

### Fix A — restart-policy-per-service, not just per-database

Docker's `restart: unless-stopped` brings a node's FULL stack back up on any VPS/Docker-daemon
reboot, **regardless of intended HA role**, unless every single app-tier service — not just
`db`/`redis` — has its restart policy gated by `HA_NODE_ROLE`.

**The first version of this fix only covered `db`/`redis` and was not enough.** A node's
`api`/`web`/`admin`/`nginx` tier came back up independently on a standby's reboot — because those
services still used a hardcoded `unless-stopped` — causing a genuine split-brain (app tier + local
Postgres both live, on both nodes, simultaneously) that the incomplete fix did not prevent.

`docker-compose.yml` pattern — every service that shouldn't run on a standby needs its own gated var:

```yaml
services:
  db:
    restart: ${HA_DB_RESTART_POLICY:-unless-stopped}
  redis:
    restart: ${HA_REDIS_RESTART_POLICY:-unless-stopped}
  api:
    restart: ${HA_API_RESTART_POLICY:-unless-stopped}
  web:
    restart: ${HA_WEB_RESTART_POLICY:-unless-stopped}
  admin:
    restart: ${HA_ADMIN_RESTART_POLICY:-unless-stopped}
  nginx:
    restart: ${HA_NGINX_RESTART_POLICY:-unless-stopped}
```

`.env` (per-node, NOT synced by git — roles swap):

```bash
# PRIMARY: leave unset (defaults to unless-stopped) or set explicitly
HA_NODE_ROLE=primary
HA_DB_RESTART_POLICY=unless-stopped
HA_REDIS_RESTART_POLICY=unless-stopped
HA_API_RESTART_POLICY=unless-stopped
HA_WEB_RESTART_POLICY=unless-stopped
HA_ADMIN_RESTART_POLICY=unless-stopped
HA_NGINX_RESTART_POLICY=unless-stopped

# STANDBY: ALL SIX set to "no"
HA_NODE_ROLE=standby
HA_DB_RESTART_POLICY=no
HA_REDIS_RESTART_POLICY=no
HA_API_RESTART_POLICY=no
HA_WEB_RESTART_POLICY=no
HA_ADMIN_RESTART_POLICY=no
HA_NGINX_RESTART_POLICY=no
```

**Rule: both `ha-promote`'s "Mark New Primary" and `ha-rejoin`'s "Mark Candidate as STANDBY" stages
must set/clear ALL of these vars together, every time — never a subset.** If a new app-tier service
is ever added to the compose file, it needs its own `HA_<SERVICE>_RESTART_POLICY` var wired into
both stages in the same commit, or it silently repeats this exact incident.

### Fix B — tie `standby.signal` to `HA_NODE_ROLE` via an entrypoint guard

Even with restart policies correctly gated, a node's on-disk replication state can independently
drift from its `HA_NODE_ROLE` bookkeeping — e.g. a node was promoted once, long ago, and never
properly rejoined since. The `.env` says `standby` but the data directory has no `standby.signal`
because it's actually sitting there as plain-primary data. On reboot, Docker's restart-manager just
brings `db` back up per whatever's already on disk — a silent, undetected writable primary, with
no `pg_ctl promote` ever having run because none was needed.

**Fix: wrap the Postgres entrypoint with a guard that refuses to start in that specific
disagreement.**

`scripts/ha-db-guard.sh`:

```sh
#!/bin/sh
# Wraps postgres:16-alpine's default entrypoint. Refuses to start rather than
# silently booting as a writable primary when HA_NODE_ROLE disagrees with the
# on-disk standby.signal state.
set -e

PGDATA_DIR="${PGDATA:-/var/lib/postgresql/data}"

if [ "$HA_NODE_ROLE" = "standby" ] && [ ! -f "$PGDATA_DIR/standby.signal" ]; then
  echo "[ha-db-guard] FATAL: HA_NODE_ROLE=standby but $PGDATA_DIR/standby.signal is missing." >&2
  echo "[ha-db-guard] Refusing to start as a writable primary. Run ha-rejoin on this node first." >&2
  exit 1
fi

exec docker-entrypoint.sh "$@"
```

Wired into `docker-compose.yml`'s `db` service:

```yaml
services:
  db:
    image: postgres:16-alpine
    entrypoint: ["/ha-db-guard.sh"]
    environment:
      HA_NODE_ROLE: ${HA_NODE_ROLE:-primary}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/ha-db-guard.sh:/ha-db-guard.sh:ro
```

This converts a silent "boots as a rogue writable primary" failure into a loud, safe one (crash
loop + logs) that alerts instead of silently corrupting data.

**Deliberate design choice: only guard the "standby-without-signal" direction, not the reverse**
("primary role with `standby.signal` still present"). The reverse legitimately happens transiently
mid-rejoin — right after `pg_basebackup -R` creates `standby.signal` but before `HA_NODE_ROLE`
flips in `.env`. Guarding both directions would create a real conflict with `ha-rejoin`'s own
necessary ordering. This is exactly why `ha-rejoin`'s "Rebuild Replica" stage sets
`HA_NODE_ROLE=standby` in `.env` **before** starting the rebuilt `db` container, not after — so the
two always agree by start time, and the two fixes work together instead of fighting each other.
`ha-promote` never touches this guard at all: its "Promote & Start Standby" stage never
restarts/recreates `db` — `pg_ctl promote` acts on the already-running process — so the guard is
simply never invoked during a normal promote.

---

## Networking Gotcha: Firewall Rules for Replication Ports

Two real mistakes, both worth treating as explicit anti-patterns:

**1. `ufw route allow proto tcp to any port <published-port>` does NOT work for Docker-published
ports.** Docker's DNAT rewrites the destination to the container's INTERNAL port in `PREROUTING`,
before the packet ever reaches the `FORWARD` chain where UFW's rules live. A rule matching the
published port (e.g. `5435`) can never match, because by the time it reaches `FORWARD` the
destination port has already been rewritten (e.g. to `5432`). This looks correctly configured
(`ufw status verbose` shows the rule) but `iptables -L ufw-user-forward -n -v` shows it matching
**0 packets, ever**.

**2. The `ufw-docker` helper tool, if installed, solves this correctly** by targeting the
container's actual internal IP+port in the `DOCKER-USER` chain instead (`ufw-docker allow
<container> <port>`). But it inserts a LIVE, non-persistent iptables rule — no `after.rules` hook,
no systemd unit, nothing re-applies it after a reboot or container recreation (which assigns a new
internal IP, silently orphaning the old rule). It also may not even be installed consistently
across every node — this project found it present on one node and completely absent on another.

**The robust, portable fix — don't depend on `ufw-docker` being installed or on `sudo` being
configured identically on every node** (a real gotcha: passwordless sudo worked on one node but NOT
the other in this project, breaking a naive `sudo iptables` approach mid-incident, on exactly the
node where it was needed):

```bash
ensure_rule() {
  container="$1"; port="$2"
  ip=$(docker inspect "$container" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
  for src in <known-vps-1> <known-vps-2>; do
    if docker run --rm --privileged --network=host alpine sh -c \
         "apk add -q iptables 2>/dev/null; iptables -C DOCKER-USER -p tcp -s $src -d $ip --dport $port -j ACCEPT" 2>/dev/null; then
      echo "OK: rule already present"
    else
      docker run --rm --privileged --network=host alpine sh -c \
        "apk add -q iptables 2>/dev/null; iptables -I DOCKER-USER -p tcp -s $src -d $ip --dport $port -j ACCEPT"
      echo "ADDED: rule for $container ($ip:$port) from $src"
    fi
  done
}
ensure_rule <db-container> 5432
ensure_rule <redis-container> 6379
```

This needs no `sudo` at all — the deploy user's `docker` group membership is sufficient — and it
works uniformly across nodes regardless of local sudoers config.

**Make this self-healing**, not a one-off manual fix: run it as its own `ha-rejoin` stage
("Ensure Primary Firewall") on EVERY run, unconditionally — not gated on `NEEDS_REJOIN` — since a
reboot or container recreation can silently wipe these rules at any time with no warning, and
re-checking every 5 minutes (piggybacking on `ha-rejoin`'s own cron) costs nothing when the rule is
already correct.

---

## Health-Check Design: Always Resolve the Real IP, Never Trust the Public Domain Alone

Both `ha-watchdog`'s health check and `ha-promote`'s split-brain guard must use:

```bash
curl --resolve <domain>:443:<resolved-ip> https://<domain>/health
```

against a directly-resolved IP (via the Cloudflare API, not `dig` — `dig` on a proxied domain
returns Cloudflare's edge IPs, not the real origin) — **never** just `curl https://<domain>/health`.
A CDN/proxy layer can serve a stale/cached response that masks a genuinely dead origin. This was
found live in this project: a domain-based health check registered one real failure, then
returned `200` on the very next check while the origin was independently confirmed still fully
down — meaning the 2-consecutive-failure escalation threshold was never reliably reached until
this fix. This is a critical detail, not a nice-to-have.

---

## CI/CD Deploy vs HA Failover — Keep Image-Tag State in Sync

If the app also has a separate CI/CD deploy pipeline (e.g. GitHub Actions building versioned images
pushed to a registry, deployed via its own Jenkins job) that's independent from the HA failover
pipelines, be aware **these two systems can silently disagree about which image version should be
running.**

**What happens if you don't fix this:** if the deploy pipeline only `export`s an image-tag env var
transiently inside its own SSH session (not persisting it into the node's `.env`), then a LATER
real failover's `ha-promote`/`ha-rejoin` run — which just does a bare `docker compose up` reading
whatever's in `.env` — falls back to old, stale, locally-built image tags instead of the actual
currently-deployed version. This happened for real in this project: a newly-promoted node silently
served an old admin panel bundle, confirmed by diffing served JS for version-specific field-name
markers, even though the correct versioned images were already sitting on disk under their full
registry-qualified tag — just under the wrong tag name for Compose to pick up.

**Recommendation:** whatever pipeline deploys a new version should WRITE the resolved image tags
into `.env` on BOTH nodes (not just `export` them transiently on whichever node it happens to be
actively deploying to), so that any later HA-triggered container restart — planned or
emergency — automatically picks up the correct version with no separate sync step. An alternative
(not yet chosen in this project, more robust but heavier) is having `ha-promote`/`ha-rejoin`
themselves resolve "what image tag is the currently-live healthy node actually running" via
`docker inspect` over SSH at promote/rejoin time, rather than trusting local `.env` state on the
node being acted on.

Also worth fixing in the same pass: any "prepare standby" step in the deploy pipeline that does a
bare `git checkout main` with no `pull`/fast-forward afterward — that just switches to whatever the
LOCAL `main` pointer already was, which can be arbitrarily behind `origin/main`. Use
`git checkout main && git pull origin main` instead.

---

## Testing Methodology — Test With Real Drills, Not Simulations

Every mechanism in this design was validated by **actually powering off a real node** and watching
the system respond — not by mocking failure. Simulated tests (fake `/etc/hosts` entries, disabled
downstream jobs) were used only where a real drill would have caused real customer impact.

**Technique for safely testing the failure-escalation path (2 consecutive fails → trigger) without
real customer impact and without risking an actual bad promote:**

1. Scope a firewall block to ONLY the Jenkins host's own IP on the target's health-check port
   (`iptables -I DOCKER-USER -p tcp --dport 443 -s <jenkins-host-ip> -j DROP`) — real users on
   other IPs are completely unaffected, confirmed via a parallel `curl` from an unrelated machine
   staying at 200 the entire time.
2. As a belt-and-suspenders safety net, temporarily **disable the downstream job** (`ha-promote`)
   in the Jenkins UI so that even if the escalation logic reaches the real trigger call, Jenkins
   refuses to execute it.

This proves the escalation logic actually fires without any risk of an unwanted real failover.

**After any drill, always do a full independent read-only verification** — SSH + curl checks of
`HA_NODE_ROLE`, `pg_is_in_recovery()`, Redis `INFO replication`, direct-IP health checks on both
nodes — rather than just trusting a pipeline's own "SUCCESS" report.

**The 4-case drill pattern that fully validates a 2-node setup** (run once per new deployment,
and again after any change to the pipelines):

| Case | Action | Expected automatic result | What to independently verify |
|---|---|---|---|
| 1 | Power off node A (currently PRIMARY) | `ha-watchdog` detects 2 consecutive failures → auto-triggers `ha-promote` → node B becomes PRIMARY | `HA_NODE_ROLE=primary` on B, `pg_is_in_recovery()=f`, direct-IP health `200` on B, public domain `200` |
| 2 | Power node A back on | It boots with a stale `HA_NODE_ROLE`/role state → `ha-rejoin`'s own cron notices within its polling interval → rebuilds A as a proper standby, with zero manual trigger | `HA_NODE_ROLE=standby` on A, `pg_is_in_recovery()=t`, Redis `role:slave`/`master_link_status:up`, A's app tier stopped and no longer publicly serving |
| 3 | Power off node B (now PRIMARY) | Same as Case 1, mirrored: A auto-promotes | Same checks as Case 1, on A |
| 4 | Power node B back on | Same as Case 2, mirrored: `ha-rejoin` self-heals B | Same checks as Case 2, on B |

All four should complete with **zero manual Jenkins clicks** if `ha-watchdog` and `ha-rejoin`'s
cron triggers are both correctly registered (see the cron gotchas below) — that's the actual bar
for "this system is done," not just "the Jenkinsfiles exist and build."

---

## Adapter Rules — What MUST Change vs What Does NOT Need to Change

| Item | Example (illustrative, not a real deployment) | Change to |
|---|---|---|
| `KNOWN_VPS_1` / `KNOWN_VPS_2` | `10.0.0.11` / `10.0.0.12` | The 2 real VPS IPs for the new project |
| Container name prefix | `<app>-infra-*-1` | This project's actual compose container names |
| `INFRA_DIR` | `/opt/<app>/repo/<infra-dir>` | Path on the new project's VPS |
| `DOMAIN` | `<app>.example.com` | New project's domain |
| Cloudflare zone/record IDs | project-specific | New project's CF zone + A record |
| App-tier service list | `api web admin minio nginx` | Whatever services this app's `docker-compose.prod.yml` actually has — must be kept in sync as services are added/removed |
| `HA_<SERVICE>_RESTART_POLICY` var names | one var per service (db/redis/api/web/admin/nginx) | One var per app-tier service that shouldn't run on standby — add a new var + wire it into both `ha-promote`'s "Mark New Primary" and `ha-rejoin`'s "Mark Candidate as STANDBY" in the same commit whenever a service is added |
| `DB_PORT` / `REDIS_PORT` (external, published) | `5432` / `6379` (or whatever's mapped) | This project's published ports — must match `docker-compose.yml`'s `ports:` mapping |
| Jenkins credential IDs | `cf-api-token`, `cf-zone-id`, `cf-record-id`, `prod-vps-ssh-key`, `prod-vps-user`, `db-user`, `pg-repl-password` | Reuse existing ones if this Jenkins instance already runs a CI/CD deploy pipeline for the same infra; else create fresh |
| Registry/image paths (if using a CI/CD-vs-HA sync fix) | `<registry>/<org>/<repo>/*` | New project's registry path |
| MinIO/object storage sync (`ha-minio-sync`) | rsync of `/opt/<app>/data/minio` | Only include this job if the app actually has an object-storage tier that needs node-to-node sync; drop entirely otherwise |

## Không cần Đội (logic is generic, don't re-derive from scratch)

- The split-brain guard logic itself (direct-IP curl, abort via `when` + flag, not `error()`)
- The cooldown (`300s`) and 2-consecutive-failure escalation constants — proven-good defaults
- `ha-db-guard.sh`'s core logic (guard only the standby-without-signal direction, not the reverse)
- The self-trigger cron pattern (`H/5 * * * *` for rejoin/minio-sync, `* * * * *` for watchdog)
- The `docker run --privileged --network=host alpine ... iptables` trick for firewall self-heal
- The "always resolve real IP, never trust the bare public domain" health-check pattern
- The credential-escaping pattern for SSH heredocs: single backslash (`\${VAR}`) for a Jenkins
  credential that must expand LOCALLY before being sent to the remote shell; triple backslash
  (`\\\${VAR}`) only for a value that must stay unexpanded until the REMOTE shell runs it. This
  exact bug (extra backslash deferring expansion to the wrong shell, silently expanding to empty
  and corrupting a `psql`/`iptables` command) was hit repeatedly across every job in this project —
  don't re-derive the fix from scratch, copy the validated pattern.
- The "keep only the last `primary_conninfo` line" cleanup — matches Postgres's own last-wins
  behavior for duplicate settings, don't try to be cleverer with nested-quote greps

---

## Anti-patterns

- **Don't use `ufw route allow` for Docker-published ports** — Docker's `PREROUTING` DNAT rewrites
  the destination port before the packet reaches `FORWARD`, so a rule matching the published port
  can never match. Use `ufw-docker allow <container> <port>` (post-DNAT) if installed, or the
  `docker run --privileged` iptables trick if not.
- **Don't rely on `sudo` being consistently configured across nodes** — passwordless sudo working
  on one VPS is not proof it's configured the same way on the other. Use `docker run --privileged
  --network=host` instead, which only needs `docker` group membership.
- **Don't check health via the bare public domain when a CDN/proxy sits in front** — it can mask a
  real origin outage with a cached/stale `200`. Always resolve the real IP first and `curl
  --resolve` directly to it.
- **Don't gate only `db`/`redis` restart policies and assume the app tier is safe** — a "standby"
  node's `api`/`web`/`admin`/`nginx` can independently auto-start on reboot if their restart policy
  isn't also gated by `HA_NODE_ROLE`. Cover every app-tier service, every time either "Mark" stage
  runs.
- **Don't trust `HA_NODE_ROLE` alone without also verifying/enforcing the actual on-disk
  replication state** — the env var and `standby.signal` can independently drift apart. Wire the
  guard script into the Postgres entrypoint so the two are forced to agree at container start.
- **Don't let a CI/CD pipeline's image-tag choice live only in a transient shell `export`** — write
  it into `.env` on both nodes, or a later HA-triggered restart will silently fall back to stale
  local-build tags.
- **Don't use `H/1` cron on Jenkins without first confirming it actually fires every minute** —
  this project found it degrading to hourly on at least one real Jenkins instance. Test with
  explicit `* * * * *` if in doubt; verify via real build timestamps, not assumption.
- **Don't trust a pipeline's own reported `SUCCESS` without independent read-only verification** —
  always follow up with direct SSH/curl checks of `HA_NODE_ROLE`, `pg_is_in_recovery()`, Redis
  replication status, and direct-IP health on both nodes.
- **Don't reuse the old bash-script design (`health_check.sh`/`promote.sh`/`rejoin.sh`) even
  adapted** — it independently has the same structural defects (stale hardcoded paths, incomplete
  service lists, per-VPS physical copies that drift) this entire Jenkins-based design exists to
  fix. Build fresh from the patterns in this file instead of trying to salvage the old scripts.

---

## Reference — Diary App Implementation

Everything needed to apply this skill is already inlined above. The table below only matters if
you're working inside the Diary App repo itself and want the real, currently-running code or the
full chronological incident history — none of it needs to travel to a new project.

| File | Description |
|---|---|
| `jenkins/ha-promote/Jenkinsfile` | Full working promote pipeline |
| `jenkins/ha-watchdog/Jenkinsfile` | Full working health-check + auto-escalate pipeline |
| `jenkins/ha-rejoin/Jenkinsfile` | Full working self-healing rejoin pipeline |
| `jenkins/ha-minio-sync/Jenkinsfile` | Full working object-storage sync pipeline (if applicable) |
| `diary-infra/scripts/ha-db-guard.sh` | Postgres entrypoint guard script |
| `diary-infra/docker-compose.yml` | `db`/`redis`/`api`/`web`/`admin`/`nginx` restart-policy wiring + guard entrypoint mount |
| `diary-infra/.env.example` | `HA_NODE_ROLE` + all 6 restart-policy vars, documented |
| `.claude/references/ha-infra-diary.md` | Live IP/role state for this project — always check here for current PRIMARY/STANDBY, never infer from an alias name |

**Optional deep-dive, this repo only (not required to apply this skill elsewhere):**

| File | Description |
|---|---|
| `diary-data/plans/HA_JENKINS_FAILOVER_SPEC.md` | Full incident-level history — every bug found and fixed, chronological, Phases 1-7 |
| `diary-data/plans/HA_FAILOVER_VALIDATION_REPORT.md` | Clean logic summary + 4 real back-to-back test cases (already summarized inline above) |
| `diary-data/plans/HA_JENKINS_FAILOVER_SPEC.md` § Phase 7 | The CI/CD-deploy-vs-HA-failover image-tag gap, root cause + tactical fix + undecided systemic options (already summarized inline above) |

---

## Historical — Superseded Bash+Cron Design (do not build this)

The original HA design for this project used one physical script per VPS, driven by plain
crontab: `health_check.sh` (STANDBY polls the public domain every minute, escalates to
`promote.sh` after 2 failures), `promote.sh` (promote PG, flip Redis, restart containers, flip
Cloudflare DNS), and `rejoin.sh`/`watch_rejoin.sh` (manual/cron-driven rebuild of a stale node as
standby). It is fully decommissioned — every script renamed `.disabled` on both nodes, not
deleted, kept only as historical reference. Its root problems (scripts as N physical copies that
silently drift out of sync with the repo, a watchdog that dies silently when its own node's
environment drifts, incomplete service lists, no SSL-cert verification, no firewall self-heal, no
restart-policy control) are exactly what the Jenkins-based design above exists to fix. Do not
resurrect this pattern for a new project — build from the Jenkinsfiles referenced above instead.
