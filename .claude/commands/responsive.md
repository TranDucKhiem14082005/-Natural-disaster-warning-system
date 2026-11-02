# /responsive — Responsive UI Engineering trên MỌI màn hình (mobile → ultrawide)

> **Trigger**: user muốn code/sửa UI chạy đẹp mọi kích thước màn, "làm responsive", "fix vỡ layout mobile", "layout tràn ngang", "chữ/khoảng cách co giãn mượt", audit responsive cho 1 dự án.
> **Output**: code layout responsive mới, hoặc audit + fix UI hiện có + báo cáo `responsive-report.md`.
> **Phạm vi**: web (HTML/CSS, React/Vue/Svelte, Tailwind). Base là CSS thuần; §10 map Tailwind. Không đổi logic nghiệp vụ — chỉ layout/CSS/a11y.
> **Mục tiêu không chỉ "vừa màn"**: layout đúng · component tái sử dụng · accessible (focus/keyboard/zoom) · không tràn ngang · ít CLS · có bằng chứng test trước ship.

> **Nguyên tắc gốc (2026)**: bốn công cụ phối hợp — **media query** (bố cục *trang*), **container query** (*component*), **`clamp()`** (type + spacing), **intrinsic Grid** `auto-fit/minmax` (layout không breakpoint). Cộng **`dvh/svh`** (chiều cao), breakpoint neo **`rem`** (a11y), và **logical properties** (RTL). `overflow-x: clip` chỉ là lớp phòng thủ cuối — **không phải** cách sửa lỗi tràn.

---

## 0. Bộ công cụ — dùng cái nào khi nào

| Công cụ | Dùng cho | Vì sao |
|---|---|---|
| **Media query** `@media (min-width)` | Bố cục cấp *trang* | Phản ứng theo viewport |
| **Container query** `@container` | *Component* tái sử dụng | Co theo **cha nó**, không phụ thuộc viewport → 1 card đẹp cả ở sidebar hẹp lẫn main rộng |
| **`clamp(min, ideal, max)`** | font, padding, gap, width | Co giãn mượt, bỏ nhiều breakpoint |
| **Intrinsic Grid** `repeat(auto-fit, minmax(X, 1fr))` | lưới card | Tự đổi cột theo bề rộng, **0 media query** |
| **`dvh`/`svh`/`lvh`** | hero, modal, drawer | Sửa `100vh` bị thanh công cụ mobile che |
| **`rem` breakpoints** | mọi `@media`/`@container` | Scale theo cỡ chữ gốc → zoom/text-zoom vẫn đúng |
| **Logical properties** `inline`/`block` | margin/padding/inset/size | Tự đúng RTL + i18n |

**Luật chọn:** layout tự co bằng Grid/Flex/clamp → **đừng thêm breakpoint**. Chỉ thêm `@media`/`@container` khi nội dung *thật sự vỡ*. Breakpoint sinh từ **nội dung**, không từ tên thiết bị.

---

## 1. Baseline CSS bắt buộc

```css
*, *::before, *::after { box-sizing: border-box; }
html { overflow-x: clip; }                 /* lớp phòng thủ CUỐI — không dùng để che lỗi */
body { margin: 0; min-inline-size: 0; }
img, svg, video, canvas { display: block; max-inline-size: 100%; }
```

> `overflow-x: clip` (ưu tiên hơn `hidden` — không tạo scroll container ngoài ý muốn) chỉ chặn tràn *sau khi* đã tìm & sửa phần tử gây tràn thật. Đừng dùng `body { overflow-x: hidden }` để giấu lỗi layout — nó làm khó debug và vẫn để lại UX xấu.

---

## 2. `min-inline-size: 0` — nguyên nhân tràn ngang phổ biến nhất

Flex/Grid item mặc định `min-width: auto` = **không nhỏ hơn nội dung**. Nội dung dài (URL, mã đơn, hash, `white-space: nowrap`, bảng, code) ép item phình → tràn cả container dù CSS trông "responsive".

```css
.flex-child, .grid-child { min-inline-size: 0; }   /* cho phép item co lại đúng cách */
```

