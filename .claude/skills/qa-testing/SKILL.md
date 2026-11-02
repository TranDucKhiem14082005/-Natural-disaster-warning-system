---
name: qa-testing
description: QA / Test Engineer trọn gói - thiết kế case, viết và CHẠY test ở đúng tầng (unit, integration, business, E2E) cộng các tầng cắt ngang (security, performance, reliability, eval AI), phân loại test đỏ, và trả verdict SHIP/BLOCK có bằng chứng. Gộp agent qa-test-engineer + /unit-tests (+ unit-tests-rules) + e2e-testing (tester-army/e2e, Playwright). Dùng khi user nói "viết test", "unit test", "thêm test coverage", "test e2e", "end-to-end", "kiểm thử", "QA tính năng này", "regression test cho bug", "bug bash", "săn bug", "có ship được không", "quality gate", "dựng test cho project", hoặc khi một lần chạy test bị fail.
---

# qa-testing - Chứng minh build làm đúng điều spec hứa

> "Test là một bản spec chạy được. Suite chưa chạy là **lời tuyên bố**, không phải kết quả."
>
> Test **hành vi**, không test cách cài đặt. Một test đỏ phải chỉ đúng **một** nguyên nhân thật.

Vị trí trong vòng đời: `Plan -> Design -> Build -> [TEST] -> Deploy -> Maintain`.
Đầu vào: code + hành vi cần chứng minh (spec, acceptance criteria, bug report).
Đầu ra: suite test xanh, có ý nghĩa + **verdict SHIP / BLOCK** cho bước Deploy.

---

## 1. Bảy tầng test - biết mình đang viết tầng nào

```
        ^  ít, chậm, đắt
   4. E2E           luồng người dùng thật qua UI (chỉ luồng sống còn)
   3. Business      nghiệp vụ: auth, RBAC, state machine, tiền, thứ tự
   2. Integration   API <-> DB / Redis / queue / webhook, contract
   1. Source        unit (FE/BE), type, lint, secret scan
        v  nhiều, nhanh, rẻ  ->  đáy rộng
   -- cắt ngang mọi tầng --
   5. Performance   load, stress, spike, soak, volume
   6. Security      authn/z, IDOR, injection, XSS, rate limit, prompt injection
   7. Reliability   retry, idempotency, timeout, backup/restore, rollback, chaos
```

Tầng 1-4 là **kim tự tháp**: đáy rộng rẻ, đỉnh hẹp đắt. **Đặt mỗi check ở tầng rẻ nhất chứng minh được nó.** Đừng E2E thứ unit test chứng minh được.

---

## 2. Định tuyến - đọc file nào cho việc nào

| Việc | Đọc |
|---|---|
| Hàm / class / service / handler cần unit test | [references/unit-tests.md](references/unit-tests.md) |
| ...đụng tiền, thời gian, null, quyền, trạng thái, validation | + [unit-rules/edge-cases.md](references/unit-rules/edge-cases.md) |
| ...async, queue, webhook, retry, job nền | + [unit-rules/async.md](references/unit-rules/async.md) |
| ...repository / DAO / service gọi DB hoặc service khác | + [unit-rules/integration-boundary.md](references/unit-rules/integration-boundary.md) |
| ...cần quyết định mock khó | + [unit-rules/mocking-fidelity.md](references/unit-rules/mocking-fidelity.md) |
| ...stack lạ, không chắc idiom đặt tên | + [unit-rules/frameworks.md](references/unit-rules/frameworks.md) |
| Luồng người dùng xuyên nhiều màn (web / mobile), bug bash, migrate Playwright | [references/e2e/README.md](references/e2e/README.md) -> file con theo bảng ở đó |
| Nghiệp vụ, ma trận RBAC, security, performance, reliability, eval AI | [references/cross-cutting.md](references/cross-cutting.md) |
| Project **chưa có** test runner | [references/bootstrap.md](references/bootstrap.md) |

Chỉ đọc file cần cho việc đang làm. Hàm thuần không I/O thường chỉ cần `unit-tests.md`.

---

## 3. Workflow 6 bước

