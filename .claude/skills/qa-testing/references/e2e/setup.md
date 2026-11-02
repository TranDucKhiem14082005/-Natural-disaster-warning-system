# Setup — thêm e2e vào một project

> Nguồn gốc: `skills/e2e/references/setup.md` (tester-army/e2e, Apache-2.0). Bản đã cài:
> `npx e2e guide setup`.

## Mục lục
1. Yêu cầu
2. Scaffold (`e2e init`)
3. Model: subscription, API key, local
4. File config — bảng key
5. App dưới test (`app` của target)
6. Tuỳ chọn `web()`
7. Để runner tự khởi động app
8. Biến môi trường runner đọc
9. Mobile target
10. Xong khi

---

## 1. Yêu cầu

- **Node.js ≥ 24.8**, hoặc **≥ 22.22.3** trên dòng 22.
- **ES module**: config, test, helper `.ts` luôn nạp như ESM, bất kể `type` trong `package.json`.
  Không `require`/`module.exports`. Import theo TypeScript: `./x.js` hoặc `./x` nạp `x.ts`;
  `paths`/`baseUrl` của `tsconfig.json` gần nhất có hiệu lực. Decorator cần `experimentalDecorators`;
  TypeScript CommonJS đặt trong `.cts`.
- **Web:** `@e2e-dev/web` tự pin `playwright-core` — **không** thêm gói `playwright` cho nó. Browser
  thiếu sẽ tải ở lần boot đầu; trong CI chạy bước riêng `npx @e2e-dev/web install chromium --with-deps`
  (pnpm: `pnpm exec e2e-web install chromium --with-deps`).
- **Mobile:** `@e2e-dev/mobile` pin `agent-device`; mỗi pin đi theo release của engine.

## 2. Scaffold

```bash
npx e2e init        # npm
pnpm dlx e2e init   # pnpm
npx e2e init my-app # scaffold vào thư mục mới
```

Wizard hỏi engine + model provider (`None` cho test không AI), đề nghị cài skill gốc, đăng ký MCP
server cho coding agent, cài dependency. `--yes` = Playwright + Vercel AI Gateway, cài skill vào
`.agents/skills/` (symlink `.claude/skills/e2e`), đăng ký MCP vào `.mcp.json` và `.cursor/mcp.json`,
**không** cài dependency.

`init` thêm dependency + script `test:e2e`, ghi `e2e.config.ts` và `tests/example.e2e.ts`, cập nhật
`.gitignore`, không đụng config/test có sẵn. Chạy lại sau khi nâng cấp để làm mới skill + MCP.

> Skill gốc cài vào `.claude/skills/e2e`; skill này tên `e2e-testing` nên không đè nhau. Nếu cả hai
> cùng có, bản gốc khớp version đã cài → ưu tiên khi lệch.

Không dùng wizard (`ai` = Vercel AI SDK v7, chỉ cần cho bước `agent.*`):

```bash
npm install --save-dev e2e @e2e-dev/web ai@^7
```

## 3. Model: subscription, API key, local

| Lựa chọn | Thiết lập |
|---|---|
| ChatGPT Plus/Pro | `npx e2e login openai` |
| GitHub Copilot | `npx e2e login github-copilot` (cần GitHub CLI đã đăng nhập, hoặc `--client-id`) |
| OpenCode Console (Zen/Go) | `npx e2e login opencode-console` (duyệt device code, chọn workspace) |
| SuperGrok / X Premium+ | `npx e2e login spacexai` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY`, hoặc đăng nhập Vercel CLI + `npx vercel link` (không key → `gateway()` dùng Vercel OIDC token) |
| OpenRouter | `OPENROUTER_API_KEY` |
| Local / self-hosted | URL endpoint + model nó phục vụ (+ key nếu cần) |

- `npx e2e models [provider]` liệt kê id mỗi login phục vụ. **CI dùng API key**, không dùng login subscription.
- Đổi sang ChatGPT: cài `ai` + `@ai-sdk/openai`, `model: chatgpt('gpt-6-luna')` từ `e2e/oauth/chatgpt`, chạy `npx e2e login openai`.
- Đổi sang Copilot: cài `ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/openai`; `model: copilot('<id>')` từ `e2e/oauth/copilot`.
- Đổi sang OpenCode Console: thêm `@ai-sdk/anthropic`, `@ai-sdk/google`; `model: opencodeConsole('<id>')`
  từ `e2e/oauth/opencode-console`; id `go/…` cần gói Go; CI đặt `OPENCODE_API_KEY`.
- Model local (server có `/v1/chat/completions`):

```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const local = createOpenAICompatible({
  name: 'local',
  baseURL: 'http://127.0.0.1:11434/v1',
  // apiKey: process.env.LLM_API_KEY,
});

