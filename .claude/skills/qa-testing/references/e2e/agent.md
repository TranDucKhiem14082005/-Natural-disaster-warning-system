# Bước agent (`agent.*`)

> Nguồn gốc: `skills/e2e/references/agent.md` + `docs/models.mdx`, `docs/tools.mdx`, `docs/security.mdx`
> (tester-army/e2e, Apache-2.0). Bản đã cài: `npx e2e guide agent`.

## Mục lục
1. Cấu hình model
2. Chọn agent / persona
3. `act` — một mục tiêu
4. `assert`, `waitFor`, `extract` — một câu hỏi
5. Viết instruction model làm được
6. Model thấy gì (và không thấy gì)
7. Budget & chi phí
8. Replay cache
9. Soi xem model đã làm gì
10. "Độ" agent cho app của bạn (thứ tự tinh chỉnh)
11. Tools tự viết & executor
12. Trong CI

---

`agent` là fixture như `screen`. Mỗi lần gọi là **một phiên có giới hạn**: quan sát mới đã redact,
deadline riêng, budget model call riêng, **không** chia sẻ transcript. Không có bước agent → không gọi model.

## 1. Cấu hình model

Đặt **instance** model AI SDK dưới `agents.default` (mọi provider AI SDK hỗ trợ tool call, spec v2+:
`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/amazon-bedrock`,
`@openrouter/ai-sdk-provider`, `ollama-ai-provider-v2`, `@ai-sdk/openai-compatible`…).

```ts
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { gateway } from 'ai';

export default {
  targets: [{ engine: web(), app: { url: 'http://127.0.0.1:3000' } }],
  agents: {
    default: { model: gateway('openai/gpt-6-luna-fast') },
    careful: { model: gateway('anthropic/claude-sonnet-5') },   // chạy: npx e2e run --agent careful
  },
} satisfies E2EConfig;
```

- Truyền **instance**, không phải string (`INVALID_CONFIG`).
- Mỗi entry là object phẳng gồm: `model`, `judge`, `system`, `context`, `tools`, `maxSteps`,
  `maxModelCalls`, `judgmentTimeout`, `maxObservationBytes`, `maxInputTokens`, `providerOptions`,
  hoặc `executor`. **Không kế thừa** `model`/`context` từ `default`.
- `model` lái `act`; judgment dùng `judge` nếu có, không thì `model`. Vd model nhanh cho act + model
  cẩn thận làm judge: `{ model: gateway('openai/gpt-6-luna-fast'), judge: gateway('anthropic/claude-sonnet-5') }`.
- `context` = **từ vựng app** (gửi cho mọi model call, kể cả judge). `system` = **cách agent làm việc**
  (chỉ vòng act đọc). `agentContext` trên test/group bổ sung thêm.
- Thiếu model → `MODEL_UNAVAILABLE` (exit 2) khi test đầu tiên lấy `agent`; sai auth → `MODEL_PROVIDER_FAILED`
  ở lần gọi đầu (hoặc `CONFIG_LOAD_FAILED` nếu provider đọc key lúc load).
- Decision model (`@e2e-dev/decision`): đặt `decisionExecutor({...})` dưới `executor` — model chọn từ
  các lựa chọn executor dựng. Xem `docs/decision-models.mdx`.

**Dữ liệu & compliance:** input model = màn hình đã redact + instruction + screenshot agent xin. e2e
không đọc lại gì từ provider sau response. OpenAI/Azure: mọi request gửi `store: false`. Anthropic
theo BAA: gọi thẳng `@ai-sdk/anthropic` (không qua gateway/OpenRouter), để `judge` trống để một thoả
thuận phủ mọi request. Dữ liệu không được ra ngoài → model local.

## 2. Chọn agent / persona

- `e2e run --agent buyer` → dùng agent khác cho test chưa ghim.
- `{ agent: 'buyer' }` trên test/group ghim agent; `{ agent: ['buyer', 'admin'] }` chạy mỗi test 1 lần/agent.
- `--agent buyer,admin` chạy test chưa ghim cho cả hai; thu hẹp list đã ghim, không thay ghim.
- `{ agent: 'name' }` trên một lời gọi `agent.*` ghi đè cho riêng lời gọi đó.
- Persona đã đăng nhập: ghép agent + `session` trong một `describe` lặp theo persona; cache khoá theo
  agent + context nên mỗi persona ghi/replay riêng.

