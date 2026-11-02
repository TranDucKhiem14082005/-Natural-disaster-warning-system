---
name: nextjs
description: Next.js (App Router) best practices — Server Components, Server Actions, rendering strategies, data fetching, SEO. Use when building Next.js apps.
---

> **Áp dụng khi:** dự án dùng Next.js (`next.config.*`, thư mục `app/`).
> **Bỏ qua nếu:** không dùng Next → báo "không dùng Next.js, bỏ qua skill này". Nếu dùng React
> Router framework mode → dùng [`frontend-react-router-best-practices`](./frontend-react-router-best-practices.md).

# Next.js Best Practices (App Router, Next 14+)

Ưu tiên: **Server Components mặc định → data fetch đúng chỗ → rendering strategy hợp lý → SEO + Core Web Vitals**.

## 1. App Router architecture
- Mặc định **Server Component**; chỉ thêm `"use client"` ở lá cần interactivity (state, event, browser API) — đẩy client boundary xuống thấp nhất.
- `layout.tsx` (giữ state qua navigation) vs `template.tsx` (remount mỗi lần); route groups `(group)`; parallel/intercepting routes khi cần.
- `loading.tsx` (Suspense fallback) + `error.tsx` (error boundary) theo segment.

## 2. Server Components & data fetching
- Fetch data **trong Server Component** (async component), không dùng `useEffect` để fetch.
- **Song song hoá**: khởi tạo các promise trước rồi `await Promise.all` — tránh waterfall.
- Cache: `fetch` có cache mặc định; chọn `cache`/`next.revalidate` có chủ đích; `revalidatePath`/`revalidateTag` khi mutate.
- Streaming SSR + `<Suspense>` để trả phần nhanh trước.

## 3. Server Actions (mutation)
- Dùng Server Action cho form/mutation thay vì API route thủ công; validate input (zod) trong action.
- Optimistic update (`useOptimistic`); xử lý lỗi trả về form; rate-limit + security (không tin input).
- Progressive enhancement: form chạy được cả khi JS chưa load.

## 4. Rendering strategy (chọn đúng)
| Chiến lược | Khi nào |
|---|---|
| Static (SSG) | Nội dung ít đổi, biết trước |
| ISR (`revalidate`) | Đổi định kỳ, không cần realtime |
| Dynamic SSR | Phụ thuộc request (cookie, user) |
| Edge runtime | Latency thấp, logic nhẹ |
| PPR (Partial Prerendering) | Vỏ tĩnh + phần động stream trong |

## 5. Performance (Core Web Vitals)
- `next/image` (tối ưu ảnh, tránh CLS), `next/font` (self-host, tránh layout shift).
- `next/link` prefetch; `next/script` với `strategy` phù hợp.
- Phân tích bundle (`@next/bundle-analyzer`); code splitting theo route tự động.

## 6. SEO
- **Metadata API** (`export const metadata` / `generateMetadata`) thay vì thẻ tay.
- `sitemap.ts`, `robots.ts`, Open Graph, structured data (JSON-LD), canonical URL.

## Checklist
- [ ] Server Component mặc định; `"use client"` chỉ ở lá cần interactivity
- [ ] Data fetch trong Server Component, song song hoá tránh waterfall
- [ ] Mutation qua Server Action + validate input; revalidate sau khi đổi data
- [ ] Chọn đúng rendering strategy theo nhu cầu (SSG/ISR/SSR/Edge/PPR)
- [ ] `next/image` + `next/font`; Metadata API cho SEO

## Anti-patterns
- `"use client"` ở đầu cây → kéo cả subtree thành client, mất lợi ích RSC.
- `useEffect` fetch data trong Next App Router → nên fetch ở Server Component.
- Data fetch tuần tự (await lần lượt) → waterfall; khởi tạo promise song song.
- Thẻ `<title>`/`<meta>` thủ công thay vì Metadata API.
- Không revalidate sau mutation → user thấy data cũ.
