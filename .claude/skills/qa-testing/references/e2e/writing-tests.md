# Viết test

> Nguồn gốc: `skills/e2e/references/writing-tests.md` + `docs/api-testing.mdx` (tester-army/e2e,
> Apache-2.0). Bản đã cài: `npx e2e guide writing-tests`.

## Mục lục
1. Một file hoàn chỉnh
2. Đăng ký test, hook, tuỳ chọn
3. Fixture (`app`, `screen`, `agent`, `platform`, `browser`, `device`, `session`)
4. Locator
5. Action
6. Read
7. `expect`
8. Đăng nhập: credentials, secrets, setup session
9. Fixture `browser` (chỉ web)
10. Công thức mẫu (login, CRUD, API, mock mạng, iframe, dialog, download, nhiều persona)
11. Thói quen tốt

---

## 1. Một file hoàn chỉnh

```ts
// tests/todos.e2e.ts
import { beforeEach, describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';

describe('todos', { tags: ['todos'] }, () => {
  beforeEach(async ({ app }) => {
    await app.open('/todos');
  });

  test('adds and completes a todo', async ({ agent, screen, browser }) => {
    await agent.act('add a todo named {title}', { params: { title: 'Write the release notes' } });
    await expect(screen.getByRole('listitem')).toHaveCount(1);
    await expect(screen.getByRole('status', 'Remaining')).toHaveText('1 remaining');

    await agent.act('mark the todo as done');
    await expect(screen.getByRole('status', 'Remaining')).toHaveText('0 remaining');
    await expect(browser).toHaveURL('/todos');
  });

  test('ignores an empty submission', async ({ screen }) => {
    // Tương tác chính xác: bấm Add khi rỗng chính là điều cần test.
    await screen.getByRole('button', 'Add').tap();
    await expect(screen.getByRole('listitem')).toHaveCount(0);
  });
});
```

- Trên **browser**, mỗi test bắt đầu ở context mới, chưa có trang → luôn `app.open()` trước.
- Trên **device**, test bỏ `app.open()` sẽ bắt đầu ở nơi test trước để lại.

## 2. Đăng ký test, hook, tuỳ chọn

Mọi thứ đăng ký lúc import → thân `describe` phải **đồng bộ** (`async` → `COLLECTION_ERROR`).

```ts
test('title', async ({ app, screen }) => {});
test('title', { tags: ['smoke'], retries: 2, timeout: 60_000 }, async ({ app }) => {});
describe('group', { tags: ['billing'] }, () => { /* test + hook */ });
describe('checkout flow', { serial: true }, () => { /* chạy tuần tự, chung state app */ });
beforeEach(async ({ app }) => {});      // mỗi attempt, có fixture của test
afterEach(async ({ screen }) => {});    // chạy cả khi fail, budget riêng = cleanupTimeout (30 s)
beforeAll(async ({ platform }) => {});  // mỗi suite realm, không có fixture app
afterAll(async () => {});
test.skip('later', async () => {});
test.only('focus', async () => {});     // chỉ local — CI fail với ONLY_IN_CI
test('conditional', async () => { test.skip(await onlyOneOrg(), 'nothing to switch to'); });
test.setup('sign in', { sessions: ['admin'] }, async ({ app, screen, session }) => {});
const wsTest = test.extend<{ ws: Ws }>({ ws: async ({ browser }, use) => { await use(await seed()); await drop(); } });
wsTest('uses the workspace', async ({ ws }) => {}); // code sau use() = teardown, chạy cả khi fail
```

| Tuỳ chọn | Mặc định | Ghi chú |
|---|---|---|
| `timeout` | `config.timeout` (120 s) | Gồm `beforeEach` + thân test. |
| `retries` | `config.retries` | 0–10. |
| `tags` | `[]` | Chọn bằng `--tag smoke`; `--tag-mode all` để đòi đủ tag. |
| `skip` | — | `true` hoặc chuỗi lý do. |
| `platforms` | — | Chỉ target thuộc nền tảng này, vd `['ios']`. |
| `requires` | `[]` | Capability engine, vd `['browser']` → thiếu thì skip thay vì fail. |
| `session` | — | Khôi phục state do setup test lưu. |
| `agentContext` | — | Context bổ sung cho `agent.*` trong test/group. |
| `agent` | agent của run | Tên `agents.<name>` hoặc danh sách (chạy mỗi test 1 lần/agent). |
| `trace`, `video` | theo target | Mode như config; test thắng CLI/target/config. |
| `serial` | `false` | Chỉ cho group: chạy tuần tự, 1 worker, retry cả nhóm. |

