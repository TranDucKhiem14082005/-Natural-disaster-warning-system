---
name: jenkins
description: Use Jenkins as a general orchestration hub for a project — not just CI/CD, but also cron-driven automation (self-healing, failover, scheduled maintenance) and as a REST API data source for an admin dashboard instead of hand-rolled log parsers. Use when the user wants to add Jenkins to a project, set up CI/CD with Jenkins, automate failover, build a self-healing cron job, or surface build/run history on an admin panel.
---

# /jenkins — Jenkins as a General Orchestration Hub

> Activate: khi user muốn dùng Jenkins cho một project — không chỉ CI/CD, mà cả cron-driven
> automation (self-healing, failover, scheduled maintenance) hoặc muốn dùng Jenkins REST API
> làm nguồn dữ liệu cho admin dashboard thay vì tự viết log parser.
> User có thể nói: "thêm Jenkins", "setup CI/CD với Jenkins", "tự động hoá failover", "cron job
> tự sửa lỗi", "lấy build history hiển thị lên admin".
> **Battle-tested** — mọi pattern dưới đây đã chạy thật trên production, kể cả một lần failover
> hoàn toàn tự động (zero-click) trong một sự cố thật, không phải drill. Skill file này tự chứa
> đủ để áp dụng sang bất kỳ project nào — không cần mang theo tài liệu nào khác.
>
> For the fully-worked Diary App HA/failover implementation (Jenkinsfiles, split-brain guard,
> restart-policy fixes, `ha-db-guard.sh`), see the [[ha]] skill — that's Use Case 2 below, fleshed
> out end-to-end for one real project. This skill covers the broader picture Use Case 2 sits inside.

---

## The Core Insight

Jenkins thường bị đóng khung là "CI/CD tool" — build code, deploy code. Nhưng bản chất của nó chỉ
là **một scheduler + executor có UI, credential store, và REST API** chạy trên một VPS luôn bật.
Điều đó khiến nó phù hợp cho 3 nhóm việc rất khác nhau, và một project trưởng thành thường dùng
cả 3:

```
┌───────────────────────┬───────────────────────────┬───────────────────────────────┐
│ 1. CI/CD DEPLOY       │ 2. CRON AUTOMATION        │ 3. DATA SOURCE (REST API)     │
│ ─────────────         │ ─────────────────         │ ─────────────────────────    │
│ Trigger: git tag      │ Trigger: cron (every 1-5  │ Trigger: none — passive,      │
│ push → build image →  │ min) → runs forever,      │ read-only. Another service    │
│ SSH deploy            │ mostly no-ops             │ queries Jenkins's own API     │
│                       │                           │                               │
│ Use when: shipping    │ Use when: something       │ Use when: you need "who did  │
│ new application code  │ needs to be checked/      │ what and when" without       │
│                       │ healed continuously,      │ building your own audit log  │
│                       │ with no human in the loop │ or log-file parser            │
└───────────────────────┴───────────────────────────┴───────────────────────────────┘
```

Tất cả 3 dùng chung: 1 Jenkins instance, cùng credential store, cùng git repo cho pipeline
definitions (`Jenkinsfile` per job, checked into git — không có script nào sống rời rạc trên VPS
đích), và cùng notification channel (Telegram).

---

## Use Case 1 — CI/CD Deploy Pipeline

**Khi nào chọn:** cần deploy có audit trail, approval gate rõ ràng, hoặc muốn tách "ai build" (CI)
khỏi "ai deploy" (Jenkins) — ví dụ GitHub Actions build + push image lên registry, Jenkins pull về
và chạy trên VPS đích qua SSH.

### Kiến trúc

```
LOCAL / DEV VPS (dev)              GITHUB                    JENKINS + PROD VPS
────────────────────              ──────                    ────────────────────
git tag vX.Y.Z ───────────────────► stable tag
                                       │
                          GitHub Actions triggers
                          build-api → ghcr.io/.../api:X.Y.Z
                          build-web → ghcr.io/.../web:X.Y.Z
                          trigger-jenkins ───────────────────► Jenkins buildWithParameters
                                                                   │
                                                               Pipeline runs:
                                                               1. docker pull images
                                                               2. git fetch --tags --force
                                                                  && git checkout <tag>
                                                               3. docker compose up
                                                               4. health check ✓
                                                               5. notify Telegram
```