### Bước 1 - Khảo sát (thứ tự cố định)
1. **Stack + runner thật**: đọc manifest (`package.json` scripts, `go.mod`, `pyproject.toml`...), CI, file test có sẵn. Không đoán lệnh.
   Không có runner -> [bootstrap.md](references/bootstrap.md), **hỏi user trước khi thêm dependency**.
2. **Code production TRƯỚC**: liệt kê mọi nhánh, giá trị trả về, lỗi ném ra. Hành vi = điều code *làm*, không phải điều tên hàm gợi ý.
3. **Test có sẵn SAU**: học style + biết hành vi nào đã phủ -> chỉ thêm **phần thiếu**.
4. **Dependency CUỐI**: DTO, entity, enum, collaborator - để hiểu input/output.

### Bước 2 - Lập test plan (trước khi viết code)
- Liệt kê từng hành vi khác nhau dạng **Given-When-Then**, ghi tầng + nhánh code nó phủ.
- Mỗi case chọn **tầng rẻ nhất** (mục 1). Cùng hành vi x nhiều input -> 1 test parameterized.
- Bug fix -> bắt buộc 1 **regression test** tái hiện đúng bug (đỏ trước khi sửa, xanh sau khi sửa).

### Bước 3 - Duyệt plan
Trình plan, hỏi "Làm N case này?". Lựa chọn thật (framework, có dựng DB test không) -> `AskUserQuestion`.
User chỉ muốn xem chiến lược ("chỉ liệt kê case") -> dừng ở đây.

### Bước 4 - Viết test
Theo Core Rules (mục 4) + convention của repo. Một case đã duyệt -> một test tập trung.

### Bước 5 - Chạy trên runner thật
- Xanh hết -> sang Bước 6.
- Có test đỏ -> **Triage** (mục 5), sửa đúng phía. Không nới test cho qua.
- Không chạy được (thiếu deps, sandbox) -> nói rõ **"đã viết, chưa chạy"**. Không bao giờ ngụ ý là đã pass.
- E2E: đo flaky bằng chạy lặp (`--repeat-each 10 --retries 0`), không bật retry để che.

### Bước 6 - Verdict
Xuất **Quality Gate Verdict** (mục 6): SHIP hoặc BLOCK, kèm bằng chứng.

---

## 4. Core Rules (mọi tầng)

1. **Một kịch bản mỗi test.** Tên cần chữ "và" -> tách.
2. **Given-When-Then, không logic trong assertion.** Assert giá trị literal (`toBe(30)`), không tính lại (`toBe(price*qty)`).
3. **Assertion hẹp**: chỉ assert field hành vi đó quan tâm.
4. **Lỗi đọc là hiểu**: tên `{unit}_{given}_{expected}` + message expected-vs-actual đủ để bắt đầu debug.
5. **Parameterized** cho một hành vi x nhiều input, mỗi dòng có tên. Nhánh khác nhau -> test riêng.
6. **Nguyên nhân cạnh kết quả**: setup quan trọng nằm trong test, không giấu ở `beforeEach` xa.
7. **Qua public API**, không test hàm private.
8. **Deterministic**: unit test không dùng clock/network/random/filesystem thật. E2E không `sleep`, dùng matcher có timeout / `expect.poll`.
9. **Mock ít nhất có thể**: real > fake > mock. Chỉ mock thứ mình sở hữu, bọc thư viện bên thứ ba.
10. **Dữ liệu test sạch**: builder/factory, tên duy nhất, dọn sau test. Không dùng chung dữ liệu với dev/prod.
11. **Secret không nằm trong code test**: lấy từ env / credentials store.
12. **Coverage là thước đo, không phải mục tiêu**: dùng để tìm lỗ hổng, không chạy theo con số.

---

## 5. Triage - mỗi test đỏ một kết luận

| Kết luận | Nghĩa | Làm gì |
|---|---|---|
| **Bug thật** | Code production sai | Báo `file:line` + input -> output sai. **Không** sửa test cho khớp code lỗi |
| **Kỳ vọng sai** | Test hiểu sai code | Sửa assertion theo hành vi đúng |
| **Dính chi tiết cài đặt** | Assert thứ tự gọi, state private, query | Nới về phía hành vi |
| **Thiếu nhánh** | Lộ ra đường chưa phủ | Thêm case |
| **Flaky** (E2E / async) | Pass/fail ngẫu nhiên | Tìm gốc (race, dữ liệu dùng chung, chờ thiếu). Không thêm retry/sleep |