Thành viên serial **không** được đặt `retries`, `trace`, `video`, `session`, `platforms`, `requires`,
`skip`, `only`; lồng serial → `COLLECTION_ERROR`. Hook lồng: `beforeEach` ngoài trước, `afterEach`
trong trước. `beforeAll` lỗi → `HOOK_FAILED`, mọi test trong scope bị skip.

## 3. Fixture

Fixture dựng sẵn là **lười** — destructure cái cần. Fixture tự viết bằng `test.extend` chạy cho **mọi**
test đăng ký qua `test` đó (dù có destructure hay không) → fixture đổi state nên có `test` riêng.

| Fixture | Có khi | Nội dung chính |
|---|---|---|
| `app` | luôn | `baseUrl`, `open(path?)`, `back()`, `restart()` (giữ state), `clearState()` (xoá cookie/storage), `screenshot(label?)` |
| `screen` | luôn | `getBy*` locator, `tapAt`, `swipe`, `scrollUntilVisible` |
| `agent` | có model | `act`, `assert`, `waitFor`, `extract` (thiếu model → `MODEL_UNAVAILABLE`) |
| `platform` | luôn (kể cả hook) | `'web'`, `'ios'`, `'android'`… |
| `browser` | target browser | import `test` từ `@e2e-dev/web` |
| `device` | target device | import `test` từ `@e2e-dev/mobile` (`installApp`, `openLink`, `setPermission`, `setNetwork`, `setAppearance`, `clearKeychain`…) |
| `session` | chỉ trong `test.setup` | `session.save(name)` |

`app.screenshot()` bị từ chối (`POLICY_DENIED`) sau khi đã điền secret.

## 4. Locator

`screen.getBy*` dựng query lười, chỉ resolve khi có action/read/assertion. Mọi query cũng có trên
locator (scope vào cây con).

| Query | Khớp | Ưu tiên |
|---|---|---|
| `getByRole(role, name?, { exact?, checked?, disabled?, selected?, expanded?, pressed?, level?, visible? })` | role ngữ nghĩa + accessible name/state | **1 — luôn thử trước** |
| `getByLabel(text, …)` | control theo label | 2 |
| `getByPlaceholder(text, …)` | input theo placeholder | 3 |
| `getByText(text, …)` | text hiển thị | 4 |
| `getByDisplayValue(value, …)` | input theo giá trị hiện tại | — |
| `getByTestId(id, …)` | `data-testid` (web) / accessibility id (device) | **cuối cùng** |

- **So khớp text:** nguyên chuỗi sau khi chuẩn hoá khoảng trắng, **phân biệt hoa thường** (khác
  Playwright). `exact: false` = chuỗi con không phân biệt hoa thường; RegExp khớp như viết.
- Query trượt (0 match) làm assertion **phủ định** pass oan → luôn kiểm khẳng định trước.
- **Đúng 1 match** cho mỗi action/read/assertion. 2 → `LOCATOR_AMBIGUOUS` ngay; 0 → poll tới timeout →
  `LOCATOR_NOT_FOUND`. Ngoại lệ (chấp nhận 0/nhiều): `toHaveCount`, `toBeVisible`, `toBeHidden`,
  `toBeAttached`, dạng list của `toHaveText`/`toContainText`, `isVisible()`, `isHidden()`, `count()`,
  `all()`, `allTextContents()`.
- Thu hẹp: `filter({ hasText })` (chuỗi con không phân biệt hoa thường), `filter({ has: locator })`,
  `first()`, `last()`, `nth(i)`, scope dưới locator khác. `hasNot`/`hasNotText`/`filter({})` → `INVALID_LOCATOR`.
- `visible: true` loại node bị ẩn (drawer đóng) trước luật "đúng 1".
- Shadow DOM mở + closed root tạo bằng `attachShadow`: query đi vào được. `browser.locator(css)`,
  `frameLocator`, `filter({ hasText })` dừng ở closed root.
- `screen.scrollUntilVisible(locator, { direction?, momentum?, timeout? })` cuộn tới khi thấy.
- Role là union đóng (`button`, `link`, `textbox`, `combobox`, `checkbox`, `radio`, `switch`,
  `heading`, `tab`, `dialog`, `alert`, `status`, `listitem`, `row`, `cell`, `navigation`, `main`, …;
  `img` = alias `image`). `contenteditable` là `textbox` với agent; từ test dùng `getByLabel`/`getByTestId`.

## 5. Action

Mỗi action resolve 1 node, đợi tối đa `actionTimeout` (30 s hoặc `{ timeout }`) cho tới khi thao tác
được, rồi làm 1 việc:

`tap()` (alias `click()`), `doubleTap()`, `secondaryTap()` (đều nhận `{ modifiers: ['Shift'] }`),
`longPress({ duration? })`, `fill(value | Secret)`, `pressSequentially(text, { delay? })`, `clear()`,
`press(key)`, `check()`, `uncheck()`, `selectOption(label | { label } | { value } | { index })`
(1 option — mảng → `INVALID_ARGUMENT`), `focus()`, `hover()`, `setInputFiles(paths)` (tương đối gốc
project), `dragTo(locator)`, `scrollIntoView()`, `swipe({ direction, momentum? })`.

- `fill` đặt giá trị **không** phát phím → app phản ứng theo phím (autocomplete, input mask) dùng
  `pressSequentially` (chỉ nhận string thường; `Secret` phải đi qua `fill`).
- `selectOption('Pro')` khớp **label**, không khớp value (khác Playwright) → `{ value: 'pro' }` nếu cần.
- Toạ độ (CSS px) chỉ cho thứ cây không liệt kê: `tap({ position: { x, y } })`, `screen.tapAt({ x, y })`,
  `screen.swipe({ from, to })`. Ưu tiên locator — điểm trôi theo layout.
- Chỉ web (device → `UNSUPPORTED_CAPABILITY`): `secondaryTap`, `selectOption`, `setInputFiles`,
  `scrollIntoView`, `modifiers`.

## 6. Read

Resolve **một lần, không retry**: `textContent()`, `inputValue()`, `getAttribute(name)`, `isVisible()`,
`isHidden()`, `isEnabled()`, `isDisabled()`, `isChecked()`, `boundingBox()`, `count()`, `all()`,
`allTextContents()`. `waitFor({ state: 'attached'|'detached'|'visible'|'hidden', timeout? })` đợi trong
`actionTimeout`.

- Text = text **render** (như `innerText`): `text-transform` có hiệu lực, `display: none` biến mất.
- `isChecked()` trả `false` (không lỗi) trên node không có state checked → query checkbox bằng role.
- Đọc giá trị/thuộc tính ô password → `POLICY_DENIED`.
- Giá trị cần thời gian ổn định → **matcher**, không phải read.

## 7. `expect`

- `expect(locator)` poll tới `assertionTimeout` (5 s) hoặc `{ timeout }`. `.not` pass khi phủ định giữ
  liên tục 1 s (hoặc cả timeout nếu ngắn hơn).
- `expect(value, message?)` đồng bộ. `expect.poll(read, { timeout?, interval?, message? })` đọc lại tới
  khi matcher pass (nhớ `await`).
- `expect.soft(x)` giữ lỗi, thân test chạy tiếp; attempt fail sau cùng liệt kê đủ.
- Asymmetric: `expect.any(Class)`, `expect.anything()`, `expect.objectContaining()`,
  `expect.arrayContaining()`, `expect.stringContaining()`, `expect.stringMatching()`.
- `toMatchSchema(schema)` nhận Standard Schema đồng bộ (Zod, Valibot, ArkType), liệt kê mọi lỗi theo
  path và **trả về giá trị đã typed**.

```ts
await expect(screen.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
await expect(browser).toHaveURL('/dashboard');      // tương đối base URL, hoặc RegExp
expect(order).toMatchObject({ id: expect.any(Number), lines: [{ sku: 'a' }] });
expect.soft(await screen.getByTestId('tax').textContent()).toBe('$8.00');
const users = expect(await response.json()).toMatchSchema(z.array(User));
```

| Locator | Browser | Giá trị |
|---|---|---|
| `toBeVisible`, `toBeHidden`, `toBeAttached`, `toBeEnabled`, `toBeDisabled`, `toBeChecked`, `toBeSelected`, `toBeExpanded`, `toBeFocused`, `toHaveText`, `toContainText`, `toHaveValue`, `toHaveAttribute`, `toHaveCount`, `toHaveAccessibleName` | `toHaveURL`, `toHaveTitle`, `toHaveClass(locator, expected)` | `toBe`, `toEqual`, `toMatchObject`, `toBeTruthy`, `toBeFalsy`, `toBeNull`, `toBeUndefined`, `toBeDefined`, `toHaveLength`, `toHaveProperty`, `toContain`, `toMatch`, `toBeGreaterThan(OrEqual)`, `toBeLessThan(OrEqual)`, `toBeCloseTo`, `toMatchSchema` |

- `toHaveText` = nguyên text đã chuẩn hoá; `toContainText` = chuỗi con/RegExp; `toHaveValue` = giá trị
  nguyên vẹn. Trên ô password cả ba → `POLICY_DENIED`.
