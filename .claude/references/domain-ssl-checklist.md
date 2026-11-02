# Domain & SSL Setup
**Date:** 2026-05-12

> **Multi-app note:** Each app has its own section in this file. Dev uses subdomain `appN.dev.domain.com` pointing to the shared Dev VPS. Each Prod app has its own dedicated VPS — see [`multi-app-infra.md`](multi-app-infra.md) for the full rules.

---

## 1. Domain Registration ([Domain Registrar])

- Domain: ask owner
- Update nameservers to [DNS/CDN Provider]: (set to [DNS/CDN Provider]-branded nameservers)

---

## 2. DNS Records ([DNS/CDN Provider])

| Type  | Name                            | Content                  | Proxy    |
|-------|---------------------------------|--------------------------|----------|
| A     | `dev`                           | Dev VPS IP (ask owner)   | Proxied  |
| A     | ask owner                       | Prod VPS IP (ask owner)  | Proxied  |
| A     | `www`                           | Prod VPS IP (ask owner)  | Proxied  |
| CNAME | CNAME certification (ask owner) | Value (ask owner)        | DNS only |

---

## 3. VPS Servers ([VPS Provider])

| Name | IP | Purpose | Specs |
|---|---|---|---|
| [product]_server_prod | ask owner | Production | Standard-1-2-20 |
| [product]_server_dev | ask owner | Dev | Standard-1-2-20 |

Expiry: ask owner

---

## 4. SSL Certificate ([VPS Provider])

- Plan: **Positive SSL** (Sectigo)
- Domain: ask owner
- Verification method: **CNAME certification method**

### Certificate files (gitignored - do not commit)

| File | Location on VPS |
|------|-----------------|
| `fullchain.pem` (cert + CA chain) | `<SERVER_PATH>/nginx/ssl/fullchain.pem` |
| `privkey.pem` (private key) | `<SERVER_PATH>/nginx/ssl/privkey.pem` |

### Renew SSL

```bash
# When a new cert arrives from [VPS Provider], upload and run:
scp certificate.crt <DEPLOY_USER>@<VPS_PROD_IP>:/tmp/domain.crt
ssh my-vps-prod "sudo bash <PATH_TO_APPLY_SSL_SCRIPT> /tmp/domain.crt"
```

---

## 5. SSL/TLS Mode ([DNS/CDN Provider])

- Mode: **Full (Strict)**
- End-to-end encryption, requires a valid certificate at the origin server

---

## 6. Nginx Configuration

File: `<SERVER_PATH>/nginx/nginx.conf`

- `server_name ask owner www.ask owner`
- Port 80 → 301 redirect to HTTPS
- Port 443 → SSL termination with Sectigo cert
- Upstream `api_servers` → `[product]-agent-api:8080`
- Upstream `web_servers` → `[product]-agent-web:80`
- Route `/api/` → backend API
- Route `/` → frontend web container

### Reload nginx

```bash
ssh my-vps-prod "sudo docker exec [product]-agent-nginx nginx -s reload"
```

---

## 7. Frontend Build

- `VITE_API_URL=https://ask owner/api/v1` baked into the image at build time
- Image: `[product]-agent-web:local`
- HTML has `Cache-Control: no-cache` to prevent [DNS/CDN Provider] from caching stale assets

### Rebuild frontend

```bash
ssh my-vps-prod "cd /opt/[product]/[product]_Frontend && sudo docker build --no-cache --build-arg VITE_API_URL=https://ask owner/api/v1 -t [product]-agent-web:local ."
ssh my-vps-prod "sudo docker stop [product]-agent-web && sudo docker rm [product]-agent-web && sudo docker run -d --name [product]-agent-web --restart unless-stopped --network [product]_infra_[product]-agent-network [product]-agent-web:local"
```

---

## Traffic Flow

```
Browser
  └─ HTTPS ──► [DNS/CDN Provider] (edge cert: Let's Encrypt, auto-managed)
                  └─ HTTPS ──► Nginx on VPS (Sectigo cert, valid until ask owner)
                                  ├─ /api/* ──► [product]-agent-api:8080 (Go backend)
                                  ├─ /storage/* ──► minio:9000
                                  └─ /* ──► [product]-agent-web:80 (React frontend)
```

---
