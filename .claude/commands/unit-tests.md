# /unit-tests — Language-Agnostic Unit Test Generator

> **Trigger**: User asks to write, generate, or improve unit tests for a file/class/function/module.
> **Goal**: Analyze code → propose test cases (Given-When-Then) for review → generate real test code → run it green.
> Adapted from [mavka-ai/unit-tests-skills](https://github.com/mavka-ai/unit-tests-skills) (Java-focused), generalized to every language + the Google "Testing on the Toilet" fidelity principles.

> **This file is the lean core — load it every run.** The heavy, situational detail lives in `unit-tests-rules/` and is read **only when the target needs it** (see the Load-on-demand table). This keeps context light for the common case.

---

## When to Trigger

- "write tests", "generate unit tests", "add test coverage", "test this function/class", "viết test", "thêm unit test"
- A new function/service/handler needs tests, or a bug fix needs a regression test.

Two modes — state which you're running:

| Mode | Flow | Use when |
|---|---|---|
| **Full** (default) | Analyze → propose cases → **get approval** → generate → run | User wants actual test files |
| **Cases-only** | Analyze → output GWT case list, stop | User wants to review strategy first ("just list the cases" / "chỉ liệt kê") |

---

## The Workflow (5 steps)

### Step 1 — Analyze context (STRICT order)
Read in this exact order — each step stops you from testing blind:
1. **Detect stack**: language + test runner + assertion/mock libs actually used (grep test files + manifest: `package.json`, `go.mod`, `pom.xml`, `pyproject.toml`/`requirements.txt`, `*.csproj`, `Gemfile`, `Cargo.toml`). Never assume. Unfamiliar stack? → read `unit-tests-rules/frameworks.md`.
2. **Production code (target) — FIRST**: map every branch, return, thrown error. Behavior = what the code *does*, not what a name/test implies.
3. **Existing tests — SECOND**: read fully → learn house style + which behaviors are already covered → add **only the gaps**, never duplicate.
4. **Dependencies — THIRD**: follow imports to referenced types (DTOs, entities, enums, collaborators) — you can't test inputs/outputs you don't understand.

> Order = truth → gaps+style → data shapes. Reading tests/names before the production code makes you assert what the code *should* do, not what it *does*.

### Step 2 — Draft the test plan (deliberate, before any code)
Produce a **test plan** — the intentional list of cases, not an afterthought. Enumerate every distinct behavior (INCLUDE/EXCLUDE below); collapse "same behavior × many inputs" into one parameterized case (Core Rule 5). If the target touches money/time/permissions/state/async/DB, **load the matching rule file** (table below) before drafting. Output as a Given-When-Then list — one case per distinct branch/outcome.

### Step 3 — Review the test plan (Full mode only)
Present the test plan, get approval **before** writing code. `AskUserQuestion` for a real choice (framework ambiguity); otherwise a short "Proceed with these N cases?". Skip in Cases-only mode.

### Step 4 — Generate test code
Write real, idiomatic tests following Core Rules + the project's existing conventions. One approved case → one focused test.

### Step 5 — Verify against the real repo
If the repo has a working runner, you **must actually run** the new tests — use the project's real runner (check `package.json` scripts / Makefile / CI), not a guessed command.

Triage the result:
- **All green** → done.
- **A test fails** → run **Failure Review** below; fix the correct side. Never loosen a test just to make it pass.
- **Runner unavailable** (missing deps / sandbox can't execute) → say so **explicitly**, mark tests *written but not executed*. Never imply they passed.

> A suite you didn't run is a **claim, not a result.**

**Failure Review** — per failing test, state one verdict (don't re-run blindly):
1. **Real bug** — production code is wrong. Report the exact branch/input; don't rewrite the test to match buggy output.
2. **Wrong expectation** — test misread the code. Fix the assertion to the real expected behavior.
3. **Over-coupled** — asserts implementation detail (call order, private state, a query verify). Loosen toward behavior.
4. **Missing branch** — reveals an uncovered path. Add the case.

---

## Core Rules (always apply)

1. **Test behaviors, not methods — one scenario per test.** One method with 3 outcomes → 3 tests, one scenario each, so a red test points at exactly **one** behavior (this is what makes failures actionable — Rule 4). If a name needs "and", split it.
2. **Given-When-Then, no logic in assertions.** Setup → single action → verify. Assert **literal expected values** (`toBe(30)`, not `toBe(price*qty)`) — never recompute production logic (= change-detector test). **DAMP/KISS > DRY**: a little repetition beats a helper that hides the assertion.
3. **Narrow assertions — assert only what the behavior is about.** Don't assert every field of a returned object "just because"; assert the specific output(s) this test verifies. Broad whole-object asserts break on unrelated changes and bury which field actually matters. (Structured payload → capture + assert only the relevant fields.)
4. **Failures must be actionable.** The test **name + failure message alone** should be enough to start debugging — without reading the test body. Use the `{unit}_{given}_{expected}` name and assertions that surface expected-vs-actual; add a custom message when the assertion isn't self-explanatory.
5. **Parameterized / table-driven for one behavior × many inputs.** Same logic over many input→output pairs → **one** parameterized test with **named cases** (JUnit `@ParameterizedTest`, Go table-driven `t.Run(name, …)`, pytest `@pytest.mark.parametrize(ids=…)`, xUnit `[Theory]/[InlineData]`), not N copy-pasted tests — a failing row must still name *which* input. But keep **distinct behaviors/branches** in separate tests; don't jam different branches into one table.
6. **Keep cause next to effect.** Setup that matters lives *inside* the test, not a distant `beforeEach`.
7. **Test through public APIs**, not private methods.
8. **Deterministic.** No real clock/network/random/filesystem in a unit test — inject/stub them. Same input → same result.
9. **Mock only what you own, as little as possible.** real > fake > mock. Wrap third-party types. Stub queries, `verify()` only state-changing commands. Assert only the args that matter. → deeper: `unit-tests-rules/mocking-fidelity.md`.
10. **Clean test data** via builders/factories — each test states only the fields it cares about.
11. **A good test is Clear, Complete, Concise, Resilient** — and can fail for one real, unique reason.

---

## Load-on-demand rules (read the file only when it applies)

| If the target… | Read |
|---|---|
| involves money, time/timezone, locale, null/empty, permissions, state transitions, or validation | `unit-tests-rules/edge-cases.md` |
| does anything async — queues, webhooks, retries, background jobs, concurrency | `unit-tests-rules/async.md` |
| is a repository/DAO, or a service that touches a DB / another service | `unit-tests-rules/integration-boundary.md` |
| needs non-trivial mocking decisions | `unit-tests-rules/mocking-fidelity.md` |
| is in an unfamiliar stack, or you're unsure of the naming idiom | `unit-tests-rules/frameworks.md` |

Skip any file that doesn't apply — pure sync logic with no I/O usually needs none of them.

> **If a rule file is missing** (the command was installed/copied without its `unit-tests-rules/` folder): do **NOT** silently skip the concern. The row's own description is the minimum bar — cover that concern from first principles anyway, and tell the user the fragment was unavailable so it can be restored. A missing fragment must degrade to "covered from general knowledge + flagged", never to "not covered". These fragments must travel **with** this file when distributed.

---

## Test Case Strategy — INCLUDE / EXCLUDE

**INCLUDE:** each distinct branch + outcome (success, error/exception, validation) · each unique return value or exception type · distinct error responses separately (400 vs 401 vs 403 = 3 cases) · negative/validation cases · boundaries the code handles (empty, zero, null *when the type allows*, min/max) · security/authorization branches.

**EXCLUDE:** duplicate scenarios hitting the same branch with the same result · collection-size variations unless the code branches on size · speculative cases the code doesn't handle (exotic Unicode, giant payloads) · null args for non-nullable params · multiple tests for the *same* exception from the *same* branch · getters/setters/trivial pass-throughs.

> Goal: **max distinct-behavior coverage, min redundancy.** Every test must fail for a reason no other test covers.

---

## Coverage (a gauge, not a goal)

- Don't optimize for a coverage number — 100% with weak assertions is worse than 80% with strong ones.
- Prioritize by importance: branch/decision logic > business rules (money, permissions, state) > error paths > trivial mappers.
- Use coverage to find **gaps**, not to declare success. Never add a test purely to raise the number.

---

## Output Format — the test plan (Given-When-Then)

```
## Test Cases for {Unit}.{operation}

### 1. {testName}   ← format: {unit}_{givenState}_{expectedOutcome}, adapted to the language's idiom
- **Given:** {preconditions / input state}
- **When:** {the single action under test}
- **Then:** {expected observable outcome}
- **Branch:** {which code path this covers}
```

In Full mode this is what the user approves in Step 3 before any code is written. (Naming idioms per language → `unit-tests-rules/frameworks.md`.)

---

## Anti-patterns

- Booting the full framework/DB for a *unit* test → isolate with doubles (it's an integration test).
- Logic in assertions / re-implementing production logic → assert independent literals.
- Setup in a distant `beforeEach` hiding cause → keep cause next to effect.
- One test asserting many behaviors → split; a failure should point to one cause.
- Over-verifying irrelevant mock args, or `verify()`-ing query/getter calls → assert only relevant, verify only commands.
- Mocking a third-party type directly → wrap it, mock your own interface. Over-mocking → real > fake > mock.
- Testing private methods directly → go through the public API.
- Asserting the whole returned object when the test is about one field → narrow the assertion.
- N copy-pasted tests differing only by input → one parameterized/table-driven test with named cases.
- Opaque failures (vague name, bare `assertTrue`) → name `{unit}_{given}_{expected}` + expected-vs-actual message so the failure is debuggable on its own.
- Declaring "done" without running the tests → verify green or say it wasn't run.
- Generating code before the user approves the test plan (Full mode) → propose first.

---

## Checklist Before "Done"

- [ ] Read in order: **production code → existing tests → dependencies**; stack detected (not assumed)
- [ ] Added only uncovered behaviors; one scenario per test, GWT, no logic in assertions
- [ ] Assertions are **narrow** (only the fields the behavior needs) and **actionable** (name + message point at the cause)
- [ ] "Same behavior × many inputs" collapsed into a parameterized/table-driven test with named cases
- [ ] (Full mode) A deliberate **test plan** was drafted and approved before code
- [ ] Every INCLUDE branch covered; no EXCLUDE redundancy
- [ ] Loaded + applied the relevant on-demand rule(s) (edge-cases / async / integration-boundary / mocking) where the target needed them
- [ ] Unit tests isolate I/O, time, randomness — deterministic; no real DB/socket in a unit test
- [ ] Names follow `{unit}_{given}_{expected}` in the language's idiom
- [ ] Coverage used to find gaps, not chased as a number
- [ ] Tests **ran green** on the real runner — or explicitly marked "written, not executed"
- [ ] Any failure triaged (real bug / wrong expectation / over-coupled / missing branch), not silently loosened
