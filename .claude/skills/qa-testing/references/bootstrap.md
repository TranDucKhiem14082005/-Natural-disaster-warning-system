# Bootstrap - dựng test runner khi project chưa có

> Đọc khi Bước 1 (Khảo sát) phát hiện **không có runner**. Chỉ cài thứ cần cho tầng đang viết.
> Luôn hỏi user trước khi thêm dependency mới vào `package.json`.

## 1. Chọn runner theo stack (đọc manifest, không đoán)

| Stack | Unit / Integration | E2E |
|---|---|---|
| Node ESM (`"type": "module"`) + Express | **Vitest** + **supertest** | - |
| Vite + React | **Vitest** + `@testing-library/react` + `jsdom` | Playwright hoặc `e2e` (tester-army) |
| Next.js | Vitest (component) | Playwright hoặc `e2e` |
| Go | `go test` + table-driven | - |
| Python | pytest | - |

Lý do chọn Vitest cho Node ESM: chạy ESM native, không cần Babel/transform như Jest.

## 2. Backend Node + Express (ESM)

```bash
npm i -D vitest supertest
```

```jsonc
// package.json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:unit": "vitest run test/unit",
  "test:int": "vitest run test/integration"
}
```

Cấu trúc:

```
test/
├── unit/            # hàm thuần, service với dependency giả - không DB, không mạng
├── integration/     # app thật + DB/Redis thật (container riêng cho test)
└── helpers/         # factory/builder dữ liệu, login helper
```

Integration với HTTP: app phải tách được khỏi `listen()`. Dùng factory tạo app, **không** import file entry gọi `listen`.

```js
import request from "supertest";
import { createApp } from "../../src/app.js";

const app = createApp();
const res = await request(app).get("/health");
```

### DB cho integration test

- **DB riêng cho test**, không bao giờ trỏ vào dev/prod. Ví dụ Postgres container port khác:
  `docker run -d --name pg-test -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16`
- `.env.test` với `DATABASE_URL` trỏ DB test. Chạy `prisma migrate deploy` trước suite.
- Dọn dữ liệu giữa các test: `TRUNCATE ... RESTART IDENTITY CASCADE` trong `beforeEach`, hoặc mỗi test tạo dữ liệu có tên duy nhất.
- Redis/queue: dùng container thật, hoặc tắt worker (`ENABLE_WORKERS=false`) nếu test không cần queue.
- Env bị validate lúc import (Zod) -> set đủ biến trong `.env.test` trước khi import app.

## 3. Frontend Vite + React

```bash
npm i -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

```js
// vite.config.js
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./test/setup.js"] },
});
// test/setup.js
import "@testing-library/jest-dom/vitest";
```

- Test hành vi qua role/label (`getByRole`, `getByLabelText`), không qua class CSS.
- React Query: mỗi test tạo `QueryClient` mới, `retry: false`.
- Mock HTTP ở tầng mạng (MSW) thay vì mock từng hàm axios.

## 4. E2E

- AI-driven, ít vỡ khi UI đổi: `npx e2e init` -> [e2e/README.md](e2e/README.md) (Node >= 24.8 hoặc >= 22.22.3).
- Truyền thống, deterministic: `npm init playwright@latest`.
- Chỉ viết cho **luồng sống còn** (đăng nhập, tạo board -> list -> card -> kéo thả, mời thành viên).

## 5. CI tối thiểu

```yaml
# chạy trên mỗi PR
- run: npm ci
- run: npm test            # unit + integration (service container Postgres/Redis)
- run: npm run test:e2e    # chỉ luồng sống còn; upload artifacts khi fail
```

## 6. Ghi chú riêng cho repo Trello Clone

- Hiện **không repo nào có test runner** (backend, frontend đều không có script `test`).
- Backend: `src/app.js` export `createApp()` -> dùng thẳng với supertest.
- Ứng viên unit test đầu tiên (thuần, không I/O): `src/lib/position.js` (`endPosition`, `midpoint`).
- Ưu tiên integration: phân quyền `assertWorkspaceAccess` / `assertBoardAccess` / `assertCardAccess` theo từng role, auth refresh token rotation + reuse detection.
- Không có test runner thì vẫn phải xác minh bằng chạy app thật (`make dev` + `make health`) và nói rõ "chưa có test tự động".