Đặc biệt kiểm khi item chứa: text dài không khoảng trắng · URL/email/mã · `white-space: nowrap` · bảng/code block/ảnh · Grid item nội dung dài.

---

## 3. Text overflow — xử lý bên trong component

```css
.text-content { overflow-wrap: anywhere; word-break: break-word; }   /* URL/token/mã dài */

.single-line {                                                       /* cắt 1 dòng khi CHẤP NHẬN cắt */
  min-inline-size: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
```

- `overflow-wrap: anywhere` — cho URL/token/hash: xuống dòng thay vì đẩy tràn.
- `text-overflow: ellipsis` — **chỉ khi** cắt nội dung là ổn (title trong list). Cần `min-inline-size: 0` để hoạt động trong flex.
- **Không** `overflow: hidden` bừa — cắt mất tooltip, focus ring, nội dung quan trọng.

---

## 4. Mobile-first + breakpoint theo nội dung

```css
.card { padding: 1rem; }                        /* base = mobile */
@media (min-width: 48rem) { .card { padding: 1.5rem; } }   /* ~768px */
@media (min-width: 64rem) { .card { padding: 2rem; } }     /* ~1024px */
```

- **Mobile-first**: base mobile → `min-width` nới dần. Tránh override chồng chéo.
- **Breakpoint `rem`, không `px`**: `48rem` scale theo cỡ chữ gốc; `768px` thì không.
- **Content-based**: đặt tại điểm nội dung vỡ, không theo "iPhone/iPad". Mốc tham chiếu: `40/48/64/80/96rem`.
- **`max-width` breakpoint**: ưu tiên `min-width`, nhưng `max-width` *hữu ích có lý do rõ* — chỉ áp style khi component còn hẹp, fallback cho trình duyệt thiếu container query, chỉnh typography/modal riêng ở mobile. Khi dùng → ghi chú phạm vi, tránh tạo khoảng breakpoint bị bỏ sót (dùng cùng hệ mốc, không chồng lấn/hở).

---

## 5. Fluid type + spacing bằng `clamp()`

```css
:root {
  --step-0: clamp(1rem, 0.95rem + 0.25vw, 1.25rem);
  --step-2: clamp(1.75rem, 1.3rem + 2vw, 3rem);       /* heading */
  --space-l: clamp(2rem, 1.5rem + 2.5vw, 4rem);
}
h1 { font-size: var(--step-2); }
section { padding-block: var(--space-l); }
```

- `clamp(MIN, IDEAL, MAX)` — `IDEAL` trộn `rem + vw` để vừa scale viewport vừa scale zoom.
- Một scale clamp thay hàng loạt media query chỉnh font/padding.
- **MIN không quá nhỏ**: body ≥ `1rem` (16px) trên mobile; heading ≥ ~1.25rem.

---

## 6. Layout không cần breakpoint (intrinsic)

```css
.grid {                                             /* lưới card tự đổi cột — 0 media query */
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
  gap: var(--space-s);
}
.toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; }   /* 1 chiều, wrap tự nhiên */

.with-sidebar { display: flex; flex-wrap: wrap; gap: var(--space-s); }
.with-sidebar > .sidebar { flex: 1 1 15rem; min-inline-size: 0; }
.with-sidebar > .main    { flex: 999 1 60%; min-inline-size: 0; }
```

- `minmax(min(16rem, 100%), 1fr)` — card tối thiểu 16rem nhưng **không tràn** khi màn < 16rem. Fix overflow kinh điển.
- **Grid** cho 2 chiều (hàng+cột thẳng), **Flex** cho 1 chiều. Đừng ép Flex làm lưới cột đều.
- `subgrid` khi cần con thẳng hàng theo lưới cha.
- Mọi flex/grid con dễ chứa nội dung dài → thêm `min-inline-size: 0` (§2).

### Page shell + max-width (ultrawide)

```css
.page-shell {
  --page-gutter: clamp(1rem, 3vw, 4rem);
  inline-size: min(100% - 2 * var(--page-gutter), 96rem);
  margin-inline: auto;
}
```

