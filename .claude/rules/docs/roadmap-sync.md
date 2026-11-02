# Roadmap Sync - Luôn giữ `docs/03-san-pham/roadmap.md` đúng thực tế

> **Level:** MANDATORY.
> **Rule:** Mỗi khi (1) code xong một tính năng có trong roadmap, hoặc (2) user yêu cầu thêm tính năng
> mới / ý tưởng mới → **PHẢI** cập nhật [docs/03-san-pham/roadmap.md](../../../docs/03-san-pham/roadmap.md)
> trong cùng lượt làm việc. Không để roadmap lệch với code.

---

## Cấu trúc roadmap (giữ nguyên, không tự đổi)

| Mục | Nội dung |
|---|---|
| Header | Ngày cập nhật, phiên bản mới nhất, ký hiệu |
| 1. Tổng quan tiến độ | Bảng module (User / Admin) + bảng tóm tắt N0-N20: trạng thái + "Còn lại" |
| 2.1 Làm được ngay | Việc còn lại của module có sẵn, mã `M<số module>` |
| 2.2 Tính năng mới | Mã `N<số>`, tính năng ngoài plan gốc |
| 2.3 Cần credential 🔑 | Cần tài khoản/khoá bên thứ ba |
| 2.4 Subsystem lớn 🏗 | Mỗi cái 1 batch riêng |
| 3. Ưu tiên tiếp theo | Thứ tự gợi ý, chỉ chứa việc CHƯA xong |
| 4. Cách thêm tính năng | Mã N tiếp theo (`hiện tại: N..`) |
| 5. Đã xong | Theo app → module, mỗi module có anchor `xong-<số>` |

Ký hiệu: ✅ xong · 🟡 một phần · ⬜ chưa làm · 🔑 cần credential · 🏗 subsystem lớn.

---

## Trigger 1 - Code xong một tính năng

Chỉ áp dụng khi tính năng **đã chạy được và đã verify** (chạy app, gọi API, xem UI). Chưa verify → không đánh ✅.

1. **Xoá dòng** khỏi mục 2.x (backlog).
2. **Thêm 1 dòng** vào mục 5 đúng app/module, kèm version nếu có: `- Tên tính năng (v1.x.y)`.
   Module/N mới xuất hiện ở mục 5 → thêm anchor `<a id="xong-<số>"></a>` trước tiêu đề, và link số module ở mục 1 tới đó.
   Không dùng `<details>` ở mục 5 (link không nhảy vào được khi đang thu gọn).
3. **Mục 1:** cập nhật cột "Còn lại" của module; hết việc → trạng thái ✅ và "Còn lại" = `-`.
   Với N: cập nhật số "Xong x/y" và danh sách còn lại.
4. **Mục 3:** bỏ tính năng khỏi danh sách ưu tiên.
5. **Header:** cập nhật `Cập nhật: YYYY-MM-DD` và phiên bản mới nhất.
6. Ra phiên bản mới → đồng thời thêm mục vào [changelog.md](../../../docs/03-san-pham/changelog.md) (theo CLAUDE.md).

### Làm một phần
- Giữ dòng ở mục 2.x, đổi trạng thái → 🟡, ghi rõ phần còn thiếu trong cột tính năng.
- Phần đã xong ghi vào mục 5 với hậu tố `- 🟡 phần còn lại ở 2.x`.
- Mục 1: module chuyển ⬜ → 🟡.

---

## Trigger 2 - User thêm tính năng mới / ý tưởng mới

Áp dụng khi user nói "thêm tính năng...", "muốn có...", "sau này làm...", hoặc đưa ra yêu cầu chưa có trong roadmap
(kể cả khi làm luôn trong lượt đó).

1. **Kiểm tra trùng:** tìm trong roadmap. Đã có → cập nhật mô tả, không tạo dòng mới.
2. **Chọn mục:**
   - Thuộc module có sẵn (Auth, Board, Card...) → **2.1**, mã `M<số module>`.
   - Tính năng mới ngoài plan gốc → **2.2**, mã `N<số tiếp theo>` (lấy từ mục 4, sau đó tăng số ở mục 4).
   - Cần credential/hạ tầng ngoài → **2.3**. Rule engine/i18n/PWA-cỡ lớn → **2.4**.
3. **Điền đủ cột:** Mã · Tính năng (1 câu cụ thể) · App (User/Admin/Toàn hệ thống) · Trạng thái ⬜.
   Ô Mã có anchor: `<a id="n21"></a>N21` (id viết thường, duy nhất trong file).
4. **Mục 1:** thêm link `[N21](#n21)` vào cột "Còn lại" của module; module đang ✅ → đổi 🟡. Với N: cập nhật bảng tóm tắt.
5. Nếu user nói rõ độ ưu tiên → chèn vào mục 3 đúng vị trí.
6. Làm xong luôn trong lượt → chạy tiếp Trigger 1.

---

## Quy tắc chung

- **Link:** xoá 1 dòng có anchor → sửa/bỏ mọi link `(#id)` trỏ tới nó (mục 1, 3). Không để link chết.
- **Không đổi số mã** đã cấp (M/N). Mã N đã dùng không tái sử dụng, kể cả khi tính năng bị bỏ.
- **Bỏ tính năng** theo yêu cầu user → gạch `~~...~~` + ghi `(bỏ, YYYY-MM-DD)`, không xoá im lặng.
- **Không đánh ✅ khi chưa verify.** Nghi ngờ → 🟡 + ghi chú.
- **Không tự đổi cấu trúc** mục 1-5. Muốn đổi → hỏi user.
- Sửa bằng `Edit` từng chỗ, không viết lại toàn file.
- Sau khi cập nhật → báo user **1 dòng**: `Roadmap: <mã> -> <trạng thái>`.

---

## Checklist trước khi kết thúc lượt

- [ ] Có tính năng nào vừa code xong/verify trong lượt này? → đã chuyển sang mục 5, cập nhật mục 1, 3?
- [ ] User có nhắc tính năng mới? → đã thêm vào 2.x với mã đúng, cập nhật mục 1?
- [ ] Đã cập nhật ngày ở header?
- [ ] Ra version mới → đã cập nhật changelog.md?
