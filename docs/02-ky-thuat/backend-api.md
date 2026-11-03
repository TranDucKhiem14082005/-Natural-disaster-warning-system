# Backend API v1

Base URL: `http://localhost:8000/api/v1`. Xac thuc: header `Authorization: Bearer <token>` (Sanctum). Moi response la JSON; danh sach co phan trang Laravel (`data`, `current_page`, `last_page`...).

## Quy uoc chung

- Toa do: `lat`, `lng` (WGS84). Trong DB luu `POINT(lng lat)` SRID 4326, GeoJSON cung theo thu tu `[lng, lat]`.
- Vai tro: `citizen`, `rescuer`, `officer`, `admin`. Khach = khong gui token.
- Dia ban: officer co `region_id` chi quan ly ban ghi cung `region_id` hoac `region_id = null`. Officer khong co `region_id` va admin quan ly tat ca.
- Loi validate: `422` + `errors`. Sai quyen: `403`. Khong thay / khong duoc xem: `404`.

## Vung anh huong canh bao (`area`)

```json
{ "type": "circle", "center": { "lat": 16.0471, "lng": 108.2068 }, "radius_m": 3000 }
{ "type": "polygon", "coordinates": [[108.20, 16.04], [108.21, 16.04], [108.21, 16.05], [108.20, 16.05]] }
```

Hinh tron duoc xap xi thanh da giac 32 dinh de dung `ST_Contains`. Response tra `area_geojson` (Polygon) de ve tren Leaflet.

## Vong doi canh bao

`draft` -> `pending` (submit) -> `published` (publish) -> `updated` (sua khi dang hieu luc) -> `ended` (end). `pending` -> `draft` (reject). Co the publish thang tu `draft`. Moi lan doi trang thai / sua deu tao 1 ban ghi `alert_versions`.

Khi publish hoac sua canh bao dang hieu luc: broadcast `alert.changed` tren kenh `alerts` va queue job gui thong bao (database + broadcast; email khi `severity >= 4`) cho nguoi dung co vi tri quan tam nam trong vung.

## Trang thai SOS

`new` -> `received` -> `rescuing` -> `safe`, chi duoc di tien tung buoc. Phan cong doi cuu ho tu dong chuyen `new` -> `received`. `priority` 1-5 tinh tu so nguoi + tinh trang (`injured`, `trapped`, `children`, `elderly`, `pregnant`, `disabled`). Cung so dien thoai gui lai trong 30 phut khi yeu cau chua `safe` -> tra ve yeu cau cu.

## Endpoint

### Cong khai

| Method | Path | Mo ta |
|---|---|---|
| POST | /auth/register | `name`, `email` hoac `phone`, `password`, `password_confirmation` |
| POST | /auth/login | `login` (email hoac phone), `password` -> `token` |
| POST | /auth/forgot-password | `email` -> gui link `FRONTEND_URL/reset-password?token=&email=` |
| POST | /auth/reset-password | `token`, `email`, `password`, `password_confirmation` |
| GET | /overview | So canh bao hieu luc, su kien dang dien ra, diem tru an con cho, 5 canh bao moi |
| GET | /map/layers?layers[]=alerts&layers[]=shelters&layers[]=reports&layers[]=sos | GeoJSON FeatureCollection theo lop; `sos` chi tra cho can bo |
| GET | /alerts | Loc: `q`, `disaster_type_id`, `region_id`, `severity`, `min_severity`, `status` (`active`/`published`/`updated`/`ended`), `from`, `to`, `lat`+`lng`+`radius_km` |
| GET | /alerts/at-point?lat=&lng= | Canh bao dang hieu luc bao trum diem |
| GET | /alerts/{id} | Chi tiet |
| GET | /events | Su kien thien tai, loc nhu alerts (`status`: `ongoing`/`ended`) |
| GET | /events/{id} | Chi tiet + canh bao lien quan |
| GET | /events/{id}/timeline | Cac phien ban canh bao theo thoi gian (phat lai dien bien) |
| GET | /reports | Bao cao da duyet; `lat`+`lng`+`radius_km` de tim gan |
| GET | /reports/{id} | Chi tiet |
| GET | /shelters | `available=1`, `region_id`, `lat`+`lng`+`radius_km` (sap xep theo khoang cach, tra `distance_m`) |
| GET | /shelters/{id} | Chi tiet |
| GET | /evacuation/route?lat=&lng= | Diem tru an gan nhat con cho, nam ngoai vung nguy hiem + tuyen duong |
| GET | /forecasts?region_id= | Du bao 3 ngay + `risk_level` 1-5 theo khu vuc |
| GET | /regions, /disaster-types | Danh muc |
| GET | /guides, /guides/{slug} | Cam nang ung pho |
| GET | /emergency-contacts?region_id= | Danh ba khan cap |
| POST | /sos | SOS khong can dang nhap: `contact_phone`, `lat`, `lng`, `people_count`, `conditions[]`, `note`. Gioi han 3 lan / 10 phut |
| GET | /sos/track/{tracking_code} | Theo doi tien trinh (khong lo toa do) |