Ở 1920–3440px kiểm: nội dung không bị kéo giãn quá rộng (khó đọc) · header/footer **cùng trục** với nội dung chính · sidebar không giữ width tối thiểu quá lớn · modal/toast không bị container giới hạn sai.

---

## 7. Container queries — component tự lo thân nó

```css
.card-wrap { container-type: inline-size; }
.card { display: grid; gap: 0.75rem; }
@container (min-width: 24rem) { .card { grid-template-columns: 8rem 1fr; } }   /* theo CHA, không viewport */
```

- Dùng khi cùng component xuất hiện ở nhiều vùng rộng-hẹp: media query không phân biệt được, container query thì có.
- `container-type: inline-size` phổ biến nhất; đặt `container-name` khi lồng nhiều tầng.
- `cqi` (% bề ngang container) cho type theo container: `font-size: clamp(1rem, 5cqi, 1.5rem)`.
- Support 2023+; cần đời rất cũ → `max-width` media query fallback.

---

## 8. Viewport height, safe-area, modal/drawer/bàn phím ảo

```css
/* Progressive fallback: 100vh cho trình duyệt cũ, svh đè cho mới */
.hero  { min-height: 100vh; min-height: 100svh; }   /* small: luôn thấy hết */
.modal { max-block-size: min(90dvh, 48rem); overflow: auto; overscroll-behavior: contain; }

/* safe-area cả 4 chiều (iPhone landscape cần trái/phải) */
.page {
  padding-block-start: env(safe-area-inset-top);
  padding-block-end:   max(1rem, env(safe-area-inset-bottom));
  padding-inline-start: max(var(--page-gutter), env(safe-area-inset-left));
  padding-inline-end:   max(var(--page-gutter), env(safe-area-inset-right));
}

.bottom-sheet {
  max-block-size: calc(100dvh - env(safe-area-inset-top));
  padding-block-end: max(1rem, env(safe-area-inset-bottom));
}
```

- **Đừng `100vh` một mình** cho vùng cần chính xác trên mobile → dùng `svh` (vừa 1 màn) / `dvh` (co theo thanh công cụ) / `lvh`. Nhưng **đừng dùng `100dvh` mù quáng** cho mọi thứ — hero, modal, drawer nhu cầu khác nhau.
- Cần safe-area: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- **Modal/drawer**: scroll được nội dung nhưng **không scroll body** (`overscroll-behavior: contain`) · không bị bàn phím ảo che · nút submit luôn tiếp cận được khi keyboard mở · drawer không tạo scroll ngang · đóng modal → focus quay lại trigger.
- Bàn phím ảo đẩy layout: cân nhắc `interactive-widget=resizes-content` trong meta viewport.

---

## 9. Ảnh, media, bảng, code, nav

### Ảnh — responsive + CLS + LCP
```html
<img src="image-800.webp"
     srcset="image-480.webp 480w, image-800.webp 800w, image-1200.webp 1200w"
     sizes="(min-width: 64rem) 50vw, 100vw"
     width="1200" height="675" decoding="async" fetchpriority="high" alt="…">
```
```css
img, video { max-inline-size: 100%; height: auto; }
img { aspect-ratio: 16 / 9; object-fit: cover; }
```
- `srcset`+`sizes` → trình duyệt chọn đúng độ phân giải theo màn (tiết kiệm data). `width`/`height` (hoặc `aspect-ratio`) → chừa chỗ, giảm **CLS**.
- Ảnh **LCP** (đầu trang): `fetchpriority="high"`, **KHÔNG** `loading="lazy"`. Ảnh dưới màn đầu: `loading="lazy"`.
- Không dùng `background-image` cho nội dung cần responsive image thật. Font web có fallback tránh nhảy layout.

