# Explore · MCP · Bug bash

> Nguồn gốc: `skills/e2e/references/explore.md`, `mcp.md`, `bug-bash.md` (tester-army/e2e, Apache-2.0).
> Bản đã cài: `npx e2e guide explore|mcp|bug-bash`.

## Mục lục
1. `e2e explore` — khám phá không cần file test
2. `e2e mcp` — cho coding agent lái app thật
3. Bug bash — nhiều explorer song song + chứng minh bằng repro test

---

## 1. `e2e explore` — khám phá không cần file test

Cho agent chạy trên app với một **mục tiêu** thay vì file test: xem agent làm được gì trước khi có
test, săn regression trên branch, tìm luồng đáng biến thành test. Chỉ cần config có target + agent có model.

```bash
npx e2e explore                                         # goal mặc định: "Explore the app and find bugs"
npx e2e explore 'Explore checkout like a first-time buyer and report anything off'
npx e2e explore --target web --max-steps 4 --headed
npx e2e explore 'Hunt for broken forms' --video
npx e2e explore --session admin 'Explore the admin settings'
```

**Một run làm gì:** mở app → planner (1 model call có cấu trúc) đọc goal + kết quả đến giờ + màn hiện
tại, trả về 1 "charter" cho 1 luồng (hoặc kết luận đã đủ) → chạy charter như một `agent.act()` có thêm
tool `report_finding` (title, `issue`/`warning`, severity 1–5, expected, actual, các bước tái hiện; runner
gắn path + screenshot đã redact) → lặp tới khi planner dừng, hết step, hết giờ, hoặc 3 step liên tiếp
fail/bị chặn mà không báo gì → đánh giá tổng kết.

| Cờ | Mặc định | Tác dụng |
|---|---|---|
| `[goal]` | `Explore the app and find bugs` | 1 câu: khu vực + tư thế |
| `--target <id>` | target đầu tiên | Target cần khám phá |
| `--agent <name>` | `default` | Dựng explorer từ agent khác |
| `--session <name>` | — | Chạy setup lưu session này rồi khám phá ở trạng thái đã đăng nhập |
| `--max-steps <n>` | 8 (1–12) | Số bước khám phá tối đa |
| `--timeout <ms>` | 600000 (180000–900000) | Thời gian thực; phút cuối dành cho đánh giá |
| `--headed`, `--reporter`, `--output`, `--debug`, `--ai-trace`, `--trace`, `--video` | như `run` | Chỉ 1 attempt → mode retry không ghi gì (`CI=1 e2e explore` cần `--trace on`) |

- Budget mỗi bước mặc định 40 action + 40 model call (ghi đè bằng `agents.<name>.maxSteps/maxModelCalls`).
  Cache **tắt**, retries **0**.
- Credentials đã khai được đưa cho explorer như secret của step: agent điền password bằng `type_secret`.
- **Exit code:** `0` = có bước chạy, không `issue` (warning được phép) · `1` = có ≥ 1 `issue`, hoặc không
  bước nào chạy · mọi charter bị chặn → `blocked`, exit = code của blocker đầu (1/2/3).
- Kết quả trong `report.json` → `run.explore` (`goal`, `budgets`, `ended`, `summary`, `steps[]`,
  `findings[]` với `kind`, `severity`, `expected`, `actual`, `reproduction`, `path`, `artifactId`).
  Severity: critical 5 · high 4 · medium 3 · low 2 · trivial 1.
- **Finding là lời khẳng định của model + bằng chứng, chưa phải bug đã tái hiện.** Đọc `actual` đối chiếu
  screenshot trước khi báo. Biến finding thành test: `reproduction` → `agent.act()`/`screen.*`, `expected` → assertion.

## 2. `e2e mcp` — cho coding agent lái app thật

`e2e mcp` phục vụ app đang chạy cho coding agent qua MCP (stdio): nhìn màn hình trước khi viết test, thử
locator trước khi commit. Chạy test và đọc run fail vẫn ở CLI. **Không cần model** cho phần deterministic.

