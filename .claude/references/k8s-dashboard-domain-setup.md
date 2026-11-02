# K8s Dashboard (Headlamp) Domain + Auth Setup — Playbook (Generic)

> How to expose an in-cluster web UI (Headlamp, or any similar admin tool: Grafana, RabbitMQ mgmt
> UI, etc.) running on **k3s + Traefik** behind a proper domain, valid TLS, and an access gate —
> without touching the app's own Ingress/TLS. Written after the real setup on tai-san-viet's dev
> k3s cluster (2026-07-14). Companion to `jenkins-domain-setup.md`, which covers the same goal for
> a **Docker + nginx** VPS instead of k3s — use that one if the VPS has no k8s and use this one if
> it does.
>
> Placeholders: `<DOMAIN>` (e.g. `taisanviet.online`), `<SUBDOMAIN>` (e.g. `headlamp-dev`),
> `<TOOL_NAMESPACE>` (e.g. `headlamp`), `<TOOL_SERVICE>` + `<TOOL_SERVICE_PORT>` (the tool's own
> k8s Service), `<VPS_IP>` (the node's external IP == Traefik LoadBalancer external IP),
> `<CF_ZONE_ID>`, `<CF_ACCOUNT_ID>`, `<OWNER_EMAIL_1>`, `<OWNER_EMAIL_2>`.

---

## Goal

Reach the tool at `https://<SUBDOMAIN>.<DOMAIN>` instead of a bare `kubectl port-forward`, with:
- Valid HTTPS (no browser warning)
- An access gate in front of the tool's own login (never bare-public — these tools usually grant
  cluster-admin-equivalent visibility)
- Zero disruption to the app's existing Ingress on the same Traefik instance

---

## Starting state (typical — verify before assuming)

- k3s cluster already running Traefik as the default Ingress controller (`kubectl get svc -n
  kube-system traefik` shows a `LoadBalancer` with `EXTERNAL-IP` = the node's public IP, ports
  `80:xxxxx/TCP,443:xxxxx/TCP`) — **no separate nginx to configure**, Traefik already owns 80/443
  on the host.
- The tool itself (e.g. Headlamp) already deployed via Helm into its own namespace, with only a
  `ClusterIP` Service — not yet reachable from outside the cluster.
- The app's own Ingress (e.g. `tai-san-viet-dev`) may use fake `.local` hostnames with no real DNS
  or TLS (common for a dev cluster that's never had a real domain wired to it before) — **do not
  assume a working TLS pattern already exists to copy**; check with `kubectl get ingress -A -o
  wide` and `kubectl get secret -A | grep tls` before planning the cert step.

---

## Step-by-step

### 1. Confirm Traefik's external IP and that it's the right one

```bash
kubectl get svc -n kube-system traefik
# EXTERNAL-IP here is what the new DNS record must point to
```

Note: on a multi-VPS setup, this may be a **different IP than production** if the k8s cluster is
dev-only and production runs on a separate VPS/Docker. Always double check — pointing the new
subdomain at the wrong IP silently serves nothing (see gotcha in step 4).

### 2. Create a cluster-admin ServiceAccount for the tool's own login (if the tool needs one)

Headlamp specifically authenticates via a Kubernetes bearer token, not a username/password. If the
Helm chart didn't already create a usable one:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: <tool>-admin
  namespace: <TOOL_NAMESPACE>
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: <tool>-admin
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: ServiceAccount
    name: <tool>-admin
    namespace: <TOOL_NAMESPACE>
```

```bash
kubectl apply -f sa.yaml
kubectl create token <tool>-admin -n <TOOL_NAMESPACE> --duration=8760h   # 1 year
```

Paste the resulting JWT into the tool's own login screen. This token is **cluster-admin** — scope
it to a real RBAC role instead if the tool doesn't need full cluster visibility.

### 3. DNS record (Cloudflare)

Dashboard → zone → DNS → Add record — or via API if the token has `DNS Edit`:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/<CF_ZONE_ID>/dns_records" \
  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"type":"A","name":"<SUBDOMAIN>","content":"<VPS_IP>","proxied":true,"ttl":1}'
```

| Field | Value |
|---|---|
| Type | `A` |
| Name | `<SUBDOMAIN>` |
| Content | `<VPS_IP>` (Traefik's external IP from step 1 — **not** necessarily prod's IP) |
| Proxy status | Proxied (orange cloud) |

### 4. TLS — Cloudflare Origin CA cert as a k8s TLS Secret

Same rule as the Docker/nginx playbook: **never touch the zone-wide SSL/TLS mode** — give this
origin its own cert instead.

⚠️ **Gotcha — the Origin CA Certificates API (`/client/v4/certificates`) rejects a normal scoped
API Token even with "SSL and Certificates: Edit" granted** (`1016 Not authorized` no matter what
zone-level permissions are added to the token). It only accepts the separate legacy **Origin CA
Key** (format `v1.0-...`, found at My Profile → API Tokens → bottom of page → "Origin CA Keys" →
View), sent as header `X-Auth-User-Service-Key` instead of `Authorization: Bearer`. If that key
also fails, or isn't available, create the cert manually via dashboard (SSL/TLS → Origin Server →
Create Certificate) — it's a one-time paste, not worth more debugging time than one retry.