### Bảng / code / dữ liệu không wrap được
```css
.table-scroll { max-inline-size: 100%; overflow-x: auto; overscroll-behavior-inline: contain; }
.table-scroll table { min-inline-size: 40rem; }
pre { max-inline-size: 100%; overflow-x: auto; white-space: pre; tab-size: 2; }
```
- Mỗi khối rộng tự cuộn trong `overflow-x: auto` — **body trang KHÔNG bao giờ cuộn ngang**.
- Kiểm nội dung dễ tràn: JSON · log server · SQL · UUID · hash · diff code · Mermaid/SVG · markdown table · syntax highlight.
- **Nav**: hamburger/drawer ở mobile, hàng ngang desktop; breakpoint tại điểm menu wrap.

---

## 10. Touch + Accessibility (focus, keyboard, zoom)

**Touch target**
- Tối thiểu **24×24 CSS px** để đạt WCAG 2.2 AA §2.5.8 (kèm ngoại lệ về khoảng cách/ngữ cảnh); **ưu tiên 44×44px** cho nút chính, icon, thao tác mobile (khuyến nghị thực tế, không phải mức tối thiểu chung).
- Kiểm **kích thước rendered thật** bằng `getBoundingClientRect()` (khác giá trị CSS khai báo), + khoảng cách giữa các target, + trạng thái `disabled/loading`.

**Focus + keyboard**
```css
:focus-visible { outline: 0.1875rem solid currentColor; outline-offset: 0.1875rem; }
[id] { scroll-margin-block-start: 5rem; }          /* anchor không bị sticky header che */
```
Kiểm: focus ring **không bị `overflow:hidden` cắt** (trong card/modal) · dùng toàn UI bằng bàn phím · drawer mobile khoá focus đúng · đóng modal/drawer → focus về trigger · skip link không bị ẩn khỏi keyboard · sticky header không che phần tử đang focus.

**Zoom + input + motion**
```css
@media (hover: hover) and (pointer: fine) { /* hover chỉ cho thiết bị có chuột thật */ }
@media (pointer: coarse)   { /* tăng vùng bấm, giảm phụ thuộc hover */ }
@media (orientation: landscape) { /* mobile landscape */ }
@media (prefers-reduced-motion: reduce) { /* tắt/giảm animation */ }
@media (forced-colors: active) { /* high-contrast / Windows contrast mode */ }
```
- **Zoom được**: không `user-scalable=no`/`maximum-scale=1`; font dùng `rem`.
- **Đừng giả định**: `hover: none` ≠ luôn mobile; `pointer: coarse` ≠ luôn màn nhỏ. Laptop cảm ứng có cả `fine` lẫn `coarse` → cân nhắc `any-hover`/`any-pointer`.
- **Logical properties** `margin-inline`/`padding-block`/`inset-inline-start`/`inline-size` → RTL-safe. Reflow, đừng `display:none` cắt nội dung cần thiết.

---

## 11. Component đặc thù hay bị bỏ sót

Data table nhiều cột · modal/dialog/bottom-sheet · dropdown/select/autocomplete · tooltip/popover · toast · carousel/slider · virtualized list · calendar/date-picker · rich text editor · code editor/terminal · canvas/SVG/chart · drag-and-drop · sticky header/sidebar · nested scroll container · RTL + ngôn ngữ chữ dài.

- **Dropdown/tooltip/popover**: đừng định vị cứng bằng `left/right`; cân nhắc **CSS Anchor Positioning** (hoặc thư viện popper/floating) + fallback nếu trình duyệt mục tiêu chưa hỗ trợ; luôn né mép viewport (flip/shift).
- **Nested scroll**: `overscroll-behavior: contain` để không "cuộn xuyên" ra body.
- **Sticky**: kiểm che focus/anchor (§10 `scroll-margin`).

---

## 12. Test matrix — kiểm mọi màn (bắt buộc)

| Loại | Kích thước | Kiểm |
|---|---|---|
| Mobile nhỏ | 320×568 | Không tràn ngang, chữ đọc được, target đủ to |
| Mobile | 390×844 | Safe-area, dvh, nav mobile, bàn phím ảo |
| Tablet | 768×1024 | Breakpoint chuyển layout đúng |
| Laptop | 1280×800 | Cột đầy đủ, max-width nội dung |
| Ultrawide | 1920–3440 | Nội dung không giãn xấu, header/footer cùng trục |

