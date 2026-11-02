# Các chức năng của hệ thống cảnh báo thiên tai
## Học phần Phát triển mã nguồn mở (PTMNM)

> Ký hiệu: **[MVP]** cần có để demo · **[+]** điểm cộng, làm khi còn thời gian · ✨ chức năng bổ sung so với bản gốc.

### 0. ✨ Vai trò người dùng

| Vai trò | Quyền chính |
|---|---|
| Khách (chưa đăng nhập) | Xem bản đồ, cảnh báo công khai, cẩm nang; gửi SOS nhanh |
| Người dân | Nhận cảnh báo theo vị trí, gửi báo cáo, gửi SOS, đánh dấu "Tôi an toàn" |
| Tình nguyện viên / Đội cứu hộ | Nhận và xử lý các yêu cầu SOS được phân công |
| Cán bộ quản lý (theo địa bàn) | Tạo, duyệt, cập nhật cảnh báo; duyệt báo cáo; điều phối SOS trong địa bàn |
| Admin | Quản lý người dùng, vai trò, danh mục (loại thiên tai, khu vực), cấu hình hệ thống |

### 1. Đăng nhập, phân quyền và trang tổng quan

- **[MVP]** Đăng nhập vào hệ thống.
- **[MVP]** Phân quyền theo vai trò người dùng.
- **[MVP]** Hiển thị trang tổng quan về tình hình thiên tai và các cảnh báo.
- ✨ **[MVP]** Đăng ký tài khoản bằng email/số điện thoại, quên mật khẩu.
- ✨ **[+]** Đăng nhập bằng Google (OAuth2). Xác thực OTP qua email, không dùng OTP qua SMS.
- ✨ **[MVP]** Hồ sơ cá nhân: lưu các vị trí quan tâm (nhà, nơi làm việc, nhà người thân) để nhận cảnh báo đúng khu vực.
- ✨ **[MVP]** Dashboard theo vai trò:
  - Người dân: cảnh báo gần mình, điểm trú ẩn gần nhất.
  - Cán bộ: số SOS chưa xử lý, báo cáo chờ duyệt, cảnh báo đang hiệu lực.
- ✨ **[+]** Nhật ký hoạt động (audit log) cho mọi thao tác quản trị.

### 2. Tạo, cập nhật và quản lý cảnh báo

- **[MVP]** Theo dõi và quản lý các sự kiện thiên tai đang xảy ra.
- **[MVP]** Cho phép Admin/người quản lý tạo, cập nhật và quản lý cảnh báo.
- **[MVP]** Cho phép người dùng xem các cảnh báo liên quan.
- ✨ **[MVP]** Vẽ vùng ảnh hưởng trực tiếp trên bản đồ (đa giác hoặc tâm + bán kính) khi tạo cảnh báo.
- ✨ **[MVP]** Vòng đời cảnh báo: Nháp → Chờ duyệt → Phát hành → Cập nhật → Kết thúc. Mỗi lần cập nhật lưu lại phiên bản.
- ✨ **[+]** Mẫu cảnh báo theo loại thiên tai (lũ, bão, sạt lở, động đất, hạn mặn...) kèm hướng dẫn hành động cho người dân.
- ✨ **[+]** Xuất cảnh báo theo chuẩn mở CAP (Common Alerting Protocol) dạng XML và RSS feed để hệ thống khác dùng lại.

#### Các chức năng phụ

**Báo cáo từ người dân**

- **[MVP]** Tiếp nhận báo cáo tình hình thiên tai từ người dân.
- ✨ **[MVP]** Báo cáo kèm ảnh/video, vị trí GPS, loại sự cố, mô tả.
- ✨ **[MVP]** Cán bộ duyệt/từ chối báo cáo; báo cáo đã duyệt hiện trên bản đồ.
- ✨ **[+]** Người dân khác bấm "Tôi cũng thấy" để tăng độ tin cậy của báo cáo.
- ✨ **[+]** Chống spam: giới hạn số lần gửi, CAPTCHA.

**Sơ tán và điểm trú ẩn**