**Full working Jenkinsfile + GHA trigger job + credentials setup:** xem
`deploy-workflow.md` — "Hybrid Workflow — AI on Dev + GitHub Actions + Jenkins on Prod". Không lặp
lại ở đây — file đó đã có YAML/Groovy production-verified, copy trực tiếp được.

### 3 gotcha quan trọng nhất (rút từ incident thật, không phải lý thuyết)

1. **Checkout tag TRƯỚC `docker compose up`, không phải sau.** Nếu bỏ qua, `docker-compose.prod.yml`
   ở repo cũ trên VPS thiếu dòng `image: ${API_IMAGE}` → container fallback về local-build image
   cũ thay vì image vừa pull từ registry. Đây là nguyên nhân của "Deploy SUCCESS nhưng code vẫn cũ"
   — xảy ra thật, không phải giả định.
2. **`git checkout main` (bare, không `pull`) sau mỗi deploy = drift âm thầm.** Nó chỉ switch về
   con trỏ `main` local hiện có — có thể lùi hàng chục commit so với `origin/main`. Luôn dùng
   `git checkout main && git pull origin main`.
3. **Image tag chọn lúc deploy phải được GHI vào `.env` trên máy đích, không chỉ `export` trong
   session SSH của chính bước deploy đó.** Nếu chỉ export, một job khác chạy sau (đặc biệt là một
   cron job không liên quan gì đến CI/CD, xem Use Case 2) sẽ đọc lại `.env` cũ và fallback về image
   sai. Đây là gốc rễ của lỗi nghiêm trọng nhất từng gặp khi 2 hệ thống Jenkins (CI/CD + cron
   automation) không chia sẻ state — xem "Cross-Cutting Gotcha" bên dưới.

---

## Use Case 2 — Cron-Driven Automation (Self-Healing / Failover)

**Khi nào chọn:** có một điều kiện cần được kiểm tra liên tục (không phải một lần khi deploy) và
tự sửa nếu sai — ví dụ: node chính chết → promote node phụ; node phụ lệch cấu hình → rebuild lại;
dữ liệu 2 nơi lệch nhau → đồng bộ lại.

**For the complete, production-tested implementation of this use case** (Jenkinsfile per job,
split-brain guard, restart-policy gotchas, `ha-db-guard.sh`, firewall self-heal, 4-case drill
methodology) — see the [[ha]] skill. It's a full worked example of everything summarized below.

### Tại sao không dùng bash script + crontab trên chính server cần bảo vệ

Cách làm cũ, sai lầm: viết `health_check.sh` / `promote.sh` / `rejoin.sh`, copy lên từng VPS,
chạy bằng crontab của chính VPS đó. **Vấn đề cấu trúc:** logic tự chữa cháy sống dưới dạng file
hand-edited trên chính những host không đáng tin cậy mà nó có nhiệm vụ bảo vệ, và chỉ được thực
thi thật khi có sự cố thật xảy ra — drift giữa các bản copy không ai để ý cho đến đúng lúc quan
trọng nhất. Nếu node đó chết hoặc bị lệch quyền, cái đang được kỳ vọng để phát hiện sự cố cũng chết
theo — không ai biết watchdog đã ngừng hoạt động cho đến sự cố thật tiếp theo.

**Cách làm đúng: Jenkins pipelines, không phải bash + cron trên node đích.**

