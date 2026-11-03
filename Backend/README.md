# Backend - He thong canh bao thien tai

REST API (Laravel 12, PHP 8.2+, MariaDB 10.4 GIS, Sanctum, Reverb). Tai lieu endpoint: [docs/02-ky-thuat/backend-api.md](../docs/02-ky-thuat/backend-api.md).

## Cai dat (XAMPP)

1. Bat MySQL (MariaDB) trong XAMPP Control Panel. Tao 2 database `disaster_warning` va `disaster_warning_test` (utf8mb4_unicode_ci) trong phpMyAdmin.
2. Chay:

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan reverb:install   # sinh REVERB_APP_ID/KEY/SECRET neu .env chua co
php artisan migrate --seed
php artisan storage:link
```

3. Chay cac tien trinh (4 terminal):

```bash
php artisan serve            # API: http://localhost:8000/api/v1
php artisan queue:work       # gui thong bao, broadcast
php artisan reverb:start     # WebSocket: ws://localhost:8080
php artisan schedule:work    # lay du lieu Open-Meteo (1h) va USGS (30 phut)
```

## Tai khoan demo (mat khau: `password`)

| Email | Vai tro |
|---|---|
| admin@demo.vn | Admin |
| officer@demo.vn | Can bo Da Nang |
| rescuer@demo.vn | Doi cuu ho |
| citizen@demo.vn | Nguoi dan (nha trong vung canh bao) |
| outsider@demo.vn | Nguoi dan (Ha Noi, ngoai vung) |

## Lenh huu ich

```bash
php artisan test               # 23 test, chay tren DB disaster_warning_test
php artisan weather:fetch      # lay du bao + de xuat canh bao lu khi mua > RAIN_ALERT_THRESHOLD_MM
php artisan earthquakes:fetch  # nhap dong dat USGS
```

`ORS_API_KEY` (OpenRouteService, mien phi) de trong thi tuyen so tan tra ve duong thang toi diem tru an.
