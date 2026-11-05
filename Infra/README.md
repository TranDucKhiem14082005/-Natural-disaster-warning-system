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
| `db` | `mysql:8.4.6` | CSDL MySQL 8.4 (bat buoc), ho tro GIS SRID 4326. Volume `mysql-data`. Host: `127.0.0.1:3307` |
| `phpmyadmin` | `phpmyadmin:5.2` | `http://127.0.0.1:8081` (chi localhost). Co the dung phpMyAdmin cua XAMPP thay the (xem duoi) |
| `tunnel` | `cloudflare/cloudflared` | Tuy chon (profile `tunnel`): link cong khai khi demo |

Volume `storage` (thu muc `storage/` cua Laravel) duoc dung chung giua cac container Laravel va nginx (nginx chi doc), nen anh/video bao cao khong mat khi tao lai container.

Chua bao gom Redis / MinIO: dac ta uu tien Database Queue va luu file cuc bo o giai doan dau.

Chuyen tu MariaDB sang MySQL 8.4: MySQL khong mo duoc thu muc du lieu cua MariaDB, nen `db` dung volume moi `mysql-data` (CSDL trong). Sau lan `up` dau tien phai chay lai `db:seed`. Volume MariaDB cu `db-data` khong bi dong toi; khi khong can nua thi xoa bang `docker volume rm disaster-warning_db-data`.

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
docker compose exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup.sql
```

## Quan ly CSDL bang phpMyAdmin cua XAMPP

Nhom van dung phpMyAdmin cua XAMPP (`C:\xampp\phpMyAdmin`, ban 5.2.1) de quan ly MySQL 8.4 trong Docker. Them 1 server vao cuoi `C:\xampp\phpMyAdmin\config.inc.php`:

```php
$i++;
$cfg['Servers'][$i]['verbose'] = 'MySQL 8.4 - du an (Docker :3307)';
$cfg['Servers'][$i]['host'] = '127.0.0.1';
$cfg['Servers'][$i]['port'] = '3307';
$cfg['Servers'][$i]['auth_type'] = 'cookie';
$cfg['Servers'][$i]['AllowNoPassword'] = false;
```

Bat Apache trong XAMPP Control Panel, mo `http://localhost/phpmyadmin`, chon server "MySQL 8.4 - du an (Docker :3307)", dang nhap bang `dws` / `DB_PASSWORD` hoac `root` / `DB_ROOT_PASSWORD` trong `Infra/.env`. phpMyAdmin trong Docker (`http://127.0.0.1:8081`) van dung duoc thay the.

Auth plugin `caching_sha2_password` (mac dinh MySQL 8.4): mysqli cua PHP 8.2 (XAMPP) tu trao doi khoa RSA nen dang nhap duoc ngay. Neu loi: kiem tra cong 3307, user/mat khau trong `Infra/.env` va extension `openssl` trong `C:\xampp\php\php.ini`.

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

- `backend`: Pint (`--test`) + `php artisan test` tren MySQL 8.4.
- `docker`: `docker compose config` + build image `app`, `nginx`.

## Ghi chu bao mat

- `Infra/.env` da nam trong `.gitignore`, khong commit mat khau / khoa.
- MySQL (3307) va phpMyAdmin (8081) chi mo tren `127.0.0.1`. Khi trien khai len VPS, dat HTTPS truoc nginx (reverse proxy / Cloudflare) va giu nguyen gioi han nay.
- `APP_DEBUG=false` mac dinh.
