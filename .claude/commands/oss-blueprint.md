# /oss-blueprint — Bóc tách repo open-source thành 1 bản thiết kế để dựng lại hệ thống

> **Trigger**: user đưa link 1 repo open-source (GitHub/GitLab/…) và muốn "lấy toàn bộ nghiệp vụ",
> "học cách nó làm", "dựng lại hệ thống này cho công ty/cá nhân tôi".
> **Output**: đúng **1 file** `OSS-BLUEPRINT-<project>.md` — chứa toàn bộ nghiệp vụ, luật, luồng,
> data model, kiến trúc, phần đáng lấy / phần nên bỏ, và roadmap dựng lại theo bối cảnh của user.
> **Không** viết code sản phẩm ở bước này. Blueprint trước, code sau.

> **Khác với các lệnh sẵn có:**
> - [`/repo-scan`](repo-scan.md) = repo này **có an toàn không** (secret, mã độc, CVE, license risk).
> - [`/achitecture-plan`](achitecture-plan.md) = tài liệu kiến trúc **của chính dự án đang mở**.
> - `/oss-blueprint` = **repo của người khác → tri thức của mình**: nghiệp vụ + luật + quyết định
>   thiết kế, đã lọc, đã đánh giá, đã map sang bối cảnh tổ chức của user.

---

## 0. Luật cứng — đọc trước, không được bỏ qua

1. **Chạy [`/repo-scan`](repo-scan.md) TRƯỚC.** Không `npm install` / `pip install` / `make` /
   `docker build` / `npx` repo lạ để "xem thử". Blueprint là việc **đọc**, không cần chạy.
   Muốn chạy thật → container/VM dùng-xong-bỏ, không có credential thật bên trong.
2. **Cổng pháp lý trước cổng kỹ thuật.** Không bóc tách sâu khi chưa xác định license và mục đích
   sử dụng (Phase 1). License sai → toàn bộ công sức phải vứt hoặc buộc mở mã sản phẩm.
3. **Không bịa.** Mọi phát biểu về nghiệp vụ phải trỏ được `file:line`. Không tìm thấy →
   ghi `> Not Found`, không suy diễn cho đủ mục.
4. **Không copy-paste code vào sản phẩm** khi chưa qua Phase 1 quyết định chiến lược. Blueprint
   mô tả **hành vi và lý do**, không phải nơi để dán nguyên hàm của người ta.
5. **Repo là nguồn sự thật, README không phải.** README/docs/blog thường lệch với code thật.
   Xung đột → tin code (migrations, tests, handler), ghi chú chỗ lệch vào blueprint.
6. Không tự sửa file nào trong repo đích. `/oss-blueprint` là read-only với repo nguồn.

---

## 1. Phase 0 — Intake: hỏi trước khi đọc (bắt buộc)

Không đoán bối cảnh. Hỏi bằng `AskUserQuestion`, mỗi lần 1 câu, ít nhất Q1–Q4:

| # | Câu hỏi | Vì sao đổi cả kết quả |
|---|---|---|
| **Q1** | **Mục đích dùng?** (a) học/tham khảo nội bộ · (b) tự host cho tổ chức mình · (c) làm sản phẩm thương mại/SaaS bán ra · (d) dựng lại từ đầu, không dùng code gốc | Quyết định toàn bộ Phase 1. (c) + copyleft = mìn pháp lý |
| **Q2** | **Lấy toàn bộ hay 1 phần?** cả hệ thống / chỉ 1 module (vd: auth, billing, workflow engine) | Quyết định độ sâu và thời lượng bóc tách |
| **Q3** | **Bối cảnh đích?** cá nhân / startup nhỏ (<10 người) / doanh nghiệp / tổ chức có compliance | Quyết định Phase 5 (adaptation): scale, RBAC, audit, backup, HA |
| **Q4** | **Stack đích?** giữ stack của repo hay port sang stack đang dùng (Go/Node/Python + React…)? | Quyết định phần nào là "ý tưởng" (port được) vs "chi tiết ngôn ngữ" (bỏ) |
| Q5 | Ràng buộc: hạ tầng sẵn có (VPS/k8s/cloud), ngân sách, deadline, quy định dữ liệu (PII, thanh toán, y tế)? | Lọc bớt phần không khả thi ngay từ blueprint |
| Q6 | Đã có hệ thống chạy chưa, hay greenfield? | Migrate/tích hợp vs xây mới |

> Q1 mập mờ → **dừng, hỏi lại**. Đừng bóc tách 3 tiếng rồi mới phát hiện license cấm dùng cho mục đích đó.