```
   ┌──────────────────────────┐         ┌──────────────────────────┐
   │   FAST LOOP (1 min)     │         │   SLOW LOOP (5 min)      │
   │   <check>-watchdog       │         │   <check>-rejoin          │
   │                          │         │                          │
   │   "Is X still alive?"   │         │   "Is Y still healthy?"  │
   └───────────┬──────────────┘         └───────────┬──────────────┘
               │ no, N lần liên tiếp                 │ no
               ▼                                     ▼
      ┌───────────────────┐                  tự sửa tại chỗ,
      │   <action>-do     │                  không cần người
      │  (one-shot job,  │                  bấm nút
      │  not scheduled)  │
      └──────────┬────────┘
               │
               ▼
      Trạng thái được khôi phục,
      hoặc escalation rõ ràng qua
      Telegram nếu không tự sửa được
```

Tại sao 2 loop tách biệt thay vì 1 job "check-everything":
- **Fast loop** chỉ cần trả lời 1 câu hỏi yes/no rẻ tiền — chạy mỗi phút không tốn kém.
- **Slow loop** làm việc thật (dừng stack, rebuild, resync) khi phát hiện vấn đề — chạy mỗi phút là
  lãng phí và vô nghĩa, vì việc sửa một node không cần xảy ra trong vài giây như việc phát hiện.

### Jenkins Cron Trigger — Gotcha quan trọng nhất

```groovy
triggers {
    // KHÔNG dùng 'H/1 * * * *'. Đã xác nhận LIVE trên Jenkins instance thật rằng dạng "H" hash
    // với step=1 ở field phút degrade xuống chạy 1 LẦN/GIỜ, không phải 1 lần/phút (xác nhận qua
    // build timestamps cách nhau đúng 3600s), trong khi H/5 trên job khác chạy đúng mỗi 5 phút
    // trên CÙNG instance. '* * * * *' tường minh không có ambiguity hash, và không có lợi ích
    // load-spreading nào bị mất ở granularity 1 phút (không có gì nhỏ hơn để spread).
    // Nếu nghi ngờ trên Jenkins instance mới: test bằng '* * * * *' trước, xác nhận qua build
    // timestamps thật cách nhau ~60s trước khi tin `H/1`.
    cron('* * * * *')
}
```

### Pattern bắt buộc cho mọi job cron-driven

| Nguyên tắc | Lý do |
|---|---|
| **`disableConcurrentBuilds()`** | Nếu action job không thực sự khôi phục trạng thái, watchdog có thể trigger lại trước khi lần chạy trước xong → 2 lần chạy song song (race DNS flip, container start...) tệ hơn việc queue lại |
| **Mọi exit path đều gọi shared `notify-telegram` job** | Success, failure, abort, no-op, skip — không có exit path im lặng. Đây là fix trực tiếp cho sự cố gốc: một watchdog ngừng hoạt động mà không ai biết |
| **Resolve trạng thái thật tại mỗi lần chạy, không tin state từ lần chạy trước** | Đừng cache "ai đang là primary" — luôn hỏi lại nguồn sự thật (Cloudflare API, `pg_is_in_recovery()`, v.v.) mỗi lần |
| **Health check trực tiếp vào IP thật, không qua domain công khai nếu có CDN/proxy** | `curl --resolve <domain>:443:<real-ip> https://<domain>/health` — một CDN có thể trả 200 cached trong khi origin thật đã chết. Đã xảy ra thật: 1 lần fail được ghi nhận, lần check tiếp theo trả 200 trong khi origin vẫn chết theo xác nhận trực tiếp — khiến ngưỡng "2 lần fail liên tiếp" không bao giờ đạt được |
| **Idempotent — an toàn khi chạy lặp lại vô điều kiện** | Job tự kiểm tra "cần sửa không?" mỗi lần, không giả định lần trước đã sửa xong. Đây là điều làm cho self-triggering cron an toàn |

### Ví dụ cụ thể — HA Postgres/Redis failover

4 jobs, mỗi job 1 Jenkinsfile trong git repo (không có bash script nào trên VPS đích):