### Da dang nhap

| Method | Path | Mo ta |
|---|---|---|
| POST | /auth/logout | Thu hoi token hien tai |
| GET / PATCH | /me | Ho so; doi mat khau can `current_password` |
| GET / POST | /me/locations | Vi tri quan tam (toi da 10): `label`, `lat`, `lng`, `address` |
| PATCH / DELETE | /me/locations/{id} | |
| GET | /dashboard | Theo vai tro: nguoi dan (canh bao tai vi tri + diem tru an gan nhat), cuu ho (SOS duoc giao), can bo (SOS chua xu ly, bao cao cho duyet, canh bao hieu luc) |
| GET | /notifications?unread=1 | Thong bao |
| POST | /notifications/{id}/read, /notifications/read-all | |
| POST | /reports | multipart: `disaster_type_id`, `description`, `lat`, `lng`, `media[]` (jpg/png/webp/mp4/mov, <= 20MB, toi da 5). Gioi han 10/gio |
| GET | /me/reports | Bao cao cua toi |
| POST | /reports/{id}/confirm | "Toi cung thay" (1 lan / nguoi, khong tu xac nhan) |
| GET | /me/sos | SOS cua toi |

### Cuu ho + can bo (`rescuer`, `officer`, `admin`)

| Method | Path | Mo ta |
|---|---|---|
| GET | /sos | Cuu ho: SOS duoc giao. Can bo: SOS trong dia ban. Loc `status`, `open=1`, `min_priority` |
| GET | /sos/{id} | Chi tiet |
| PATCH | /sos/{id}/status | `status` (buoc tiep theo), `is_verified` (chi can bo) |

### Can bo + admin (`/manage`)

| Method | Path | Mo ta |
|---|---|---|
| GET | /manage/alerts | Ca nhap / cho duyet |
| POST | /manage/alerts | Tao (nhap) |
| PATCH | /manage/alerts/{id} | Sua (+ `note`) |
| DELETE | /manage/alerts/{id} | Chi xoa duoc nhap |
| POST | /manage/alerts/{id}/submit, /publish, /reject, /end | Chuyen trang thai (`note` tuy chon) |
| GET | /manage/alerts/{id}/versions | Lich su phien ban |
| POST / PATCH | /manage/events, /manage/events/{id} | Su kien thien tai |
| GET | /manage/reports?status=pending | Hang doi duyet |
| PATCH | /manage/reports/{id}/review | `status`: `approved`/`rejected`, `review_note` |
| POST / PATCH / DELETE | /manage/shelters[/{id}] | Diem tru an |
| GET | /manage/sos/{id}/rescuers | Goi y doi cuu ho (it viec + gan nhat) |
| POST | /manage/sos/{id}/assign | `rescuer_id` |
| GET | /manage/stats | Thong ke: canh bao theo thang / loai / tinh / muc do, SOS theo trang thai / thang, thoi gian phan hoi trung binh. Loc `from`, `to`, `region_id`, `disaster_type_id` |

### Admin (`/admin`)

| Method | Path | Mo ta |
|---|---|---|
| GET / POST | /admin/users | Loc `q`, `role`, `region_id`; tao tai khoan voi vai tro bat ky |
| PATCH | /admin/users/{id} | Doi vai tro, dia ban, khoa (`is_active=false` thu hoi token) |
| GET / POST | /admin/catalog/{resource} | `resource`: `regions`, `disaster-types`, `guides`, `emergency-contacts` |
| PATCH / DELETE | /admin/catalog/{resource}/{id} | |
| GET | /admin/activity-logs | Nhat ky moi thao tac ghi cua can bo / admin |

## Realtime (Reverb)

| Kenh | Loai | Su kien | Ai nghe |
|---|---|---|---|
| `alerts` | public | `alert.changed` | Moi nguoi (cap nhat ban do) |
| `sos.{tracking_code}` | public | `sos.updated` | Nguoi gui SOS (khong co toa do) |
| `staff.sos` | private | `sos.updated` | Can bo, cuu ho |
| `App.Models.User.{id}` | private | thong bao `AlertIssued` | Nguoi dung trong vung canh bao |

Xac thuc kenh private: `POST /api/broadcasting/auth` voi Bearer token.

## Tac vu nen

| Lenh | Lich | Viec |
|---|---|---|
| `weather:fetch` | moi gio | Open-Meteo 3 ngay / khu vuc -> `weather_readings` + `risk_level`; mua > `RAIN_ALERT_THRESHOLD_MM` -> tao canh bao lu `pending` (`source=auto`) cho can bo duyet |
| `earthquakes:fetch` | 30 phut | USGS, M >= 3.5 quanh Viet Nam -> `disaster_events` (`source=usgs`) |

## Chua lam (ngoai pham vi backend MVP)

GDACS, Web Push / Telegram, CAP XML / RSS, Google OAuth, OTP email, "Toi an toan", tinh nguyen vien, diem tiep nhan cuu tro, xuat Excel / PDF, Swagger.
