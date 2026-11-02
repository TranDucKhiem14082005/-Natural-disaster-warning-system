---
name: diagram-design
description: Tạo sơ đồ chất lượng cao (architecture, flow, sequence, state, ER, timeline, swimlane, quadrant, pyramid, tree, org, layers, venn, radar, bar/line/gantt/scatter...) thành 1 file HTML self-contained gồm inline SVG + CSS. Dùng khi cần hình có gu, gọn, nhúng được vào bài viết/slide/social — không phải Mermaid vẽ nhanh.
metadata:
  version: "2.0"
---

# /diagram-design — Sơ đồ có gu (HTML/SVG)

> Kích hoạt: khi cần một sơ đồ **gọn, đẹp, đồng nhất phong cách, nhúng được** vào blog / slide / ảnh social.
> Kết quả: **1 file `.html` tự chứa** (SVG + CSS inline; chỉ font là external). Mở thẳng trong browser, không cần build.
>
> Phân biệt với Mermaid ([[artifact-diagramming]] / khối ```mermaid): Mermaid = nhanh, tự dàn layout, hợp tài liệu nội bộ. Skill này = layout thủ công, phối màu chủ đích, dùng khi hình là "sản phẩm" người ngoài nhìn. Việc nhanh vẫn ưu tiên Mermaid.

Nguyên lý dàn hình node-link legible ở đây là kiến thức kỹ thuật chung; file này viết độc lập bằng bảng màu, typography và cách tổ chức riêng.

---

## 1. Nguyên tắc gốc (chi phối mọi thứ khác)

**Chất lượng đến từ việc cắt bớt, không phải thêm vào.**

- Mỗi node là một ý riêng. Hai node luôn xuất hiện cùng nhau → gộp làm một.
- Mỗi đường nối phải mang thông tin. Nếu quan hệ đã rõ từ vị trí → xoá đường nối.
- **Chỉ một điểm nhìn chính.** Màu nhấn dành cho tối đa 1–2 node quan trọng nhất. Nhấn 5 thứ = không nhấn gì.
- Hình chưa xong khi còn thứ để thêm; xong khi không còn thứ để bỏ.

Mật độ hợp lý: khoảng **một nửa mức tối đa**. Đủ chính xác, chưa cần chú giải để hiểu. Quá ~8 node thường là dấu hiệu nên tách hai hình.

---

## 2. Có nên vẽ không?

Vẽ khi người đọc **hiểu nhanh hơn từ hình so với đoạn văn, bảng, hay danh sách**.

Đừng vẽ khi:
- Chỉ là danh sách các mục → dùng bullet/bảng.
- So sánh trước/sau đơn giản → dùng bảng 2 cột.
- Quan hệ chỉ có một bước → viết một câu.
- Cần nháp nhanh cho nội bộ → dùng Mermaid.

Tự hỏi trước khi vẽ: *"Một đoạn văn viết tốt có truyền đạt được như hình không?"* Nếu có → đừng vẽ.

---

## 3. Chọn dạng hình (theo thứ muốn truyền đạt)

| Muốn thể hiện | Dạng |
|---|---|
| Thành phần hệ thống + kết nối | Architecture |
| Quyết định có nhánh | Flowchart |
| Thông điệp giữa các bên theo thời gian | Sequence |
| Trạng thái + điều kiện chuyển | State machine |
| Thực thể + trường + quan hệ | ER / data model |
| Sự kiện trên trục thời gian | Timeline |
| Quy trình liên bộ phận có bàn giao | Swimlane |
| Định vị theo 2 trục / xếp ưu tiên | Quadrant 2×2 |
| Chu trình tự củng cố (bước cuối nuôi bước đầu) | Loop / flywheel |
| Phân cấp bằng bao chứa | Nested |
| Cha → con | Tree |
| Sở hữu / báo cáo / định tuyến | Org chart |
| Các tầng trừu tượng xếp chồng | Layer stack |
| Giao nhau giữa các tập | Venn |
| Xếp hạng / phễu chuyển đổi | Pyramid / funnel |
| So nhiều đối tượng qua 3–5 tiêu chí | Radar |
| So định lượng theo hạng mục | Bar |
| Xu hướng liên tục theo thời gian | Line |
| Công việc + giai đoạn trên timeline | Gantt |
| Phân bố / tương quan 2 biến | Scatter |

Quy tắc chọn: nếu **một bảng 3 cột** nói được điều tương tự → chọn bảng. Hai dạng đều hợp → chọn theo trục chi phối, đừng trộn hai kiểu layout. Vượt giới hạn ở §6 → tách overview + detail.

**Trước khi vẽ, nói một câu:** dạng đã chọn + kích thước + thứ gì sẽ bị lược. Để người dùng chỉnh hướng nếu cần.

---

## 4. Bảng màu & chữ (đổi được — xem §9)

Mọi màu là **vai trò ngữ nghĩa**, không phải màu tuỳ hứng. Bộ mặc định (trung tính + một màu nhấn xanh mòng két):

| Vai trò | Hex mặc định | Dùng cho |
|---|---|---|
| `bg` / `panel` | `#f4f4f2` / `#ffffff` | Nền trang / nền hộp, card |
| `ink` | `#22252b` | Chữ chính, nét chính |
| `muted` | `#5c6672` | Chữ phụ, mũi tên mặc định, sublabel |
| `faint` | `#8a94a2` | Nhãn mờ, node input |
| `line` | `rgba(34,37,43,0.12)` | Đường kẻ mảnh |
| `accent` | `#127d74` (teal) | 1–2 node/element trọng tâm |
| `link` | `#2b6cb0` (blue) | Gọi API/HTTP, hệ thống ngoài |

**Luật trọng tâm:** `accent` chỉ trên ≤2 element; phần còn lại `ink`/`muted`/`faint`.

### Node → cách tô
| Loại | Fill | Nét |
|---|---|---|
| Trọng tâm (≤2) | `accent` @0.10 | `accent` |
| Xử lý / API / bước | `panel` (trắng) | `ink` |
| Kho / trạng thái | `ink` @0.05 | `muted` |
| Bên ngoài / cloud | `ink` @0.03 | `ink` @0.28 |
| Input / người dùng | `muted` @0.10 | `faint` |
| Tuỳ chọn / async | `ink` @0.02 | `ink` @0.18, nét đứt `4,3` |
| Ranh giới / bảo mật | `accent` @0.05 | `accent` @0.45, nét đứt `4,4` |

### Chữ (trio mặc định — đổi được)
- **Tiêu đề** — một serif hiển thị (mặc định *Newsreader*), ~28px, chỉ H1.
- **Tên node** — một sans trung tính (mặc định *Inter*), 12px, đậm 600.
- **Sublabel/tag** — một mono (mặc định *IBM Plex Mono*), 7–9px, cho port/URL/kiểu dữ liệu, tag IN HOA.

Quy ước: **mono chỉ cho nội dung kỹ thuật**; tên khái niệm/người dùng sans; tiêu đề serif. Không dùng một font mono duy nhất cho toàn bộ chữ.

```html
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital@0;1&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## 5. Vẽ SVG cho đúng

### Nền — mặc định phẳng, một màu
```svg
<rect width="100%" height="100%" fill="#f4f4f2"/>
```
Không bọc thêm một lớp nền thứ hai quanh hình.

### Marker mũi tên — định nghĩa cả ba
```svg
<marker id="arw" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
  <polygon points="0 0, 8 3, 0 6" fill="#5c6672"/></marker>
<marker id="arw-acc" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
  <polygon points="0 0, 8 3, 0 6" fill="#127d74"/></marker>
<marker id="arw-link" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
  <polygon points="0 0, 8 3, 0 6" fill="#2b6cb0"/></marker>
```
| Mũi tên | Màu | Khi nào |
|---|---|---|
| Thường | muted `#5c6672` | Nội bộ, chung chung |
| Nhấn | teal `#127d74` | Luồng chính / được làm nổi |
| Link | blue `#2b6cb0` | HTTP/API, hệ thống ngoài |
| Nét đứt | `stroke-dasharray="5,4"` | Tuỳ chọn, thụ động, trả về, async |

Vẽ **mũi tên trước, hộp sau** để đường nằm dưới node.

### Kỷ luật đường nối (5 điều — kiểm ở §7)
1. **Chỉ dùng khuỷu vuông bo góc.** Node lệch cả hai trục → đường phải gấp góc vuông, mỗi khuỷu là cung 1/4 bán kính ~8px. `<line>` thẳng chỉ khi hai đầu chung x hoặc y. Đường chéo là lỗi.
2. **Nhãn cách đường 6–10px.** Nhãn không bao giờ nằm đè lên mũi tên. Rect che (màu nền) chặn đường xuyên chữ, nhưng vẫn phải chừa khe nhìn thấy giữa mép rect và nét — rect che không chạm nét.
3. **Không hai đường chồng nhau.** Không đi chung một đoạn, không song song đè lên nhau. Hai đường buộc cắt nhau → dùng "cầu nhảy" (cung nhỏ nhảy qua). Muốn song song → cách nhau ≥12px suốt chiều dài.
4. **Chung một cạnh hộp → xoè điểm gắn.** ≥2 đường vào/ra cùng một cạnh → mỗi đường một điểm gắn riêng, cách nhau ≥12px. Với N đường trên cạnh dài L, điểm thứ k ở `L*k/(N+1)`.
5. **Đường không đi sau một hộp không phải đầu/cuối của nó.** Mặc định vòng tránh. Bất khả kháng (một hộp nằm chắn trên đường thẳng duy nhất) → nét phải đứt (báo "chỉ đi ngang qua"), nhãn đặt ở đầu nhìn thấy, không để mũi tên rơi lên cạnh hộp trung gian.

### Hộp node — mẫu đầy đủ
```svg
<rect x="X" y="Y" width="W" height="H" rx="6" fill="#f4f4f2"/>              <!-- che nền, chặn đường xuyên -->
<rect x="X" y="Y" width="W" height="H" rx="6" fill="FILL" stroke="NÉT"/>   <!-- hộp có style -->
<rect x="X+8" y="Y+6" width="28" height="12" rx="2" fill="none" stroke="NÉT@0.4" stroke-width="0.8"/>
<text x="X+22" y="Y+15" fill="NÉT" font-size="7" font-family="'IBM Plex Mono',monospace" text-anchor="middle" letter-spacing="0.08em">TAG</text>
<text x="CX" y="CY+2"  fill="#22252b" font-size="12" font-weight="600" font-family="'Inter',sans-serif" text-anchor="middle">Tên node</text>
<text x="CX" y="CY+18" fill="#5c6672" font-size="9" font-family="'IBM Plex Mono',monospace" text-anchor="middle">tech:port</text>
```
Bo góc tối đa 6–10px hoặc vuông. **Không bao giờ dùng bóng đổ** — chỉ dùng border.

### Nhãn mũi tên — luôn có rect che + khe
```svg
<rect x="MID-18" y="AY-20" width="36" height="12" rx="2" fill="#f4f4f2"/>
<text x="MID" y="AY-11" fill="#8a94a2" font-size="8" font-family="'IBM Plex Mono',monospace" text-anchor="middle" letter-spacing="0.06em">WRITE</text>
```
≤14 ký tự, IN HOA, canh giữa đoạn; đoạn dọc → đặt nhãn sang bên; không xoay chữ dọc.

### Legend — dải ngang dưới cùng
```svg
<line x1="30" y1="LY-8" x2="VW-30" y2="LY-8" stroke="rgba(34,37,43,0.10)" stroke-width="0.8"/>
<text x="30" y="LY+8" fill="#5c6672" font-size="8" font-family="'IBM Plex Mono',monospace" letter-spacing="0.14em">LEGEND</text>
<!-- các mục xếp hàng ngang -->
```
Không đặt legend nổi trong vùng vẽ. Nới `viewBox` cao thêm ~60px cho dải này.

---

## 6. Bố cục & giới hạn

**Lưới 4px:** mọi kích thước, toạ độ, gap, font-size (trừ nét/opacity) nên chia hết cho 4. Toạ độ lẻ (1/2/3/5/6/7/9) → làm tròn.

**Giữ hình nhỏ.** Ngưỡng khuyến nghị để hình còn đọc được không cần chú giải:
- Node: khoảng **≤8–9**; mũi tên **≤12**; màu nhấn **≤2**.
- Các dạng riêng: lifeline/lane ~5; entity ER ~8; layer/pyramid/độ sâu cây ~6; venn 3 vòng; trục radar ~5.
- Vượt ngưỡng → **tách overview + detail**, đừng nhồi.

**Khung trang:**
1. Header — eyebrow (mono) → tiêu đề (serif) → phụ đề (sans muted).
2. Vùng hình — mặc định không viền, không nền (SVG đặt thẳng trên nền trang). Biến thể đóng khung: nền `panel` + border 1px `line` + bo 8px + padding + `overflow-x:auto`.
3. Card tóm tắt (nếu có) — grid 2–3 cột **rộng khác nhau**, nền trắng, border 1px, không bóng.
4. Footer — colophon mono, muted, viền trên mảnh.

---

## 7. Tự kiểm trước khi xuất

**Đúng dạng**
- [ ] Dạng hình khớp nội dung? Một bảng/đoạn văn có làm được không (nếu có → đừng vẽ)?
- [ ] Đã báo dạng + kích thước + phần bị lược?

**Cắt bớt**
- [ ] Bỏ được node nào? Gộp được hai node nào? Bỏ được mũi tên nào (quan hệ đã rõ từ layout)? Bỏ được nhãn nào (màu/hình đã báo)?

**Tín hiệu**
- [ ] Màu nhấn ≤2? Legend phủ đủ loại đã dùng, không dư? Trong ngưỡng §6?

**Kỹ thuật đường nối**
- [ ] Mũi tên vẽ trước hộp?
- [ ] Đường lệch trục đều là khuỷu vuông bo góc? Không có `<line>` chéo?
- [ ] Mọi nhãn có khe 6–10px với đường (rect che không chạm nét)?
- [ ] Không hai đường chồng/chung đoạn? Chỗ cắt dùng cầu nhảy?
- [ ] Nhiều đường cùng cạnh hộp → mỗi đường một điểm gắn (≥12px)?
- [ ] Không đường đi sau hộp lạ (trừ ngoại lệ §5.5: nét đứt + nhãn ở đầu thấy được)?
- [ ] Mọi kích thước/toạ độ chia hết cho 4? `viewBox` đã nới cho legend?

**Chữ**
- [ ] Tên node bằng sans (không mono)? Sublabel kỹ thuật bằng mono? Tiêu đề bằng serif?

**Tiếp cận (a11y)**
- [ ] `<svg>` có `role="img"` + `aria-labelledby` trỏ tới `<title>`/`<desc>`? `<title>` là con đầu tiên (trước `<defs>`)? ID có tiền tố theo slug (`<slug>-title`/`<slug>-desc`, không để trần)?

---

## 8. Xuất file & hợp đồng SVG tiếp cận

Luôn xuất **1 file `.html` tự chứa**: CSS inline, SVG inline, không ảnh ngoài, tĩnh. Chỉ font là external.

Với mọi `<svg>`:
1. `role="img"` + `aria-labelledby="<slug>-title <slug>-desc"`.
2. `<title>` là **con đầu tiên**, trước `<defs>`.
3. ID có tiền tố theo file/biến thể (`flow-title`, `flow-dark-title`...) — không để `title`/`desc` trần (hai hình inline sẽ trùng ID).
4. `<title>` = tên ngắn của chủ đề (~≤60 ký tự).
5. `<desc>` = một câu nói hình thể hiện gì **theo nghĩa** (không tả hình học).
6. SVG chỉ trang trí → `aria-hidden="true"`.

```html
<svg viewBox="0 0 W H" role="img" aria-labelledby="slug-title slug-desc" xmlns="http://www.w3.org/2000/svg">
  <title id="slug-title">Tên hình</title>
  <desc id="slug-desc">Một câu mô tả theo nghĩa.</desc>
  <defs><!-- markers --></defs>
  <rect width="100%" height="100%" fill="#f4f4f2"/>
  <!-- mũi tên trước, hộp sau, legend cuối -->
</svg>
```

Xuất PNG/SVG (khi được yêu cầu): tách khối `<svg>` ra file `.svg`, hoặc render bằng headless browser để ra PNG (giữ đúng font). Chỉ export khi người dùng yêu cầu.

---

## 9. Đổi brand

Khớp brand riêng: thay 7 hex ở §4 (bg/panel/ink/muted/faint/line/accent/link) + đổi 3 font sang font brand. Nguồn token: đọc CSS website, thư mục design-system, hoặc người dùng cung cấp. Giữ nguyên **cấu trúc vai trò**, chỉ đổi giá trị.

---

## Sai lầm hay gặp (tránh)

- Nhồi >9 node thay vì tách hai hình.
- Màu nhấn trên >2 element → mất trọng tâm.
- Đường chéo, đường chồng, nhãn dính đường → vi phạm §5.
- Bóng đổ, bo góc lớn, mono cho toàn bộ chữ, legend nổi trong hình.
- Xuất nhiều file rời khi chỉ cần 1.
- Bê nguyên layout tự-dàn của Mermaid vào đây — phải dàn lại có chủ đích.