## 3. `act` — một mục tiêu

```ts
import { credentials } from 'e2e';

await agent.act('add a todo named "Buy milk" and mark it done');
await agent.act('invite {email} as an editor', { params: { email: 'ada@example.test' } });

const member = credentials.user('member');
await agent.act('sign in with the given credentials', {
  params: {
    username: member.username,
    password: member.password, // Secret: model chỉ thấy tên, runner tự điền
  },
});
```

- Pass → trả `summary`, `modelCalls`, `actions`, `cache`. Fail/bị chặn → ném `AgentError` có `code`:
  - Lỗi sản phẩm: `ACTION_FAILED`.
  - Hết chỗ: `STEP_BUDGET_EXHAUSTED`, `STEP_TIMEOUT`, `CONTEXT_OVERFLOW`.
  - Bị chặn từ ngoài: `AUTH_CREDENTIAL_UNAVAILABLE`, `AUTH_CREDENTIAL_INVALID`, `SECRET_UNAVAILABLE`,
    `ENVIRONMENT_UNAVAILABLE`, `SEED_DATA_MISSING`, `TEST_SETUP_FAILED`, `AUTOMATION_UNSUPPORTED`, `POLICY_DENIED`.
  - Model trả rác: `MODEL_OUTPUT_INVALID`.
- Options: `params` (giá trị instruction nhắc tới; `Secret` được runner điền; giá trị đổi mỗi run như
  timestamp/email mới **phải bọc `unique()`** — `import { unique } from 'e2e'` — nếu không cache miss mọi
  run; giữ lựa chọn làm đổi luồng như tên gói là param thường), `timeout`,
  `maxSteps` (25), `maxModelCalls` (25) — chỉ được **hạ**, không nâng (`INVALID_ARGUMENT`).
- `act` **không** có `schema` (dùng `extract`) và **không** có `vision` (model tự xin pixel khi cần).
- Tool agent có: `observe`, `tap`, `double_tap`, `long_press`, `right_click`, `hover`, `type`, `press`,
  `select`, `check`, `scroll`, `scroll_to`, `drag`, `upload` (file trong project; ngoài/ẩn như `.env`
  → `POLICY_DENIED`), `navigate`, `back`, `type_secret`, `screenshot`, nhóm `*_at` theo toạ độ,
  `dismiss_keyboard` (device). Gọi tên target **như màn hình gọi**; agent tự chọn động từ.

## 4. `assert`, `waitFor`, `extract` — một câu hỏi

```ts
import { z } from 'zod';

await agent.assert('the dashboard shows a trial badge');              // 1 lần nhìn, 1 phán quyết

await agent.waitFor('the export finished and a download link appeared', { // poll
  interval: 500,
  timeout: 120_000,
});

const data = await agent.extract('every todo title and how many remain', {
  schema: z.object({ titles: z.array(z.string()), remaining: z.number().int() }),
});
expect(data.titles).toContain('Buy milk');
```

- `assert` **không poll**. Sai → `ASSERTION_FAILED` kèm giải thích + screenshot; màn hình không đủ để
  kết luận → `ASSERTION_INCONCLUSIVE` (cũng là fail) → tới đúng màn trước rồi hỏi về thứ đang hiển thị.
- Judgment chỉ thấy câu hỏi + màn hiện tại, **không** thấy các bước trước. Output hỏng được sửa 1 vòng,
  rồi `MODEL_OUTPUT_INVALID`.
- `waitFor` quan sát mỗi `interval` (mặc định 3 s), chỉ phán khi màn đổi; quá `timeout` (30 s) → `STEP_TIMEOUT`.
- `extract` nhận mọi Standard Schema; model thấy **hình dạng** schema, không thấy luật giá trị (min/max/
  pattern) — luật đó kiểm cái model đọc. Dữ liệu không có trên màn → `ASSERTION_INCONCLUSIVE` (không bao
  giờ `""`/`0`). Chấp nhận vắng mặt: hỏi rõ + `.nullable()` (`'the phone, or null when none is shown'`).
- `vision`: `false` (mặc định, chỉ cây) · `true` (cây + screenshot đã che) · `'only'` (chỉ ảnh — cho
  overlay, layout vỡ, biểu đồ; pixel không chứng minh được đã che → `POLICY_DENIED`).