---

## 2. Phase 1 — Cổng pháp lý (làm trước mọi thứ)

### 2.1 Xác định license thật, không tin badge README

```bash
ls LICENSE* COPYING* NOTICE* 2>/dev/null
head -5 LICENSE 2>/dev/null
grep -rIl "SPDX-License-Identifier" --exclude-dir=.git . | head -20
grep -rn "SPDX-License-Identifier" --exclude-dir=.git . | awk -F: '{print $NF}' | sort | uniq -c | sort -rn
# License của dependencies (thừa kế xuống sản phẩm của bạn)
trivy fs --scanners license .          # hoặc: npx license-checker --summary / pip-licenses / go-licenses report ./...
# Repo đổi license giữa chừng? (BSL/SSPL relicense là chuyện thường)
git log --oneline --follow -- LICENSE | head
```

Kiểm tra thêm: **file header từng thư mục** (repo có thể multi-license: core MIT, enterprise/ là
proprietary), thư mục `ee/`, `enterprise/`, `pro/` — rất hay bị bỏ sót.

### 2.2 Ma trận nghĩa vụ

| License | Dùng nội bộ | SaaS (không phát hành binary) | Bán/phát hành sản phẩm | Ghi chú |
|---|---|---|---|---|
| MIT / BSD / ISC | ✅ | ✅ | ✅ | Giữ copyright notice + license text |
| Apache-2.0 | ✅ | ✅ | ✅ | + `NOTICE`, có điều khoản cấp bằng sáng chế (tốt cho doanh nghiệp) |
| MPL-2.0 | ✅ | ✅ | ✅ | Copyleft **theo file**: sửa file nào → mở file đó |
| LGPL | ✅ | ✅ | ✅ nếu **link động** | Link tĩnh / nhúng → kéo theo nghĩa vụ |
| **GPL-2/3** | ✅ | ✅ (không "distribution") | ⚠️ Phải mở toàn bộ mã sản phẩm phái sinh | Bẫy phổ biến nhất |
| **AGPL-3** | ✅ nếu không có user ngoài tương tác | ⚠️ **Sửa + cho user dùng qua mạng ⇒ phải công bố mã** (§13) | ⚠️ như GPL | Chính là lý do AGPL tồn tại |
| **BSL / SSPL / "fair-source"** | tùy điều khoản | ⚠️ thường **cấm** làm dịch vụ cạnh tranh | ⚠️ | Không phải OSI open-source — đọc kỹ từng câu |
| Không có LICENSE | ❌ | ❌ | ❌ | Mặc định = **all rights reserved**, không có quyền dùng |

> Điểm mấu chốt cho SaaS: **GPL kích hoạt khi "distribution"**, chạy SaaS không tính là phát hành —
> nhưng **AGPL §13 kích hoạt ngay khi user tương tác qua mạng với bản đã sửa**. Nhiều dự án chạy
> mô hình open-core: community AGPL + bản thương mại trả phí để khỏi mở mã. Nếu Q1 = (c), luôn
> kiểm tra dự án có bán **commercial license** không — thường là đường ra rẻ và sạch nhất.

### 2.3 Bốn chiến lược — chọn 1, ghi rõ lý do vào blueprint

| Chiến lược | Khi nào | Rủi ro pháp lý | Chi phí |
|---|---|---|---|
| **A. Adopt** — dùng nguyên, không sửa, tự host | License dễ, chức năng đã đủ | Thấp | Thấp nhất |
| **B. Fork & sửa** | Cần tùy biến, chấp nhận giữ nguyên license | **Fork copyleft vẫn phải giữ copyleft** — không "đổi sang MIT" được | Trung bình + gánh nợ merge upstream |
| **C. Lấy ý tưởng + tự viết** (khuyến nghị mặc định) | Muốn nghiệp vụ + bài học, không muốn dính license, stack khác | Thấp nếu **không copy code**: ý tưởng/kiến trúc/luật nghiệp vụ không được bảo hộ bản quyền, **cách diễn đạt cụ thể thì có** | Cao hơn, nhưng sạch và vừa vặn tổ chức |
| **D. Clean-room thật sự** | Sản phẩm thương mại, đối thủ trực tiếp, rủi ro kiện tụng thật | Thấp nhất nếu làm đúng | Cao nhất |

