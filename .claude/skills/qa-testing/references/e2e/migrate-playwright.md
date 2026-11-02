# Chuyển từ Playwright sang e2e

> Nguồn gốc: `docs/migrate/playwright.mdx` (tester-army/e2e, Apache-2.0). Upstream cũng có hướng dẫn cho
> Cypress, Selenium, Detox, Maestro trong `node_modules/e2e/docs/migrate/`.

## Mục lục
1. Chạy song song, migrate từng file
2. Map config
3. Một test, trước và sau
4. Map API (locator, action, assertion)
5. Khác biệt "by design" dễ vấp
6. Chưa có (giữ Playwright cho phần này)
7. Quy trình migrate an toàn

---

## 1. Chạy song song, migrate từng file

`@e2e-dev/web` mang `playwright-core` đã pin riêng → `@playwright/test` của bạn giữ nguyên version. Hai
runner sống chung một project; e2e đọc `e2e.config.ts` và tìm `tests/**/*.e2e.ts` → **giữ hai pattern
file tách nhau** (vd Playwright `*.spec.ts`, e2e `*.e2e.ts`).

## 2. Map config

Mọi key e2e là key top-level, key của target (như `app`), hoặc option của `web(...)`. Key Playwright
(`testDir`, `baseURL`, `webServer`, `projects`) bị từ chối kèm message chỉ chỗ đúng.

| Playwright | e2e |
|---|---|
| `use.baseURL` | `app: { url }` trên target |
| `webServer` | `app: { url, command }` trên target |
| `webServer.reuseExistingServer` | `app.command.reuseExisting: true` (CI bỏ qua) |
| `projects` | `targets` (mỗi target 1 engine instance) |
| `projects[].dependencies` cho đăng nhập | `test.setup` + `{ session }` |
| `testDir`, `testMatch` / `testIgnore` | `tests` (glob) / entry `!` (`'!tests/wip/**'`) |
| `reporter` | `reporters: ['list', 'junit']` (+ `json`, `markdown`; **không có** `html`) |
| `outputDir` | `output` (mặc định `.e2e`) |
| `use.viewport`, `use.browserName` | `web({ viewport, browser })` |
| `use.testIdAttribute` | `web({ testIdAttribute })` |
| `use.httpCredentials` / `extraHTTPHeaders` | `web({ basicAuth })` / `web({ headers })` |
| `use.locale`, `timezoneId`, `userAgent` | `web({ locale, timezoneId, userAgent })` |
| `expect.timeout` / `use.actionTimeout` | `assertionTimeout` / `actionTimeout` |
| `use.navigationTimeout` | `timeout` (budget test); `browser.goto(url, { timeout })` cho 1 lời gọi |
| `use.storageState` | `test.setup` + `{ session }` (không import file — by design) |
| `use.trace`, `use.video` | `trace`, `video` (cùng mode); mặc định khác |
| `use.headless: false` | `--headed` |
| `maxFailures` | `--max-failures <n>` (không có key config) |
| `retries`, `workers`, `timeout` | Cùng tên ở top-level (mặc định khác: CI retries 1, workers 1) |

## 3. Một test, trước và sau

```ts
// Playwright
import { test, expect } from '@playwright/test';

test('checkout', async ({ page }) => {
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByLabel('Card number').fill('4242424242424242');
  await page.getByLabel('Expiry').fill('12/30');
  await page.getByLabel('CVC').fill('123');
  await page.getByRole('button', { name: 'Pay' }).click();
  await expect(page.getByRole('heading')).toHaveText('Order confirmed');
});
```

```ts
// e2e
import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('checkout', async ({ app, agent, screen }) => {
  await app.open('/cart');
  await agent.act('pay with the test card 4242 4242 4242 4242, expiry 12/30, CVC 123');
  await expect(screen.getByRole('heading')).toHaveText('Order confirmed');
});
```

Điều hướng + assertion cuối vẫn tường minh; agent lo phần form (và thích nghi khi form đổi). Muốn giữ
100% deterministic: mỗi dòng `page.getBy*` có một dòng `screen.getBy*` tương ứng — không cần model.

## 4. Map API