```bash
claude mcp add e2e -- npx e2e mcp      # Claude Code
```

```json
{ "mcpServers": { "e2e": { "command": "npx", "args": ["e2e", "mcp"] } } }
```

(`.mcp.json` cho Claude Code, `.cursor/mcp.json` cho Cursor, `.vscode/mcp.json` cho VS Code.) Cờ:
`--config`, `--target`, `--headed`, `--max-sessions <n>` (mặc định 4, 1–16).

**4 tool:** `open_session` (load config, bật app command, boot engine, mở app, trả session id + catalog +
quan sát đầu) · `tools` (catalog; `tools {tool}` xem schema) · `call` (chạy 1 tool trong catalog:
`call {tool: "tap", args: {target: "n42"}}`) · `close_session`.

**Catalog mỗi session:** `observe` (1 node/dòng `#id role "name"` + path) · các động từ `tap`, `type`,
`press`, `select`, `check`, `scroll`, `scroll_to`, `drag`, `upload`, `navigate`, `back`… · `type_secret` ·
**`locate`** (thử 1 locator: đúng 1 trong `role`/`text`/`label`/`placeholder`/`testId`, trả số match +
**dòng `screen.*` cần viết**) · `screenshot` · nhóm `*_at` theo toạ độ · `start_recording`/`stop_recording`
· tool của project (`defineTool`, `mobileTools`).

**Vòng lặp explore → viết test:**
1. `open_session` → `call {tool: "observe"}` → thao tác tới màn cần test. Node id chỉ hợp lệ với lần
   observe mới nhất.
2. `call {tool: "locate", args: {...}}` cho **từng** locator định viết. 1 match → dùng dòng `screen.getByRole(...)`
   được in ra; 0 hoặc nhiều → chỉnh trước khi viết (nếu không test sẽ `LOCATOR_NOT_FOUND`/`LOCATOR_AMBIGUOUS`).
3. Viết `tests/<feature>.e2e.ts`: bước deterministic ở chỗ đã thấy tên chính xác, `agent.act` ở chỗ luồng biến đổi.
4. Chạy từ shell: `npx e2e run tests/<feature>.e2e.ts`, đọc lỗi, sửa, lặp.
5. `close_session` khi xong (idle 30 phút tự đóng, tối đa 4 giờ).

**Luật:**
- Session không ghi thành test, không ghi vào cache — chỉ để nhìn và thử.
- Run từ shell và session chỉ dùng chung app nếu `app.command` có `reuseExisting` (CI bỏ qua) — nếu
  không, đóng session trước khi chạy.
- Subagent song song dùng chung 1 server: mỗi subagent **tự mở session** và truyền session id vào mọi
  `tools`/`call`/`close_session`. Mobile: 1 target / 1 thiết bị.
- Video không được che → không để secret trên màn khi quay. Sau khi điền secret, `screenshot` và tool
  toạ độ trả `PIXEL_TAINTED` → thao tác theo node id.
- Lỗi thường gặp: `TARGET_REQUIRED`, `UNKNOWN_TARGET`, `NO_SESSION`, `SESSION_REQUIRED` (nhiều session
  mở → truyền `session`), `SESSION_OPEN` (hết slot), `CONFIG_IN_USE`, `UNKNOWN_TOOL`.

## 3. Bug bash — nhiều explorer song song + chứng minh bằng repro test

**Nguyên tắc:** chỉ báo **bug đã xác nhận**, mỗi bug kèm **repro test đang fail**. "Explorer báo" ≠ "đã xác nhận".

### 3.1 Chuẩn bị
- Config có target + agent có model + auth provider.
- App phải phục vụ nhiều explorer cùng lúc: bật 1 lần + `reuseExisting: true`, **hoặc** URL port `0`
  để mỗi run tự bật app trên port trống. (`CI` set → `reuseExisting` bị bỏ qua → dùng port 0.)
- `app.command` tự dựng stack riêng (DB tự xoá khi thoát) → explorer xong đầu tiên xoá DB của người khác.
  Tự bật stack 1 lần, dùng config bug-bash **không có command**.