- **[MVP]** Đề xuất tuyến đường sơ tán phù hợp.
- ✨ **[MVP]** Quản lý điểm trú ẩn: vị trí, sức chứa, số người hiện tại, tiện ích (nước, y tế, điện).
- ✨ **[+]** Tuyến sơ tán tránh vùng nguy hiểm, dẫn tới điểm trú ẩn gần nhất còn chỗ (dùng OpenRouteService gói miễn phí, có hạn mức; cache tuyến đã tính để tiết kiệm lượt gọi).

**Cầu cứu (SOS)**

- **[MVP]** Cho phép người dân gửi tín hiệu cầu cứu khi đang ở trong vùng nguy hiểm và cần được hỗ trợ khẩn cấp.
- ✨ **[MVP]** SOS một chạm: tự lấy vị trí GPS, nhập số người, tình trạng (bị thương, trẻ em, người già, mắc kẹt). Cho phép gửi SOS nhanh không cần đăng nhập, đồng thời có cơ chế xác minh và chống spam.
- ✨ **[MVP]** Trạng thái SOS: Mới → Đã tiếp nhận → Đang cứu hộ → Đã an toàn. Người gửi theo dõi tiến trình theo thời gian thực.
- ✨ **[+]** Cán bộ phân công đội cứu hộ gần nhất; ưu tiên SOS theo mức độ nguy cấp.
- ✨ **[+]** "Tôi an toàn" (safety check): người dân trong vùng cảnh báo đánh dấu an toàn, người thân được cấp quyền có thể xem trạng thái.

### 3. Bản đồ và thông tin thiên tai

- **[MVP]** Hiển thị trên bản đồ các khu vực đang bị ảnh hưởng và các khu vực có nguy cơ bị ảnh hưởng trong tương lai.
- **[MVP]** Hiển thị danh sách thiên tai đang xảy ra và thông tin chi tiết của từng sự kiện.
- **[MVP]** Gửi thông báo cảnh báo đến người dùng và cho phép người dùng xem các thông báo.
- **[MVP]** Dự báo thiên tai và đánh giá mức độ nguy hiểm.

**Bản đồ** ✨

- **[MVP]** Dùng bản đồ mở Leaflet + OpenStreetMap (không phụ thuộc Google Maps).
- **[MVP]** Các lớp bật/tắt: vùng cảnh báo, điểm trú ẩn, báo cáo người dân, SOS (chỉ cán bộ có quyền thấy).
- **[+]** Lớp thời tiết (lượng mưa, gió), heatmap mật độ SOS/báo cáo.

**Thông báo** ✨

- **[MVP]** Thông báo realtime trong ứng dụng bằng WebSocket thông qua Laravel Reverb và Laravel Broadcasting.
- **[MVP]** Geofencing: chỉ gửi cảnh báo cho người có vị trí quan tâm nằm trong vùng ảnh hưởng.
- **[+]** Đa kênh: Web Push (VAPID), email (SMTP), Telegram Bot. Mức khẩn cấp quyết định kênh gửi. Không sử dụng SMS vì có thể phát sinh phí theo tin.

**Dự báo và đánh giá nguy hiểm** ✨

- **[MVP]** Tích hợp dữ liệu mở: Open-Meteo (mưa, gió), USGS (động đất), GDACS (thiên tai toàn cầu).
- **[+]** Quy tắc ngưỡng tự động, ví dụ mưa > 100mm/24h → hệ thống đề xuất cảnh báo lũ, cán bộ duyệt mới phát hành.
- **[+]** Chấm điểm rủi ro theo khu vực (mức 1-5) dựa trên dữ liệu dự báo và lịch sử.

### 4. Tìm kiếm và lọc thông tin

- **[MVP]** Tìm kiếm theo địa điểm.
- **[MVP]** Tìm kiếm hoặc lọc theo loại thiên tai.
- **[MVP]** Tìm kiếm hoặc lọc theo mức độ nguy hiểm.
- ✨ **[MVP]** Lọc theo khoảng thời gian và trạng thái (đang diễn ra / đã kết thúc).
- ✨ **[+]** Tìm "gần tôi" theo bán kính bằng các chức năng dữ liệu không gian của MariaDB (Spatial Data / GIS).
- ✨ **[+]** Tìm kiếm tiếng Việt không dấu.