| Playwright | e2e |
|---|---|
| `page.getByRole(role, { name })` | `screen.getByRole(role, name)` (hoặc `{ name }`) |
| `getByAltText(alt)` | `getByRole('image', alt)` |
| `page.locator('css')` | `browser.locator('css')` (web only, cuối cùng) |
| `page.frameLocator('#f')` | `browser.frameLocator('#f')` |
| `page.waitForSelector(sel)` | `browser.locator(sel).waitFor()` |
| `click()` / `click({ button: 'right' })` / `dblclick()` | `tap()` (alias `click()`) / `secondaryTap()` / `doubleTap()` |
| `scrollIntoViewIfNeeded()` | `scrollIntoView()` |
| `innerText()` | `textContent()` (trả text render) |
| `page.mouse.click(x, y)` | `screen.tapAt({ x, y })` |
| `mouse.move/down/up` (kéo) | `screen.swipe({ from, to })` |
| `expect(page).toHaveURL/Title` | `expect(browser).toHaveURL/Title` |
| `expect(locator).toHaveClass(c)` | `expect(browser).toHaveClass(locator, c)` |
| `toHaveAttribute('aria-selected', 'true')` | `toBeSelected()` (`aria-expanded` → `toBeExpanded()`) |
| `expect(async () => …).toPass()` | `expect.poll(read).toBe(...)` |
| `page.keyboard.press/type` | `browser.keyboard.press/type` (chỉ text thường, không `Secret`; `down/up/insertText` chưa có) |

## 5. Khác biệt "by design" dễ vấp

- **So text khớp nguyên chuỗi, phân biệt hoa thường** (`getByRole`, `getByLabel`, `getByPlaceholder`,
  `getByText`). Playwright mặc định substring → thêm `{ exact: false }` khi port.
- **Matcher khẳng định trên nhiều match** → `LOCATOR_AMBIGUOUS` ngay. `getByRole` không bao giờ khớp node
  ẩn (không có `includeHidden`); các query khác dùng `{ visible: true }` để bỏ bản sao ẩn.
- `textContent()` trả **text render** (như `innerText`), không phải DOM `textContent`.
- `toHaveText`/`toContainText` so text render (như `{ useInnerText: true }`).
- `selectOption('pro')` khớp **label**, không khớp value → `{ value: 'pro' }`.
- `toContain` trên mảng = deep equality (như `toContainEqual`).
- `isChecked()`/`.not.toBeChecked()` trên node không checkable → `false`/pass (Playwright ném lỗi).
- Không import `storageState` từ file — đăng nhập qua `test.setup` + session (mã hoá, xoá cuối run).
- Một file chạy tuần tự trên 1 worker; **các file** chạy song song (chưa có `fullyParallel`).

## 6. Chưa có (giữ Playwright cho phần này)

`toHaveScreenshot`/`toMatchSnapshot` (pixel diff — `agent.assert(..., { vision: true })` là phán đoán,
không phải diff) · `toMatchAriaSnapshot` · `globalSetup`/`globalTeardown` · `fullyParallel` ·
`colorScheme`, `geolocation`, `permissions` (web) · `devices['iPhone 15']`, `isMobile`, `hasTouch`
(chỉ có `viewport`) · `ignoreHTTPSErrors`, `bypassCSP`, `offline`, `proxy` · `locator.and/or` ·
`filter({ hasNot, hasNotText })` · `locator.locator('css')` · `getByTitle` · `expect.extend` ·
`.resolves/.rejects` · reporter `html` · `toHaveCSS`, `toBeEmpty`, `toBeInViewport`, `toBeEditable`.

> Danh sách "chưa có" thay đổi theo version — kiểm `node_modules/e2e/docs/migrate/playwright.mdx` của
> bản đã cài trước khi kết luận.

## 7. Quy trình migrate an toàn

```
- [ ] Cài e2e song song (npx e2e init), KHÔNG gỡ Playwright.
- [ ] Đổi pattern file: e2e = tests/**/*.e2e.ts, Playwright giữ *.spec.ts.
- [ ] Port config theo bảng §2 (webServer → app.command, projects → targets).
- [ ] Port auth: storageState/global setup → test.setup + session.
- [ ] Port từng file, bắt đầu từ file hay vỡ nhất vì selector; giữ assertion cuối y nguyên.
- [ ] Thêm { exact: false } nơi Playwright đang dựa vào substring.
- [ ] Chạy cả hai suite trong CI tới khi e2e ổn định (--repeat-each 10 --retries 0).
- [ ] Giữ Playwright cho visual diff / tính năng ở §6.
- [ ] Gỡ file Playwright đã port; cuối cùng mới gỡ @playwright/test nếu không còn dùng.
```