- Ưu tiên **production build**: dev server compile route lần đầu trông như link chết.
- Seed **1 workspace/tài khoản riêng cho mỗi charter** (`bb-<slug>`), khai làm credential — dùng chung
  account thì explorer báo thay đổi của nhau là bug.
- Ghi vào `context` những gì app local không làm được (không gửi email, không có AI key, không bao giờ bấm
  thanh toán thật) + điểm mù của explorer (link tab mới, lazy-load ảnh, sentinel infinite scroll).
- **Site đã deploy người khác đang dùng = CHỈ ĐỌC:** không signup/signin/submit, không chuỗi giống
  injection trong URL, không request lặp. Bị WAF chặn là firewall làm đúng việc, không phải finding.
- Mỗi bước khám phá cần ≥ 40 `maxSteps` + `maxModelCalls` trên agent.
- Bỏ `--headed`; `--video` cho mỗi run một bản replay.

```ts
// e2e.bugbash.config.ts — để untracked
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { gateway } from 'ai';
import base from './e2e.config.ts';

const shared: E2EConfig = base;
const context =
  'Sign in with the credential the goal names. The local app sends no email and has no AI key. Never start a paid run or connect an integration. ' +
  'Not bugs: a link that opens a new tab leaves this one unchanged; images lazy-load, so scroll and wait before calling one blank.';
const persona = { model: gateway('openai/gpt-6-luna-fast'), maxSteps: 40, maxModelCalls: 40, context };

export default {
  ...shared,
  tests: [shared.tests ?? 'tests/**/*.e2e.ts', 'tests/bugbash/**/*.e2e.ts'].flat(),
  targets: [{ name: 'web', engine: web(), app: { url: 'http://127.0.0.1:3000' } }], // app đã chạy: không command
  retries: 0,
  reporters: ['list'],
  credentials: {
    ...shared.credentials,
    'bb-cart': { username: 'bb-cart@example.test', password: process.env.BUGBASH_PASSWORD ?? '' },
    'bb-account': { username: 'bb-account@example.test', password: process.env.BUGBASH_PASSWORD ?? '' },
  },
  agents: {
    default: persona,
    skeptic: { ...persona, system: 'Distrust every number, date, count, and claim on screen; cross-check each against every other place it appears.' },
    fuzzer: { ...persona, system: "At every input, run the goal's input matrix before anything else, judging each entry before the next. Never take the happy path." },
  },
} satisfies E2EConfig;
```

Set `BUGBASH_PASSWORD` (≥ 6 ký tự) trước; thêm `--config e2e.bugbash.config.ts` cho mọi lệnh.

### 3.2 Lên charter (5–10 cái, mỗi cái 1 khu vực + 1 tư thế + 1 câu, nêu route bắt đầu)

| Tư thế | Charter mẫu | Persona |
|---|---|---|
| Người dùng mới | `Starting at /signup, sign up and complete onboarding like a first-time user; report anything confusing, broken, or inconsistent` | default |
| Số liệu & copy | `Starting at /cart, change quantities and apply a coupon; check every price, total, and label against the rest of the page` | skeptic |
| Input biên | `Starting at /settings/profile, submit each field empty, a 300-character value, unicode, and leading spaces; report validation that is missing or wrong` | fuzzer |
| State | `Starting at /projects, create, rename, and delete a project, reloading and going back after each; report state that is lost or stale` | default |
| Đường lỗi | `Starting at /login, try a wrong password, an unknown account, and a locked account; report errors that are missing, misleading, or leak detail` | skeptic |

Branch: đọc `git diff --stat` so với base để chọn khu vực.

### 3.3 Fan out (job shell chạy nền, 4 cái một lúc — không dùng subagent cho bước này)