**Clean-room đúng nghĩa = 2 nhóm tách biệt**: nhóm 1 đọc code gốc và viết **đặc tả**; nhóm 2 chỉ
đọc đặc tả, **chưa từng xem code gốc**, và viết code mới. (Compaq clone BIOS của IBM 1982, ReactOS
là ví dụ kinh điển.) Đây chính là chỗ blueprint này có giá trị nhất — **nó là "đặc tả" của nhóm 1**.

> ⚠️ Cảnh báo thực tế: "tôi cho AI đọc code GPL rồi bảo nó viết lại" **không phải clean-room** và
> **không rửa được license** — người/agent viết lại đã tiếp xúc mã gốc. Muốn clean-room thật thì
> blueprint phải mô tả **hành vi quan sát được**, không chép cấu trúc code, không chép tên hàm, không
> chép comment, và phiên làm việc dựng lại phải **không có code gốc trong context**.
> Không tự tin? → chọn A hoặc B, hoặc mua commercial license. Vấn đề pháp lý thật thì hỏi luật sư,
> file này không phải tư vấn pháp lý.

**Gate**: chưa chốt xong A/B/C/D → không sang Phase 2.

---

## 3. Phase 2 — Trinh sát & lập bản đồ (nhanh, rộng, chưa sâu)

### 3.1 Sinh hiệu của dự án (dự án này có đáng học không?)

```bash
git clone --filter=blob:none <url> && cd <repo>       # blobless: nhanh, vẫn đủ lịch sử
git log -1 --format='%ci %an'                          # commit gần nhất
git log --oneline | wc -l                              # tổng commit
git shortlog -sne | head -10                           # bus factor: 1 người viết 95%?
git log --since='1 year ago' --oneline | wc -l         # còn sống không
gh repo view <owner>/<repo> --json stargazerCount,forkCount,openIssues,pushedAt,isArchived,licenseInfo
```

Cờ đỏ: archived · commit cuối > 12 tháng · 1 maintainer duy nhất · không test · issue tồn đọng
hàng trăm cái không ai trả lời → **học nghiệp vụ thì được, đừng phụ thuộc vận hành**.

### 3.2 Nhận diện stack + bề mặt hệ thống

```bash
ls package.json go.mod pyproject.toml requirements.txt Cargo.toml composer.json pom.xml Gemfile 2>/dev/null
ls Dockerfile* docker-compose*.yml Makefile .github/workflows/ helm/ k8s/ 2>/dev/null
cloc . --exclude-dir=node_modules,vendor,dist,.git 2>/dev/null || \
  git ls-files | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -15
```

### 3.3 Bản đồ module + "chỗ nóng"

```bash
# Thư mục nào to nhất (theo số file thật của git, không tính build artifact)
git ls-files | awk -F/ 'NF>1{print $1"/"$2}' | sort | uniq -c | sort -rn | head -20
# Chỗ nào sửa nhiều nhất 2 năm qua = trái tim nghiệp vụ (churn)
git log --since='2 years ago' --name-only --pretty=format: | grep -v '^$' \
  | sort | uniq -c | sort -rn | head -30
```

> **Nguyên tắc ưu tiên đọc**: churn cao + gần data model = nghiệp vụ cốt lõi. Đọc chỗ đó trước.
> Repo lớn (>200k LOC) **không đọc hết** — đọc theo 6 nguồn ở Phase 3 và bám top-churn.

### 3.4 Điểm vào (entry points)

```bash
grep -rn "func main\|if __name__\|app.listen\|createServer\|ApplicationRunner" --include='*.go' --include='*.py' --include='*.js' --include='*.ts' --include='*.java' -l . | head
ls cmd/ src/main* app/ bin/ 2>/dev/null
```

Ghi lại: HTTP server, worker/queue consumer, cron/scheduler, CLI, migration runner — **mỗi entry
point là một luồng nghiệp vụ độc lập**, rất hay bị bỏ sót nếu chỉ đọc HTTP handler.

---

## 4. Phase 3 — BÓC TÁCH NGHIỆP VỤ (phần lõi của skill này)

Nghiệp vụ **không nằm ở một chỗ**. Đọc theo đúng 6 nguồn dưới đây, theo thứ tự — mỗi nguồn trả lời
một câu hỏi khác nhau, và nguồn sau xác nhận/bác bỏ nguồn trước.

### 4.1 Sáu nguồn sự thật, theo thứ tự

