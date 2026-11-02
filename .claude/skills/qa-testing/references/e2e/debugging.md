# Gỡ lỗi một run fail

> Nguồn gốc: `skills/e2e/references/debugging.md` (tester-army/e2e, Apache-2.0). Bản đã cài:
> `npx e2e guide debugging`. Đường dẫn dưới đây nằm trong `output` (mặc định `.e2e`).

## Mục lục
1. Đọc lỗi theo thứ tự
2. Bảng mã lỗi đầy đủ
3. Công cụ
4. Flaky test
5. Lỗi app hay lỗi test?

---

## 1. Đọc lỗi theo thứ tự

1. Chạy lại với `--reporter list,markdown`: `list` kết thúc bằng mục `Failed Tests`; reporter markdown
   chỉ tới `.e2e/failures/`.
2. Mở trang của test fail trong `.e2e/failures/`, grep `Expected:` / `Observed:` (một `expect`),
   `Asked for:` / `Waited:` (một locator), `Look at:` (dòng code), xem **mọi attempt có fail giống nhau
   không** (giống nhau = bug, không phải flaky), các step, lượt model cuối của step agent fail, và cây
   accessibility lúc fail (1 node/dòng). **Sửa từ những gì thực sự có trên màn hình.**
3. `.e2e/report.json` là nguồn dữ liệu của các trang đó:

```bash
jq '.run | {status, exitCode, errors}' .e2e/report.json
jq '.run.results[] | select(.selected and .status != "passed") | {titlePath, file, status}' .e2e/report.json
jq '.run.results[] | select(.selected and .status != "passed") | .attempts[-1]
    | {status, error, failure, steps: [.steps[] | select(.status != "passed") | {api, label, source, status, error}], artifacts}' .e2e/report.json
```

   `error.details` chứa sự thật, `error.source` là dòng, `failure` có `url`, `screen`, id screenshot và
   `candidates`; step agent fail có `turns`.
4. Artifact trong `.e2e/artifacts/`: `failure/screen.txt` + screenshot mỗi attempt fail; Playwright trace
   (`npx playwright-core@1.63.0 show-trace <file>`, hoặc `pnpm dlx` dưới pnpm); download; video
   (`--video`); transcript từng step agent (`--debug`).

## 2. Bảng mã lỗi đầy đủ