```bash
mkdir -p .e2e/bugbash
cat > .e2e/bugbash/charters.txt <<'CHARTERS'
cart|web|skeptic|Starting at /cart, change quantities and apply a coupon; check every price, total, and label against the rest of the page
account|web|fuzzer|Starting at /settings/profile, submit each field empty, a 300-character value, unicode, and leading spaces; report validation that is missing or wrong
CHARTERS
while IFS='|' read -r slug target agent charter; do
  [ -n "$slug" ] && printf '%s\0%s\0%s\0%s\0' "$slug" "$target" "$agent" "$charter"
done < .e2e/bugbash/charters.txt | xargs -0 -n 4 -P 4 sh -c \
  'npx e2e explore "$4" --config e2e.bugbash.config.ts --target "$2" --agent "$3" --output ".e2e/bugbash/$1" --max-steps 6 --video --reporter list,markdown < /dev/null > ".e2e/bugbash/$1.log" 2>&1' _
```

Thêm `.e2e/bugbash/` vào `.gitignore` (init không thêm sẵn). Exit 1 = có issue (đọc log); 2/3 = lỗi
setup/môi trường → sửa rồi chạy lại charter đó.

### 3.4 Gộp → 3.5 Phân loại → 3.6 Xác minh → 3.7 Báo cáo

- **Gộp:** cùng path + cùng hành vi hỏng = 1 defect; giữ repro rõ nhất + mọi charter đã gặp. Warning để danh sách riêng.
- **Phân loại (đọc source để quyết):**

| Nhóm | Dấu hiệu | Kết luận |
|---|---|---|
| Artifact của explorer | Link `target="_blank"` "chết" nhưng mở được trực tiếp, câu "vỡ" nhưng screenshot nguyên vẹn, sentinel "Loading more", ảnh lazy-load | Loại (nêu check đã làm) — xử lý nhóm này trước |
| Môi trường | Chỉ fail vì thiếu key/dịch vụ/giới hạn của stack local | Loại (nêu biến/dịch vụ); ghi riêng nếu app xử lý lỗi tệ theo cách user prod sẽ thấy |
| Thiết kế | Code/test/copy cho thấy hành vi là cố ý | Loại (trích nơi) |
| Fixture | Seed data thiếu field mà record thật luôn có | Loại (nêu field) |
| **Ứng viên** | Không thuộc các nhóm trên | → Xác minh |

- **Xác minh** (có subagent: 1 subagent/khu vực, 3–5 ứng viên, tối đa 4 song song = giới hạn session MCP mặc định):
  1. Đọc `actual` đối chiếu screenshot/video; bằng chứng mâu thuẫn → loại.
  2. Viết repro test theo `reproduction`, assert **hành vi đúng** → fail hôm nay, pass khi bug được sửa.
     Đặt trong `tests/bugbash/<slug>.e2e.ts` (phải nằm trong glob `tests`), tag `{ tags: ['bugbash'] }`,
     ưu tiên `screen` + `expect` giá trị chính xác.
  3. Lấy locator chính xác qua `e2e mcp` (`open_session` với config bug-bash, `locate` từng locator).
  4. Chạy riêng file. **Xác nhận chỉ khi fail `ASSERTION_FAILED` đúng ở assertion mã hoá bug.** Lỗi khác
     (`LOCATOR_NOT_FOUND`, timeout, setup) = test sai → sửa test. Test pass = bug không tái hiện → loại,
     chuyển test ra `.e2e/bugbash/extra-tests/`.
- **Báo cáo:** bug đã xác nhận trước (nặng nhất trước): tiêu đề, path, expected vs actual 1 dòng, root
  cause (`file:line` nếu biết), các bước, screenshot/video, repro test, charter đã gặp → ứng viên môi
  trường có rủi ro prod (đánh dấu chưa xác minh) → finding bị loại theo lý do → warning → charter đã
  chạy, chi phí, vùng chưa charter nào chạm.
- Repro test fail cho tới khi bug được sửa: gating run loại chúng (`--exclude-tag bugbash`) hoặc để
  uncommitted. Sửa bug → repro chuyển xanh = bằng chứng, giữ làm regression test (bỏ tag `bugbash`).
- Để nguyên file project: config bug-bash, seed script, repro test **untracked** cho tới khi user bảo
  khác; tắt stack đã bật khi user xong.