const agent = { model: local.chatModel('your-model-id') }; // đặt làm agents.default
```

Agent dựng sẵn cần model **hỗ trợ tool call và ảnh**. Luôn giữ `ai@^7` khi dùng bất kỳ provider nào.

## 4. File config — bảng key

`e2e.config.ts` (hoặc `.mts`) ở gốc project, `export default { … } satisfies E2EConfig`. Key lạ →
`INVALID_CONFIG` lúc load.

| Key | Mặc định | Ghi chú |
|---|---|---|
| `targets` | **bắt buộc** | ≥ 1. Target UI có `engine` + `app`; target chỉ-tools bỏ `engine`, phải có `platform`. `--target` nhận `name`. |
| `tests` | `'tests/**/*.e2e.ts'` | Glob tương đối gốc: `*`, `?`, `**`, `!` để loại (`'!tests/wip/**'`). Ngoặc nhọn, class, `..`, path tuyệt đối → `INVALID_GLOB`. |
| `timeout` | `120000` | Mỗi attempt (ms); cũng là deadline mặc định của `agent.act`. |
| `launchTimeout` | `60000` | Khởi tạo engine + bắt đầu attempt. |
| `actionTimeout` | `30000` | Mỗi action locator / thao tác engine. |
| `assertionTimeout` | `5000` | Cửa sổ polling của `expect`. |
| `cleanupTimeout` | `30000` | Mỗi `afterEach`, teardown fixture, cleanup engine. |
| `retries` | `0` (CI: `1`) | 0–10. |
| `workers` | nửa số core (CI: `1`) | Số file chạy song song, bị giới hạn bởi engine. |
| `reporters` | `['list']` | `list`, `json`, `junit`, `markdown`, hoặc object `{ name, onEvent?, onRunFinished? }`. `json` không đi chung `list`. |
| `cache` | `'read-write'` | `'read-only'`, `'off'`, hoặc `{ mode, store, dir, strict }`. CI chỉ hạ mode **mặc định** xuống read-only. |
| `agents` | `{ default: built-in }` | Không entry nào kế thừa từ `default`. Xem `agent.md`. |
| `credentials` | `{}` | `{ username, password }`; password là chuỗi ≥ 6 code point hoặc hàm trả về nó. |
| `secrets` | `{}` | Giá trị model không bao giờ thấy; namespace riêng với credentials. |
| `output` | `'.e2e'` | Thư mục kết quả; không được là thư mục cache. |
| `artifacts` | — | `{ store }` đẩy artifact sang `ArtifactStore` của bạn. |
| `trace` | `'on'` (CI: `'on-first-retry'`) | `'off'`, `'on'`, `'retain-on-failure'`, `'on-first-retry'`, `'on-all-retries'`. |
| `video` | `'off'` | Cùng các mode; ưu tiên: test > `--video` > target > config. |
| `projectId` | tên package | Danh tính report + cache. |
| `failOnSkippedFailure` | `false` | `true` → test skip sau khi đã có soft failure làm run exit 1. |

Password tĩnh được kiểm lúc load (≥ 6 code point) → **set env trước** (`ADMIN_PASSWORD` hoặc
`E2E_USER_ADMIN_PASSWORD`), hoặc hoãn tới lúc fill: `password: () => process.env.ADMIN_PASSWORD ?? ''`.

## 5. App dưới test (`app` của target)

Target khai báo app; engine chỉ lái. (`web({ url })`, `mobile({ app })` kiểu cũ là key lạ.)

| Key | Ý nghĩa |
|---|---|
| `url` | Base URL cho `app.open()`. Bắt buộc với `web()`. Thiếu scheme → `https://` (loopback → `http://`). Port `0` trên `127.0.0.1`/`[::1]` = lấy port trống. |
| `bundleId` | Mobile: bundle id / package / tên hiển thị mà `app.open()` khởi chạy. |
| `appPath` | Mobile: file `.app`/`.apk` dưới test (cần `bundleId` hoặc `appPath`). |
| `launchArguments`, `permissions` | Mobile: tham số + quyền (`grant`/`deny`/`reset`) cho mỗi lần launch mới. |
| `command` | Tiến trình phục vụ `url`: `{ executable, args, cwd, env, startupTimeout, shutdownTimeout, log, reuseExisting }`. `{port}` trong `args`/`env` = port của `url`. |
| `readyUrl` | Probe sẵn sàng nếu khác `url`. |
| `environment` | `'test'`/`'staging'`/`'production'` — nhãn report + cache key. |
| `identity` | Danh tính ổn định cho cache/session khi origin đổi theo deploy (preview URL). |

