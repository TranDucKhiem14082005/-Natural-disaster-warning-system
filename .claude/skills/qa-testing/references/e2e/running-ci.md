# Chạy test, report & CI

> Nguồn gốc: `skills/e2e/references/running.md` + `docs/github.mdx` (tester-army/e2e, Apache-2.0).
> Bản đã cài: `npx e2e guide running`.

## Mục lục
1. Lệnh CLI
2. Cờ của `run`
3. `list` — xem trước sẽ chạy gì
4. Cache CLI
5. Output & reporter
6. Exit code
7. Chế độ CI
8. GitHub Actions (kèm PR comment)
9. Chia shard & tối ưu chi phí CI

---

## 1. Lệnh CLI

```bash
npx e2e run [files...] [options]   # chạy test
npx e2e explore [goal] [options]   # khám phá app tới một mục tiêu, không cần file test
npx e2e list [files...] [options]  # in ra những gì run sẽ chọn
npx e2e init [directory] [--yes]   # scaffold, làm mới skill/MCP sau khi nâng cấp
npx e2e guide [topic]              # in skill gốc: setup, writing-tests, agent, running, explore, debugging, mcp, bug-bash
npx e2e cache ls|clear|stats       # xem / xoá replay cache
npx e2e login|logout|models [provider]  # login subscription: openai, github-copilot, opencode-console, spacexai
npx e2e mcp [--target <name>]      # MCP server cho coding agent
npx e2e feedback -m <text> [opts]  # báo lỗi về chính e2e (hỏi user trước)
npx e2e telemetry [disable|enable] # telemetry ẩn danh
```

**Bẫy script:** với `"test:e2e": "e2e run"`, pnpm chuyển `--` nguyên văn → `pnpm test:e2e -- --headed`
thành `run -- --headed` và **exit 2**. Viết `pnpm test:e2e --headed` hoặc `pnpm exec e2e run --headed`;
npm: `npm exec -- e2e run --headed`.

## 2. Cờ của `run`

| Cờ | Tác dụng |
|---|---|
| `[files...]` | File, thư mục, glob (có quote), hoặc tên trần (`signup` chọn `tests/agent/signup.e2e.ts`); `file:line` = test có `test(` mở ở dòng đó. Chỉ **thu hẹp** glob `tests`, không vượt qua. |
| `--config <path>` | File config (mặc định `e2e.config.ts`/`.mts`, tìm ngược lên). |
| `--target <ids>` | Chỉ các target này (và chỉ chúng bật app command). |
| `--tag`, `--tag-mode all`, `--exclude-tag` | Lọc theo tag. |
| `--grep`, `--grep-invert` | Lọc theo title (describe + test nối bằng dấu cách), regex. |
| `--last-failed` | Chỉ test lần trước chưa pass/chưa chạy (cần `.e2e/report.json`, không có → `NO_LAST_RUN`). |
| `--shard <i/n>` | Một lát liên tục của test đã chọn (`--shard 2/3`). |
| `--headed` | Hiện browser/simulator. |
| `--agent <names>` | Chạy test chưa ghim bằng agent khác (nhiều tên = mỗi test chạy mỗi agent). |
| `--workers <n>`, `--retries <n>` | Ghi đè (retries 0–10, workers 1–1024). |
| `--max-failures <n>` | Dừng sau n fail (phần còn lại skip). |
| `--repeat-each <n>` | Chạy mỗi test n lần (đo flaky; thêm `--no-cache` nếu không các lần sau replay lần đầu). |
| `--reporter <ids>` | `list`, `json`, `junit`, `markdown` (`json` không đi với `list`). |
| `--output <dir>` | Thư mục kết quả cho run này. |
| `--no-cache` / `--strict-cache` | Tắt cache / fail `REPLAY_STALE` khi bản ghi đã commit không replay được. |
| `--pass-with-no-tests` | Exit 0 thay vì `NO_TESTS`. |
| `--debug`, `--ai-trace` | Bảng step + transcript / ghi mọi model call vào `ai-trace.json`. |
| `--trace [mode]`, `--video [mode]` | Ghi trace/video (bare = `on`; viết `--video=<mode>` vì cờ "tham lam"). |