**Phát hiện phần tử gây tràn** (dán vào DevTools Console / evaluate_script):
```js
[...document.querySelectorAll('*')]
  .filter(el => { const r = el.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; })
  .map(el => ({ el, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }));
```
- Ở mỗi cỡ, `document.documentElement.scrollWidth > innerWidth` phải **false**.
- Test **giữa** breakpoint (vd 900px), không chỉ đúng mốc.
- **Zoom**: browser zoom 200% · text-only zoom 200% · tăng font mặc định trình duyệt · OS display scaling · `forced-colors: active` (nếu cần a11y cao).
- Thiết bị **thật** khi được (iOS Safari + Android Chrome) — simulator bỏ sót thanh công cụ động, bàn phím, tai thỏ, momentum scroll.
- Có Chrome DevTools MCP / Playwright → `resize_page` từng cỡ + `take_screenshot` làm bằng chứng.

---

## 13. Tailwind quick-map

| Ý | Tailwind |
|---|---|
| Mobile-first | base = mobile, thêm `md:` `lg:` `xl:` |
| Fluid type | `text-[clamp(1rem,0.9rem+0.5vw,1.5rem)]` hoặc plugin fluid |
| Intrinsic grid | `grid grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))] gap-4` |
| min-inline-size:0 | `min-w-0` trên flex/grid child |
| Container query | `@container` + `@md:grid-cols-2` (v4 sẵn) |
| dvh | `min-h-dvh` / `max-h-dvh` / `h-svh` |
| Logical spacing | `ps-4 pe-4` (thay `pl/pr`), `ms-auto` |
| No horizontal scroll | `overflow-x-auto` khối rộng; `max-w-full` media |

> Có `frontend:tailwind` skill trong repo cho pattern sâu hơn.

---

## Audit workflow (8 bước) — chạy trên dự án có sẵn

1. **Phát hiện stack + CSS architecture** (CSS thuần / Tailwind / CSS-in-JS).
2. **Xác định page shell, container, breakpoint, component boundary.**
3. **Quét overflow ngang**: `scrollWidth`, bounding-box detector (§12), nội dung dài không wrap.
4. **Audit layout**: Grid/Flex, `min-inline-size: 0` (§2), intrinsic sizing, px cứng → fluid, page-shell max-width.
5. **Audit viewport**: `svh/dvh` thay `100vh`, safe-area 4 chiều, modal/drawer/keyboard, orientation.
6. **Audit a11y**: focus-visible không bị cắt, keyboard nav, zoom 200% + text-zoom, target size (rendered), reduced-motion, forced-colors.
7. **Audit media/perf**: `srcset/sizes/width/height`, CLS, LCP (`fetchpriority`, không lazy ảnh LCP).
8. **Sửa → render → test matrix → ghi report + chụp bằng chứng** (chỉ CSS/layout; rủi ro cao → "Cần review tay").

**`responsive-report.md` — cột bảng findings:**

| Cột | Nghĩa |
|---|---|
| Severity | Critical / High / Medium / Low |
| Selector | Selector/component bị lỗi |
| Viewport | Kích thước tái hiện lỗi |
| Symptom | Triệu chứng quan sát |
| Root cause | Nguyên nhân CSS/layout |
| Fix | Thay đổi đã làm (before→after) |
| Verification | Cách xác nhận đã sửa |
| Regression risk | Rủi ro ảnh hưởng layout khác |

Severity: **CRITICAL** (tràn ngang / nội dung bị cắt / không bấm được / bàn phím che submit) → **HIGH** (đọc khó, vỡ giữa breakpoint, focus bị cắt) → **MEDIUM** (chưa fluid) → **LOW**.

---

## Checklist trước khi "done"

- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1">` (+ `viewport-fit=cover` nếu cần safe-area)
- [ ] Baseline: `box-sizing: border-box`, media `max-inline-size:100%`, flex/grid child `min-inline-size: 0`
- [ ] **Không** cuộn ngang MỌI cỡ (320→1920+): `scrollWidth == innerWidth`; đã chạy overflow detector
- [ ] Mobile-first, breakpoint `rem` sinh từ nội dung; `max-width` chỉ khi có lý do + ghi chú
- [ ] Type + spacing `clamp()`; body ≥ 16px mobile
- [ ] Lưới `auto-fit/minmax(min(X,100%),1fr)`; không px cứng cho cột; page-shell có `max-width`
- [ ] Component đa-context dùng container query
- [ ] Chiều cao dùng `svh/dvh` (fallback `100vh`), không mù quáng `100dvh`; safe-area 4 chiều
- [ ] Modal/drawer: `overscroll-behavior: contain`, không bị keyboard che, focus trap + trả focus
- [ ] Ảnh: `srcset/sizes` + `width/height` + `aspect-ratio`; LCP `fetchpriority=high` không lazy; ảnh dưới màn `lazy`; bảng/code `overflow-x:auto`
- [ ] Text: `overflow-wrap: anywhere` cho URL/mã dài; `ellipsis` chỉ khi cắt được
- [ ] Touch target ≥ 24px (ưu tiên 44); kiểm rendered size + khoảng cách + disabled/loading
- [ ] `:focus-visible` không bị `overflow:hidden` cắt; keyboard nav đầy đủ; `scroll-margin` cho anchor/sticky
- [ ] Zoom 200% + text-zoom + `prefers-reduced-motion` + (nếu cần) `forced-colors` OK
- [ ] Logical properties (RTL-safe); không khoá zoom
- [ ] Test ma trận viewport + giữa breakpoint + (nếu được) thiết bị thật; có ảnh bằng chứng

---

## Anti-patterns

- **`min-width: auto` mặc định của flex/grid child** để nội dung dài ép tràn → thêm `min-inline-size: 0`.
- **`body { overflow-x: hidden }` để giấu lỗi** → che triệu chứng, khó debug. Tìm phần tử tràn thật; `overflow-x: clip` chỉ là lớp cuối.
- **`100vh` một mình trên mobile** → bị thanh công cụ cắt. Dùng `svh/dvh` (fallback tiến hoá).
- **`100dvh` mù quáng mọi component** → hero/modal/drawer nhu cầu khác nhau.
- **Breakpoint `px`** → không scale khi zoom/tăng cỡ chữ. Dùng `rem`.
- **Breakpoint theo thiết bị** ("iPhone=375px") → vỡ vô số màn khác. Theo nội dung.
- **`grid-template-columns` / container px cứng** → tràn mobile. Dùng `minmax`/`max-width`.
- **Ép Flexbox làm lưới cột đều** → dùng Grid.
- **Media query lặp chỉ chỉnh font/padding** → gộp `clamp()`.
- **Component chỉnh theo viewport khi nằm trong container hẹp** → container query.
- **Ảnh thiếu `width/height`/`aspect-ratio`** → CLS. **Lazy-load ảnh LCP** → chậm LCP.
- **`overflow: hidden` bừa** → cắt tooltip/focus ring. **`text-overflow: ellipsis` không có `min-width:0`** → không hoạt động trong flex.
- **Định vị dropdown/tooltip cứng `left/right`** → tràn mép viewport. Dùng anchor positioning/floating + flip.
- **Touch target cỡ desktop** trên mobile; **chỉ kiểm CSS khai báo** không kiểm rendered size.
- **`user-scalable=no`** → chặn a11y. **`display:none` nội dung cần thiết cho "gọn"** → reflow, đừng cắt.
- **Chỉ test 1 cỡ (máy mình)** → deploy mới thấy vỡ. Chạy ma trận + zoom + thiết bị thật.

---

## Khi nào chạy /responsive

- UI mới muốn responsive đúng từ đầu (không chắp vá media query sau).
- UI hiện có vỡ mobile/tablet/ultrawide, tràn ngang, hoặc lỗi focus/keyboard/zoom.
- Chuyển mớ breakpoint px lộn xộn → hệ fluid (clamp + intrinsic grid + container query).
- Trước ship: audit 8 bước + test ma trận.
- **Không cần** nếu chỉ trang tĩnh 1 khối text đã tự reflow tốt.