- Dạng list: `toHaveText(['Alpha', /^Beta/])` cần **đúng 2** match theo thứ tự;
  `toContainText(['Alpha', 'Beta'])` cần mỗi mục ở 1 match riêng, theo thứ tự, được thừa.
- Option Playwright hợp lệ: `{ checked: false }`, `{ enabled: false }`, `{ visible: false }`,
  `{ attached: false }`, `{ ignoreCase: true }`. Option khác (`indeterminate`, `useInnerText`) → `INVALID_ARGUMENT`.
- `toContain` trên mảng so **deep equality** (như `toContainEqual` của Playwright).

## 8. Đăng nhập: credentials, secrets, setup session

**Đăng nhập một lần, lưu state, test khác khai báo dùng lại.**

```ts
// tests/auth.setup.e2e.ts
import { test } from '@e2e-dev/web';
import { expect, credentials } from 'e2e';

test.setup('authenticate as admin', { sessions: ['admin'] }, async ({ app, screen, session, browser }) => {
  const admin = credentials.user('admin');
  await app.open('/login');
  await screen.getByLabel('Email').fill(admin.username);
  await screen.getByLabel('Password').fill(admin.password);   // Secret, không có plaintext
  await screen.getByRole('button', 'Sign in').tap();
  await expect(browser).toHaveURL('/dashboard');              // chứng minh đăng nhập xong rồi mới lưu
  await session.save('admin');
});
```

```ts
// tests/dashboard.e2e.ts
import { test, expect } from 'e2e';

test('the dashboard opens directly', { session: 'admin' }, async ({ app, screen }) => {
  await app.open('/dashboard');
  await expect(screen.getByRole('heading', 'Dashboard')).toBeVisible();
});
```

- Setup test ở top-level; đúng 1 setup lưu một tên; thân lưu mọi tên đã khai (`SESSION_CONTRACT`).
  Chạy riêng test phụ thuộc vẫn tự chạy setup của nó.
- Session giữ cookie, local storage, IndexedDB **cho một run**, mã hoá, xoá khi dọn. Không gồm state server.
- **Sau khi điền secret**, pixel + screenshot assertion bị giữ lại cho phần còn lại của session; session
  khôi phục mang theo "taint". Đăng nhập không qua fill (`browser.setCookies`, gọi API) giữ được screenshot.
- Config: `credentials: { admin: { username: 'admin@example.test', password: process.env.ADMIN_PASSWORD ?? '' } }`.
  Override per run: `E2E_USER_ADMIN_USERNAME` / `E2E_USER_ADMIN_PASSWORD`.
- `credentials.user('admin').password` là `Secret` (tên `admin.password`), chỉ `fill()` và `params`
  của `agent.act` nhận; stringify → `INVALID_CONFIG`; gọi ngoài run → `AUTH_CREDENTIAL_UNAVAILABLE`.
- Giá trị nhạy cảm khác: `secrets: { 'stripe-key': process.env.STRIPE_KEY ?? '' }` → `secrets.get('stripe-key')`;
  override `E2E_SECRET_STRIPE_KEY`.
- Giá trị đã đăng ký mà lỡ truyền dạng chuỗi thường (trong title, URL, instruction) bị redact thành
  `<secret:stripe-key>` ở mọi nơi → agent **không** gõ được. Luôn truyền **handle**.
- Mobile: không có `test.setup`/`session` → đăng nhập trong từng test bằng `screen` hoặc `agent.act`.

## 9. Fixture `browser` (chỉ web)

Ưu tiên `app` + `screen`; `browser` cho thứ chỉ browser có. Suite portable khai `requires: ['browser']`.
Tab app tự mở (`target="_blank"`, `window.open`) **không** được theo → `browser.goto(url)`.

| API | Dùng cho |
|---|---|
| `goto(url, { waitUntil?, timeout? })`, `reload`, `back`, `forward` | Điều hướng (`goto` nhận path tương đối base) |
| `url()`, `title()`, `waitForURL(url \| RegExp)` | Đọc + đợi URL |
| `locator(css)` | CSS/XPath thô — **cuối cùng**, không portable |
| `frameLocator(css)` | `Screen` trong iframe: `browser.frameLocator('#payment').getByLabel('Card number')` |
| `evaluate(fn \| source, arg?)` | Chạy trong trang, JSON vào/ra, không closure |
| `addInitScript(...)` | Chạy trước script trang — gọi trước `app.open` |
| `route(pattern, handler)`, `unroute` | Chặn request; handler gọi **đúng một** `fulfill`/`continue`/`fallback`/`abort` |
| `waitForResponse(pattern)` | `{ url, status, headers, json(), text() }` |
| `cookies()`, `setCookies([...])` | Cookie |
| `setViewport({ width, height })` | Đổi kích thước |
| `onDialog('accept' \| 'dismiss' \| handler)` | Đăng ký **trước** cú tap mở dialog |
| `waitForDownload(() => trigger)` | `{ path, suggestedFilename }` |
| `keyboard.*`, `mouse.*` | Input không focus — ưu tiên `locator.press/fill` |