```bash
# If you have a genuine Origin CA Key:
openssl req -new -newkey rsa:2048 -nodes -keyout origin-key.pem -out origin.csr \
  -subj "/CN=<SUBDOMAIN>.<DOMAIN>"

curl -X POST "https://api.cloudflare.com/client/v4/certificates" \
  -H "X-Auth-User-Service-Key: $CF_ORIGIN_CA_KEY" -H "Content-Type: application/json" \
  --data "{\"hostnames\":[\"<SUBDOMAIN>.<DOMAIN>\"],\"requested_validity\":5475,\"request_type\":\"origin-rsa\",\"csr\":$(python3 -c "import json;print(json.dumps(open('origin.csr').read()))")}"
```

Either way, once you have `cert.pem` + `key.pem`, load them straight into the cluster — never
leave a plaintext private key on disk longer than needed:

```bash
scp cert.pem key.pem <vps-alias>:/tmp/
ssh <vps-alias> "kubectl create secret tls <tool>-origin-tls -n <TOOL_NAMESPACE> \
  --cert=/tmp/cert.pem --key=/tmp/key.pem \
  --dry-run=client -o yaml | kubectl apply -f -; rm -f /tmp/cert.pem /tmp/key.pem"
```

### 5. Ingress — Traefik terminates TLS using the Secret from step 4

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: <tool>
  namespace: <TOOL_NAMESPACE>
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - <SUBDOMAIN>.<DOMAIN>
      secretName: <tool>-origin-tls
  rules:
    - host: <SUBDOMAIN>.<DOMAIN>
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: <TOOL_SERVICE>
                port:
                  number: <TOOL_SERVICE_PORT>
```

```bash
kubectl apply -f ingress.yaml
kubectl get ingress -n <TOOL_NAMESPACE>   # ADDRESS should show the Traefik external IP
```

No `--force-recreate` dance needed here (unlike the Docker/nginx playbook) — Traefik picks up new
Ingress/Secret objects automatically via the k8s watch API, no reload step exists or is needed.

### 6. Access gate — Cloudflare Access (Zero Trust), same pattern regardless of origin

The tool's own login (ServiceAccount token, OIDC, whatever) should not be reachable by anyone on
the internet before even hitting that login. This step is **identical** to the Docker/nginx
playbook — Cloudflare Access sits at the edge, in front of the origin, so it doesn't care whether
the origin is a Docker container or a k8s Ingress.

⚠️ Requires the API token to have **Account → Access: Apps and Policies → Edit** — a different
permission group than zone-level DNS/SSL. If you only granted DNS+SSL earlier, this call 401s with
`Authentication error` until that account-level permission is added.

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/<CF_ACCOUNT_ID>/access/apps" \
  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  --data '{
    "name": "<Tool Name>",
    "domain": "<SUBDOMAIN>.<DOMAIN>",
    "type": "self_hosted",
    "session_duration": "24h",
    "policies": [{
      "name": "Allow owners",
      "decision": "allow",
      "include": [
        {"email": {"email": "<OWNER_EMAIL_1>"}},
        {"email": {"email": "<OWNER_EMAIL_2>"}}
      ]
    }]
  }'
```

