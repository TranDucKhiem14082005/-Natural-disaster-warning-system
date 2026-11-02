# Tầng nghiệp vụ & cắt ngang (Business · Security · Performance · Reliability · AI)

> Đọc khi target đụng tiền, quyền, trạng thái, bảo mật, tải, hoặc tính năng AI.
> Mỗi mục là checklist case cần có. Đặt mỗi check ở **tầng rẻ nhất** chứng minh được nó.

## 1. Business (nghiệp vụ)

Viết dạng integration (API + DB thật), một test một quy tắc nghiệp vụ.

| Nghiệp vụ | Case bắt buộc |
|---|---|
| Auth | đăng ký trùng email · sai mật khẩu · token hết hạn · refresh xoay vòng · refresh cũ dùng lại -> thu hồi cả họ · logout -> token bị chặn |
| Phân quyền (RBAC) | **ma trận role x endpoint**: mỗi role gọi mỗi endpoint nhạy cảm -> đúng 200/403 · role thấp không tự nâng role · chủ sở hữu không bị xoá |
| State machine | chuyển trạng thái hợp lệ OK · chuyển không hợp lệ bị chặn · thao tác trên tài nguyên đã archive/khoá |
| Tiền / số lượng | làm tròn · âm · 0 · trần · trừ 2 lần (idempotency) · hoàn tiền một phần |
| Thứ tự / vị trí | chèn đầu, giữa, cuối · nhiều lần chèn giữa liên tiếp (độ chính xác số thực) |

Ma trận RBAC nên là **một test table-driven** đọc từ bảng `{role, method, path, expectedStatus}`.

## 2. Security

| Lỗ hổng | Cách test |
|---|---|
| AuthN | gọi không token, token sai chữ ký, token hết hạn, token của user bị khoá -> 401 |
| AuthZ / IDOR (BOLA) | user A đọc/sửa/xoá tài nguyên của user B bằng cách đổi id -> 403/404 |
| Mass assignment | gửi thêm field `role`, `isAdmin`, `ownerId` trong body -> bị bỏ qua |
| Injection | input chứa `' OR 1=1`, `<script>`, `{{7*7}}` -> lưu nguyên văn, render đã escape |
| XSS (markdown) | markdown chứa `<img onerror>`, `javascript:` link -> đã sanitize |
| Realtime | join room của board không có quyền -> bị từ chối, không nhận event |
| Rate limit | vượt ngưỡng login/forgot-password -> 429 |
| Upload | sai MIME, quá dung lượng, tên file `../` -> bị chặn |
| Secret | log/response không chứa password, token, hash |
| Prompt injection (nếu có LLM) | nội dung người dùng chứa "ignore previous instructions" -> không đổi hành vi |

Pentest có authorization -> `/pentest-suite`. Code mới -> `security-review`. Repo lạ -> `/repo-scan`.

## 3. Performance

| Loại | Mục tiêu | Công cụ |
|---|---|---|
| Load | đạt SLO (vd p95 < 300ms) ở tải bình thường | k6, autocannon |
| Stress | tìm điểm gãy | k6 ramp |
| Spike | tải tăng đột ngột không sập | k6 |
| Soak | chạy lâu không rò bộ nhớ/kết nối | k6 vài giờ |
| Volume | dữ liệu lớn (10k card/board) vẫn phân trang, không N+1 | seed lớn + đo query |

Đo trên môi trường giống prod, không trên laptop. Đọc kết quả cùng metrics/trace (`/observability`).

## 4. Reliability

- **Retry + idempotency**: job/webhook chạy 2 lần -> kết quả như 1 lần.
- **Timeout**: dịch vụ ngoài chậm -> request không treo vô hạn.
- **Queue**: job lỗi -> retry có backoff -> hết lượt vào failed/DLQ, không mất im lặng.
- **Backup/restore**: restore bản backup ra DB tạm, đếm bản ghi khớp. Chưa restore thử = chưa có backup.
- **Rollback**: deploy bản cũ chạy được với schema hiện tại (migration tương thích lùi).
- **Chaos nhẹ**: tắt Redis/DB giữa chừng -> `/health` báo đỏ, app không crash, phục hồi khi dịch vụ lên lại.
- **Logging/tracing**: lỗi có trace id, log đủ để lần ra nguyên nhân.

## 5. Tính năng AI / LLM

Unit test không đủ cho output của model. Cần **eval**:

- **Golden dataset**: 20-100 input thật + output mong đợi (hoặc tiêu chí chấm).
- **Chấm điểm**: deterministic khi được (JSON đúng schema, có trích nguồn), LLM-as-judge cho ý nghĩa.
- **Baseline + regression**: lưu điểm bản hiện tại; đổi prompt/model mà điểm giảm -> BLOCK.
- **Case xấu**: câu hỏi ngoài phạm vi, prompt injection, input rỗng, quá dài.
- Mock model trong unit test để test phần code xung quanh (parse, retry, rate limit).