### 5. Lịch sử cảnh báo và thống kê

- **[MVP]** Lưu trữ và tra cứu lịch sử cảnh báo.
- **[MVP]** Thống kê tình hình thiên tai và số lượng cảnh báo.
- **[MVP]** Hỗ trợ xem lại các sự kiện theo thời gian, địa điểm hoặc loại thiên tai.
- ✨ **[MVP]** Biểu đồ: số cảnh báo theo tháng, theo loại, theo tỉnh; số SOS và thời gian phản hồi SOS trung bình.
- ✨ **[+]** Xuất báo cáo Excel/PDF.
- ✨ **[+]** Phát lại diễn biến một sự kiện trên bản đồ theo dòng thời gian.

### 6. ✨ Cộng đồng và hỗ trợ

- **[+]** Đăng ký tình nguyện viên: kỹ năng, phương tiện (thuyền, xe), khu vực có thể hỗ trợ.
- **[+]** Điểm tiếp nhận cứu trợ: nhu yếu phẩm đang cần, đã nhận.
- **[MVP]** Cẩm nang kỹ năng ứng phó theo từng loại thiên tai.
- **[MVP]** Danh bạ khẩn cấp: 112, 113, 114, 115, số cứu hộ địa phương (bấm để gọi).

### 7. ✨ Hoạt động khi mất mạng / mạng yếu

- **[+]** PWA: cài được lên điện thoại, cache cảnh báo mới nhất và cẩm nang để xem offline.
- **[+]** SOS offline: lưu yêu cầu vào hàng đợi trên thiết bị và tự gửi khi có mạng trở lại. Có thể cung cấp nút mở ứng dụng SMS với nội dung soạn sẵn và tọa độ để người dùng chủ động gửi.

### 8. ✨ Yêu cầu phi chức năng (trọng tâm môn PTMNM)

**Stack mã nguồn mở gợi ý**

| Thành phần | Công nghệ |
|---|---|
| Frontend | Laravel Blade + HTML/CSS/JavaScript (khuyến nghị để giảm độ phức tạp); có thể dùng React / Vue + Vite nếu cần giao diện độc lập |
| Backend | **PHP 8.2+ + Laravel** |
| CSDL | **MariaDB 10.4.32 (tích hợp trong XAMPP hiện tại), hỗ trợ dữ liệu không gian (Spatial Data / GIS)** |
| Công cụ quản trị CSDL | **phpMyAdmin (tích hợp trong XAMPP)** |
| Realtime | Laravel Reverb + Laravel Broadcasting (WebSocket) |
| Bản đồ / dẫn đường | Leaflet + OpenStreetMap, OpenRouteService gói miễn phí (không dùng Google Maps) |
| Hàng đợi / cache | Laravel Queue; ưu tiên Database Queue để bắt đầu, có thể bổ sung Redis khi cần |
| Lưu file | Lưu trữ cục bộ trong giai đoạn phát triển; có thể mở rộng MinIO khi triển khai |
| Triển khai | XAMPP cho môi trường phát triển; Docker Compose + Nginx + PHP-FPM cho môi trường triển khai |

**Lưu ý về CSDL và GIS**

- XAMPP hiện tại của nhóm sử dụng MariaDB 10.4.32, không phải MySQL Community Server 8.0.
- phpMyAdmin là công cụ quản trị cơ sở dữ liệu thông qua trình duyệt, không phải là hệ quản trị cơ sở dữ liệu.
- MariaDB hỗ trợ kiểu dữ liệu và các phép toán không gian (Spatial Data / GIS). Có thể sử dụng để lưu tọa độ người dùng, điểm trú ẩn và vùng cảnh báo.
- Các kiểu dữ liệu không gian có thể sử dụng gồm `POINT`, `POLYGON`, `MULTIPOLYGON`, tùy theo nhu cầu và khả năng hỗ trợ của phiên bản.
- Có thể sử dụng các hàm không gian như `ST_Contains()`, `ST_Within()`, `ST_Distance_Sphere()` khi phiên bản và cú pháp MariaDB tương ứng hỗ trợ.
- Có thể sử dụng chỉ mục không gian (Spatial Index) để hỗ trợ truy vấn dữ liệu địa lý.
- Cần kiểm tra khả năng hỗ trợ cụ thể của MariaDB 10.4.32 đối với từng hàm GIS trước khi triển khai. Không mặc định mọi hàm của MySQL đều hoạt động giống hệt trên MariaDB.
- Nên thống nhất hệ tọa độ (ví dụ SRID 4326) và thứ tự kinh độ/vĩ độ khi lưu, truy vấn dữ liệu.
- Nếu dự án bắt buộc sử dụng MySQL Community Server, nhóm cần cài MySQL Server riêng. Vẫn có thể sử dụng phpMyAdmin để quản lý MySQL Server sau khi cấu hình kết nối đúng máy chủ và cổng.