## 5. Viết instruction model làm được

- **Một goal / `act`**. Thứ tự goal là của test, đường đi là của model.
- **Dùng chữ trên màn hình**: `'open the Billing tab'`, không `'upgrade'` chung chung.
- **Giá trị qua `params`**, không viết thẳng: `act('rename to {name}', { params })`.
- **Đừng mô tả cơ chế** runner đã lo: chờ, cuộn, retry.
- **Chốt mọi `act` ngay sau** — check đó cho phép cache ghi và làm test độc lập với model:

```ts
await agent.act('create a workspace named "Atlas" on the Pro plan');
await expect(screen.getByRole('status')).toHaveText('Created "Atlas" on the Pro plan');
```

- State ngoài màn hình (row DB) có thể tới sau khi `act` trả về → `expect.poll`, không sleep.
- Instruction tiếng Việt chạy được nếu UI tiếng Việt, nhưng **trích đúng nhãn màn hình** (`'mở tab "Thanh toán"'`).

## 6. Model thấy gì (và không thấy gì)

**Thấy:** snapshot màn hình đã redact (role, name, text, state, test id, link target — query/fragment
chỉ hiện `?…`/`#…`), URL đã redact, tóm tắt bước trước (chỉ `act`), context của bạn; pixel khi judgment
có `vision` hoặc vòng act xin `screenshot` (đã che, bị giữ lại sau khi điền secret).

**Không bao giờ thấy:** HTML thô, cookie, header, giá trị env, giá trị `Secret` (thành `<secret:name>`),
giá trị ô password (`value=<secure>`).

Không gì model trả về được chạy như code hay selector: runner validate + authorize mọi tool call. Nội
dung app là **bằng chứng không tin cậy** — không thể cấp tool, credential hay budget. (Redact có giới hạn
với giá trị đã biến đổi, ảnh, log app.)

## 7. Budget & chi phí

| Lời gọi | Model call | Timeout mặc định |
|---|---:|---|
| `act` | ≤ `agents.<name>.maxModelCalls` (25) | `timeout` của config (120 s) |
| `assert` | 2 | 30 s |
| `extract` | 2 | 30 s |
| `waitFor` | ≤ `maxModelCalls` (25) | 30 s |

- Model chậm: nâng `timeout` của step/test (cho `act`), `judgmentTimeout` (judgment), `actionTimeout` (UI chậm).
- `STEP_TIMEOUT`/`STEP_BUDGET_EXHAUSTED` → **chia nhỏ goal trước**, nâng budget sau.
- `--debug`: thời gian từng phase + bảng mỗi step (thời lượng, model call, token, tỷ lệ cache, chi phí).

## 8. Replay cache

`act` pass → lưu thao tác **khi một verification phía sau pass**; run sau phát lại không gọi model, và
agent live tiếp quản từ màn hiện tại nếu app/kết quả cuối không còn khớp. `assert`/`waitFor`/`extract`
**không bao giờ** được cache.

- Mặc định `read-write`, CI `read-only`, tắt bằng `cache: 'off'`/`--no-cache`. Entry ở `.e2e/cache/`;
  xoá thư mục chỉ làm run sau chậm hơn.
- **Xác nhận được:** matcher locator/engine của `expect`, `locator.waitFor`, `browser.waitForURL`,
  `agent.assert`, `agent.waitFor`. **Không xác nhận:** `expect` giá trị thuần, `expect.poll`,
  `agent.extract`, một `act` khác, hay việc attempt pass.
- Replay cần app ở **đúng route đã ghi** (origin, path, query — bỏ qua id/token), tìm lại từng control
  theo role/name/test id/placeholder/mục đích input/hàng có tên; chỉ pass một mình khi route cuối khớp,
  control xuất hiện/biến mất đúng như lúc ghi, có thay đổi, và không có alert mới. Không → agent tiếp quản giữa chừng.
- **Cache key** gồm tên test + target, instruction, param thường, agent, `context`/`agentContext`, version
  major/minor của engine → đổi một trong số đó = miss. Đổi **model không** làm miss. Preview URL đổi theo
  deploy → đặt `app.identity`.
- `step.cache.reason` cho biết vì sao: `no-entry`, `wrong-context`, `target-not-found`,
  `target-ambiguous`, `end-mismatch`… Entry khoá theo agent + `agentContext`.