Propagation to Cloudflare's edge takes **up to ~30s** after this call succeeds — a `curl` right
after creation may still return the app's raw `200` instead of the expected `302` redirect to
`cdn-cgi/access/login`. Don't conclude the policy failed until you've waited and retried once.

---

## Final request flow

```
Browser → https://<SUBDOMAIN>.<DOMAIN>
    ↓ (Cloudflare edge, Proxied)
Cloudflare Access check → 302 to https://<team>.cloudflareaccess.com/... (email OTP)
    ↓ authenticated → passes through
Cloudflare edge → origin <VPS_IP>:443 (Origin CA cert validated via SNI)
    ↓
Traefik (k3s), routes by Ingress host rule, TLS terminated with <tool>-origin-tls Secret
    ↓
<TOOL_SERVICE>:<TOOL_SERVICE_PORT> (ClusterIP)
    ↓
Tool's own login (ServiceAccount token / OIDC / etc.)
```

---

## Verification commands

```bash
# Origin serves the right cert (bypass Cloudflare, hit the node directly)
echo | openssl s_client -connect <VPS_IP>:443 -servername <SUBDOMAIN>.<DOMAIN> 2>/dev/null \
  | openssl x509 -noout -subject -dates

# Public HTTPS resolves and Access gate is live
curl -s -o /dev/null -w '%{http_code}\n' https://<SUBDOMAIN>.<DOMAIN>/    # expect 302 once Access has propagated
curl -sI https://<SUBDOMAIN>.<DOMAIN>/ | grep -i location                # should point at cloudflareaccess.com

# Existing app Ingress on the same Traefik unaffected
curl -s -o /dev/null -w '%{http_code}\n' https://<DOMAIN>/<known-good-route>   # 200
```

---

## Adapter Rules — applying this to another internal tool / another project

| Item | This setup (Headlamp) | Change to |
|---|---|---|
| Tool namespace | `headlamp` | target tool's namespace |
| Service name/port | `headlamp` / `80` | target tool's Service |
| Tool login mechanism | k8s ServiceAccount bearer token | whatever the tool natively supports (OIDC, its own user/pass, etc.) — Access gate step is unchanged either way |
| Subdomain | `headlamp-dev` | new subdomain |
| Access app name | `Headlamp` | new tool's name |

### Không cần đổi
- Traefik auto-picks-up-Ingress behavior — no reload/recreate step exists in k3s, unlike the
  Docker+nginx playbook's bind-mount inode gotcha
- The Cloudflare Access pattern (Self-hosted app + email-Allow policy) — identical regardless of
  whether the origin is Docker or k8s
- **Never touch zone-wide Cloudflare SSL/TLS mode** for a single new subdomain — same rule as
  `jenkins-domain-setup.md`, same production-outage risk if ignored
- Always verify the target IP in step 1 explicitly — a k8s cluster and the app's production VPS
  can be, and in this project *are*, two different machines with two different IPs. Assuming
  "the domain already points somewhere, reuse that" without checking is the most likely mistake.

### API token permission groups needed (Cloudflare), split across 3 separate grants
1. `Zone → DNS → Edit` (step 3)
2. `Zone → SSL and Certificates → Edit` — **necessary but not sufficient** for step 4; the Origin
   CA cert endpoint still needs the separate Origin CA Key regardless
3. `Account → Access: Apps and Policies → Edit` (step 6) — commonly forgotten since it's an
   account-level grant, not a zone-level one, and lives in a different part of the token editor UI

---

## Setup Checklist — New Tool / New Project

```bash
# 1. Confirm Traefik external IP
kubectl get svc -n kube-system traefik

# 2. (If tool needs its own bearer-token login) create SA + ClusterRoleBinding, get token
kubectl apply -f sa.yaml
kubectl create token <tool>-admin -n <TOOL_NAMESPACE> --duration=8760h

# 3. DNS A record → Traefik's external IP (Step 3)

# 4. Origin CA cert → k8s TLS Secret (Step 4) — try Origin CA Key API first,
#    fall back to manual dashboard creation after one failed attempt

# 5. Ingress with tls: block referencing the Secret (Step 5)
kubectl apply -f ingress.yaml

# 6. Cloudflare Access application + policy (Step 6) — confirm token has
#    Account-level Access:Edit permission before calling

# 7. Run every command under "Verification commands" above, including the
#    existing-app regression check — wait ~30s before concluding Access failed
```