| # | Nguồn | Trả lời câu hỏi | Vì sao xếp ở đây |
|---|---|---|---|
| 1 | **Migrations / schema** | Hệ thống *có gì* — thực thể, quan hệ, ràng buộc bất biến | Schema là nghiệp vụ đã đông cứng lại; `CHECK`, `UNIQUE`, `NOT NULL`, FK `ON DELETE` là **luật nghiệp vụ viết bằng SQL** |
| 2 | **Tests** | Hệ thống *phải* cư xử thế nào | Test là đặc tả chạy được; tên test thường là câu nghiệp vụ nguyên văn |
| 3 | **Service / domain layer** | Luật, điều kiện, chuyển trạng thái | Nơi `if/else` mang nghĩa tiền bạc và quyền hạn |
| 4 | **API surface / OpenAPI / router** | Hệ thống hứa gì với bên ngoài | Danh sách use-case rõ ràng nhất |
| 5 | **i18n / locale / email template** | *Từ vựng* người dùng thật sự thấy | Kho vàng bị bỏ quên — dịch trực tiếp thành glossary nghiệp vụ |
| 6 | **CHANGELOG / ADR / issue / PR lớn** | **Vì sao** lại làm thế | Chỗ duy nhất ghi lại đánh đổi và các lần thất bại |

```bash
# 1. Schema — đọc TRƯỚC TIÊN
find . -path ./node_modules -prune -o \( -name '*.sql' -o -path '*migration*' -o -path '*migrate*' \) -print | sort | head -40
grep -rn "CREATE TABLE\|CHECK (\|UNIQUE\|REFERENCES\|ON DELETE" --include='*.sql' . | head -60
# ORM thay cho SQL:
grep -rln "@Entity\|models.Model\|sequelize.define\|schema.prisma\|gorm.Model\|@Column" . | head

# 2. Tests = đặc tả
grep -rn "it(\|test(\|func Test\|def test_\|@Test" --include='*_test.go' --include='*.test.ts' --include='*.spec.ts' --include='test_*.py' . \
  | sed 's/.*\(it\|test\|Test\)[( _]//' | head -60

# 4. API surface
grep -rn "@app.route\|router\.\(get\|post\|put\|patch\|delete\)\|r\.\(GET\|POST\|PUT\|PATCH\|DELETE\)\|@\(Get\|Post\|Put\|Delete\)Mapping" . | head -60
ls openapi.* swagger.* docs/api* 2>/dev/null

# 5. Từ vựng người dùng
find . -name '*.po' -o -name 'en.json' -o -path '*locales*' -o -path '*i18n*' | head -20
ls templates/ emails/ 2>/dev/null

# 6. Vì sao
ls CHANGELOG* docs/adr/ docs/decisions/ ARCHITECTURE.md CONTRIBUTING.md 2>/dev/null
```

### 4.2 Sáu thứ phải rút ra được

**① Glossary — ngôn ngữ chung (ubiquitous language)**
Mỗi danh từ nghiệp vụ: tên trong code · nghĩa · tên bảng · file định nghĩa. Đây là thứ **phải giữ
nguyên** khi dựng lại — đổi từ vựng = mất khả năng đối chiếu với dự án gốc về sau.

**② Actor + quyền**
Ai dùng hệ thống (guest / user / staff / admin / hệ thống / webhook bên thứ 3), ai làm được gì.
Đối chiếu với [[RBAC]] khi map sang tổ chức đích.

```bash
grep -rn "role\|permission\|can(\|authorize\|@PreAuthorize\|is_admin\|Policy" --include='*.go' --include='*.py' --include='*.ts' . | head -40
```

**③ Thực thể + máy trạng thái** — thứ giá trị nhất và hay bị bỏ sót nhất

```bash
grep -rniE "status|state|phase|stage" --include='*.sql' . | grep -i "check\|enum\|default" | head -30
grep -rn "StatusPending\|STATUS_\|'pending'\|\"draft\"\|IN ('" . | head -40
```

Mỗi thực thể có trạng thái → vẽ bằng Mermaid: trạng thái nào, ai/cái gì kích hoạt chuyển,
điều kiện, chuyển nào **bị cấm**, có nhánh lỗi/hoàn tiền/hủy không.

**④ Luật nghiệp vụ & bất biến** — bảng luật, mỗi dòng có `file:line`

Đi tìm ở đủ 5 tầng, vì cùng một luật thường nằm rải rác (và đôi khi mâu thuẫn nhau):
DB constraint · validator/DTO · service layer · background job · UI (chỉ là gợi ý, không phải luật).
Bắt buộc soi: **tiền** (làm tròn, đơn vị nhỏ nhất, tiền tệ, thuế, hoàn tiền, đối soát), **thời gian**
(timezone, hạn, gia hạn, khóa sổ), **giới hạn** (quota, rate limit, hạn mức), **idempotency**
(webhook/retry xử lý trùng thế nào), **soft delete & audit**.

