# Hướng dẫn sử dụng và triển khai - Hệ thống cảnh báo thiên tai

Cập nhật: 2026-11-04. Áp dụng cho nhánh `main` (Laravel 12 API + React SPA, dữ liệu demo đặt ở Nha Trang).

- [Phần 1. Hướng dẫn chức năng](#phan-1)
- [Phần 2. Hướng dẫn chạy: local, Docker, VPS](#phan-2)

---

<a id="phan-1"></a>
# Phần 1. Hướng dẫn chức năng

## 1.1. Vai trò, cổng và tài khoản demo

Hệ thống có 5 nhóm người dùng, chia thành 4 cổng giao diện. Sau khi đăng nhập, mỗi người được đưa thẳng về cổng của mình. Nếu mở nhầm cổng của vai trò khác, hệ thống tự chuyển về đúng cổng.

| Vai trò | Cổng | Đường dẫn gốc | Tài khoản demo |
|---|---|---|---|
| Khách (chưa đăng nhập) | Công khai | `/` | - |
| Người dân | Công khai + "Của tôi" | `/`, `/me` | `citizen@demo.vn` (nhà ở phường Ngọc Hiệp, trong vùng cảnh báo), `outsider@demo.vn` (Hà Nội, ngoài vùng) |
| Đội cứu hộ | Ứng dụng hiện trường | `/rescuer` | `rescuer@demo.vn` (Khánh Hoà) |
| Cán bộ quản lý | Bảng điều hành | `/officer` | `officer@demo.vn` (địa bàn Khánh Hoà) |
| Quản trị viên | Quản trị hệ thống | `/admin` (dùng được cả `/officer`) | `admin@demo.vn` |

Mật khẩu mọi tài khoản demo: `password`. Trang đăng nhập có sẵn các nút **đăng nhập nhanh** theo từng vai trò.

**Quy tắc địa bàn:** cán bộ có địa bàn (vd Khánh Hoà) chỉ thấy và quản lý dữ liệu thuộc địa bàn đó, cùng dữ liệu "Toàn quốc" (không gắn địa bàn). Cán bộ không gắn địa bàn và admin quản lý toàn bộ.

**Quyền thật nằm ở backend.** Giao diện chỉ ẩn/hiện nút. Gọi API sai quyền sẽ nhận `403`.

## 1.2. Chức năng cho khách (không cần đăng nhập)

Thanh điều hướng công khai: Trang chủ, Bản đồ, Cảnh báo, Sự kiện, Trú ẩn, Báo cáo, Cẩm nang, Danh bạ. Nút đỏ **SOS** luôn hiện ở mọi trang.

### Trang chủ (`/`)
- **Tình hình chung:** số cảnh báo đang hiệu lực, số cảnh báo mức nghiêm trọng (mức 4 trở lên), số sự kiện đang diễn ra, số điểm trú ẩn còn chỗ.
- **"Khu vực của bạn có an toàn không?"**: bấm **Kiểm tra vị trí của tôi**, cho phép trình duyệt lấy vị trí.
  - Kết quả là "Vị trí của bạn hiện an toàn" hoặc "Bạn đang ở trong vùng cảnh báo", kèm danh sách cảnh báo bao trùm điểm đó.
  - Vị trí chỉ dùng để tra cứu, không được lưu.
- **Cảnh báo đang hiệu lực:** các cảnh báo mới nhất, bấm để xem chi tiết.
- **Dự báo rủi ro 3 ngày:** lượng mưa, gió theo Open-Meteo cho từng khu vực, kèm mức rủi ro 1-5. Dữ liệu cập nhật mỗi giờ.
- **Đường dây nóng:** 113 Công an, 114 Cứu hoả, 115 Cấp cứu, 112 Cứu nạn. Bấm là gọi trên điện thoại.

### Bản đồ thiên tai (`/map`)
- Bản đồ mở sẵn ở Nha Trang. Bảng **Lớp hiển thị** cho bật/tắt:
  - **Vùng cảnh báo:** màu theo mức nguy hiểm, vùng đã kết thúc màu xám.
  - **Điểm trú ẩn:** ghim ghi rõ còn chỗ hay đã đầy.
  - **Báo cáo người dân:** chỉ hiện báo cáo đã được duyệt.
  - **Yêu cầu SOS:** chỉ cán bộ/admin thấy lớp này, khách và người dân không thấy.
- Bấm vào một vùng hoặc ghim để xem tóm tắt, rồi **Chi tiết** / **Xem hướng dẫn**. Cán bộ có thêm nút **Mở điều phối SOS**.
- Nút **Vị trí của tôi** đưa bản đồ về chỗ bạn đứng và vẽ đường tới **điểm trú ẩn gần nhất còn chỗ**.
  - Đường nét đứt là đường chim bay. Bấm **Đóng tuyến** để tắt.
- Bản đồ cập nhật realtime khi cán bộ phát hành, sửa hoặc kết thúc cảnh báo.

### Cảnh báo (`/alerts`, `/alerts/:id`)
- **Bộ lọc:**
  - từ khoá (tên, địa điểm; tìm được cả khi gõ không dấu);
  - loại thiên tai, khu vực, mức nguy hiểm;
  - khoảng thời gian (từ ngày, đến ngày);
  - trạng thái: Đang hiệu lực, Đã kết thúc, Tất cả;
  - **Trong bán kính** quanh vị trí của bạn ("gần tôi").
- Chi tiết cảnh báo gồm:
  - thông tin: loại, mức độ, khu vực, thời gian hiệu lực, sự kiện liên quan;
  - **Vùng ảnh hưởng** trên bản đồ (đa giác hoặc "bán kính x km quanh tâm");
  - **Hướng dẫn hành động** cho người dân;
  - **Diễn biến**: các lần cập nhật.
- Hộp "Bạn đang ở trong vùng này?" dẫn nhanh tới Tuyến sơ tán hoặc SOS.
- Cảnh báo do hệ thống sinh từ dữ liệu mưa có nhãn **Đề xuất tự động**. Nhãn chỉ hiện sau khi cán bộ đã duyệt và phát hành cảnh báo đó.

### Sự kiện thiên tai (`/events`, `/events/:id`)
- Danh sách bão, lũ, động đất... đang diễn ra và đã kết thúc. Lọc theo trạng thái, từ khoá, loại, khu vực.
- Động đất từ USGS (từ M3.5, quanh Việt Nam) được nhập tự động mỗi 30 phút.
- Chi tiết sự kiện:
  - mô tả, thời điểm bắt đầu/kết thúc, khu vực, số cảnh báo;
  - danh sách **Cảnh báo liên quan**;
  - **Phát lại diễn biến:** bấm **Phát** / **Tạm dừng**, hoặc kéo thanh **Thời điểm**. Bản đồ vẽ lại vùng cảnh báo theo từng phiên bản cập nhật.

### Điểm trú ẩn (`/shelters`) và Tuyến sơ tán (`/evacuation`)
- **Điểm trú ẩn:**
  - xem dạng **Danh sách** hoặc **Bản đồ**;
  - lọc **Tất cả**, **Còn chỗ** hoặc **Gần tôi nhất** (sắp theo khoảng cách);
  - mỗi điểm có sức chứa, số người đang ở, tiện ích (nước sạch, y tế, điện, thức ăn, nhà vệ sinh, wifi), số điện thoại.
- **Tuyến sơ tán:**
  1. Trang tự lấy vị trí. Nếu không lấy được, bấm lên bản đồ để chọn điểm xuất phát.
  2. Hệ thống báo bạn đang ở **trong** hay **ngoài** vùng cảnh báo.
  3. Hệ thống chọn **điểm trú ẩn gần nhất còn chỗ và nằm ngoài vùng nguy hiểm**, rồi hiện quãng đường và thời gian đi bộ ước tính.
  - Có `ORS_API_KEY` (OpenRouteService) thì vẽ tuyến theo đường thật. Không có thì vẽ đường chim bay.
  - Ví dụ demo: từ nhà `citizen` ở Ngọc Hiệp, đích là **Trường Đại học Khánh Hoà**, cách khoảng 4,3 km.

### Chỉ đường (`/directions`)
Mọi nút **Chỉ đường** / **Dẫn đường** tới điểm trú ẩn (Bản đồ, Điểm trú ẩn, Tuyến sơ tán, Trang của tôi) đều mở trang này:
- **Điểm xuất phát (A)** mặc định là **vị trí hiện tại** (GPS). **Điểm đến (B)** là điểm trú ẩn vừa chọn.
- Đổi được cả hai điểm theo 4 cách:
  1. **gõ địa chỉ** (vd "Chợ Đầm Nha Trang") rồi chọn trong danh sách gợi ý;
  2. **gõ toạ độ** dạng `vĩ độ, kinh độ` (vd `12.2388, 109.1967`) rồi Enter: ghim đặt đúng toạ độ đã nhập;
  3. bấm **Chọn trên bản đồ** rồi bấm lên bản đồ;
  4. **kéo ghim** A hoặc B.
- Nút **Vị trí của tôi** lấy lại GPS cho điểm xuất phát; nút mũi tên đổi chiều A ↔ B.
- Chọn phương tiện **Đi bộ / Xe máy - ô tô / Xe đạp**. Hệ thống vẽ tuyến theo đường thật (OSRM, dữ liệu OpenStreetMap), hiện quãng đường và thời gian. Vùng cảnh báo được tô màu để tránh. Không tính được tuyến thì vẽ đường chim bay (nét đứt).
- **Xem từng chặng rẽ** mở cùng tuyến trên bản đồ dẫn đường bên ngoài.

### Báo cáo cộng đồng (`/reports`, `/reports/:id`)
- Xem các báo cáo người dân **đã được cán bộ duyệt**: loại sự cố, mô tả, ảnh/video, vị trí, thời điểm.
- Lọc **Gần tôi (10 km)**.
- Khách chỉ xem được báo cáo. Gửi báo cáo và bấm "Tôi cũng thấy" cần đăng nhập (xem 1.4).

### Cẩm nang (`/guides`) và Danh bạ khẩn cấp (`/contacts`)
- **Cẩm nang ứng phó:** lọc theo loại thiên tai (lũ lụt, bão, sạt lở đất, động đất, hạn hán - xâm nhập mặn, lũ quét). Mỗi bài có việc cần làm trước, trong và sau thiên tai.
- **Danh bạ:** số toàn quốc (112-115, miễn phí, 24/7) và số địa phương theo khu vực. Bấm số để gọi.

### SOS một chạm (`/sos`) và theo dõi (`/sos/track/:code`)
Không cần đăng nhập. Biểu mẫu có 4 bước:
1. **Vị trí của bạn:** tự lấy GPS. Có thể **Chỉnh trên bản đồ** nếu vị trí sai.
2. **Số người cần cứu:** dùng nút `+` / `-`.
3. **Tình trạng:** chọn mọi ô đúng: Bị thương, Mắc kẹt, Có trẻ em, Có người già, Phụ nữ mang thai, Người khuyết tật. Tình trạng càng nặng thì mức ưu tiên (1-5) càng cao.
4. **Liên hệ:**
   - số điện thoại (bắt buộc với khách; người đã đăng nhập để trống sẽ dùng số trong tài khoản);
   - tên người liên hệ;
   - ghi chú cho đội cứu hộ (tầng mấy, màu nhà, mực nước...).

Bấm **GỬI SOS NGAY**. Sau khi gửi:
- **Mã theo dõi** hiện ra (vd `SOS-ABC123`). Bấm **Chép** để lưu lại.
- Trang theo dõi hiện tiến trình `Đã gửi, đang chờ tiếp nhận` → `Đã tiếp nhận yêu cầu` → `Đội cứu hộ đang tới` → `Đã an toàn`.
  - Trạng thái **tự đổi realtime**, không cần tải lại.
  - Trang có tên đội phụ trách và mẹo an toàn trong lúc chờ.
- Thiết bị nhớ các SOS đã gửi ("Đã gửi từ thiết bị này"). Ở `/sos`, có thể nhập mã để tra lại.

**Chống spam và trùng lặp:**
- Mỗi IP chỉ gửi được 3 SOS trong 10 phút.
- Cùng số điện thoại gửi lại trong 30 phút khi yêu cầu cũ chưa an toàn thì nhận lại yêu cầu cũ, không tạo yêu cầu mới.
- Trang theo dõi không lộ toạ độ: chỉ đội cứu hộ và cán bộ thấy vị trí.

## 1.3. Tài khoản: đăng ký, đăng nhập, quên mật khẩu

- **Đăng ký (`/register`):** họ tên, email **hoặc** số điện thoại (ít nhất một), mật khẩu (tối thiểu 8 ký tự). Tài khoản mới có vai trò Người dân.
- **Đăng nhập (`/login`):** bằng email hoặc số điện thoại. Mỗi IP được thử 10 lần mỗi phút.
- **Quên mật khẩu (`/forgot-password`):**
  1. Nhập email, hệ thống gửi liên kết `/reset-password?token=...&email=...`.
  2. Mở liên kết, đặt mật khẩu mới.
  - Docker đang để mặc định `MAIL_MAILER=log`: thư không gửi thật mà ghi vào log container (xem `docker compose logs app queue`). Cấu hình SMTP thì mới gửi thật.
- **Đăng xuất:** từ menu tài khoản. Token hiện tại bị thu hồi.

## 1.4. Chức năng cho người dân (`citizen`)

Ngoài mọi chức năng của khách, người dân có thêm:

### Trang của tôi (`/me`)
- Số vị trí quan tâm, số thông báo chưa đọc, số SOS đang xử lý.
- **Tình hình an toàn tại từng vị trí quan tâm:** vị trí nào đang nằm trong vùng cảnh báo sẽ được nêu tên kèm cảnh báo.
- **Điểm trú ẩn gần nhất** còn chỗ và an toàn.
- **Yêu cầu SOS của bạn** và tiến trình của chúng.
- Lối tắt: Gửi SOS, Báo cáo sự cố, Tuyến sơ tán, Điểm trú ẩn, Bản đồ, Cẩm nang.

### Hồ sơ và vị trí quan tâm (`/me/profile`)
- Sửa họ tên, email, số điện thoại. Đổi mật khẩu: nhập mật khẩu hiện tại, mật khẩu mới và nhập lại.
- **Vị trí quan tâm** (tối đa 10), ví dụ Nhà, Nơi làm việc, Nhà người thân:
  - **Thêm vị trí:** đặt tên, bấm lên bản đồ để đặt ghim (hoặc dùng vị trí hiện tại), thêm địa chỉ nếu muốn.
  - **Sửa** / **Xoá** từng vị trí.
  - Đây là dữ liệu cho **geofencing**: chỉ người có vị trí quan tâm nằm trong vùng cảnh báo mới nhận thông báo.

### Thông báo (`/me/notifications`) và cảnh báo realtime
- Khi cán bộ phát hành hoặc cập nhật một cảnh báo bao trùm vị trí quan tâm của bạn:
  - **banner cảnh báo realtime** hiện ngay trên mọi trang;
  - số trên **chuông** tăng lên;
  - cảnh báo mức 4-5 được gửi thêm email.
- Trang Thông báo lọc được **Tất cả** hoặc **Chưa đọc**. Bấm một thông báo để đánh dấu đã đọc, hoặc đánh dấu tất cả là đã đọc.
- Thử geofencing: đăng nhập `citizen` và `outsider` ở hai trình duyệt rồi phát hành cảnh báo ở Ngọc Hiệp. Chỉ `citizen` nhận thông báo.

### Gửi báo cáo sự cố (`/reports/new`) và Báo cáo của tôi (`/me/reports`)
- Biểu mẫu báo cáo:
  1. chọn **loại sự cố**;
  2. viết **mô tả** (mực nước, đường bị chia cắt, số người cần hỗ trợ...);
  3. chọn **vị trí** (mặc định là vị trí hiện tại, bấm bản đồ để đổi);
  4. đính kèm **ảnh/video**: tối đa 5 tệp jpg/png/webp/mp4/mov, mỗi tệp tối đa 20 MB. Ảnh được nén ngay trên trình duyệt trước khi tải lên.
- Mỗi tài khoản gửi tối đa 10 báo cáo mỗi giờ.
- Báo cáo mới ở trạng thái **Chờ duyệt**. Báo cáo chỉ hiện công khai trên bản đồ sau khi cán bộ duyệt.
- **Báo cáo của tôi** hiện trạng thái Chờ duyệt / Đã duyệt / Từ chối, kèm ghi chú của cán bộ.
- **Tôi cũng thấy:** trên báo cáo đã duyệt của người khác, bấm để xác nhận. Mỗi người bấm được 1 lần và không tự xác nhận báo cáo của mình. Số người xác nhận làm báo cáo đáng tin hơn.

### SOS khi đã đăng nhập
Biểu mẫu SOS giống khách, nhưng số điện thoại tự lấy từ tài khoản. Các SOS đã gửi hiện ở `/me`.

## 1.5. Chức năng cho đội cứu hộ (`rescuer`)

Cổng `/rescuer` thiết kế cho điện thoại, có thanh điều hướng dưới gồm Nhiệm vụ, Bản đồ, Đã xong, Tài khoản.

### Nhiệm vụ của đội (`/rescuer`)
- Thẻ số liệu: Chờ xuất phát, Đang cứu hộ, Ưu tiên cao (mức 4-5), Đã hoàn thành.
- Lọc **Tất cả**, **Chờ xuất phát** hoặc **Đang cứu hộ**. Nhiệm vụ ưu tiên cao xếp trước.
- Nhiệm vụ mới do cán bộ giao **hiện ngay lập tức** (realtime). Giữ ứng dụng mở để không bỏ lỡ.

### Chi tiết nhiệm vụ (`/rescuer/sos/:id`)
- **Liên hệ nạn nhân:** tên, số điện thoại, nút **Gọi ngay**.
- **Chỉ đường:** mở trang Chỉ đường trong ứng dụng (`/rescuer/directions`), từ vị trí hiện tại của đội tới vị trí phát tín hiệu SOS, mặc định đi xe máy / ô tô. Sửa được điểm đi, điểm đến như mục Chỉ đường ở 1.2.
- Bản đồ nhiệm vụ đánh dấu nạn nhân bằng ghim nhấp nháy, kèm toạ độ và **địa chỉ gần nhất** của tín hiệu.
- Số người, tình trạng (bị thương, mắc kẹt...), ghi chú, mức ưu tiên, nhãn "Đã xác minh" nếu cán bộ đã xác minh.
- **Tiến trình:** mỗi lần chỉ có một nút cho bước tiếp theo, và hệ thống hỏi xác nhận trước khi chuyển:
  1. **Tiếp nhận nhiệm vụ** (chỉ khi yêu cầu còn ở trạng thái Mới);
  2. **Bắt đầu cứu hộ** khi đội đã xuất phát;
  3. **Đã đưa tới nơi an toàn**: đóng nhiệm vụ.
  - Trạng thái chỉ đi tiến từng bước, không lùi.
  - Mỗi lần đổi, trang theo dõi của người gửi cập nhật realtime.

### Bản đồ nhiệm vụ (`/rescuer/map`)
- Mọi nhiệm vụ đang mở trên bản đồ, số trên ghim là mức ưu tiên, kèm vị trí của bạn.
- Bấm ghim để xem khoảng cách và dùng nút **Gọi** / **Chỉ đường**.

### Đã xong (`/rescuer/history`)
- Danh sách nhiệm vụ đã hoàn thành.
- Thống kê: số nhiệm vụ, số người được hỗ trợ, thời gian cứu hộ trung bình (từ lúc xuất phát tới khi an toàn).

Đội cứu hộ cũng có trang Thông báo và Hồ sơ riêng (`/rescuer/notifications`, `/rescuer/profile`).

## 1.6. Chức năng cho cán bộ quản lý (`officer`)

Cổng `/officer` có thanh bên gồm: Tổng quan, Điều phối SOS, Cảnh báo, Duyệt báo cáo, Sự kiện thiên tai, Điểm trú ẩn, Thống kê. Tên địa bàn hiện ở đầu thanh bên.

### Tổng quan điều hành (`/officer`)
- Thẻ số liệu: SOS chưa xử lý (mới, chưa giao), Đang cứu hộ, Cảnh báo hiệu lực, Cảnh báo chờ duyệt, Báo cáo chờ duyệt.
- **Bản đồ tình hình:** vùng cảnh báo đang hiệu lực và yêu cầu SOS chưa an toàn.
- **Hàng đợi SOS**, xếp ưu tiên cao trước, có nút **Mở điều phối**.
- **Cảnh báo chờ duyệt**, gồm cả đề xuất tự động từ dữ liệu mưa, có nút **Mở cảnh báo**.
- **Báo cáo chờ duyệt.**

### Điều phối SOS (`/officer/sos`)
- **Lọc:** trạng thái (Đang mở, Tất cả, từng trạng thái), ưu tiên tối thiểu, tìm theo mã, số điện thoại hoặc tên.
- Bản đồ ghim SOS (số trên ghim là mức ưu tiên) cùng danh sách.
- **Bấm vào một yêu cầu** (trong danh sách hoặc ghim trên bản đồ):
  - bản đồ lớn bay tới đúng vị trí tín hiệu, ghim đó nhấp nháy;
  - ngăn chi tiết mở mục **Vị trí phát tín hiệu**: bản đồ thu nhỏ quanh điểm GPS, toạ độ, địa chỉ gần nhất, nút **Chép toạ độ** và **Chỉ đường tới đây**;
  - tiếp theo là người cần hỗ trợ, số người, tình trạng, liên hệ (bấm gọi) và tiến trình.
- Đường dẫn `/officer/sos?sos=<id>` mở thẳng một yêu cầu. Ở Tổng quan, nút **Xem vị trí** cạnh mỗi SOS, và ghim SOS trên Bản đồ (`/map`), đều dẫn tới đây.
- **Xác minh** / **Bỏ xác minh** sau khi gọi điện xác nhận yêu cầu là thật.
- **Phân công đội cứu hộ:**
  - hệ thống **gợi ý** đội theo số việc đang làm ít nhất và khoảng cách gần nhất;
  - bấm **Giao việc**: yêu cầu Mới tự chuyển sang "Đã tiếp nhận", đội được giao nhận ngay;
  - **Giao lại** để đổi đội.
  - Chưa có đội trong địa bàn thì admin phải tạo tài khoản `rescuer` trước.
- Danh sách cập nhật realtime khi có SOS mới hoặc khi đội cứu hộ đổi trạng thái.

### Quản lý cảnh báo (`/officer/alerts`)
- Tab: Tất cả, Nháp, Chờ duyệt, Đang hiệu lực, Đã kết thúc. Tìm theo tiêu đề, mô tả, khu vực.
- **Vòng đời cảnh báo:**

```
Nháp --(Gửi duyệt)--> Chờ duyệt --(Phát hành)--> Đang hiệu lực --(Sửa)--> Cập nhật --(Kết thúc)--> Đã kết thúc
  ^                       |
  +------(Từ chối)--------+
Nháp --(Phát hành ngay)--> Đang hiệu lực
```

- Mỗi lần đổi trạng thái hoặc sửa nội dung đều lưu một **phiên bản**. Xem lại ở mục **Lịch sử phiên bản** trong trang sửa.
- Thao tác trên mỗi dòng: Gửi duyệt, Phát hành, Từ chối (bắt buộc ghi lý do, cảnh báo quay về Nháp), Kết thúc (ghi chú, vd "nước đã rút"), Xoá (chỉ xoá được bản Nháp).

### Tạo / sửa cảnh báo (`/officer/alerts/new`, `/officer/alerts/:id`)
Trình soạn thảo có 4 bước:
1. **Thông tin:**
   - tiêu đề (nêu rõ loại thiên tai và địa danh);
   - loại thiên tai, mức độ nguy hiểm 1-5 (mức 4-5 gửi thêm email);
   - khu vực (để trống là Toàn quốc), thuộc sự kiện (tuỳ chọn);
   - mô tả tình hình, thời gian hiệu lực từ / đến.
2. **Vùng ảnh hưởng:** chọn kiểu vùng.
   - **Đa giác:** bấm lần lượt các đỉnh trên bản đồ, cần ít nhất 3 điểm không thẳng hàng.
   - **Tâm + bán kính:** bấm để đặt tâm, chọn bán kính có sẵn hoặc nhập số mét.
   - Chỉ người có vị trí quan tâm nằm trong vùng này mới nhận thông báo.
3. **Hướng dẫn:** khi chọn loại thiên tai, phần này tự điền **hướng dẫn mẫu** (quản lý ở Danh mục) và có thể sửa. Ô xem trước "Người dân sẽ thấy" hiện nội dung như trên điện thoại.
4. **Xem lại:** kiểm tra trước khi lưu, rồi chọn **Lưu nháp**, **Gửi duyệt** hoặc **Phát hành ngay**.

- **Khi phát hành:**
  - cảnh báo hiện trên bản đồ công khai;
  - thông báo realtime gửi cho người dân trong vùng.
- **Sửa cảnh báo đang hiệu lực:**
  - trạng thái chuyển sang "Cập nhật";
  - bản mới được gửi lại cho người trong vùng;
  - nên điền **Ghi chú phiên bản**, ví dụ "mở rộng vùng ngập".
- **Đề xuất tự động:**
  - lượng mưa dự báo vượt `RAIN_ALERT_THRESHOLD_MM` (mặc định 100 mm/24h) thì hệ thống tự tạo cảnh báo lũ ở trạng thái **Chờ duyệt**;
  - trang sửa hiện khung "Hệ thống đề xuất từ dữ liệu dự báo mưa";
  - cán bộ kiểm tra và chỉnh vùng rồi mới phát hành.

### Duyệt báo cáo người dân (`/officer/reports`)
- Tab theo trạng thái (Chờ duyệt, Đã duyệt, Từ chối).
- Mỗi báo cáo có ảnh/video, vị trí trên bản đồ, người gửi.
- Chọn kết quả **Duyệt** hoặc **Từ chối**, kèm ghi chú (vd "đã xác minh qua cán bộ phường").
  - Báo cáo đã duyệt hiện trên bản đồ công khai.
  - Người gửi thấy kết quả và ghi chú ở "Báo cáo của tôi".

### Sự kiện thiên tai (`/officer/events`)
- **Thêm sự kiện:**
  - tên (vd "Bão số 7 (Yagi)"), loại, mức độ, khu vực;
  - thời điểm bắt đầu, mô tả;
  - vị trí tâm (tuỳ chọn, để hiện trên bản đồ).
- **Sửa** hoặc **Kết thúc sự kiện**.
- Gắn cảnh báo vào sự kiện (ô "Thuộc sự kiện" trong trình soạn cảnh báo) để theo dõi chung và để **Phát lại diễn biến**.

### Điểm trú ẩn (`/officer/shelters`)
- **Thêm / sửa điểm trú ẩn:**
  - tên, địa chỉ, khu vực, số điện thoại;
  - vị trí (bấm bản đồ để đặt ghim);
  - tổng sức chứa, số người đang ở, tiện ích;
  - "Đang mở cửa đón người dân" (tắt = Tạm đóng).
- **Cập nhật nhanh số người** bằng nút ±10 người. Số người đang ở không được vượt sức chứa. Điểm hết chỗ hiện "Đã đầy" và không được gợi ý sơ tán.
- **Xoá** điểm trú ẩn: điểm đó biến mất khỏi bản đồ và khỏi gợi ý sơ tán.

### Thống kê (`/officer/stats`)
- Lọc theo khoảng thời gian, khu vực, loại thiên tai.
- Số liệu tổng: tổng cảnh báo, tổng yêu cầu SOS, thời gian **phản hồi SOS trung bình** (từ lúc gửi tới khi tiếp nhận), thời gian **hoàn tất cứu hộ trung bình** (từ lúc gửi tới khi an toàn).
- **Biểu đồ:** cảnh báo theo tháng, theo loại thiên tai, theo tỉnh/thành, theo mức độ; SOS theo tháng và theo trạng thái.

## 1.7. Chức năng cho quản trị viên (`admin`)

Admin có toàn bộ cổng cán bộ (nhóm "Điều hành", không giới hạn địa bàn), thêm nhóm "Quản trị hệ thống":

### Tổng quan hệ thống (`/admin`)
- Số tài khoản theo vai trò (tổng, người dân, đội cứu hộ, cán bộ).
- Tình hình điều hành: SOS chưa xử lý / đang cứu hộ, cảnh báo hiệu lực / chờ duyệt, báo cáo chờ duyệt, sự kiện đang diễn ra.
- **Lối tắt điều hành:** Tạo cảnh báo mới, Điều phối SOS, Duyệt báo cáo, Điểm trú ẩn, Thống kê.
- Dữ liệu nền (danh mục) và **Hoạt động gần đây**.

### Người dùng (`/admin/users`)
- Tìm theo tên, email, số điện thoại. Lọc theo vai trò và địa bàn.
- **Thêm tài khoản** với vai trò bất kỳ:
  - họ tên, email hoặc số điện thoại, mật khẩu (tối thiểu 8 ký tự, gửi cho người dùng qua kênh an toàn);
  - vai trò và địa bàn: cán bộ và đội cứu hộ chỉ xử lý việc trong địa bàn được gán.
- **Sửa:** đổi vai trò, địa bàn, đặt lại mật khẩu (để trống nếu không đổi).
- **Khoá tài khoản:** người dùng bị đăng xuất khỏi mọi thiết bị và không đăng nhập được cho tới khi **Mở khoá**.
- Admin không tự đổi vai trò hay tự khoá tài khoản của chính mình.

### Danh mục (`/admin/catalog`)
Dữ liệu nền dùng chung. Chọn danh mục, rồi Thêm / Sửa / Xoá / tìm kiếm:

| Danh mục | Trường chính |
|---|---|
| Khu vực | Mã viết tắt (vd `DN`, `KH`), tên, vĩ độ / kinh độ tâm (vd 12.2388 / 109.1967) |
| Loại thiên tai | Mã (chữ thường không dấu, vd `flood`), tên, **hướng dẫn mẫu** (tự điền vào cảnh báo mới thuộc loại này) |
| Cẩm nang | Tiêu đề, loại thiên tai (hoặc "Chung"), slug (để trống thì tự sinh), nội dung (`## ` là tiêu đề mục, `- ` là gạch đầu dòng), trạng thái Nháp / Công khai |
| Danh bạ khẩn cấp | Tên, số điện thoại, mô tả, khu vực (để trống là toàn quốc), thứ tự hiển thị |

### Nhật ký hoạt động (`/admin/logs`)
- Ghi mọi thao tác **ghi dữ liệu** của cán bộ và admin: ai, làm gì, lúc nào, đường dẫn, địa chỉ IP, kết quả (thành công / lỗi), dữ liệu gửi lên.
- Mật khẩu và token không được lưu.
- Lọc theo người thực hiện, khoảng thời gian, loại thao tác (Tạo / Sửa / Xoá), kết quả. Bật **Ẩn kết nối realtime** để bỏ các bản ghi kết nối kênh.

## 1.8. Các tiến trình chạy ngầm

| Tiến trình | Lịch | Việc |
|---|---|---|
| `weather:fetch` | Mỗi giờ | Lấy dự báo Open-Meteo 3 ngày cho từng khu vực, tính mức rủi ro 1-5. Mưa vượt ngưỡng thì tạo đề xuất cảnh báo lũ (Chờ duyệt) |
| `earthquakes:fetch` | 30 phút | Nhập động đất USGS (M ≥ 3.5 quanh Việt Nam) thành sự kiện thiên tai |
| Queue worker | Luôn chạy | Gửi thông báo cho người trong vùng (geofencing), email cảnh báo mức 4-5, broadcast realtime |
| Reverb | Luôn chạy | WebSocket: kênh `alerts` (bản đồ), `sos.{mã}` (người gửi SOS), `staff.sos` (cán bộ, cứu hộ), kênh riêng từng người dùng (thông báo) |

Chạy tay để demo: `php artisan weather:fetch`, `php artisan earthquakes:fetch` (trong Docker: thêm tiền tố `docker compose exec app`).

## 1.9. Bản đồ nền và chủ quyền Việt Nam

- **Bản đồ nền:**
  - bản đồ vector OpenFreeMap, dữ liệu OpenStreetMap, miễn phí, không cần key;
  - mọi nhãn hiển thị tên tiếng Việt;
  - Hoàng Sa và Trường Sa có nhãn đỏ **"Quần đảo Hoàng Sa (Việt Nam)"** và **"Quần đảo Trường Sa (Việt Nam)"**, biển ghi **"Biển Đông"**;
  - nhãn và đường ranh giới của nước khác trong vùng hai quần đảo bị ẩn.
- **Trường hợp dùng ảnh bản đồ raster:** chỉ khi đặt `VITE_MAP_TILE_URL` hoặc trình duyệt không có WebGL. Chế độ này **không** có các chỉnh sửa chủ quyền trên.
- Bản đồ chỉ thu nhỏ tới mức 4 (vùng Đông Nam Á), không kéo ra cả thế giới.

## 1.10. Kịch bản demo đầy đủ (5-7 phút, dữ liệu Nha Trang)

1. **Khách:** Trang chủ → **Kiểm tra vị trí của tôi** → Bản đồ (bật/tắt lớp) → Cảnh báo (lọc loại, mức độ, "Trong bán kính").
2. **Đề xuất tự động:** chạy `weather:fetch`. Nếu mưa vượt ngưỡng, cảnh báo lũ "Chờ duyệt" xuất hiện ở Tổng quan cán bộ.
3. **Chuẩn bị:** mở cửa sổ ẩn danh, đăng nhập `citizen@demo.vn`. Mở thêm trình duyệt khác với `outsider@demo.vn`.
4. **Cán bộ** (`officer@demo.vn`): Cảnh báo → **Tạo cảnh báo** → chọn Lũ lụt (hướng dẫn tự điền) → vẽ vùng quanh Ngọc Hiệp → **Phát hành ngay**.
   - `citizen` thấy banner realtime và chuông tăng.
   - `outsider` không nhận gì.
5. **Sơ tán:** `citizen` → Trú ẩn → **Tuyến sơ tán**. Hệ thống dẫn tới Trường Đại học Khánh Hoà, nằm ngoài vùng ngập.
6. **SOS:** bấm nút đỏ **SOS** (không cần đăng nhập) → gửi → giữ trang theo dõi mở.
   - `officer` → Điều phối SOS → Xác minh → **Giao việc** cho đội gợi ý.
   - `rescuer` → Nhiệm vụ → **Bắt đầu cứu hộ** → **Đã đưa tới nơi an toàn**.
   - Trang theo dõi của người gửi tự đổi trạng thái từng bước.
7. **Báo cáo:** `citizen` gửi báo cáo có ảnh → `officer` duyệt → báo cáo hiện trên bản đồ.
8. **Kết thúc:** `officer` kết thúc cảnh báo → Sự kiện → mở "Bão số 6 (demo)" → **Phát lại diễn biến** → Thống kê.
9. **Admin:** Người dùng (tạo đội cứu hộ mới, khoá tài khoản) → Danh mục → Nhật ký hoạt động (thấy các thao tác vừa làm).

**Dữ liệu demo sau khi seed:**
- 1 sự kiện "Bão số 6 (demo)".
- Cảnh báo:
  - đang hiệu lực: "Cảnh báo ngập lụt phường Ngọc Hiệp" (tâm + bán kính 2,5 km);
  - bản nháp: sạt lở đèo Khánh Lê.
- 4 điểm trú ẩn:
  - THPT Lý Tự Trọng, Nhà văn hoá phường Ngọc Hiệp, Nhà thi đấu tỉnh Khánh Hoà (đã đầy);
  - Trường Đại học Khánh Hoà, nằm ngoài vùng ngập.
- 1 báo cáo người dân, 1 yêu cầu SOS mẫu.

## 1.11. Giới hạn hiện tại

Chưa làm các phần sau: GDACS, Web Push / Telegram, xuất CAP XML / RSS, đăng nhập Google, OTP email, "Tôi an toàn", đăng ký tình nguyện viên, điểm tiếp nhận cứu trợ, xuất Excel / PDF, Swagger, PWA / offline.

---

<a id="phan-2"></a>
# Phần 2. Hướng dẫn chạy: local, Docker, VPS

## 2.1. Chọn cách chạy

| Cách | Khi nào dùng | Kết quả |
|---|---|---|
| **A. Docker (khuyên dùng)** | Chạy demo nhanh, giống môi trường triển khai | Web + API + realtime ở `http://localhost:8000` |
| **B. Docker backend + Vite dev** | Sửa giao diện, cần hot reload | SPA dev ở `http://localhost:5173` |
| **C. XAMPP + MySQL 8.4 + Vite dev** | Phát triển backend bằng `php artisan serve` (XAMPP cho PHP + phpMyAdmin) | API `:8000`, Reverb `:8080`, SPA `:5173` |
| **D. VPS (Docker)** | Demo công khai cho giảng viên, bạn bè | `http://<IP-VPS>` |

Không chạy XAMPP (`php artisan serve`) và Docker cùng lúc vì cả hai dùng cổng 8000.

## 2.2. Yêu cầu phần mềm

- Git.
- Cách A, B, D: **Docker Desktop** (Windows/macOS, bật WSL2) hoặc Docker Engine + Compose v2.20+ (Linux).
- Cách B, C: **Node.js 18+** (đã thử Node 22/25).
- Cơ sở dữ liệu: **MySQL 8.4** (bắt buộc). Cách A, B, D dùng sẵn image `mysql:8.4.6` trong Docker.
- Cách C: **XAMPP** (chỉ dùng Apache + PHP 8.2+ + phpMyAdmin), **Composer 2**, và **MySQL 8.4**: MySQL trong Docker (`Infra/`, cổng 3307) hoặc **MySQL Community Server 8.4** cài riêng (cổng 3306). Module MySQL của XAMPP là MariaDB 10.4, không dùng làm CSDL của dự án. Bật các extension PHP `pdo_mysql`, `mbstring`, `gd`, `zip`, `intl`, `bcmath`.

Lấy mã nguồn:

```bash
git clone git@github.com:TranDucKhiem14082005/-Natural-disaster-warning-system.git
cd -Natural-disaster-warning-system
```

## 2.3. Cách A - Chạy toàn bộ bằng Docker trên máy

Docker Compose ở thư mục `Infra/` gồm các service:

| Service | Vai trò |
|---|---|
| `nginx` | Cổng vào `:8000`: trang React đã build, `/api` sang PHP, `/app` sang Reverb, `/storage` file upload |
| `app` | Laravel (PHP 8.2-FPM) |
| `migrate` | Chạy `migrate --force` một lần rồi thoát |
| `queue` | `queue:work`: gửi thông báo, broadcast |
| `scheduler` | `schedule:work`: thời tiết mỗi giờ, động đất 30 phút |
| `reverb` | WebSocket |
| `db` | MySQL 8.4 (image `mysql:8.4.6`, volume `mysql-data`) |
| `phpmyadmin` | Quản trị CSDL tại `127.0.0.1:8081` (có thể dùng phpMyAdmin của XAMPP thay thế, xem bên dưới) |

Chuyển từ MariaDB sang MySQL 8.4: MySQL không mở được dữ liệu cũ của MariaDB, nên `db` dùng volume mới `mysql-data` (CSDL trống, phải chạy lại bước 3 `db:seed`). Volume MariaDB cũ `db-data` vẫn được giữ nguyên; khi không cần nữa thì xoá bằng `docker volume rm disaster-warning_db-data`.

**Bước 1 - Tạo file cấu hình** (chỉ lần đầu):

```bash
cd Infra
cp .env.example .env
```

Điền các giá trị đang trống trong `Infra/.env`:

```bash
echo "base64:$(openssl rand -base64 32)"   # -> APP_KEY
openssl rand -hex 16                        # -> REVERB_APP_KEY
openssl rand -hex 16                        # -> REVERB_APP_SECRET
openssl rand -hex 12                        # -> DB_PASSWORD
openssl rand -hex 12                        # -> DB_ROOT_PASSWORD
```

Windows không có `openssl` thì chạy các lệnh trên trong Git Bash. `Infra/.env` đã nằm trong `.gitignore`, **không commit file này**.

**Bước 2 - Khởi động:**

```bash
docker compose up -d --build
docker compose ps                 # migrate = Exited (0), các service khác = running/healthy
curl http://localhost:8000/up     # health check Laravel
```

**Bước 3 - Nạp dữ liệu demo** (một lần):

```bash
docker compose exec app php artisan db:seed --force
```

**Bước 4 - Dùng:**

| Địa chỉ | Nội dung |
|---|---|
| http://localhost:8000 | Giao diện web (đủ 4 cổng) |
| http://localhost:8000/api/v1 | REST API |
| http://127.0.0.1:8081 | phpMyAdmin (user `dws` hoặc `root`, mật khẩu `DB_PASSWORD` / `DB_ROOT_PASSWORD` trong `Infra/.env`) |
| `127.0.0.1:3307` | MySQL 8.4 từ máy host |
| http://localhost/phpmyadmin | phpMyAdmin của XAMPP, sau khi thêm server MySQL 8.4 (cổng 3307) như dưới đây |

Đăng nhập bằng tài khoản demo ở mục 1.1.

**Quản lý CSDL bằng phpMyAdmin của XAMPP:** nhóm vẫn dùng phpMyAdmin của XAMPP (`C:\xampp\phpMyAdmin`, bản 5.2.1) để quản lý MySQL 8.4. Thêm một server vào cuối file `C:\xampp\phpMyAdmin\config.inc.php`:

```php
$i++;
$cfg['Servers'][$i]['verbose'] = 'MySQL 8.4 - du an (Docker :3307)';
$cfg['Servers'][$i]['host'] = '127.0.0.1';
$cfg['Servers'][$i]['port'] = '3307';
$cfg['Servers'][$i]['auth_type'] = 'cookie';
$cfg['Servers'][$i]['AllowNoPassword'] = false;
```

Bật Apache trong XAMPP Control Panel, mở `http://localhost/phpmyadmin`, chọn server "MySQL 8.4 - du an (Docker :3307)" rồi đăng nhập bằng `dws` / `DB_PASSWORD` hoặc `root` / `DB_ROOT_PASSWORD` trong `Infra/.env`. phpMyAdmin trong Docker (`http://127.0.0.1:8081`) vẫn dùng được thay thế.

**Lệnh thường dùng** (trong `Infra/`):

```bash
docker compose logs -f app queue scheduler reverb     # xem log
docker compose exec app php artisan weather:fetch     # lấy thời tiết ngay
docker compose exec app php artisan earthquakes:fetch # lấy động đất ngay
docker compose up -d --build                          # cập nhật code (tự migrate)
docker compose restart nginx                          # BẮT BUỘC sau khi build lại app, tránh lỗi 502
docker compose down                                   # dừng, giữ dữ liệu
docker compose down -v                                # dừng + XOÁ DB và file upload
```

Muốn làm lại dữ liệu từ đầu: chạy `docker compose down -v`, rồi `docker compose up -d --build`, rồi `docker compose exec app php artisan db:seed --force`.

Sao lưu CSDL:

```bash
docker compose exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' > backup.sql
```

Link công khai tạm thời khi demo (Cloudflare Quick Tunnel, không cần tài khoản):

```bash
docker compose --profile tunnel up -d
docker compose logs tunnel | grep trycloudflare.com
```

Sau đó đặt `APP_URL` = URL vừa nhận trong `.env` rồi chạy `docker compose up -d`, để link ảnh upload trỏ đúng domain.

## 2.4. Cách B - Backend Docker + Frontend dev (hot reload)

Chạy cách A trước (bước 1-3), sau đó:

```bash
cd Frontend
npm install
cp .env.example .env
```

Sửa `Frontend/.env`:

```dotenv
VITE_BACKEND_URL=http://127.0.0.1:8000
VITE_REVERB_URL=http://127.0.0.1:8000      # Docker: Reverb đi qua nginx /app, không mở :8080
VITE_REVERB_APP_KEY=<REVERB_APP_KEY trong Infra/.env>
```

```bash
npm run dev        # http://localhost:5173
```

Vite tự proxy `/api`, `/storage`, `/app` về backend nên không cần cấu hình CORS. Để trống `VITE_REVERB_APP_KEY` thì app vẫn chạy, chỉ mất realtime (tải lại trang để thấy dữ liệu mới).

Lệnh khác: `npm run typecheck`, `npm run build` (ra `dist/`), `npm run preview`.

## 2.5. Cách C - Chạy bằng XAMPP (không Docker cho backend)

XAMPP chỉ đóng vai trò **Apache + PHP + phpMyAdmin**. CSDL là **MySQL 8.4**, không phải MariaDB đi kèm XAMPP.

**Backend:**

1. Chuẩn bị MySQL 8.4, chọn một trong hai:
   - **Phương án A - MySQL trong Docker:** trong `Infra/` chạy `docker compose up -d db` (cổng `127.0.0.1:3307`, tài khoản trong `Infra/.env`).
   - **Phương án B - MySQL Community Server 8.4 cài trên máy** (cổng 3306): trước đó **tắt module MySQL (MariaDB) trong XAMPP Control Panel** để tránh trùng cổng 3306, hoặc cho MySQL 8.4 chạy cổng khác.
2. Thêm server MySQL 8.4 vào phpMyAdmin của XAMPP: cuối file `C:\xampp\phpMyAdmin\config.inc.php` thêm khối `$cfg['Servers'][$i]` như mục 2.3 (phương án A: `port` = `3307`; phương án B: `port` = `3306`, `verbose` = `'MySQL 8.4 (:3306)'`). Bật Apache, mở `http://localhost/phpmyadmin`, chọn server MySQL 8.4 và đăng nhập.
3. Trong phpMyAdmin (hoặc MySQL Workbench), tạo 2 database `disaster_warning` và `disaster_warning_test` (collation `utf8mb4_unicode_ci`). Phương án A đã tự tạo sẵn `disaster_warning`.
4. Trong `Backend/`:

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan reverb:install     # sinh REVERB_APP_ID/KEY/SECRET nếu .env chưa có
php artisan migrate --seed
php artisan storage:link
```

5. Kiểm tra `Backend/.env`:

```dotenv
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306                 # phương án A (Docker): 3307
DB_DATABASE=disaster_warning
DB_USERNAME=root             # phương án A: root hoặc dws
DB_PASSWORD=<mật khẩu MySQL> # phương án A: DB_ROOT_PASSWORD / DB_PASSWORD trong Infra/.env
BROADCAST_CONNECTION=reverb
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http
FRONTEND_URL=http://localhost:5173
```

6. Chạy 4 tiến trình, mỗi lệnh một terminal, trong `Backend/`:

```bash
php artisan serve          # API  http://127.0.0.1:8000/api/v1
php artisan reverb:start   # WebSocket :8080
php artisan queue:work     # thông báo + broadcast (bắt buộc cho realtime)
php artisan schedule:work  # thời tiết / động đất định kỳ (tuỳ chọn)
```

**Frontend:** như cách B, nhưng giữ `VITE_REVERB_URL=http://127.0.0.1:8080` và lấy `VITE_REVERB_APP_KEY` từ `REVERB_APP_KEY` trong `Backend/.env`.

Tuỳ chọn: điền `ORS_API_KEY` (OpenRouteService, miễn phí) để tuyến sơ tán đi theo đường thật thay vì đường chim bay.

## 2.6. Chạy kiểm thử

**Backend** (trong `Backend/`, cần database `disaster_warning_test`):

```bash
vendor/bin/pint --test      # kiểm tra code style
php artisan test            # 28 test (geofencing, vòng đời cảnh báo, SOS, quyền...)
```

Nếu dùng MySQL của Docker (cổng 3307), đặt biến môi trường trước khi chạy `php artisan test`:

```bash
DB_HOST=127.0.0.1 DB_PORT=3307 DB_USERNAME=root DB_PASSWORD=<DB_ROOT_PASSWORD trong Infra/.env> php artisan test
```

**Frontend:** `npm run typecheck` và `npm run build`.

**CI:** GitHub Actions (`.github/workflows/ci.yml`) chạy Pint + test trên MySQL 8.4, kiểm tra `docker compose config` và build image cho mỗi PR và mỗi lần push vào `main`.

## 2.7. Cách D - Triển khai lên VPS (Docker)

Yêu cầu: VPS Ubuntu 22.04+ (đã dùng 2 CPU / 4 GB RAM), có IP công khai. Ở VPS, image `nginx` tự build luôn React SPA, nên **không cần cài Node.js**.

### Bước 1 - Bảo mật SSH (làm một lần)

Trên máy local, tạo key và cấu hình alias:

```bash
ssh-keygen -t ed25519 -C "vps-deploy" -f ~/.ssh/id_ed25519_vps_deploy
```

`~/.ssh/config`:

```
Host my-vps-dev
  HostName     <IP-VPS>
  User         deploy
  IdentityFile ~/.ssh/id_ed25519_vps_deploy
  IdentitiesOnly yes
```

Trên VPS (đăng nhập root lần đầu), tạo user `deploy` và cài key:

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys     # dán nội dung ~/.ssh/id_ed25519_vps_deploy.pub
chmod 600 /home/deploy/.ssh/authorized_keys && chown -R deploy:deploy /home/deploy/.ssh
```

Mở **terminal mới** và thử `ssh my-vps-dev`. Chỉ khi đăng nhập bằng key đã chạy, mới tắt đăng nhập mật khẩu và root:
1. Đặt các dòng sau trong `/etc/ssh/sshd_config` và kiểm tra cả các file trong `/etc/ssh/sshd_config.d/*.conf`:
   - `PermitRootLogin no`
   - `PasswordAuthentication no`
   - `KbdInteractiveAuthentication no`
   - `AllowUsers deploy`
2. Chạy `sudo sshd -t` để kiểm tra cấu hình.
3. Chạy `sudo systemctl restart ssh`.

Tường lửa:

```bash
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
```

### Bước 2 - Cài Docker

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 docker-buildx git
sudo usermod -aG docker deploy      # đăng xuất rồi đăng nhập lại để có quyền
```

### Bước 3 - Lấy mã nguồn và cấu hình

```bash
sudo mkdir -p /var/www && sudo chown deploy:deploy /var/www
git clone https://github.com/TranDucKhiem14082005/-Natural-disaster-warning-system.git /var/www/disaster-warning
cd /var/www/disaster-warning/Infra
cp .env.example .env && chmod 600 .env
nano .env
```

Ngoài các secret như ở mục 2.3, trên VPS cần đổi:

```dotenv
HTTP_PORT=80
APP_URL=http://<IP-VPS>          # hoặc https://<domain> nếu có HTTPS
FRONTEND_URL=http://<IP-VPS>     # dùng cho link đặt lại mật khẩu trong email
```

Sinh secret **ngay trên VPS**. Không copy `.env` của máy local lên.

### Bước 4 - Build, chạy, seed

```bash
cd /var/www/disaster-warning/Infra
docker compose build migrate nginx      # build image app (chung cho 5 service) + image web (gồm SPA)
docker compose up -d
docker compose restart nginx
docker compose exec app php artisan db:seed --force   # chỉ lần đầu
curl http://localhost/up
```

Trên VPS **không dùng** `docker compose up -d --build`. Năm service dùng chung một image, build song song dễ lỗi `image already exists`. Build trước bằng `docker compose build migrate nginx`, sau đó mới `up`.

Mở `http://<IP-VPS>` trên trình duyệt. MySQL và phpMyAdmin chỉ mở trên `127.0.0.1` của VPS. Muốn vào phpMyAdmin thì dùng SSH tunnel:

```bash
ssh -L 8081:127.0.0.1:8081 my-vps-dev     # rồi mở http://127.0.0.1:8081 trên máy local
```

### Bước 5 - Cập nhật phiên bản mới

Tạo script `~/deploy.sh` trên VPS:

```bash
#!/usr/bin/env bash
set -e
cd /var/www/disaster-warning
git pull origin main
cd Infra
docker compose build migrate nginx
docker compose up -d
docker compose restart nginx
```

```bash
chmod +x ~/deploy.sh
```

Mỗi lần có code mới trên `main`, chạy từ máy local:

```bash
ssh my-vps-dev ~/deploy.sh
```

Migration chạy tự động qua service `migrate`. Nếu thư mục code trên VPS bị sửa tay khiến `git pull` lỗi, chạy:

```bash
git reset --hard origin/main && git clean -fd
```

Lệnh này giữ nguyên `Infra/.env` vì file đó đã bị gitignore.

### Bước 6 - HTTPS (khuyến nghị)

Chọn một trong hai:
- **Cloudflare:**
  1. Trỏ domain qua Cloudflare (proxy bật).
  2. Đặt SSL/TLS ở chế độ "Flexible", hoặc "Full" nếu có chứng chỉ trên VPS.
- **Reverse proxy trên VPS:**
  1. Đặt `HTTP_PORT=8000` trong `Infra/.env`.
  2. Chạy Caddy hoặc nginx + certbot ở cổng 80/443, proxy về `127.0.0.1:8000`. Nhớ chuyển tiếp header WebSocket cho đường dẫn `/app`.

Sau khi có HTTPS:
1. Đặt `APP_URL=https://<domain>` và `FRONTEND_URL=https://<domain>`.
2. Chạy `~/deploy.sh`.

Trang web tự kết nối WebSocket bằng `wss` theo giao thức của trang.

## 2.8. Sự cố thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `502 Bad Gateway` sau khi build lại | nginx giữ IP cũ của container `app` | `docker compose restart nginx` |
| `Cannot connect to the Docker daemon` | Docker Desktop chưa chạy | Mở Docker Desktop, chờ báo "Engine running" |
| `Access denied for user` khi lên lại DB | Volume DB cũ được tạo với mật khẩu khác trong `.env` | Đặt lại mật khẩu cũ, hoặc `docker compose down -v` (xoá dữ liệu) |
| Dữ liệu cũ biến mất / MySQL không khởi động được với volume cũ sau khi chuyển DB | Dữ liệu cũ của MariaDB không mở được bằng MySQL 8.4 | Stack dùng volume mới `mysql-data` (CSDL trống): chạy lại `docker compose exec app php artisan db:seed --force`. Volume cũ `db-data` xoá bằng `docker volume rm disaster-warning_db-data` khi không cần |
| phpMyAdmin XAMPP báo lỗi auth plugin khi đăng nhập MySQL 8.4 | Sai cổng / tài khoản, hoặc PHP thiếu extension `openssl` (MySQL 8.4 dùng `caching_sha2_password`; mysqli của PHP 8.2 tự trao đổi khoá RSA khi có `openssl`) | Chọn đúng máy chủ "MySQL 8.4 - du an (Docker :3307)", đăng nhập bằng user/mật khẩu trong `Infra/.env`, bật `extension=openssl` trong `C:\xampp\php\php.ini` rồi khởi động lại Apache |
| Bản đồ xám, không có nền | Mạng chặn OpenFreeMap / OpenStreetMap, hoặc trình duyệt tắt WebGL | Kiểm tra mạng tới `tiles.openfreemap.org`. Một số nhà mạng VN chặn `*.openstreetmap.org` |
| Không có banner / thông báo realtime | Thiếu `VITE_REVERB_APP_KEY`, sai `VITE_REVERB_URL`, hoặc `queue` không chạy | Đối chiếu mục 2.4 / 2.5, xem `docker compose logs queue reverb` |
| Người dân không nhận cảnh báo | Chưa có vị trí quan tâm nằm trong vùng cảnh báo | Thêm vị trí ở Hồ sơ & vị trí (geofencing) |
| `429 Too Many Requests` | Vượt giới hạn: đăng nhập 10/phút/IP, SOS 3/10 phút, báo cáo 10/giờ | Chờ hết thời gian giới hạn |
| Không nhận email đặt lại mật khẩu | `MAIL_MAILER=log` | Xem link trong `docker compose logs app queue`, hoặc cấu hình SMTP trong `.env` |
| `php artisan tinker` lỗi trong container | HOME của www-data không ghi được | `docker compose exec -e HOME=/tmp app php artisan tinker` |
| Cổng 8000 đã bị chiếm | Đang chạy cả XAMPP `serve` và Docker | Tắt một bên, hoặc đổi `HTTP_PORT` trong `Infra/.env` |
