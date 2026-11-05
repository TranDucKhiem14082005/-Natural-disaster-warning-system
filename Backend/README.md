# Backend - He thong canh bao thien tai

REST API (Laravel 12, PHP 8.2+, MySQL 8.4 GIS, Sanctum, Reverb). Tai lieu endpoint: [docs/02-ky-thuat/backend-api.md](../docs/02-ky-thuat/backend-api.md).

## Cai dat (XAMPP)

XAMPP chi dung cho Apache + PHP 8.2 + phpMyAdmin. CSDL bat buoc la **MySQL 8.4**; XAMPP di kem MariaDB nen khong dung module MySQL cua XAMPP lam CSDL cua du an.

1. CSDL MySQL 8.4, chon 1 trong 2:
   - A. MySQL trong Docker (`Infra/`, image `mysql:8.4.6`, cong `127.0.0.1:3307`), xem [Infra/README.md](../Infra/README.md).
   - B. Cai **MySQL Community Server 8.4** tren may (cong 3306). Truoc do tat module MySQL (MariaDB) trong XAMPP Control Panel, hoac cho MySQL 8.4 chay cong khac.
2. Them server MySQL 8.4 vao phpMyAdmin cua XAMPP, cuoi file `C:\xampp\phpMyAdmin\config.inc.php`:

```php
$i++;
$cfg['Servers'][$i]['verbose'] = 'MySQL 8.4 - du an (Docker :3307)';
$cfg['Servers'][$i]['host'] = '127.0.0.1';
$cfg['Servers'][$i]['port'] = '3307';   // phuong an B: '3306'
$cfg['Servers'][$i]['auth_type'] = 'cookie';
$cfg['Servers'][$i]['AllowNoPassword'] = false;
```

   Bat Apache trong XAMPP, mo `http://localhost/phpmyadmin`, chon server MySQL 8.4 roi dang nhap (A: `dws` / `DB_PASSWORD` hoac `root` / `DB_ROOT_PASSWORD` trong `Infra/.env`; B: tai khoan tao khi cai MySQL). phpMyAdmin Docker `http://127.0.0.1:8081` dung thay the duoc (phuong an A).
   MySQL 8.4 mac dinh dung auth plugin `caching_sha2_password`; mysqli (mysqlnd) cua PHP 8.2 trong XAMPP tu trao doi khoa RSA nen dang nhap duoc ngay (da thu ca tai khoan moi tao). Neu van loi: kiem tra dung cong (3307 cho Docker), dung user/mat khau trong `Infra/.env`, va extension `openssl` dang bat trong `C:\xampp\php\php.ini`.
3. Tao 2 database `disaster_warning` va `disaster_warning_test` (utf8mb4_unicode_ci) trong phpMyAdmin hoac MySQL Workbench. (Phuong an A da tu tao `disaster_warning`.)
4. Trong `.env`: `DB_CONNECTION=mysql`, `DB_HOST=127.0.0.1`, `DB_PORT=3307` (A) hoac `3306` (B), `DB_USERNAME` / `DB_PASSWORD` tuong ung.
5. Chay:

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan reverb:install   # sinh REVERB_APP_ID/KEY/SECRET neu .env chua co
php artisan migrate --seed
php artisan storage:link
```

6. Chay cac tien trinh (4 terminal):

```bash
php artisan serve            # API: http://localhost:8000/api/v1
php artisan queue:work       # gui thong bao, broadcast
php artisan reverb:start     # WebSocket: ws://localhost:8080
php artisan schedule:work    # lay du lieu Open-Meteo (1h) va USGS (30 phut)
```

## Chay bang Docker Compose

Docker Compose chinh thuc nam o [Infra/](../Infra/README.md) (nginx + php-fpm + queue + scheduler + reverb + MySQL 8.4 + phpMyAdmin), build tu `Backend/` va `Frontend/`:

```bash
cd Infra
cp .env.example .env                                 # dien APP_KEY, DB_*, REVERB_* (xem Infra/README.md)
docker compose up -d --build                         # build + tu chay migrate
docker compose exec app php artisan db:seed --force  # nap du lieu demo (1 lan)
```

Web + API: http://localhost:8000, MySQL tu may host: `127.0.0.1:3307`, phpMyAdmin: XAMPP `http://localhost/phpmyadmin` (server "MySQL 8.4 - du an (Docker :3307)") hoac `http://127.0.0.1:8081`.

## Tai khoan demo (mat khau: `password`)

| Email | Vai tro |
|---|---|
| admin@demo.vn | Admin |
| officer@demo.vn | Can bo Khanh Hoa (Nha Trang) |
| rescuer@demo.vn | Doi cuu ho |
| citizen@demo.vn | Nguoi dan (nha trong vung canh bao) |
| outsider@demo.vn | Nguoi dan (Ha Noi, ngoai vung) |

## Lenh huu ich

```bash
php artisan test               # chay tren DB disaster_warning_test
php artisan weather:fetch      # lay du bao + de xuat canh bao lu khi mua > RAIN_ALERT_THRESHOLD_MM
php artisan earthquakes:fetch  # nhap dong dat USGS
```

`ORS_API_KEY` (OpenRouteService, mien phi) de trong thi tuyen so tan tra ve duong thang toi diem tru an.