Pattern của `route`/`waitForResponse` là glob (`*` trong 1 segment, `**` xuyên `/`) hoặc RegExp trên
full URL; hàm predicate → `INVALID_ARGUMENT`.

## 10. Công thức mẫu

**Tạo – sửa – xoá với dữ liệu duy nhất + dọn dẹp**

```ts
import { afterEach, test } from '@e2e-dev/web';
import { expect, unique } from 'e2e';

let created: string | undefined;
// afterEach chỉ có cleanupTimeout (30 s) riêng → dọn bằng screen hoặc fetch API, đừng dùng agent.act.
afterEach(async ({ app, screen }) => {
  if (created) {
    await app.open('/projects');
    const row = screen.getByRole('row').filter({ hasText: created });
    await row.getByRole('button', 'Delete').tap();
    await screen.getByRole('dialog').getByRole('button', 'Delete').tap();
    await expect(screen.getByRole('heading', created)).toBeHidden();
  }
  created = undefined;
});

test('creates and renames a project', { session: 'admin' }, async ({ app, agent, screen }) => {
  const name = `Atlas ${Date.now()}`;
  await app.open('/projects');
  // unique(): giá trị đổi mỗi run nhưng cache vẫn replay (runner thay giá trị hiện tại vào)
  await agent.act('create a project named {name}', { params: { name: unique(name) } });
  created = name;
  await expect(screen.getByRole('heading', name)).toBeVisible();

  await agent.act('rename the project to {next}', { params: { next: unique(`${name} v2`) } });
  created = `${name} v2`;
  await expect(screen.getByRole('heading', `${name} v2`)).toBeVisible();
});
```

**Test API trong cùng suite (0 model)**

```ts
import { test, expect } from 'e2e';
import { z } from 'zod';

const User = z.object({ id: z.number(), name: z.string() });

test('GET /api/users returns the seeded users', async ({ app }) => {
  const response = await fetch(new URL('/api/users', app.baseUrl));
  expect(response.status).toBe(200);
  const users = expect(await response.json()).toMatchSchema(z.array(User));
  expect(users).toHaveLength(3);
});
```

API cần session đăng nhập: fixture `test.extend` đọc `browser.cookies()` rồi gắn header `cookie`,
chỉ cho phép URL cùng origin với `app.baseUrl`.

**Mock mạng để test trạng thái lỗi** (cần `test` từ `@e2e-dev/web` để có `browser`)

```ts
test('shows a friendly error when the API is down', { requires: ['browser'] }, async ({ app, screen, browser }) => {
  await browser.route('**/api/orders', (route) => route.fulfill({ status: 500, json: { error: 'boom' } }));
  await app.open('/orders');
  await expect(screen.getByRole('alert')).toContainText('Try again');
});
```

**Iframe thanh toán, dialog xác nhận, download**

```ts
await browser.frameLocator('#payment').getByLabel('Card number').fill('4242424242424242');

const off = await browser.onDialog('accept');            // đăng ký TRƯỚC khi bấm
await screen.getByRole('button', 'Delete account').tap();
await off();

const file = await browser.waitForDownload(() => screen.getByRole('button', 'Export CSV').tap());
expect(file.suggestedFilename).toMatch(/\.csv$/);
```

**Cùng test, nhiều persona** — khai `agents: { buyer: {...}, admin: {...} }`, rồi
`describe('checkout', { agent: ['buyer', 'admin'] }, …)`; mỗi persona ghi/replay cache riêng.

## 11. Thói quen tốt

- Selector lấy từ source (label, role, text). App thiếu accessible name → **thêm `aria-label`/heading
  vào app**, đừng lùi về `browser.locator('.btn-primary')`.
- Dữ liệu test có tên duy nhất theo run (bọc `unique()` khi đưa vào `params` của agent) + `afterEach`
  dọn → retry/replay không vấp dữ liệu cũ, cache không miss mỗi run.
- Không sleep, không vòng poll tự viết — matcher có `timeout` dài hơn.
- `await` mọi step + `expect.poll` (thiếu → `STEP_NOT_AWAITED` tại dòng gọi).
- Kết quả do model sinh → assert sự thật bằng `toContain`, không assert câu chữ.