**⑤ Danh mục use-case (event storming ngược)**
Với mỗi luồng chính: `Actor → Command → điều kiện → thay đổi state → Event phát ra → Policy/hệ quả`.
Nhóm các event theo cụm dính nhau → ra **bounded context** → chính là ranh giới module khi dựng lại.

**⑥ Việc chạy nền + tích hợp ngoài**

```bash
grep -rniE "cron|schedule|@Scheduled|celery|sidekiq|queue|consumer|worker|publish|subscribe" -l . | head -20
grep -rn "http://\|https://" --include='*.go' --include='*.py' --include='*.ts' . | grep -v localhost | head -30
grep -rn "os.Getenv\|process.env\|os.environ\|ENV\[" . | sed 's/.*[(\[]//' | sort -u | head -60
```

> Danh sách biến môi trường = **bản đồ mọi thứ bên ngoài mà hệ thống phụ thuộc**. Luôn rút ra đầy đủ.

### 4.3 Khi repo quá lớn — chia việc

Repo > ~50 file cần đọc sâu → theo [[multi-agent]]: chia theo **6 nguồn ở 4.1**, tối đa **5 agent
song song**, mỗi agent 1 phạm vi + yêu cầu "trả kết luận + `file:line`, không dump nội dung file".
Gom lại, khử trùng lặp, chốt một lần. Việc tuần tự (schema → hiểu domain → mới đọc service) thì
không chia song song.

---

## 5. Phase 4 — Lọc: cái gì đáng lấy, cái gì nên bỏ

Đây là phần **"lấy toàn bộ cái tốt nhất"** — nghĩa là *chọn lọc*, không phải bê nguyên. Chấm từng
phần theo bảng, ghi thẳng vào blueprint:

| Hạng mục | Đánh giá | Quyết định | Lý do |
|---|---|---|---|
| vd: Máy trạng thái đơn hàng | Chặt, có test, chống double-charge | **LẤY** | Đúng chuẩn nghiệp vụ, port sang stack mình được |
| vd: Plugin system tự viết | 4k LOC, phục vụ marketplace của họ | **BỎ** | Tổ chức mình không có nhu cầu plugin bên thứ 3 |
| vd: Tự viết job queue | Hoạt động nhưng không có DLQ | **THAY** | Dùng [[rabbitmq]] có retry + DLQ sẵn |
| vd: Multi-tenant theo schema | Phức tạp, cho hàng nghìn tenant | **HOÃN** | Giai đoạn 1 single-tenant, chừa đường nâng cấp |

Bốn nhãn: **LẤY** (nghiệp vụ + thiết kế đúng) · **THAY** (ý tưởng đúng, cách làm của họ yếu, có
thứ tốt hơn) · **BỎ** (nhu cầu của họ, không phải của mình) · **HOÃN** (đúng nhưng chưa tới lúc).

Tiêu chí chấm: có test không · nghiệp vụ có đúng thật không (không chỉ "code đẹp") · độ phức tạp so
với giá trị mang lại · có phụ thuộc thứ mình không muốn nuôi không · có phù hợp quy mô mình không.

> Cảnh báo: dự án OSS nổi tiếng thường **over-engineer cho quy mô của họ** (multi-region, plugin,
> i18n 30 thứ tiếng, abstraction 5 lớp). Với 1 tổ chức 20 người, phần lớn cái đó là **nợ**, không
> phải tài sản. "Best practice của Netflix" ≠ best practice của bạn.

---

## 6. Phase 5 — Map sang bối cảnh của user (dùng câu trả lời Q3/Q4/Q5)

| Chiều | Cá nhân / nhóm nhỏ | Doanh nghiệp | Tổ chức có compliance |
|---|---|---|---|
| Auth | email+password + session đơn giản | + refresh rotation, khóa brute-force → [[auth-flow]] | + SSO/OIDC, MFA bắt buộc, session list |
| Phân quyền | 2 vai trò | RBAC bảng permission → [[RBAC]] | RBAC + audit log mọi thay đổi quyền |
| Hạ tầng | 1 VPS Docker Compose → [[docker]] | tách dev/prod, CI/CD → [[cicd]] | HA/failover → [[ha]], DR drill định kỳ |
| Backup | snapshot theo lịch → [[push-backup-gdrive]] | + kiểm tra restore hàng tháng | + event-driven [[backup]], immutable, RPO/RTO ký cam kết |
| Giám sát | log + healthcheck | Prometheus/Grafana → [[monitoring]] | SLO + error budget → [[observability]] |
| Thanh toán (VN) | — | VietQR/SePay → [[payment-gateway]] | + đối soát, sổ cái, audit trail |
| Dữ liệu | — | index + backup → [[db-index]] | phân loại PII, mã hóa at-rest, retention |

