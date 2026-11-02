---
name: typescript
description: TypeScript best practices for frontend — strictness, advanced types, type-safe APIs, tooling. Use when writing/reviewing TS types, tsconfig, generics, or eliminating `any`.
---

> **Áp dụng khi:** dự án dùng TypeScript (`tsconfig.json`, file `.ts/.tsx`).
> **Bỏ qua nếu:** dự án JavaScript thuần → báo "không dùng TypeScript, bỏ qua skill này" và dùng
> [`frontend-js-best-practices`](./frontend-js-best-practices.md).

# TypeScript Best Practices (frontend)

Ưu tiên: **strictness → loại bỏ `any` → type an toàn ở ranh giới (API/form) → tooling**.

## 1. Strictness & config (CRITICAL)
- Bật `strict: true` + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`.
- **Không dùng `any`** trừ khi có lý do ghi rõ; ưu tiên `unknown` + narrowing.
- `100%` type coverage cho public API (props, hàm export, response type).
- Bật `isolatedModules`, dùng `import type` cho type-only (tree-shake tốt hơn).

## 2. Advanced type patterns
- **Discriminated union** cho state machine (`{ status: 'idle' } | { status: 'error', error }`) → exhaustive check bằng `never`.
- **Type guard / predicate** (`x is Foo`) thay vì ép kiểu `as`.
- **Branded type** cho domain (`type UserId = string & { __brand: 'UserId' }`) tránh nhầm id.
- `satisfies` để validate literal mà vẫn giữ kiểu hẹp (thay cho `as`).
- Mapped / conditional / template-literal types cho API linh hoạt; `infer` khi cần rút kiểu.
- `const` assertion (`as const`) cho literal/tuple bất biến.

## 3. Type an toàn ở ranh giới (nơi bug hay lọt)
- **Validate dữ liệu ngoài** (API response, form, URL param) bằng schema runtime (zod/valibot) → suy ra type từ schema (`z.infer`), đừng tin `as ResponseType`.
- Chia sẻ type giữa FE/BE (monorepo) hoặc end-to-end type (tRPC / GraphQL codegen).
- Form: type từ schema validate, không tự khai lại.

## 4. Error handling
- **Result type** (`{ ok: true, data } | { ok: false, error }`) thay vì throw cho lỗi dự kiến.
- Exhaustive check với `never` để compiler bắt case thiếu.
- Custom error class có `type` phân biệt.

## 5. Performance & tooling
- `import type` + `type`-only export → không kéo runtime.
- Cẩn thận generic sâu / union khổng lồ (chậm compile) — đo bằng `tsc --generateTrace`.
- Project references + incremental build cho monorepo.
- ESLint (`@typescript-eslint`) + Prettier; bật rule `no-explicit-any`, `no-unsafe-*`.

## Checklist
- [ ] `strict: true` + các cờ nghiêm ngặt bật
- [ ] Không `any` không lý do; ranh giới ngoài validate runtime (zod…) rồi mới suy type
- [ ] Union trạng thái là discriminated + exhaustive `never`
- [ ] `import type` cho type-only; public API có type đầy đủ
- [ ] Lỗi dự kiến dùng Result type, không throw bừa

## Anti-patterns
- `as SomeType` trên dữ liệu API chưa validate → runtime lệch type, sập ngầm.
- Rải `any`/`as any` để "cho qua compiler" → mất toàn bộ lợi ích TS.
- Optional bừa (`?`) rồi `!` khắp nơi → non-null assertion che bug.
- Type khai tay trùng với schema validate → lệch nhau theo thời gian; suy từ schema.