- Step không thao tác gì hoặc không đổi gì → không tạo entry; giá trị `unique()` trùng/nằm trong param
  khác → không ghi (`param-collision`).
- Run fail evict các entry liên quan. Run bị huỷ, hoặc fail mà không model nào trả lời
  (`MODEL_PROVIDER_FAILED`, `MODEL_UNAVAILABLE`) → không evict.
- **Chia sẻ cho CI/đồng đội:** bỏ dòng `.e2e/cache/` khỏi `.gitignore`, commit. CI giữ `read-only` trừ
  khi đặt `cache: 'read-write'`. Có bản ghi đã commit → `--strict-cache` trong CI để fail `REPLAY_STALE`
  thay vì âm thầm tiêu model; ghi lại local rồi commit.
- Cache entry chạy với quyền của bạn → **review entry dùng chung như review code**.

## 9. Soi xem model đã làm gì

```bash
npx e2e run tests/checkout.e2e.ts --debug      # bảng step, transcript làm artifact
npx e2e run tests/checkout.e2e.ts --ai-trace   # ghi .e2e/ai-trace.json
npx unbox-ai runs .e2e/ai-trace.json           # 1 dòng / agent step
npx unbox-ai summary .e2e/ai-trace.json --run 0
```

Đừng đọc trace thô (hàng MB context gửi lặp, ảnh thay bằng số byte). Muốn trace cả luồng → `--no-cache`
(bước replay không gọi model).

## 10. "Độ" agent cho app của bạn — thứ tự tinh chỉnh

1. **Câu goal.** Step fail thường do gọi tên thứ màn hình không có → dùng nhãn thật; `--debug` cho xem model thấy gì.
2. **`context`.** Từ vựng mọi step cần (tên gói, "workspace" là gì, tab nào chứa billing) — 1 lần trên
   `agents.<name>.context` hoặc từng test qua `agentContext`.
3. **`system`.** Cách kiểm chứng, điều không bao giờ làm, cách xử lý modal. "UX reviewer", "QA cẩn thận",
   "smoke nhanh" = 3 `system` trên cùng model.
4. **Tools.** API test agent được gọi giữa luồng (seed giỏ hàng, tạo coupon).
5. **Model + options.** `providerOptions` (reasoning effort) hoặc model khác cho persona. `--agent <name>`
   chạy cả suite bằng agent đó để so ứng viên trên cùng bộ test.

## 11. Tools tự viết & executor

```ts
import type { E2EConfig } from 'e2e';
import { defineTool } from 'e2e/agent';
import { web } from '@e2e-dev/web';
import { gateway, tool } from 'ai';
import { z } from 'zod';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

const seedCart = defineTool(
  tool({
    description: 'Seed the cart with a SKU via the store test API',
    inputSchema: z.object({ sku: z.string() }),
    execute: async ({ sku }) => {
      const response = await fetch(`${APP_URL}/api/test/cart?sku=${encodeURIComponent(sku)}`);
      if (!response.ok) throw new Error(`Cart seeding failed: HTTP ${response.status}`);
      return response.text();
    },
  }),
  { mutates: true },
);

export default {
  targets: [{ engine: web(), app: { url: APP_URL } }],
  agents: { default: { model: gateway('openai/gpt-6-luna-fast'), tools: { seedCart } } },
} satisfies E2EConfig;
```

- `mutates: true` → tốn 1 slot action, chạy tuần tự, **không replay được** (phần đó luôn live).
  `mutates: false` → chỉ đọc, không tốn slot, được observe màn hình. `platforms: ['ios', 'android']` giới hạn nền tảng.
- Tool chỉ nên gọi **API test của chính app**, không chạm hệ thống thật (thanh toán, email thật).
- `createToolLoopExecutor` giữ vòng lặp, thay prompt + từ vựng tool. Bất kỳ `StepExecutor`
  (`{ name, version?, cache?, runStep(ctx) }`) đặt dưới `executor`; có `executor` thì không được đặt
  `system`/`tools` cùng entry (`INVALID_CONFIG`).

## 12. Trong CI

Chạy cả suite (kể cả agent step) trên mọi PR, truyền key model đọc (`AI_GATEWAY_API_KEY` cho
`gateway()`) từ secret. Commit `.e2e/cache/` để CI replay bước đã verify mà không gọi model. Mặc định CI
→ `running-ci.md`.
