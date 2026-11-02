---
name: frontend
description: Master frontend — chạy /frontend trên 1 dự án để audit + fix theo best-practices (10 mảng), tự bỏ qua stack không dùng, và xuất báo cáo .md (đã fix gì + chỉ số).
---

# /frontend — Audit + Fix toàn bộ frontend, xuất báo cáo

Gõ **`/frontend`** trên một dự án → phát hiện stack → fix theo best-practices → **xuất báo cáo
`.md`** liệt kê đã fix gì và chỉ số. Chỉ cần lệnh này, không cần nhớ 10 skill con.

---

## Quy trình (Claude làm theo đúng thứ tự)

1. **Phát hiện stack** — đọc `package.json` + config (`tsconfig.json`, `next.config.*`, `tailwind.config.*`,
   `vite.config.*`, thư mục `app/`, import `react-router`/`remix-i18next`). Xác định dùng gì.
2. **Bỏ qua mảng không dùng** — với mỗi skill không khớp stack, KHÔNG áp dụng và **ghi rõ vào báo
   cáo**: `SKIPPED — không dùng Tailwind`. (Xem bảng "Kiểm tra stack" bên dưới.)
3. **Với mỗi mảng áp dụng** → đọc file chi tiết `frontend/<skill>.md` → quét code → **fix** theo rule.
   - Fix theo độ ưu tiên impact: CRITICAL → HIGH → MEDIUM → LOW.
   - Đo trước khi tối ưu re-render/bundle (Profiler / bundle analyzer) — đừng đoán.
4. **Xuất báo cáo** `frontend-report.md` ở gốc dự án theo mẫu bên dưới (đã fix gì, file:line, chỉ số).

---

## Bản đồ skill → file (đọc on-demand khi cần mảng đó)

| Mảng | Fix gì | File chi tiết |
|---|---|---|
| React | re-render, bundle, composition, hooks | `frontend/react.md` |
| React Router | loader/action/form/route, data fetching | `frontend/react-router.md` |
| JavaScript | JS/TS thuần: loop, data structure, tối ưu | `frontend/javascript.md` |
| TypeScript | strictness, advanced types, type-safe API | `frontend/typescript.md` |
| Next.js | RSC, Server Actions, rendering, SEO | `frontend/nextjs.md` |
| Async | Promise, tránh waterfall, chạy song song | `frontend/async.md` |
| Accessibility | ARIA, semantic, keyboard, screen reader | `frontend/accessibility.md` |
| i18n | locale, middleware, language switch | `frontend/i18n.md` |
| Tailwind | layout, responsive, className util | `frontend/tailwind.md` |
| Testing | ưu tiên E2E, ít mock, test behavior | `frontend/testing.md` |

> File mẹ này KHÔNG auto-nạp toàn bộ 148 rule (~350KB). Claude chỉ mở `frontend/<skill>.md` của
> mảng đang fix → nhẹ context, đúng trọng tâm.

---

## ⚠️ Kiểm tra stack trước — bỏ qua & BÁO nếu không dùng

| Mảng | Chỉ áp dụng khi có | Nếu không có |
|---|---|---|
| react | React | báo "không dùng React" → bỏ |
| typescript | `tsconfig.json` / file `.ts(x)` | JS thuần → dùng mảng JavaScript |
| javascript | JS/TS bất kỳ | gần như luôn áp dụng |
| async | có async / data fetching | code đồng bộ thuần |
| accessibility | có UI | luôn nên áp dụng |
| testing | có/cần viết test | — |
| react-router | React Router (loader/action) | Next.js / SPA thường → bỏ |
| nextjs | `next.config` / thư mục `app/` | không dùng Next → bỏ |
| tailwind | **Tailwind CSS** | CSS Modules / styled-components / vanilla → **báo & bỏ** |
| i18n | React Router + remix-i18next | app 1 ngôn ngữ / i18n khác → bỏ |

**Quy tắc:** không ép skill vào sai stack. Mỗi mảng bỏ qua đều phải xuất hiện ở mục "Đã bỏ qua"
trong báo cáo, kèm lý do.

---

## Mẫu báo cáo `frontend-report.md`

```markdown
# Frontend Audit & Fix — <tên dự án>
Ngày: <YYYY-MM-DD> · Stack phát hiện: React 18, TypeScript, Vite (không Tailwind, không Next)

## Chỉ số
| Mảng | Vấn đề tìm thấy | Đã fix | Còn lại (cần review tay) |
|---|---|---|---|
| React        | 8  | 8  | 0 |
| TypeScript   | 5  | 4  | 1 |
| Accessibility| 3  | 3  | 0 |
| **Tổng**     | 16 | 15 | 1 |

## Đã fix (chi tiết)
| # | Mảng | Rule | File:line | Before → After |
|---|---|---|---|---|
| 1 | React | rerender-lazy-state-init | src/List.tsx:20 | `useState(build())` → `useState(() => build())` |
| 2 | TS | strict-no-any | src/api.ts:44 | `as User` → zod parse |
...

## Đã bỏ qua (không thuộc stack)
- Tailwind — SKIPPED: dự án dùng CSS Modules.
- Next.js — SKIPPED: không dùng Next (React Router SPA).
- i18n — SKIPPED: app 1 ngôn ngữ.

## Cần review tay (không tự fix)
- TypeScript src/legacy.ts:120 — union quá rộng, cần thiết kế lại type (rủi ro cao, không auto-fix).
```

---

## Nguyên tắc khi fix

- **Đo trước, sửa cấu trúc trước, memoization sau cùng** (React). React 19 + Compiler → bớt memo tay.
- **Chỉ fix trong phạm vi best-practices**, không đổi logic nghiệp vụ; thay đổi rủi ro cao → đưa vào
  "Cần review tay", không tự sửa.
- **Không fix mảng không thuộc stack** — báo bỏ qua.
- Mỗi fix ghi được `file:line` + before→after để đưa vào báo cáo.

---

## Dùng lẻ 1 mảng (tùy chọn)

Chỉ cần 1 mảng → gõ trực tiếp, ví dụ `/frontend:react`, `/frontend:typescript`, `/frontend:tailwind`.
Hoặc mở thẳng file `frontend/<skill>.md`.