| Job | Trigger | Việc làm |
|---|---|---|
| `ha-watchdog` | cron `* * * * *` | Resolve primary IP thật (qua Cloudflare API, không phải `dig` — domain proxied trả về edge IP của CDN chứ không phải origin) → curl trực tiếp IP đó → đếm fail liên tiếp trên đĩa của chính Jenkins (không phải trên node đang theo dõi) → 2 lần fail → trigger job hành động |
| `ha-promote` | trigger bởi watchdog, hoặc manual | Resolve hosts → **split-brain guard** (curl trực tiếp node "đã chết" — nếu vẫn 200 thì ABORT, không promote node kia) → promote DB, promote cache, start full app tier, update DNS, health check |
| `ha-rejoin` | cron `H/5 * * * *`, tự nó cũng self-heal | Kiểm tra node còn lại (không phải primary) đã là replica khỏe mạnh chưa — nếu rồi thì no-op; nếu không thì stop toàn bộ stack, rebuild từ primary, rejoin làm replica |
| `<data>-sync` | cron `H/5 * * * *` | Đồng bộ dữ liệu không nằm trong DB replication (object storage, file uploads...) từ node chính sang node phụ, additive-only (không `--delete`) để tránh xoá nhầm dữ liệu thật nếu source/dest bị đảo ngược |

**Chi tiết đầy đủ (Jenkinsfile structure, split-brain guard logic, firewall self-heal, restart-policy
gotchas):** xem skill [[ha]] — không lặp lại ở đây, phần này chỉ tóm tắt kiến trúc chung.

---

## Use Case 3 — Jenkins REST API as a Data Source (thay cho log file parser)

**Khi nào chọn:** cần hiển thị "hệ thống tự động đã làm gì, khi nào, tự động hay có người bấm" lên
một dashboard/admin panel — mà không muốn viết log parser, không muốn mount log file vào container
API, không muốn thêm bảng DB mới chỉ để ghi lại lịch sử chạy job.

### Insight cốt lõi

Jenkins đã tự lưu build history đầy đủ cho mỗi job — không cần build lại. Chỉ cần gọi REST API:

```bash
curl --globoff -s -u "<jenkins-user>:<api-token>" \
  "http://<jenkins-host>:8080/job/<job-name>/api/json?tree=builds[number,result,timestamp,duration,actions[causes[shortDescription]]]"
```

Response trả về sẵn: `number`, `result` (SUCCESS/FAILURE/UNSTABLE), `timestamp`, `duration`, và
quan trọng nhất — `actions[].causes[].shortDescription`.

**Field `causes[].shortDescription` là chìa khoá:** nó phân biệt build được trigger **tự động**
("Started by upstream project \"ha-watchdog\" build number 346" hoặc "Started by timer") với
**thủ công** ("Started by user <username>"). Đây chính xác là bằng chứng cần để chứng minh một hệ
thống tự động thực sự chạy hands-off, không phải ai đó âm thầm bấm nút mỗi lần.

### Tại sao tốt hơn log file

| | Log file (`/var/log/promote.log`) | Jenkins REST API |
|---|---|---|
| Cần mount vào API container | ✗ Có | ✓ Không |
| Cần viết parser | ✗ Có (structured KEY=VALUE) | ✓ Không — JSON có sẵn |
| Sống trên VPS đích, có thể mất khi VPS chết | ✗ Có | ✓ Không — sống trên Jenkins |
| Phân biệt auto/manual trigger | Phải tự thêm field | ✓ Có sẵn (`causes[]`) |
| Cần thêm bảng DB mới | Tuỳ thiết kế | ✓ Không |

### Gotcha khi implement Go HTTP client

- `curl` cần cờ `--globoff` để không reject query param `tree=...[...]` (dấu ngoặc vuông không
  encode) — lỗi "URL malformed". Client Go dùng `net/http` không bị ảnh hưởng bởi vấn đề glob của
  curl, nhưng vẫn nên build query bằng `url.Values` hoặc URL-encode `[`/`]` cho chắc chắn.
- Dùng Jenkins **API token** (user → Configure → API Token → New Token), không dùng password thật.
- **Không log token ra chat/console khi test bằng curl** — chỉ chia sẻ output, không chia sẻ lệnh
  chứa token. Nếu lỡ để lộ, revoke ngay trong Jenkins → Security → xoá token đó, tạo token mới lưu
  vào env var / secrets manager.