E2E đỏ -> tra bảng mã lỗi trong [e2e/debugging.md](references/e2e/debugging.md).

---

## 6. Quality Gate Verdict (gửi cho bước Deploy)

```markdown
## Test verdict - [tính năng] - SHIP / BLOCK

### Coverage
| Tầng | Số case | Kết quả |
|------|--------:|:-------:|
| Unit                  | 12 | ✅ |
| Integration           | 5  | ✅ |
| Business (RBAC, ...)  | 4  | ✅ |
| E2E (luồng sống còn)  | 2  | ✅ |
| Security              | authz, IDOR | ✅ |

### Đã chạy trên runner thật
- [x] Có - xanh hết   (hoặc: BLOCK - N test đỏ, xem dưới)
- Lệnh: `npm test` · thời gian: 14s · flaky: 0/10 lần lặp

### Lỗi chặn ship
- [Bug thật] `src/x.js:42` - given ... -> nhận ..., mong đợi ...

### Chưa phủ (rủi ro chấp nhận)
- [hạng mục + lý do]
```

**BLOCK** khi: còn test đỏ là bug thật · test chưa chạy được mà tính năng đụng auth/tiền/dữ liệu · luồng sống còn chưa có E2E hoặc kiểm tra tay.

---

## 7. Red flags - dừng lại xem lại

- Nói "đã viết test" mà chưa chạy.
- Một test assert nhiều hành vi.
- Tính lại logic production trong assertion.
- Bật cả framework + DB cho một **unit** test.
- Chạy theo % coverage bằng assertion yếu.
- E2E cho thứ unit test chứng minh được (kim tự tháp lộn ngược).
- Tính năng LLM chỉ có unit test, không có eval trên golden set.
- Chuyển sang Deploy khi còn lỗi đã biết mà không ghi rõ.
- Sửa test cho xanh thay vì sửa bug.

---

## 8. Xong khi

- [ ] Đọc đúng thứ tự: code production -> test có sẵn -> dependency; stack đã xác định, không đoán.
- [ ] Có test plan GWT, đã duyệt (trừ khi user bảo cứ làm).
- [ ] Mỗi case đúng tầng rẻ nhất; bug fix có regression test.
- [ ] Đã đọc + áp các rule on-demand mà target cần.
- [ ] Test **chạy xanh trên runner thật** - hoặc ghi rõ "đã viết, chưa chạy".
- [ ] Mọi test đỏ đã triage, không nới bừa.
- [ ] E2E: không `sleep`, không `test.only`, flaky = 0.
- [ ] Đã xuất Verdict SHIP / BLOCK.

---

## 9. Phối hợp

| Với | Trao đổi |
|---|---|
| Dev (Build) | Nhận code + hành vi cần chứng minh; trả bug thật, không bắt lỗi vụn |
| PM | Map acceptance criteria -> test case; xác nhận "build == spec" |
| DevOps | Gắn suite vào CI (`/cicd`), thống nhất cái gì chặn merge |
| SRE | Chuyển phần reliability/chaos cần môi trường giống prod |

Công cụ liên quan: `/pentest-suite` (có authorization), `/repo-scan`, `security-review`, `/observability`, `/frontend`, `frontend:testing`.

**Không dùng skill này để**: viết tính năng (Build) hay deploy (Deploy).

---

## Nguồn

Gộp và Việt hoá từ [fdhhhdjd/AI-Agent-Master](https://github.com/fdhhhdjd/AI-Agent-Master): `agents/qa-test-engineer.md`, `commands/unit-tests.md` + `commands/unit-tests-rules/*`, `skills/e2e-testing/*`.
Phần E2E dựa trên [tester-army/e2e](https://github.com/tester-army/e2e) (Apache-2.0) - xem ghi chú bản quyền cuối [references/e2e/README.md](references/e2e/README.md).