- **Next.js 16 dev**: target mở `127.0.0.1`/`[::1]` trong khi `next dev` coi mình là `localhost` → không
  hydrate. Thêm host vào `allowedDevOrigins` trong `next.config.ts` (hoặc dùng `localhost`).
- Không có key `services`: tự bật dependency trước, hoặc cho `app.command` chạy script bật cả stack.

## 6. Tuỳ chọn `web()`

| Option | Ý nghĩa |
|---|---|
| `browser` | `'chromium'` (mặc định), `'firefox'`, `'webkit'`, hoặc `BrowserProvider` thuê browser từ xa (`kernel()` của `@e2e-dev/kernel`). |
| `viewport` | `{ width, height }`, mặc định 1280×720; `null` theo cửa sổ. |
| `connect` | `{ cdpEndpoint }` gắn vào Chromium từ xa qua CDP (resolver `(signal) => url`, không phải string). |
| `headers` | Chỉ gửi tới site của app (vd `x-vercel-protection-bypass`, `ngrok-skip-browser-warning`); tắt HTTP cache + service worker. |
| `basicAuth` | `{ username, password }` cho challenge 401; password có thể là `secrets.get('name')`. |
| `userAgent`, `locale`, `timezoneId` | UA, ngôn ngữ (`'vi-VN'`), múi giờ IANA (`'Asia/Ho_Chi_Minh'`). |
| `initScripts` | Script chạy trước script của trang. |
| `testIdAttribute` | Thuộc tính `getByTestId` đọc; mặc định `data-testid`. |
| `screencast` | `{ size?, quality? }` cho video của engine. |

Hai browser, một app:

```ts
const app = { url: 'http://127.0.0.1:3000' };
export default {
  targets: [
    { name: 'chromium', engine: web(), app },
    { name: 'mobile-webkit', engine: web({ browser: 'webkit', viewport: { width: 390, height: 844 } }), app },
  ],
} satisfies E2EConfig;
```

## 7. Để runner tự khởi động app (khuyên dùng — chạy giống nhau local và CI)

```ts
engine: web(),
app: {
  url: 'http://127.0.0.1:3000',
  command: {
    executable: 'pnpm',
    args: ['dev'],
    env: { PORT: '3000', DATABASE_URL: process.env.DATABASE_URL ?? '' },
    startupTimeout: 120_000,
    log: '.e2e/logs/app.log',
  },
},
```

- Runner spawn `command`, poll `readyUrl` (mặc định `url`) tới khi nhận status 200–499 trong
  `startupTimeout` (mặc định 60 s), dừng nó khi run xong/fail/bị ngắt (`shutdownTimeout` 10 s). Không
  sẵn sàng → `APP_UNREACHABLE` (report vẫn được ghi).
- Tiến trình con **chỉ** nhận `PATH`, `HOME`, biến thư mục tạm (+ `SystemRoot`, `COMSPEC` trên Windows)
  và `command.env` → **truyền mọi biến app cần qua `env`**. Key model và `E2E_USER_*` không bao giờ được kế thừa.
- Không có `log` → output bị bỏ, server chết lúc boot là vô hình. Luôn đặt `log` dưới thư mục bị ignore.
- `url` đã trả lời trước khi spawn → `APP_ALREADY_RUNNING`; `reuseExisting: true` gắn vào dev server
  đang chạy (CI bỏ qua).