### Heuristic phân biệt "job chạy nhưng không làm gì" vs "job chạy và thực sự sửa lỗi"

Với job cron self-healing (Use Case 2) chạy mỗi 5 phút và no-op phần lớn thời gian: dùng **build
duration** làm proxy. Một lần rebuild/sync thật (việc nặng: basebackup, rsync lớn...) mất lâu hơn
hẳn một lần chạy chỉ để kiểm tra rồi thấy ổn. Chỉ hiển thị build có `duration > <threshold>` vào
phần "history đáng chú ý" của dashboard, trong khi vẫn show "last checked: N phút trước" cho mọi
build bất kể có làm gì hay không.

### Nguồn dữ liệu khác cũng nên cân nhắc cùng lúc

| Dữ liệu | Nguồn | Lưu ý |
|---|---|---|
| Trạng thái hiện tại (ai đang primary?) | Nguồn sự thật riêng của domain (DNS API, config service...) | KHÔNG suy luận từ tên alias hay từ Jenkins build cuối — Jenkins chỉ biết "đã chạy gì", không phải "trạng thái hiện tại là gì" |
| Lịch sử hành động | Jenkins REST API (mục này) | |
| Chi tiết log từng bước | Jenkins build console (`/job/<name>/<build>/consoleText`) | Chỉ fetch khi cần drill-down, không fetch hàng loạt cho list view |

> **Sai lầm cần tránh:** đừng dùng Telegram Bot API làm nguồn thay thế — `getUpdates` chỉ trả về
> message gửi đến bot, không trả message bot đã gửi đi. Không thể lấy lại lịch sử outgoing message
> từ đó. Jenkins REST API thay thế hoàn toàn vai trò này.

---

## Cross-Cutting Pattern — Shared `notify-telegram` Job

Dùng chung cho cả 3 use case ở trên — 1 Jenkins job nhận tham số (`level`: info/warning/success/
failure, `message`: text) và gửi qua Telegram Bot API. Mọi pipeline khác gọi job này thay vì tự
implement gửi Telegram riêng lẻ.

```groovy
// jenkins/notify-telegram/Jenkinsfile (rút gọn)
pipeline {
    agent any
    parameters {
        string(name: 'LEVEL', defaultValue: 'info')
        string(name: 'MESSAGE', defaultValue: '')
    }
    stages {
        stage('Send') {
            steps {
                withCredentials([
                    string(credentialsId: 'telegram-bot-token', variable: 'BOT_TOKEN'),
                    string(credentialsId: 'telegram-chat-id',   variable: 'CHAT_ID')
                ]) {
                    sh """
                        curl -s -X POST "https://api.telegram.org/bot\$BOT_TOKEN/sendMessage" \\
                          -d chat_id="\$CHAT_ID" \\
                          -d text="${params.LEVEL}: ${params.MESSAGE}"
                    """
                }
            }
        }
    }
}
```

Gọi từ job khác: `build job: 'notify-telegram', parameters: [string(name: 'LEVEL', value: 'warning'), string(name: 'MESSAGE', value: '...')], wait: false`

**Quy tắc khi viết bất kỳ pipeline mới nào:** mọi `stage` có thể thoát pipeline (success, failure,
early return) phải gọi `notify-telegram` trước khi thoát — không thêm exit path mới mà thiếu
notification đi kèm.

---

## Cross-Cutting Gotcha — CI/CD Deploy và Cron Automation Có Thể Giẫm Chân Nhau

Nếu một project dùng cả Use Case 1 (CI/CD deploy) và Use Case 2 (cron self-healing) trên cùng hạ
tầng, chúng có thể **âm thầm bất đồng về state** — vì chúng thường không biết đến sự tồn tại của
nhau.

**Kịch bản thật đã xảy ra:** CI/CD deploy pipeline chỉ `export API_IMAGE=...` trong session SSH
của chính nó, không ghi vào `.env` trên đĩa. Vài giờ sau, node đó gặp sự cố thật — cron
self-healing job (không biết gì về deploy vừa rồi) chạy `docker compose up` — đọc `.env` cũ, không
có `API_IMAGE` — Compose fallback về tag local-build cũ, không phải image vừa deploy. Kết quả:
service tự "rollback" về phiên bản cũ ngay sau một failover tưởng như thành công.