| Code | Nguyên nhân thường gặp | Sửa |
|---|---|---|
| `CONFIG_LOAD_FAILED` | Config ném lỗi khi load, hoặc import gói/subpath/export không tồn tại (vd `defineConfig`) | Cài dependency, sửa import/dòng được trích |
| `INVALID_CONFIG`, `INVALID_GLOB` | Key lạ (`app` ở root, `webServer`, `use`, `projects`, `baseURL`), `json` đi với `list`; glob có ngoặc nhọn/class/path tuyệt đối/không wildcard | Message nêu key/glob cần viết; app khai trong `app` của target |
| `CONFIG_NOT_FOUND`, `CONFIG_AMBIGUOUS` | Sai `--config`; có cả `.ts` lẫn `.mts` | Sửa path; giữ một file |
| `NO_TESTS` | Glob/positional/filter không khớp gì | Kiểm `tests`, đuôi `.e2e.ts`, tên tag |
| `NO_LAST_RUN` | `--last-failed` không thấy report | Chạy 1 lần không có cờ |
| `COLLECTION_ERROR` | `describe` async, `test.setup` trong `describe`, option cấm trong serial, đăng ký ngoài collection | Cấu trúc lại theo `writing-tests.md` |
| `HOOK_FAILED` | `beforeAll`/`afterAll` ném lỗi; test trong scope bị skip | Sửa hook |
| `UNSUPPORTED_ARTIFACT` | `trace`/`video` ở test/target trên engine không ghi được | Bỏ ở đó, hoặc đặt ở root/CLI |
| `BROWSER_INSTALL_FAILED`, `LAUNCH_TIMEOUT` | Tải browser lỗi; init engine quá `launchTimeout` | `npx @e2e-dev/web install <names>` (`--with-deps` trên Linux trần); nâng `launchTimeout` |
| `APP_UNREACHABLE` | `app.command` không trả `readyUrl` trong `startupTimeout`; trên device: runner tự động hoá iOS lỗi | Đọc log trích ra; kiểm port, `url`, `command.env`, `startupTimeout`. Runner: chạy lại, hoặc `npx agent-device daemon stop` + reboot simulator |
| `APP_ALREADY_RUNNING` | Đã có thứ phục vụ `url` | Tắt nó, hoặc `reuseExisting: true` (local) |
| `APP_URL_REQUIRED`, `APP_NOT_OPEN` | Điều hướng trên target không có `app.url`; gọi `screen` trước `app.open()` | Thêm `app.url`; mở app trước |
| `INVALID_ARGUMENT`, `INVALID_LOCATOR` | Tham số step sai; locator có option/filter key sai | Sửa lời gọi trong code frame |
| `LOCATOR_NOT_FOUND` | Sai role/name, text không khớp nguyên văn, ngoài màn hình, trong iframe, chưa mở trang | Đọc markup lấy accessible name; `exact: false`/RegExp; `browser.frameLocator`; `app.open()`; `--headed` |
| `LOCATOR_AMBIGUOUS` | 2 match (bản sao ẩn, label lặp) | `{ name }`, scope container, `filter`, `first()`, `{ visible: true }` |
| `ASSERTION_FAILED` | Kỳ vọng sai, hoặc state ổn định sau > 5 s; với `agent.assert` là phán quyết "sai" (có giải thích) | So với text thực tế/screenshot; `{ timeout }`; viết lại câu hỏi |
| `ASSERTION_INCONCLUSIVE` | `assert`/`extract` hỏi thứ màn hình không hiển thị (trang khác, đang load, chỉ ở pixel) | `app.open()`/`agent.waitFor` tới đúng màn; hỏi thứ đang hiện; `vision: true` |
| `MODEL_OUTPUT_INVALID` | Câu trả lời `extract`/`assert` sai schema sau 1 vòng sửa | Đơn giản hoá schema/câu hỏi; model mạnh hơn |
| `ACTION_FAILED` | Element không thao tác được (bị che, disabled, tách khỏi DOM), hoặc thao tác timeout | `expect` điều kiện trước; đóng overlay; kiểm `actionTimeout` |
| `TEST_TIMEOUT` | Attempt quá `timeout` (120 s) | Tách test, hoặc nâng `timeout` |
| `STEP_NOT_AWAITED` | Thân/hook trả về khi step hoặc `expect.poll` còn chạy | `await` đúng lời gọi trong code frame |
| `MODEL_UNAVAILABLE` | `agents.<name>.model` không phải instance AI SDK; thiếu gói `ai` | Tạo instance (vd `gateway('openai/gpt-6-luna-fast')`), export key; `npm i -D ai` |
| `MODEL_PROVIDER_FAILED` | Mạng, 5xx, rate limit, hết credit, không phản hồi 120 s | Kiểm key/quota (gateway không key: login Vercel CLI + `.vercel/project.json`); retry (exit 3) |
| `REPLAY_STALE` | `--strict-cache`/`cache.strict` + bản ghi đã commit không replay được | Chạy lại read-write không có cờ strict, commit entry mới |
| `AUTOMATION_UNSUPPORTED` | Step cần thao tác engine không có (drag trên device…) | Làm bước đó bằng `screen`, hoặc target khác |
| `STEP_TIMEOUT`, `STEP_BUDGET_EXHAUSTED` | Goal quá to/mơ hồ, provider chậm | Chia goal, dùng chữ trên màn, thêm `context`; nâng `maxSteps`/`maxModelCalls`/`timeout`/`judgmentTimeout`; `--debug` |
| `CONTEXT_OVERFLOW` | Màn hình + lịch sử step vượt context window | Hạ `maxObservationBytes`, chia step, model window lớn hơn |
| `POLICY_DENIED` | URL scheme không phải http(s) (`file:`, `data:`, `view-source:`); password `Secret` vào ô không phải password; đọc ô bảo mật (kể cả `toHaveValue`/`toHaveText`/`toContainText`/`toHaveAttribute`); `app.screenshot()` sau khi điền secret | Chỉ http(s)/`about:blank`; password chỉ vào ô password; assert kết quả, không assert giá trị; chụp trước khi điền |
| `UNSUPPORTED_CAPABILITY` | Fixture engine không có (`browser` trên device), `schema`/`vision` trên `act`, action không có | Khai `requires: ['browser']`; bỏ option/action |
| `SESSION_UNAVAILABLE`, `SESSION_CONTRACT` | `session: 'x'` mà không setup nào lưu `x`; setup bỏ sót tên đã khai | Thêm/sửa `test.setup` |
| `SESSION_MISMATCH`, `SESSION_EXPIRED`, `SESSION_INVALID` | Session của run/app khác, hết hạn, hỏng | Chạy lại setup |
| `ONLY_IN_CI` | `test.only` vào CI | Xoá |
| `AUTH_CREDENTIAL_UNAVAILABLE`, `AUTH_CREDENTIAL_INVALID` | `credentials.user('x')` chưa khai; app từ chối credential | Thêm vào `config.credentials`; sửa giá trị |
| `SECRET_UNAVAILABLE` | `secrets.get('x')` chưa khai | Thêm vào `config.secrets` (`E2E_SECRET_X` chỉ ghi đè cái đã khai) |

