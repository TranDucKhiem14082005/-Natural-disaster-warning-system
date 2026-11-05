# Frontend - Hệ thống cảnh báo thiên tai

SPA React 18 + TypeScript + Vite + Tailwind CSS, bản đồ Leaflet + OpenStreetMap, realtime qua Laravel Echo + Reverb.
Gọi REST API của [Backend](../Backend/README.md) (`/api/v1`, tài liệu: [backend-api.md](../docs/02-ky-thuat/backend-api.md)).

## Yêu cầu

- Node.js 18+ (đã thử với Node 25, npm 11)
- Backend đang chạy (XAMPP hoặc Docker), xem bên dưới

## Chạy nhanh (XAMPP, 6 terminal)

### 1. Backend

Chạy **MySQL 8.4** (Docker `Infra/` cổng 3307 hoặc MySQL Community Server 8.4 cài trên máy; module MySQL của XAMPP là MariaDB, không dùng), tạo database `disaster_warning` (utf8mb4_unicode_ci) bằng phpMyAdmin của XAMPP. Chi tiết: [Backend/README.md](../Backend/README.md).

```bash
cd Backend
composer install
cp .env.example .env
php artisan key:generate
```

Sửa `Backend/.env` để bật realtime (tự đặt giá trị, không commit file `.env`):

```dotenv
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=<so-bat-ky>
REVERB_APP_KEY=<chuoi-ngau-nhien>
REVERB_APP_SECRET=<chuoi-ngau-nhien-khac>
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http
```

Hoặc chạy `php artisan reverb:install` để Laravel tự sinh các khoá này.

```bash
php artisan migrate --seed
php artisan storage:link
```

Chạy 3 tiến trình, mỗi lệnh 1 terminal, trong `Backend/`:

```bash
php artisan serve          # API  http://127.0.0.1:8000
php artisan reverb:start   # WebSocket :8080
php artisan queue:work     # gửi thông báo + broadcast (bắt buộc cho realtime)
```

### 2. Frontend

```bash
cd Frontend
npm install
cp .env.example .env       # điền VITE_REVERB_APP_KEY = REVERB_APP_KEY ở Backend/.env 
npm run dev
```

Mở **http://localhost:5173**.

Vite proxy `/api`, `/storage` sang `127.0.0.1:8000` và `/app` (WebSocket) sang Reverb `127.0.0.1:8080`, nên không cần cấu hình CORS.
Nếu để trống `VITE_REVERB_APP_KEY` thì app vẫn chạy, chỉ tắt realtime (tải lại trang để thấy dữ liệu mới).

## 4 cổng theo vai trò (mật khẩu demo `password`)

Đăng nhập xong, mỗi vai trò được đưa thẳng về cổng của mình (vào nhầm cổng thì tự chuyển về). Trang đăng nhập có nút đăng nhập nhanh.

| Cổng | Đường dẫn | Tài khoản | Dành cho |
|---|---|---|---|
| Công khai + người dân | `/`, `/me/*` | `citizen@demo.vn` (nhà trong vùng cảnh báo), `outsider@demo.vn` (Hà Nội, ngoài vùng) | Trang chủ kiểm tra "Khu vực của bạn", bản đồ, cảnh báo, trú ẩn/sơ tán, SOS một chạm, báo cáo, "Của tôi" |
| Đội cứu hộ | `/rescuer/*` | `rescuer@demo.vn` | Nhiệm vụ được giao, chi tiết + chỉ đường, bản đồ nhiệm vụ, lịch sử |
| Cán bộ | `/officer/*` | `officer@demo.vn` (Khánh Hoà) | Tổng quan điều hành, điều phối SOS, cảnh báo, duyệt báo cáo, sự kiện, trú ẩn, thống kê |
| Quản trị | `/admin/*` | `admin@demo.vn` | Tổng quan hệ thống, người dùng, danh mục, nhật ký; dùng được toàn bộ cổng cán bộ |

## Kịch bản demo

1. **Khách**: trang chủ -> "Kiểm tra vị trí của tôi" -> Bản đồ (bật/tắt lớp) -> Cảnh báo (lọc loại, mức độ, thời gian, "Gần tôi").
2. **Cán bộ** (`officer`): Cảnh báo -> **Tạo cảnh báo** -> chọn loại (hướng dẫn tự điền theo mẫu) -> vẽ vùng (đa giác hoặc tâm + bán kính) -> Lưu nháp -> **Phát hành**.
3. Mở cửa sổ ẩn danh, đăng nhập `citizen` trước bước 2: sau khi phát hành sẽ hiện **banner cảnh báo realtime** + chuông thông báo tăng. `outsider` không nhận gì.
4. **Sơ tán**: Trú ẩn -> Tuyến sơ tán (hoặc nút trên Bản đồ). Dữ liệu demo đặt ở Nha Trang; ĐH Khánh Hoà nằm ngoài vùng ngập Ngọc Hiệp để làm đích.
5. **SOS**: bấm nút đỏ **SOS** (không cần đăng nhập) -> gửi -> trang theo dõi theo mã. `officer` -> Điều phối SOS -> giao cho đội cứu hộ. `rescuer` -> Nhiệm vụ -> **Bắt đầu cứu hộ** -> **Đã an toàn**. Trang theo dõi của người gửi **tự đổi trạng thái**.
6. Kết thúc cảnh báo -> Sự kiện -> mở sự kiện -> **Phát lại diễn biến**; cán bộ -> Thống kê.

Ảnh nền bản đồ mặc định lấy từ `tile.openstreetmap.de` (một số nhà mạng VN chặn `*.openstreetmap.org`); đổi bằng `VITE_MAP_TILE_URL`.

## Lệnh

```bash
npm run dev         # dev server :5173
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + build ra dist/
npm run preview     # xem bản build
```

## Cấu trúc

```
src/
├── components/      # ui/ (design system), map/, shell/ (logo, chuông, menu tài khoản), require-role
├── layouts/         # public-layout (khách + người dân), rescuer-layout, console-layout (cán bộ + quản trị)
├── features/        # theo chức năng: overview, alerts, events, map, shelters, reports, sos, guides,
│                    # citizen, profile, notifications, auth, rescuer, manage (cán bộ), admin
├── hooks/           # use-fetch, use-geolocation, use-catalog, use-debounced
├── services/        # api.ts (fetch + Bearer token), echo.ts (Reverb)
├── store/           # auth-context (đăng nhập, vai trò), notifications-context (chuông + banner realtime)
├── types/           # kiểu dữ liệu khớp response Laravel
└── utils/           # nhãn tiếng Việt, định dạng, roles (cổng theo vai trò), directions (OSRM), nén ảnh
```

Quyền trên giao diện chỉ để ẩn/hiện; mọi kiểm tra quyền thật nằm ở backend.