**Quy chuẩn dự án mã nguồn mở**

- **[MVP]** Mã nguồn công khai trên GitHub, có LICENSE (MIT/GPL), README, hướng dẫn cài đặt.
- **[MVP]** Có hướng dẫn cài đặt và chạy dự án rõ ràng. Trong giai đoạn phát triển có thể chạy bằng XAMPP; khi đóng gói triển khai có thể sử dụng Docker Compose.
- **[+]** CONTRIBUTING.md, issue/PR template, quy ước commit, CHANGELOG.
- **[+]** CI bằng GitHub Actions (lint, test).
- **[+]** API mở có tài liệu Swagger/OpenAPI để bên thứ ba tích hợp.

**Chất lượng**

- **[MVP]** Bảo mật: mật khẩu băm bằng cơ chế Hash của Laravel (bcrypt hoặc Argon2), xác thực bằng Laravel Sanctum hoặc JWT nếu kiến trúc yêu cầu; kiểm tra quyền phía server, ẩn vị trí SOS với người không có quyền.
- **[MVP]** Giao diện responsive cho điện thoại.
- **[+]** Đa ngôn ngữ (Việt/Anh), hỗ trợ tiếp cận (tương phản cao, cỡ chữ lớn).
- **[+]** Unit test cho nghiệp vụ chính (geofencing, vòng đời cảnh báo, trạng thái SOS).

### 9. ✨ Kịch bản demo gợi ý (5-7 phút)

1. Dữ liệu Open-Meteo vượt ngưỡng mưa → hệ thống đề xuất cảnh báo lũ.
2. Cán bộ vẽ vùng ảnh hưởng, duyệt và phát hành cảnh báo.
3. Người dân có vị trí trong vùng nhận thông báo realtime; người ngoài vùng không nhận.
4. Người dân xem tuyến sơ tán tới điểm trú ẩn gần nhất.
5. Một người dân gửi SOS → cán bộ thấy trên bản đồ, phân công đội cứu hộ → người gửi thấy trạng thái đổi realtime.
6. Kết thúc sự kiện → xem thống kê, lịch sử và phát lại diễn biến.

### 10. ✨ Triển khai với chi phí 0 đồng

Các thành phần PHP, Laravel, MariaDB, phpMyAdmin, Redis, MinIO và Nginx có thể sử dụng theo giấy phép tương ứng mà không mất phí bản quyền. Chi phí có thể phát sinh ở máy chủ, tên miền hoặc dịch vụ bên ngoài nếu vượt hạn mức miễn phí.

**Phương án A - Chạy local bằng XAMPP, có link công khai khi demo (khuyên dùng cho giai đoạn phát triển)**

- Sử dụng XAMPP để chạy Apache, PHP và MariaDB.
- Sử dụng phpMyAdmin để tạo và quản lý cơ sở dữ liệu.
- Cài Composer để quản lý thư viện PHP và cài đặt Laravel.
- Chạy Laravel bằng Apache Virtual Host hoặc lệnh phát triển `php artisan serve`.
- Mở link công khai bằng Cloudflare Tunnel nếu cần cho giảng viên/bạn bè truy cập thử nghiệm.
- Ưu điểm: tận dụng môi trường đã cài đặt, dễ kiểm tra và phát triển trên máy cá nhân.

**Phương án B - Triển khai bằng Docker Compose**