**Cách phòng tránh khi thiết kế 2 hệ thống này chạy song song:**
1. CI/CD deploy pipeline phải **ghi** image tag đã deploy vào `.env` trên đĩa của node đích (không
   chỉ `export` trong shell session của chính nó) — mọi job khác chạy sau (kể cả không liên quan gì
   đến deploy) phải đọc lại được đúng version đang chạy.
2. Hoặc: cron/failover job tự **resolve** "phiên bản nào đang thực sự chạy trên node khoẻ mạnh"
   tại thời điểm hành động (vd. `docker inspect` qua SSH vào node đang sống) thay vì tin `.env`
   local trên node đang được sửa — mạnh hơn trước drift nhưng thêm một bước phụ thuộc mới.
3. Bất kỳ bước "chuẩn bị standby/node phụ" nào dùng `git checkout main` **phải** kèm `git pull
   origin main` ngay sau — bare checkout chỉ switch về con trỏ local, có thể lùi hàng chục commit.

> **Bài học chung:** khi có 2 hệ thống tự động độc lập cùng chạm vào một hạ tầng, luôn tự hỏi
> "nếu hệ thống B chạy ngay sau hệ thống A, B có đọc đúng trạng thái mà A vừa để lại không?" — nếu
> câu trả lời phụ thuộc vào state chỉ tồn tại trong 1 session đã đóng, đó là một gap thật.

---

## Setup Checklist — Jenkins Instance Mới

```bash
# 1. Chạy Jenkins qua Docker (nếu chưa có)
docker run -d \
  --name jenkins --restart unless-stopped \
  -p 8080:8080 -p 50000:50000 \
  -v /opt/jenkins:/var/jenkins_home \
  jenkins/jenkins:lts-jdk21

docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
# Required plugins: SSH Agent, Pipeline, GitHub plugin, Blue Ocean (optional)

# 2. Mỗi job = "Pipeline script from SCM" trỏ vào Jenkinsfile trong git repo
#    KHÔNG paste script trực tiếp vào Jenkins UI — mọi thay đổi phải qua git, review được

# 3. Credentials cần có sẵn trước khi viết job đầu tiên
```

| Credential ID | Type | Dùng cho |
|---|---|---|
| `<provider>-api-token` | Secret text | DNS/CDN API (nếu có failover cần flip DNS) |
| `prod-vps-ssh-key` | SSH Username with private key | Mọi job cần SSH vào VPS đích |
| `prod-vps-user` | Secret text | Deploy user (không phải root) |
| `telegram-bot-token` / `telegram-chat-id` | Secret text | Shared `notify-telegram` job |
| `db-user` / `db-name` / `<db>-repl-password` | Secret text | Job nào chạm vào DB trực tiếp (promote, rejoin, migration) |
| `jenkins-api-token` (self) | dùng riêng cho Use Case 3 | Admin dashboard gọi ngược lại Jenkins REST API |

```bash
# 4. Verify job cron thực sự chạy đúng nhịp — đừng tin 'H/1', xác nhận bằng timestamp thật
#    (xem gotcha ở Use Case 2)

# 5. Test REST API feasibility trước khi build Use Case 3 (nếu áp dụng)
curl --globoff -s -u "<user>:<token>" \
  "http://<jenkins-host>:8080/job/<job>/api/json?tree=builds[number,result,timestamp]"
```

---

## Testing Methodology — Real Drills, Not Simulations

Mỗi pattern trong skill này (đặc biệt Use Case 2) chỉ nên coi là "đã xong" sau khi được validate
bằng drill thật — tắt thật một node, quan sát hệ thống phản ứng — không phải chỉ đọc code review
xong. Kỹ thuật test an toàn không ảnh hưởng user thật: block bằng firewall chỉ scoped đến IP của
chính Jenkins host trên port health-check, verify song song bằng curl từ máy khác vẫn thấy 200
suốt quá trình. Tắt tạm job hành động (action job) trong Jenkins UI làm lớp an toàn thứ 2, để dù
logic escalation có thật sự chạy tới bước trigger, Jenkins vẫn từ chối thực thi.