Việc phải làm ở phase này, ghi thành mục riêng trong blueprint:
- Cắt bớt phạm vi: từ N tính năng của repo → **M tính năng thật sự cần** (kèm lý do bỏ).
- Đổi phụ thuộc: cái gì trong repo không nuôi nổi → thay bằng cái đang có trong tổ chức.
- Thêm phần repo **không có** mà tổ chức bắt buộc phải có (audit, backup, hóa đơn VN, dấu thời gian,
  quy định lưu trữ dữ liệu…). Phần này **luôn có** và luôn bị quên.
- Port stack (nếu Q4 = đổi stack): tách rõ **ý tưởng port được** vs **mẹo đặc thù ngôn ngữ nên bỏ**.

---

## 7. Phase 6 — File output: `OSS-BLUEPRINT-<project>.md`

Đúng **1 file**, đặt ở gốc dự án đích (hoặc `.claude/references/` nếu là tri thức dùng lại). Khung
bắt buộc:

```markdown
# OSS Blueprint — <project> (<url> @ commit <sha>)
Ngày bóc tách: <YYYY-MM-DD> · License: <SPDX> · Chiến lược đã chọn: <A/B/C/D>
Mục đích của user: <Q1> · Bối cảnh đích: <Q3> · Stack đích: <Q4>

## 0. TL;DR — 10 dòng
Hệ thống này giải bài toán gì, cho ai, điểm mạnh thật sự, cái đáng lấy nhất, cái nên bỏ.

## 1. Cổng pháp lý
License, nghĩa vụ theo mục đích của user, chiến lược đã chọn + lý do,
ràng buộc khi dựng lại (được/không được chép gì).

## 2. Tổng quan hệ thống
Bài toán nghiệp vụ · người dùng · mô hình kiến trúc · các entry point.
```mermaid
flowchart TD
  ... sơ đồ thành phần thật, chỉ vẽ cạnh nào xác nhận được trong code ...
```

## 3. Glossary — ngôn ngữ nghiệp vụ
| Thuật ngữ | Nghĩa | Bảng/Model | Nguồn |

## 4. Actor & quyền
| Actor | Làm được gì | Không được làm | Nguồn |

## 5. Data model
ERD Mermaid + bảng: bảng · cột chính · ràng buộc · **ràng buộc đó mang luật nghiệp vụ gì**.

## 6. Máy trạng thái (mỗi thực thể có vòng đời)
```mermaid
stateDiagram-v2
  ...
```
+ bảng: chuyển trạng thái · ai kích hoạt · điều kiện · hệ quả · chuyển bị cấm.

## 7. Luật nghiệp vụ & bất biến
| # | Luật | Áp ở tầng nào | Nguồn `file:line` | Giữ / Đổi khi dựng lại |

## 8. Danh mục use-case
Mỗi use-case: Actor → Command → điều kiện → state đổi → Event → Policy → lỗi có thể xảy ra.

## 9. API surface
| Method | Path | Auth | Vào | Ra | Use-case tương ứng |

## 10. Việc chạy nền & tích hợp ngoài
Cron/worker/queue/webhook · dịch vụ ngoài · **toàn bộ biến môi trường** và ý nghĩa.

## 11. Bounded context đề xuất
Nhóm event → ranh giới module khi dựng lại. Cái nào là **core domain** (tự viết),
cái nào là **generic** (mua/dùng thư viện).

## 12. Đánh giá: LẤY / THAY / BỎ / HOÃN
Bảng Phase 4 đầy đủ, mỗi dòng có lý do.

## 13. Bài học rút ra (điểm mạnh + bẫy)
Quyết định thiết kế hay, và những chỗ họ làm sai/đang nợ kỹ thuật — để mình không lặp lại.

## 14. Bản thiết kế cho <tổ chức của user>
Phạm vi đã cắt · thay phụ thuộc · phần bắt buộc thêm · kiến trúc đích · stack đích.

## 15. Roadmap dựng lại
Giai đoạn 0/1/2/3 (mục 8 dưới đây), mỗi task có tiêu chí "xong là gì".

## 16. Chưa xác minh được
Mọi thứ ghi `> Not Found` hoặc cần đọc thêm — nêu rõ, không lấp liếm.

## 17. Phụ lục (Appendix)
Phần tra cứu, gom mọi dữ liệu thô ở cuối để thân blueprint gọn. Bắt buộc có:
- **17.1 Chỉ mục `file:line`** — bảng gom mọi anchor đã dùng, nhóm theo chủ đề (data model, auth, workflow…), để nhóm dựng lại tra ngược về repo gốc nhanh.
- **17.2 Bảng enum / dropdown đầy đủ** — mọi giá trị `*_dom` quan trọng (status, stage, type, priority, resolution, role…) với nguồn — vì luật nghiệp vụ mã hoá bằng dữ liệu, không được tóm tắt cụt.
- **17.3 Danh mục module / entity đầy đủ** — inventory toàn bộ (kể cả phần gắn nhãn HOÃN/BỎ), nhóm theo họ chức năng.
- **17.4 Toàn bộ sơ đồ Mermaid gom lại** — kiến trúc, ERD, state machine, các flow (conversion, campaign, workflow) — kể cả sơ đồ chưa vẽ ở thân.
- **17.5 Lệnh recon đã chạy** — để người khác tái lập được kết quả tại đúng commit.
```