- Đóng gói Backend Laravel, MariaDB, phpMyAdmin và các dịch vụ cần thiết bằng Docker Compose.
- Có thể bổ sung Redis, MinIO, Nginx và PHP-FPM tùy nhu cầu.
- Cấu hình biến môi trường trong file `.env`, không đưa mật khẩu hoặc khóa bí mật lên GitHub.
- Dùng volume để lưu dữ liệu MariaDB, tránh mất dữ liệu khi khởi động lại container.
- Hướng dẫn chạy hệ thống bằng `docker compose up -d`.
- Lưu ý: XAMPP và Docker là hai phương án môi trường riêng; không bắt buộc phải chạy đồng thời cả hai.

**Nguồn dữ liệu và API miễn phí**

- Open-Meteo (thời tiết), USGS (động đất), GDACS (thiên tai toàn cầu).
- OpenStreetMap tiles, OpenRouteService (cần API key miễn phí và có hạn mức).
- Telegram Bot API, Web Push: sử dụng theo điều kiện và giới hạn của từng dịch vụ.
- Email SMTP: sử dụng nhà cung cấp phù hợp, chú ý hạn mức gửi email.

**Mẹo giữ trong hạn mức**

- Sử dụng Laravel Scheduler để lấy dữ liệu Open-Meteo/USGS định kỳ (ví dụ 30-60 phút/lần), lưu kết quả vào CSDL; frontend chỉ đọc dữ liệu từ hệ thống.
- Nén ảnh ngay trên trình duyệt trước khi upload, giới hạn tối đa 2-5MB/ảnh.
- Cache tuyến sơ tán đã tính; chỉ gọi lại khi vùng cảnh báo thay đổi.
- Dùng Laravel Reverb và Broadcasting đẩy dữ liệu thay vì để frontend gọi API liên tục.
- Sử dụng Laravel Queue để xử lý gửi thông báo và tác vụ nền.
- Trong giai đoạn đầu, có thể dùng Database Queue để giảm số lượng dịch vụ phải cài đặt; chỉ bổ sung Redis khi cần.
- Có file seed dữ liệu mẫu (vùng cảnh báo, điểm trú ẩn, SOS) để demo ổn định, không phụ thuộc thời tiết thật hôm đó.

**Tránh**

- SMS OTP / SMS brandname vì có thể phát sinh phí.
- Google Maps API nếu mục tiêu là tránh dịch vụ yêu cầu thông tin thanh toán hoặc tính phí theo lượt.
- Sử dụng đồng thời nhiều công nghệ Backend khác nhau không cần thiết.
- Dùng Socket.io hoặc BullMQ làm thành phần Backend chính vì dự án định hướng sử dụng PHP/Laravel. Ưu tiên Laravel Reverb và Laravel Queue.

---

## Ghi chú về kiến trúc và môi trường phát triển

1. Backend của dự án được xây dựng bằng PHP và Laravel.
2. XAMPP được sử dụng làm môi trường phát triển cục bộ.
3. MariaDB 10.4.32 là hệ quản trị cơ sở dữ liệu đang đi kèm XAMPP hiện tại.
4. phpMyAdmin được sử dụng để quản lý MariaDB thông qua giao diện web.
5. Các chức năng GIS được triển khai bằng các tính năng dữ liệu không gian mà phiên bản MariaDB đang sử dụng hỗ trợ.
6. Khi triển khai thực tế, nhóm nên nâng cấp MariaDB lên phiên bản còn được hỗ trợ và kiểm tra tương thích với Laravel, các hàm GIS cũng như cấu trúc dữ liệu.
7. Frontend có thể sử dụng Laravel Blade để đơn giản hóa kiến trúc. Nếu cần giao diện độc lập, nhóm có thể sử dụng React hoặc Vue kết hợp Vite.
8. Các dịch vụ Redis, MinIO, Reverb có thể được bổ sung theo từng giai đoạn, không nhất thiết phải cài đặt tất cả ngay từ đầu.

**Định hướng thống nhất:** PHP + Laravel + MariaDB (XAMPP) + phpMyAdmin + Leaflet/OpenStreetMap.