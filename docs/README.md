# Tài liệu dự án - Hệ thống cảnh báo thiên tai

Trung tâm tài liệu của **Hệ thống cảnh báo thiên tai**, đồ án học phần *Phát triển mã nguồn mở (PTMNM)*.
Hệ thống gồm REST API **Laravel 12** và giao diện **React SPA**. Dữ liệu không gian lưu trên **MariaDB GIS**, thông báo realtime đi qua **Laravel Reverb**, bản đồ dùng **Leaflet + OpenStreetMap**.

> Cập nhật: 2026-11-05 · Áp dụng cho nhánh `main`

**Mục lục:** [Bắt đầu nhanh](#bắt-đầu-nhanh) · [Danh mục tài liệu](#danh-mục-tài-liệu) · [Tài liệu theo module](#tài-liệu-theo-module) · [Tổng quan hệ thống](#tổng-quan-hệ-thống) · [Cấu trúc thư mục](#cấu-trúc-thư-mục-docs) · [Quy ước viết tài liệu](#quy-ước-viết-tài-liệu)

---

## Bắt đầu nhanh

Chọn đúng tài liệu theo việc bạn cần làm:

| Tôi muốn... | Đọc |
|---|---|
| Chạy thử toàn bộ hệ thống trên máy trong vài phút | [Cách A - Docker trên máy](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#23-cách-a---chạy-toàn-bộ-bằng-docker-trên-máy) |
| Phát triển giao diện với hot reload | [Cách B - Backend Docker + Frontend dev](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#24-cách-b---backend-docker--frontend-dev-hot-reload) |
| Chạy bằng XAMPP, không dùng Docker | [Cách C - XAMPP](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#25-cách-c---chạy-bằng-xampp-không-docker) |
| Triển khai lên VPS | [Cách D - VPS](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#27-cách-d---triển-khai-lên-vps-docker) |
| Biết tài khoản demo và quyền của từng vai trò | [Vai trò, cổng và tài khoản demo](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#11-vai-trò-cổng-và-tài-khoản-demo) |
| Trình diễn hệ thống trong 5-7 phút | [Kịch bản demo](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#110-kịch-bản-demo-đầy-đủ-5-7-phút-dữ-liệu-nha-trang) |
| Tích hợp hoặc gọi API | [Backend API v1](02-ky-thuat/backend-api.md) |
| Chạy kiểm thử | [Chạy kiểm thử](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#26-chạy-kiểm-thử) |
| Gỡ lỗi khi cài đặt hoặc chạy | [Sự cố thường gặp](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#28-sự-cố-thường-gặp) |

Tài khoản demo sau khi seed: `admin`, `officer`, `rescuer`, `citizen`, `outsider` `@demo.vn`, mật khẩu `password`.

---

## Danh mục tài liệu

| Tài liệu | Nhóm | Nội dung chính | Người đọc |
|---|---|---|---|
| [Backend API v1](02-ky-thuat/backend-api.md) | Kỹ thuật | Quy ước chung, vùng ảnh hưởng, vòng đời cảnh báo, trạng thái SOS, danh sách endpoint theo quyền, kênh realtime, tác vụ nền | Lập trình viên backend/frontend, bên tích hợp |
| [Hướng dẫn sử dụng và triển khai](04-van-hanh/huong-dan-su-dung-va-trien-khai.md) | Vận hành | Toàn bộ chức năng theo vai trò; chạy local, Docker, XAMPP, VPS; kiểm thử; xử lý sự cố | Người dùng, giảng viên, người vận hành, thành viên mới |

### Backend API v1

- [Quy ước chung](02-ky-thuat/backend-api.md#quy-uoc-chung): tọa độ, vai trò, địa bàn, mã lỗi, lọc thời gian.
- [Vùng ảnh hưởng cảnh báo](02-ky-thuat/backend-api.md#vung-anh-huong-canh-bao-area): định dạng đa giác và hình tròn.
- [Vòng đời cảnh báo](02-ky-thuat/backend-api.md#vong-doi-canh-bao): `draft` -> `pending` -> `published` -> `updated` -> `ended`.
- [Trạng thái SOS](02-ky-thuat/backend-api.md#trang-thai-sos): `new` -> `received` -> `rescuing` -> `safe`, cách tính độ ưu tiên.
- [Endpoint](02-ky-thuat/backend-api.md#endpoint): công khai, đã đăng nhập, cứu hộ, cán bộ, admin.
- [Realtime (Reverb)](02-ky-thuat/backend-api.md#realtime-reverb) và [Tác vụ nền](02-ky-thuat/backend-api.md#tac-vu-nen).

### Hướng dẫn sử dụng và triển khai

**Phần 1 - Chức năng**

- [1.2. Khách (không cần đăng nhập)](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#12-chức-năng-cho-khách-không-cần-đăng-nhập)
- [1.4. Người dân](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#14-chức-năng-cho-người-dân-citizen)
- [1.5. Đội cứu hộ](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#15-chức-năng-cho-đội-cứu-hộ-rescuer)
- [1.6. Cán bộ quản lý](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#16-chức-năng-cho-cán-bộ-quản-lý-officer)
- [1.7. Quản trị viên](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#17-chức-năng-cho-quản-trị-viên-admin)
- [1.8. Các tiến trình chạy ngầm](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#18-các-tiến-trình-chạy-ngầm)
- [1.9. Bản đồ nền và chủ quyền Việt Nam](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#19-bản-đồ-nền-và-chủ-quyền-việt-nam)
- [1.11. Giới hạn hiện tại](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#111-giới-hạn-hiện-tại)

**Phần 2 - Cài đặt và vận hành**

- [2.1. Chọn cách chạy](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#21-chọn-cách-chạy)
- [2.2. Yêu cầu phần mềm](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#22-yêu-cầu-phần-mềm)
- [2.3 - 2.5. Chạy local (Docker, Frontend dev, XAMPP)](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#23-cách-a---chạy-toàn-bộ-bằng-docker-trên-máy)
- [2.7. Triển khai VPS: bảo mật SSH, Docker, cập nhật, HTTPS](04-van-hanh/huong-dan-su-dung-va-trien-khai.md#27-cách-d---triển-khai-lên-vps-docker)

---

## Tài liệu theo module

Mỗi module có README riêng đặt cạnh mã nguồn, mô tả cách cài đặt và cấu trúc của module đó.

| Module | README | Nội dung |
|---|---|---|
| Backend | [Backend/README.md](../Backend/README.md) | Cài đặt Laravel bằng XAMPP, chạy server, queue, Reverb, scheduler |
| Frontend | [Frontend/README.md](../Frontend/README.md) | Cài đặt SPA, biến môi trường `VITE_*`, cấu trúc `src/` |
| Infra | [Infra/README.md](../Infra/README.md) | Các service Docker Compose, chạy lần đầu, seed, Cloudflare Tunnel |
| CI | [.github/workflows/ci.yml](../.github/workflows/ci.yml) | Pint + `php artisan test` trên MariaDB 10.4; kiểm tra và build image Docker |

---

## Tổng quan hệ thống

| Thành phần | Công nghệ |
|---|---|
| Backend | PHP 8.2, Laravel 12, REST API `/api/v1`, xác thực Laravel Sanctum (token) |
| Cơ sở dữ liệu | MariaDB 10.4.32, dữ liệu không gian SRID 4326 (`POINT(lng lat)`, `ST_Contains`) |
| Realtime | Laravel Reverb + Broadcasting (WebSocket), Laravel Echo phía client |
| Hàng đợi, lịch | Laravel Database Queue, Laravel Scheduler (Open-Meteo mỗi giờ, USGS mỗi 30 phút) |
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 3 |
| Bản đồ | Leaflet, bản đồ nền vector OpenFreeMap (MapLibre GL), dẫn đường OSRM, tìm địa chỉ Photon |
| Triển khai | XAMPP (phát triển); Docker Compose + Nginx + PHP-FPM (triển khai) |

Hệ thống có 5 vai trò: **khách**, **người dân**, **đội cứu hộ**, **cán bộ quản lý** (theo địa bàn) và **quản trị viên**.
Giao diện tương ứng chia thành 4 cổng: công khai (`/`, `/me`), cứu hộ (`/rescuer`), điều hành (`/officer`) và quản trị (`/admin`).
Mọi kiểm tra quyền đều thực hiện ở backend.

---

## Cấu trúc thư mục `docs/`

```
docs/
├── README.md            Trang này: mục lục và quy ước
├── 01-tong-quan/        Tổng quan, mục tiêu, kiến trúc tổng, roadmap
├── 02-ky-thuat/         API, cơ sở dữ liệu, quyết định kỹ thuật, tích hợp, bảo mật
│   └── backend-api.md
├── 03-san-pham/         Đặc tả tính năng, yêu cầu, user story
├── 04-van-hanh/         Triển khai, vận hành, CI/CD, sự cố, sao lưu
│   └── huong-dan-su-dung-va-trien-khai.md
├── 05-mau/              Mẫu tài liệu, checklist tái sử dụng
├── 06-design/           UI/UX, wireframe, sơ đồ, user flow
└── 99-ghi-chu/          Ghi chú nhanh, biên bản họp, nội dung chưa phân loại
```

Thư mục nhóm chỉ được tạo khi có tài liệu đầu tiên thuộc nhóm đó.

---

## Quy ước viết tài liệu

**Vị trí**

- Mọi tài liệu `.md` của dự án nằm trong `docs/<nhóm>/`, chọn nhóm theo bảng ở mục trên.
- Ngoại lệ: README của từng module đặt cạnh mã nguồn (`Backend/`, `Frontend/`, `Infra/`).
- Sơ đồ dạng HTML/SVG đặt trong `06-design/`; ảnh minh hoạ gắn với một tài liệu đặt trong `docs/<nhóm>/assets/`.

**Đặt tên**

- Tên file dạng `kebab-case`, không dấu, không khoảng trắng, có nghĩa (vd `backend-api.md`).
- Tài liệu gắn với thời điểm thêm tiền tố ngày ISO: `2026-11-05-su-co-reverb.md`.

**Nội dung**

- Viết tiếng Việt có dấu; giữ nguyên tên kỹ thuật, lệnh, đường dẫn trong `code`.
- Mở đầu bằng 1-2 câu nêu phạm vi và dòng `Cập nhật: YYYY-MM-DD`.
- Tọa độ ghi theo thứ tự `lat`, `lng` trong văn bản; GeoJSON và CSDL theo `[lng, lat]`.
- Không ghi mật khẩu thật, khoá API, `APP_KEY` hay nội dung file `.env` vào tài liệu.

**Cập nhật**

- Thêm tài liệu mới: thêm một dòng vào [Danh mục tài liệu](#danh-mục-tài-liệu) của trang này.
- Đổi hành vi API hoặc cách chạy: sửa tài liệu liên quan trong cùng pull request với phần code.
- Gửi thay đổi qua pull request vào `main`; ghi rõ tài liệu nào được sửa trong mô tả PR.