---

## 8. Phase 7 — Roadmap dựng lại (mặc định 4 giai đoạn)

| GĐ | Tên | Nội dung | Xong là gì |
|---|---|---|---|
| **0** | Walking skeleton | 1 luồng xuyên suốt mỏng nhất: đăng nhập → thao tác lõi → lưu DB → hiện lại. Có CI + deploy được | Deploy được lên môi trường dev, có 1 E2E test xanh |
| **1** | Core domain | Các thực thể + máy trạng thái + luật nghiệp vụ ở mục 7 của blueprint | Test phủ hết chuyển trạng thái hợp lệ + bị cấm |
| **2** | Vành đai | Auth đầy đủ, phân quyền, thanh toán, thông báo, job nền, admin | Chạy thật được với người dùng nội bộ |
| **3** | Vận hành | Monitoring, backup + **diễn tập restore**, HA nếu cần, tài liệu | Có SLO, có drill, có runbook |

Nguyên tắc: **core domain tự viết** (đó là lợi thế của tổ chức), **generic thì dùng đồ có sẵn**
(auth, queue, storage, payment). Đừng làm ngược — tự viết queue rồi outsource nghiệp vụ lõi.

---

## 9. Chống bịa (bắt buộc)

- Mọi luật nghiệp vụ → trỏ `file:line`. Không trỏ được → không được đưa vào mục 7.
- Không tìm thấy → `> Not Found`, kèm chỗ đã tìm. Không suy diễn cho tròn mục.
- README nói khác code → ghi cả hai, đánh dấu **code thắng**.
- Không sáng chế endpoint/field/tên hàm "cho hợp lý". Sai một tên field là hỏng cả chuỗi phía sau.
- Ghi rõ **commit SHA** đã bóc tách — repo sẽ đổi, blueprint thì đứng yên.
- Cuối file luôn có mục 16 "Chưa xác minh được". Blueprint không có mục này = blueprint đang nói dối.

---

## 10. Anti-patterns

- Chạy `npm install`/`docker compose up` của repo lạ trước khi [`/repo-scan`](repo-scan.md) → đúng chỗ mã độc chờ.
- Bóc tách sâu rồi mới đọc LICENSE → tốn công vô ích, hoặc tệ hơn là dính copyleft vào sản phẩm.
- Tin README/docs thay vì migrations + tests → tài liệu OSS lệch code là chuyện thường ngày.
- Chép nguyên kiến trúc mà không hỏi "tổ chức mình có cần quy mô đó không" → over-engineer từ ngày đầu.
- Chỉ đọc HTTP handler, bỏ qua cron/worker/webhook → mất nguyên một mảng nghiệp vụ.
- Bỏ qua i18n/email template → mất từ vựng thật của người dùng, tự đặt lại tên sai nghĩa.
- Bỏ qua các bảng lookup/seed data → mất luật nghiệp vụ được mã hóa bằng dữ liệu (bậc giá, vai trò, trạng thái).
- Xuất ra 5-6 file rời rạc → user yêu cầu **1 file đầy đủ**; rời rạc là mất ngữ cảnh.
- Dán code gốc vào blueprint rồi gọi là "clean room" → không phải, và làm hỏng luôn phương án D.
- Viết code sản phẩm ngay trong lúc bóc tách → trộn hai chế độ tư duy, kết quả là bản sao lỗi.
- Nói "đã lấy toàn bộ nghiệp vụ" sau khi đọc 10% repo → nêu rõ độ phủ đã đọc, đừng khẳng định vống.