- `executable` tìm trên `PATH`, **không qua shell** → gọi thẳng server, không wrapper.
- Port động: `url: 'http://127.0.0.1:0'` (không bao giờ `localhost:0`) + `args: ['dev', '--port', '{port}']`;
  test đọc URL thật từ `app.baseUrl`.
- App chạy ở nơi khác: `url: process.env.APP_URL ?? 'http://localhost:3000'`. Runner **không** tự nạp
  `.env` → thêm `process.loadEnvFile('.env')` đầu `e2e.config.ts`.

## 8. Biến môi trường runner đọc

| Biến | Tác dụng |
|---|---|
| `AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`… | Do gói provider đọc, không phải runner. |
| `E2E_USER_<NAME>_USERNAME`, `E2E_USER_<NAME>_PASSWORD` | Ghi đè `credentials.<name>` (`<NAME>` viết hoa, ký tự khác → `_`). |
| `E2E_SECRET_<NAME>` | Ghi đè `secrets.<name>`. |
| `CI` | Bật mặc định CI (xem `running-ci.md`). |
| `E2E_TELEMETRY_DISABLED`, `DO_NOT_TRACK` | Tắt telemetry; `E2E_TELEMETRY_DEBUG=1` in event thay vì gửi. |

## 9. Mobile target

`@e2e-dev/mobile` lái iOS simulator, Android emulator, máy thật qua
[agent-device](https://github.com/callstack/agent-device). Cần Xcode + simulator runtime hoặc Android
SDK + emulator (máy thật: Xcode Developer Mode + ký runner, hoặc adb đã bật USB debugging). Chạy
`npx agent-device doctor` một lần. Gọi máy thật bằng tên trong `npx agent-device devices`.

```ts
import type { E2EConfig } from 'e2e';
import { mobile } from '@e2e-dev/mobile';
import { mobileTools } from '@e2e-dev/mobile/tools';
import { gateway } from 'ai';

const iphone = mobile({ platform: 'ios' });

export default {
  targets: [{ engine: iphone, app: { bundleId: 'com.example.app' } }],
  workers: 1,
  agents: {
    default: {
      model: gateway('openai/gpt-6-luna-fast'),
      tools: mobileTools(iphone),
    },
  },
} satisfies E2EConfig;
```

- Engine **không tự cài app**: fixture dùng chung gọi `device.installApp()` một lần/thiết bị.
- **Expo dev build trên iOS sim:** `app.launchArguments: ['--initialUrl', 'http://localhost:8081',
  '-EXDevMenuShowsAtLaunch', 'NO', '-EXDevMenuIsOnboardingFinished', 'YES',
  '-EXDevMenuShowFloatingActionButton', 'NO']` + `app.command` = `npx expo start --port 8081` với
  `readyUrl: 'http://localhost:8081/status'`.
- **1 worker / thiết bị.** Không khai `device` → mọi sim/emulator đã boot + máy thật là pool; một
  `device` → 1 worker; danh sách → pool tường minh. Session MCP / explorer song song → mỗi target 1 `device`.
- Thiết bị thuê: `device: easSimulators({ buildId })` từ `@e2e-dev/eas` (đọc `EXPO_TOKEN`, không cần Xcode/SDK).
- Không có capability `state` → **không** `test.setup`/`session`; đăng nhập trong từng test.
- `selectOption`, `setInputFiles`, `scrollIntoView`, `secondaryTap`, `modifiers` → `UNSUPPORTED_CAPABILITY`.
- Test theo nền tảng: `test('...', { platforms: ['ios'] }, ...)`; suite portable khai `requires: ['device']`.
- React Native iOS: checkbox/radio đọc từ accessibility value; tab là `other` + `selected` → query bằng
  test id/label; `View` thường là lá → scope vào `ScrollView` hoặc gắn test id cho con.

## 10. Xong khi

- `npx e2e run tests/example.e2e.ts` pass với app thật.
- `package.json` có `"test:e2e": "e2e run"`.
- `.gitignore` có output `.e2e/` (init thêm sẵn); bỏ dòng `.e2e/cache/` nếu muốn commit replay.
- CI chạy cả suite, kể cả agent step, trên PR (`running-ci.md`).