## 3. Công cụ

| Làm | Khi nào |
|---|---|
| `--headed` | Xem bước fail diễn ra |
| `--workers 1 --retries 0` | Loại song song + retry khỏi bức tranh |
| `--no-cache` | Loại trừ replay `act` cũ |
| `--debug` | Thời lượng, model call, chi phí, transcript từng step agent |
| `--ai-trace` → `npx unbox-ai runs .e2e/ai-trace.json` | Model đã thấy gì, gọi gì |
| `--video`, `--video=retain-on-failure` | Xem lại attempt fail (`step.startedAt` − `startedAt` của segment = offset) |
| `command.log: '.e2e/logs/app.log'` | Output app khi không lên được hoặc lỗi giữa test |
| `await app.screenshot('before-submit')` | Bằng chứng trước khi điền secret |
| `CI=1 npx e2e run` | Tái hiện hành vi chỉ có ở CI |

## 4. Flaky test

- Read (`textContent()`, `count()`) bắt giá trị giữa lúc cập nhật → dùng matcher.
- Dữ liệu dùng chung → tên duy nhất/run, `afterEach` dọn, hoặc group `serial`.
- App chưa sẵn sàng → assert trên element **sắp dùng**, không phải trang trước.
- `agent.assert` so câu chữ chính xác → judge sự thật + thêm `expect` deterministic bên cạnh.
- Thời gian tải → `retries` chỉ **che**; `--workers 1 --headed` mới **thấy**.
- **Đo một bản sửa:** `npx e2e run <file> --repeat-each 10 --retries 0` (`--no-cache` nếu có agent step).
  Hàng `Repeats` trước: `0 of 1 test passed all 10 runs` (`3/10 passed · repeat 0 ASSERTION_FAILED …`),
  sau khi sửa: `1 of 1 test passed all 10 runs`.

## 5. Lỗi app hay lỗi test?

- Step deterministic fail **mọi lần, cùng chỗ, cùng code** → bug sản phẩm hoặc màn hình đã đổi, không
  phải flaky: tái hiện 1 lần với `--headed`, rồi sửa app **hoặc** cập nhật locator + expectation cùng lúc.
- Step agent bị **chặn** (`AUTH_CREDENTIAL_UNAVAILABLE`, `ENVIRONMENT_UNAVAILABLE`, `SEED_DATA_MISSING`)
  cố ý exit 2/3 → sửa **môi trường**, không sửa test.
- Không bao giờ "sửa" bằng cách nới assertion cho pass, tăng `retries`, hay thêm sleep.
