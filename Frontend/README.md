# Frontend - Hệ thống cảnh báo thiên tai

SPA React 18 + TypeScript + Vite + Tailwind CSS, bản đồ Leaflet + OpenStreetMap, realtime qua Laravel Echo + Reverb.
Gọi REST API của [Backend](../Backend/README.md) (`/api/v1`, tài liệu: [backend-api.md](../docs/02-ky-thuat/backend-api.md)).

## Yêu cầu

- Node.js 18+ (đã thử với Node 25, npm 11)
- Backend đang chạy (XAMPP hoặc Docker), xem bên dưới

## Chạy nhanh (XAMPP, 6 terminal)

### 1. Backend

Bật **MySQL** trong XAMPP Control Panel, tạo database `disaster_warning` (utf8mb4_unicode_ci) trong phpMyAdmin.

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

## Tài khoản demo (mật khẩu `password`)

Trang đăng nhập có sẵn nút đăng nhập nhanh từng tài khoản.

| Email | Vai trò | Xem được |
|---|---|---|
| `citizen@demo.vn` | Người dân, nhà nằm trong vùng cảnh báo | Trang của tôi, thông báo, gửi báo cáo |
| `outsider@demo.vn` | Người dân ở Hà Nội, ngoài vùng | Dùng để so sánh: không nhận thông báo |
| `rescuer@demo.vn` | Đội cứu hộ | Điều phối SOS (SOS được giao) |
| `officer@demo.vn` | Cán bộ Đà Nẵng | Quản lý cảnh báo, duyệt báo cáo, SOS, thống kê |
| `admin@demo.vn` | Admin | Như cán bộ, thêm người dùng, danh mục, nhật ký |

## Kịch bản demo

1. **Khách**: trang chủ -> "Tôi có đang ở vùng nguy hiểm?" -> Bản đồ (bật/tắt lớp) -> Cảnh báo (lọc loại, mức độ, thời gian, "Gần tôi").
2. **Cán bộ** (`officer`): Quản lý -> Cảnh báo -> **+ Tạo cảnh báo** -> chọn loại (hướng dẫn tự điền theo mẫu) -> bấm lên bản đồ để vẽ đa giác (hoặc chọn "Tâm + bán kính") -> Lưu nháp -> **Phát hành**.
3. Mở cửa sổ ẩn danh, đăng nhập `citizen` trước bước 2: sau khi phát hành sẽ hiện **toast cảnh báo realtime** + chuông thông báo tăng. `outsider` không nhận gì.
4. **Sơ tán**: menu Trú ẩn hoặc nút "Tuyến sơ tán gần nhất" trên Bản đồ.
   Lưu ý: trong dữ liệu seed, cả 3 điểm trú ẩn đều nằm trong vùng cảnh báo bán kính 3km, nên API trả "Không tìm thấy điểm trú ẩn".
   Để demo, vào Quản lý -> Điểm trú ẩn thêm 1 điểm nằm ngoài vùng đỏ, rồi thử lại.
5. **SOS**: bấm nút đỏ **SOS** (không cần đăng nhập) -> gửi -> trang theo dõi theo mã. Đăng nhập `officer` ở cửa sổ khác -> Điều phối SOS -> chọn yêu cầu -> Giao cho đội cứu hộ / chuyển bước. Trang theo dõi của người gửi **tự đổi trạng thái**.
6. Kết thúc cảnh báo -> Sự kiện -> mở sự kiện -> **Phát lại diễn biến**; Quản lý -> Thống kê.

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
├── components/      # UI dùng chung (ui.tsx, layout, require-role, map/)
├── features/        # theo chức năng: alerts, events, map, shelters, reports, sos,
│                    # guides, profile, dashboard, notifications, manage (cán bộ), admin
├── hooks/           # use-fetch, use-geolocation, use-catalog, use-debounced
├── services/        # api.ts (fetch + Bearer token), echo.ts (Reverb)
├── store/           # auth-context (đăng nhập, vai trò)
├── types/           # kiểu dữ liệu khớp response Laravel
└── utils/           # nhãn tiếng Việt, định dạng, nén ảnh trước khi upload
```

Quyền trên giao diện chỉ để ẩn/hiện; mọi kiểm tra quyền thật nằm ở backend.
