# Infra - Docker Compose

Phuong an B trong dac ta (muc 10): dong goi Backend Laravel bang Docker Compose. XAMPP (phuong an A) va Docker la hai moi truong rieng, khong can chay cung luc.

## Thanh phan

| Service | Image | Vai tro |
|---|---|---|
| `nginx` | `disaster-warning/web` (nginx 1.27) | Cong vao `http://localhost:8000`: API `/api/v1`, file upload `/storage`, WebSocket Reverb `/app` |
| `app` | `disaster-warning/app` (PHP 8.2-FPM) | Laravel API |
| `migrate` | nhu `app` | Chay `migrate --force` mot lan roi thoat; cac service Laravel khac chi khoi dong sau khi no xong |
| `queue` | nhu `app` | `queue:work` - gui notification, broadcast |
| `scheduler` | nhu `app` | `schedule:work` - `weather:fetch` (moi gio), `earthquakes:fetch` (30 phut) |
| `reverb` | nhu `app` | `reverb:start` - WebSocket (noi bo cong 8080, ra ngoai qua nginx) |
| `db` | `mariadb:10.4.32` | CSDL (cung phien ban voi XAMPP, ho tro GIS). Volume `db-data` |
| `phpmyadmin` | `phpmyadmin:5.2` | `http://127.0.0.1:8081` (chi localhost) |
| `tunnel` | `cloudflare/cloudflared` | Tuy chon (profile `tunnel`): link cong khai khi demo |

Volume `storage` (thu muc `storage/` cua Laravel) duoc dung chung giua cac container Laravel va nginx (nginx chi doc), nen anh/video bao cao khong mat khi tao lai container.

Chua bao gom Redis / MinIO: dac ta uu tien Database Queue va luu file cuc bo o giai doan dau.

## Chay lan dau

Yeu cau: Docker Desktop (hoac Docker Engine + Compose v2.20+).

```bash
cd Infra
cp .env.example .env
```

Dien cac gia tri bi trong trong `Infra/.env`:

```bash
echo "base64:$(openssl rand -base64 32)"   # -> APP_KEY
openssl rand -hex 16                        # -> REVERB_APP_KEY, REVERB_APP_SECRET
# DB_PASSWORD, DB_ROOT_PASSWORD: mat khau tuy chon
```

Khoi dong:

```bash
docker compose up -d --build
docker compose ps                 # migrate = exited (0), cac service khac = running
curl http://localhost:8000/up     # health check Laravel
```

Nap du lieu mau (tai khoan demo, mat khau `password`) - chi chay mot lan:

```bash
docker compose exec app php artisan db:seed --force
```

## Lenh thuong dung

```bash
docker compose logs -f app queue scheduler reverb   # log (Laravel ghi ra stderr)
docker compose exec app php artisan tinker
docker compose exec app php artisan weather:fetch    # lay du lieu Open-Meteo ngay
docker compose up -d --build                         # cap nhat code: build lai + migrate tu dong
docker compose down                                  # dung (giu du lieu)
docker compose down -v                               # dung + XOA du lieu DB va file upload
```

Sao luu CSDL:

```bash
docker compose exec db sh -c 'mysqldump -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' > backup.sql
```

## Link cong khai khi demo (Cloudflare Tunnel)

```bash
docker compose --profile tunnel up -d
docker compose logs tunnel | grep trycloudflare.com
```

Quick tunnel khong can tai khoan, URL doi moi lan khoi dong. Sau khi co URL: dat `APP_URL` = URL do trong `.env` roi `docker compose up -d` de link file upload dung domain. Nginx da cau hinh lay IP that cua client (header `X-Forwarded-For`) nen gioi han SOS / dang nhap theo IP van dung khi di qua tunnel.

## Ket noi tu Frontend

- REST: `http://localhost:8000/api/v1`
- WebSocket (Laravel Echo, broadcaster `reverb`): host `localhost`, port `8000`, scheme `http`, key = `REVERB_APP_KEY`. Xac thuc kenh private: `POST /api/broadcasting/auth` voi Bearer token.

## CI

`.github/workflows/ci.yml` chay tren moi PR va push vao `main`:

- `backend`: Pint (`--test`) + `php artisan test` tren MariaDB 10.4.32.
- `docker`: `docker compose config` + build image `app`, `nginx`.

## Ghi chu bao mat

- `Infra/.env` da nam trong `.gitignore`, khong commit mat khau / khoa.
- MariaDB (3307) va phpMyAdmin (8081) chi mo tren `127.0.0.1`. Khi trien khai len VPS, dat HTTPS truoc nginx (reverse proxy / Cloudflare) va giu nguyen gioi han nay.
- `APP_DEBUG=false` mac dinh.