---

## 11. Checklist trước khi giao blueprint

```
Pháp lý
- [ ] Đã xác định LICENSE thật (kể cả thư mục ee/ enterprise/ và license của dependency)
- [ ] Đã đối chiếu nghĩa vụ với mục đích dùng (Q1) — SaaS/AGPL đã kiểm riêng
- [ ] Đã chốt chiến lược A/B/C/D + ghi lý do vào blueprint
- [ ] Nếu chọn D: blueprint chỉ mô tả hành vi, không chép cấu trúc/tên/comment của code gốc

An toàn
- [ ] Đã chạy /repo-scan trước, không chạy lệnh install/build nào của repo

Nghiệp vụ
- [ ] Đã đọc đủ 6 nguồn (schema · test · service · API · i18n · changelog)
- [ ] Glossary, actor+quyền, ERD, máy trạng thái, bảng luật, use-case, job nền, env vars — đủ cả 6 mục ở 4.2
- [ ] Mọi luật đều có file:line
- [ ] Đã liệt kê mọi entry point (HTTP, worker, cron, CLI), không chỉ HTTP

Lọc & map
- [ ] Mỗi phần đã gắn nhãn LẤY/THAY/BỎ/HOÃN kèm lý do
- [ ] Đã map sang bối cảnh Q3/Q4/Q5, có nêu phần bắt buộc thêm mà repo gốc không có

Output
- [ ] Đúng 1 file OSS-BLUEPRINT-<project>.md, đủ 17 mục
- [ ] Có commit SHA + ngày bóc tách
- [ ] Có mục 16 "Chưa xác minh được", nêu độ phủ đã đọc
- [ ] Có mục 17 "Phụ lục" đủ 5 phần (chỉ mục file:line, enum đầy đủ, module inventory, sơ đồ gom, lệnh recon)
- [ ] Roadmap 4 giai đoạn, mỗi task có tiêu chí hoàn thành
```

---

## 12. Khi nào dùng /oss-blueprint

- Có link 1 repo OSS và muốn **hiểu nghiệp vụ để tự dựng lại**, không chỉ để chạy nó.
- Đang phân vân **adopt / fork / tự viết** — Phase 1 + Phase 4 chính là để trả lời câu này.
- Muốn học cách một hệ thống trưởng thành xử lý một miền nghiệp vụ (đơn hàng, thanh toán, LMS…).
- **Không cần** nếu chỉ định cài rồi dùng nguyên → chạy [`/repo-scan`](repo-scan.md) rồi cài, xong.
- **Không cần** nếu muốn tài liệu kiến trúc cho chính dự án của mình → dùng
  [`/achitecture-plan`](achitecture-plan.md).

---

## 13. Nguồn tham khảo

- [Clean-room design — Wikipedia](https://en.wikipedia.org/wiki/Clean-room_design)
- [Can coding agents relicense open source through a "clean room" implementation? — Simon Willison](https://simonwillison.net/2026/Mar/5/chardet/)
- [Software architecture recovery — Wikipedia](https://en.wikipedia.org/wiki/Software_architecture_recovery)
- [ArchAgent: Scalable Legacy Software Architecture Recovery with LLMs (arXiv)](https://arxiv.org/html/2601.13007)
- [Context Map Discovery / reverse engineering — Context Mapper](https://contextmapper.org/docs/reverse-engineering/)
- [Extracting Business Rules from Legacy Systems — BPMInstitute](https://www.bpminstitute.org/resources/articles/extracting-business-rules-legacy-systems/)
- [AGPL-3.0 for SaaS, explained](https://fastcrw.com/blog/agpl-3-for-saas-explained)
- [The essential guide to AGPL compliance — Vaultinum](https://vaultinum.com/blog/essential-guide-to-agpl-compliance-for-tech-companies)
- [Build or Buy: identify core bounded contexts with Event Storming — Philippe Bourgau](https://philippe.bourgau.net/build-or-buy-software-identify-your-core-functional-areas-with-event-storming-and-ddd/)

> File này không phải tư vấn pháp lý. Quyết định thương mại có rủi ro license → hỏi luật sư.