```bash
npx e2e run tests/signup.e2e.ts
npx e2e run signup.e2e.ts:12          # test khai báo ở dòng 12
npx e2e run tests/agent --tag smoke --exclude-tag slow --grep checkout
npx e2e run --last-failed             # vòng lặp sau một run đỏ
npx e2e run --shard 2/3               # 1 job CI trong 3
CI=1 npx e2e run                      # tái hiện mặc định CI ở local
```

## 3. `list` — xem trước sẽ chạy gì

Cùng cờ chọn lọc như `run`, in 1 dòng/cặp test-target (`file › title [target] #tag`, cặp bị skip có
`(skipped: <reason>)`), **không** bật app/engine/worker. `--reporter json` in `{ "pairs": [...] }`.

```bash
npx e2e list tests/signup.e2e.ts --tag smoke --reporter json
```

## 4. Cache CLI

| Lệnh | In ra |
|---|---|
| `e2e cache ls` | 1 dòng/entry: test, target, digest instruction, tuổi, số action |
| `e2e cache stats` | Thư mục, số entry, tổng dung lượng |
| `e2e cache clear` | Xoá entry + thư mục (file runner không ghi thì giữ) |

`cache.store` tuỳ biến → các lệnh này từ chối (exit 2), dùng công cụ của store đó.

## 5. Output & reporter

`<output>` (mặc định `.e2e`) chứa `report.json`, `junit.xml`, `summary.md`, `failures/`,
`ai-trace.json`, `sessions/`, `artifacts/` (screenshot, Playwright trace, video, transcript `--debug`,
download). `artifacts/` bị xoá khi test của run bắt đầu; rerun `--last-failed` ghi vào `artifacts/rerun-<n>/`.

| Reporter | Cho ra |
|---|---|
| `list` (mặc định) | Setup, 1 dòng/file+target, mục `Failed Tests` (lỗi, code, dòng, code frame), hàng tổng: `Test Files`, `Tests`, `AI`, `Cache`, `Repeats`, `Errors`, `Duration`, `Report` |
| `report.json` (luôn ghi) | `run.status`, `run.exitCode`, `run.errors[]`, `run.results[]` (titlePath, file, tags, agent, status, attempts[].steps[], artifacts[], error), `run.summary` |
| `junit` | `junit.xml` cho CI (`--reporter list,junit` giữ output terminal) |
| `markdown` | `summary.md` + 1 trang/test fail hoặc flaky trong `failures/` — **đọc trang này trước**, dán summary vào PR |
| `json` | Report ra stdout |
| `github()` (`@e2e-dev/github`) | 1 comment PR/run (sửa lại khi rerun) + job summary |

## 6. Exit code

| Code | Nghĩa | Retry job? |
|---:|---|---|
| 0 | Mọi test chọn đều pass / flaky / skip | — |
| 1 | Test hoặc setup test fail / timeout | Không — sửa test/app |
| 2 | Lỗi CLI, config, collection, credential, model-config, policy | **Không bao giờ** (deterministic) |
| 3 | Engine, app process, model provider, artifact, cleanup | **Có** — chỉ code này đáng retry ở cấp job |
| 4 | Lỗi nội bộ runner | Báo lỗi e2e |
| 130 | Bị signal ngoài ngắt | — |

Code cao nhất thắng (`130 > 4 > 3 > 2 > 1 > 0`). SIGINT/SIGTERM lần 1: ngắt + ghi report; lần 2: ép
teardown engine; lần 3: kill nhóm tiến trình app, exit 130.

## 7. Chế độ CI

Bật khi `CI` được set (khác `0`/`false`): `retries` 1, `workers` 1, `trace` `on-first-retry`,
`test.only` → `ONLY_IN_CI`, cache `read-only` (trừ khi config đặt mode tường minh), `reuseExisting` bị bỏ qua.