Sau mỗi drill: luôn verify độc lập bằng SSH/curl trực tiếp — đừng chỉ tin báo cáo "SUCCESS" của
chính pipeline.

---

## Adapter Rules — Đổi gì khi áp dụng sang project khác

| Item | Ví dụ | Đổi sang |
|---|---|---|
| Jenkins host | Docker trên một VPS luôn bật, port 8080 | VPS/host bất kỳ luôn bật của project mới |
| Credential IDs | `cf-api-token`, `prod-vps-ssh-key`... | Đặt tên theo provider DNS/infra thật của project mới |
| Cron cadence | watchdog 1 phút, rejoin/sync 5 phút | Tuỳ mức độ nghiêm trọng — health check càng rẻ càng nên nhanh, action job càng nặng càng nên thưa |
| Notify channel | Telegram | Có thể đổi sang Slack/Discord — giữ nguyên pattern "shared notify job + mọi exit path đều gọi" |
| Health check target | `curl --resolve <domain>...` | Endpoint health-check thật của app mới |
| Use Case 3 data model | HA status, failover history | Bất kỳ "audit trail của hành động tự động" nào — không giới hạn ở failover |

## Không cần Đổi

- Nguyên tắc `disableConcurrentBuilds()` cho mọi job cron trigger job khác
- Pattern shared `notify-telegram` job — mọi exit path đều gọi
- Cảnh báo `H/1` cron degrade thành hourly — luôn verify bằng timestamp thật trên instance mới
- Nguyên tắc mọi Jenkinsfile sống trong git (`Pipeline script from SCM`), không paste trực tiếp
  vào Jenkins UI
- Pattern `causes[].shortDescription` để phân biệt auto vs manual trigger qua REST API
- Gotcha `--globoff` khi test bằng curl (không ảnh hưởng Go `net/http`)
- Nguyên tắc "resolve trạng thái thật mỗi lần chạy, không cache/tin lần trước" cho mọi job idempotent

---

## Anti-patterns

- **Bash script + crontab trên chính node cần được bảo vệ** — logic tự chữa cháy không nên sống
  trên host không đáng tin cậy mà nó bảo vệ. Dùng Jenkins pipeline chạy từ một host riêng.
- **Paste Jenkinsfile trực tiếp vào Jenkins UI thay vì "Pipeline script from SCM"** — mất khả năng
  review qua git, dễ drift không ai biết.
- **Tin `H/1 * * * *` chạy đúng mỗi phút mà không verify** — đã xác nhận degrade thành hourly trên
  ít nhất 1 Jenkins instance thật.
- **Health check qua domain công khai có CDN/proxy mà không resolve IP thật trước** — có thể serve
  response cached/stale che giấu outage thật.
- **CI/CD deploy chỉ `export` image tag trong session SSH, không ghi vào `.env` trên đĩa** — job
  khác chạy sau (đặc biệt cron self-healing) sẽ đọc lại state cũ.
- **`git checkout main` không kèm `pull`/fast-forward** trong bất kỳ bước "prepare" nào — nguồn
  drift âm thầm, độc lập với vấn đề image tag.
- **Tự thiết kế lại Telegram Bot API để lấy lịch sử outgoing message** — không thể, `getUpdates`
  chỉ trả message đến bot. Dùng Jenkins REST API build history thay thế.
- **Không có `notify-telegram` (hoặc tương đương) ở MỌI exit path** — một job ngừng hoạt động âm
  thầm thường là nguyên nhân gốc của những sự cố production nghiêm trọng nhất.
- **Coi pipeline "SUCCESS" là đủ bằng chứng** — luôn verify độc lập bằng SSH/curl sau mỗi lần chạy
  quan trọng, đặc biệt sau drill.