## 8. GitHub Actions (kèm PR comment)

```ts
// e2e.config.ts — thêm reporter comment PR
import { github } from '@e2e-dev/github';
// ...
reporters: ['list', github()],
```

```yaml
# .github/workflows/e2e.yml
name: e2e
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
  pull-requests: write        # cho github() reporter; bỏ nếu không dùng
concurrency:
  group: e2e-${{ github.ref }}
  cancel-in-progress: true
jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: pnpm/action-setup@9fd676a19091d4595eefd76e4bd31c97133911f1 # v4.2.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 26 # >= 24.8, hoặc >= 22.22.3 trên dòng 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec e2e-web install chromium --with-deps   # bước riêng: tải browser ngoài launchTimeout
      - run: npx e2e run --reporter list,junit
        env:
          AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY }}
          E2E_USER_ADMIN_USERNAME: ${{ secrets.E2E_USER_ADMIN_USERNAME }}
          E2E_USER_ADMIN_PASSWORD: ${{ secrets.E2E_USER_ADMIN_PASSWORD }}
          GITHUB_TOKEN: ${{ github.token }}                  # cho github() reporter
      - if: ${{ !cancelled() }}
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: e2e-report
          path: |
            .e2e/report.json
            .e2e/junit.xml
          if-no-files-found: warn
      - if: ${{ !cancelled() }}
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: e2e-artifacts
          path: .e2e/artifacts
          if-no-files-found: warn
          retention-days: 7
```

- Action được pin theo **commit SHA** (như upstream) — chống supply-chain; giữ nguyên cách pin khi nâng cấp.
- Upload artifact `!cancelled()` để test fail-rồi-pass-khi-retry vẫn giữ bằng chứng. Giữ
  `path: .e2e/artifacts` để link trong comment PR khớp cấu trúc thư mục.
- Bật app qua `app.command` của target — runner tự tắt ở mọi đường thoát.
- **PR từ fork/người ngoài:** không có secret (đúng như mong muốn) → run fail `INVALID_CONFIG` (password
  credential rỗng) hoặc `MODEL_PROVIDER_FAILED`/`CONFIG_LOAD_FAILED` (thiếu key model); `github()` không
  post được vì token của fork chỉ đọc. Không chuyển sang `pull_request_target` để "lấy secret" cho code
  chưa review — code test chạy với quyền OS, không sandbox.

## 9. Chia shard & tối ưu chi phí CI

- **Shard:** matrix `shard: [1, 2, 3]` → `npx e2e run --shard ${{ matrix.shard }}/3`; serial group giữ
  nguyên khối, mỗi shard tự mang setup test của nó. Có `github()` → mỗi entry matrix cần `key` riêng, nếu
  không các shard ghi đè cùng một comment: `github({ key: process.env.SHARD })` + `SHARD: ${{ matrix.shard }}`
  trong `env` của step (giữ key ổn định để rerun cập nhật đúng comment). Đặt tên artifact theo shard.
- **Không trả tiền model cho bước đã verify:** commit `.e2e/cache/` + `--strict-cache` trong CI (bản ghi
  cũ → `REPLAY_STALE`, ghi lại local rồi commit). Bước chưa ghi vẫn chạy live.
- **Mặc định upstream: chạy CẢ suite (kể cả agent step) trên mọi PR.** Chỉ khi chi phí model thật sự là
  vấn đề mới cân nhắc (lệch khuyến nghị upstream): PR chạy `--tag smoke` cho luồng sống còn, cron đêm chạy
  cả suite + `explore` — đánh đổi là regression ngoài nhóm smoke chỉ lộ ra sau merge.
- **Job retry chỉ khi exit 3** (provider/engine), không bao giờ khi exit 2.
- Tách `--reporter list,markdown` khi cần `summary.md` dán vào PR/handoff.
