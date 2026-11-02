# unit-tests · Mocking & Test Fidelity

> Load this when a target needs non-trivial mocking decisions. Deep-dive behind Core Rule "mock only what you own".
> Source: Google Testing Blog / "Testing on the Toilet".

They decide *how* you isolate — get them wrong and tests pass while the code is broken, or break on every harmless refactor.

1. **Fidelity hierarchy: real > fake > mock.** Prefer the real implementation when it's fast and deterministic. If not, use a **fake** (lightweight working impl — in-memory repo, fake clock). Reach for a **mock/stub** only as last resort. Every mock is an assumption about a collaborator; the more you mock, the more your test can pass while production fails. *(HIGH — "Increase Test Fidelity By Avoiding Mocks".)*
2. **Don't mock types you don't own.** Never mock a third-party/library type directly (SDK client, HTTP lib, driver) — you'd assert behavior you don't control and that changes on upgrade. **Wrap it** behind your own thin interface and mock *that*. *(HIGH — "Don't Mock Types You Don't Own" + "Separation of Concerns? That's a Wrap!".)*
3. **Only verify state-changing calls, never queries.** Assert commands happened (`save`, `send`, `delete`, `charge`) — do **not** `verify()` query/getter calls (`findById`, `get`, `exists`). Stub queries to supply data; verifying them couples the test to the call sequence. *(HIGH — "Only Verify State-Changing Method Calls".)*
4. **No change-detector tests.** A test that re-implements/mirrors production logic (same math, branching, serialization) only detects that code changed — not that it's wrong. Assert **independent literal expected values**. If changing correct code forces a test change, it's a change-detector. *(HIGH — "Change-Detector Tests Considered Harmful".)*
5. **DAMP over DRY.** Descriptive And Meaningful Phrases beat Don't-Repeat-Yourself — a test should read top-to-bottom in isolation; a little repetition beats a helper that hides setup or assertion. *("Tests Too DRY? Make Them DAMP!".)*
6. **Exercise real contracts for service calls.** Testing code that calls another service → prefer a **fake/hermetic server** honoring the real contract over mocking the client, so a contract change is caught. *(MEDIUM — "Exercise Service Call Contracts in Tests".)*
7. **For UI logic, follow the user.** Test what the user observes/does (rendered output, events, resulting state), not internal component methods or lifecycle internals. *(LOW / frontend — "Testing UI Logic? Follow the User!".)*
8. **Capture args for structured payloads.** Asserting what a collaborator was called with for a DTO → capture and assert the fields (`ArgumentCaptor`, `mock.calls`, `assert_called_with`), not a blanket `any()`. Assert only the args that matter; wildcard the rest.
9. **Explicit literals for serialized data.** Assert against explicit expected JSON/string literals, not by re-running the same serializer the production code uses (that tests the serializer against itself).

10. **Prefer state testing over interaction testing.** Assert the **resulting state/return value** (what the code produced) over `verify()`-ing that a call happened. Interaction tests couple to *how* the code works; state tests check *what* it achieves. Use interaction verification only when the effect is the call itself (an email sent, a row saved) and there's no observable state to assert. *(HIGH — "Testing State vs. Testing Interactions".)*
11. **Don't overuse mocks — cap ~1-2 per test.** Needing 3+ mocks to set up one test is a **design smell**: the unit is doing too much, or you're mocking collaborators you should be using for real / as a fake. Extract logic or introduce a fake instead of piling on mocks. *(HIGH — "Don't Overuse Mocks".)*
12. **Fake at the lowest layer.** When you do use a fake, fake the *lowest-level* seam (the repository/gateway you own), not a high-level service in the middle — so more of your real code runs under test. *(HIGH — "Fake Your Way to Better Tests".)*

## Know your test doubles (use the right one, name it right)

| Double | What it does | Use for |
|---|---|---|
| **Dummy** | Passed but never used; fills a parameter slot | Satisfying a signature |
| **Stub** | Returns canned data on call | Feeding **queries** (input to the code) — never verify a stub |
| **Fake** | A real, lightweight working implementation (in-memory repo, fake clock) | The preferred double — real behavior, fast + deterministic |
| **Spy** | Records how it was called, for later inspection | Checking a **command** happened, when you can't assert state |
| **Mock** | Pre-programmed with expectations, fails if they aren't met | Last resort — verifying a specific interaction is the behavior |

Rule: **stub the queries, spy/mock only the commands, prefer a fake over either.** Don't `verify()` a stub, don't stub a mock's return just to also verify it as a query. *(HIGH — "Know Your Test Doubles".)*

## Injecting seams for testability

- **Break static cling.** A hard-coded static/global call (`System.now()`, `Singleton.getInstance()`, a static util doing I/O) can't be substituted → wrap it behind an injectable interface. *(MEDIUM — "Defeat Static Cling" / "Using DI to Avoid Singletons".)*
- **Constructor injection** of collaborators (clock, random, repo, HTTP) is what makes a unit testable at all — if a target reaches out to a global to do I/O, that's the first thing to refactor, or flag it.

> Rule of thumb: **stub queries, verify commands, mock only what you own, assert literals, prefer state over interactions, ≤2 mocks.** If a passing test wouldn't catch a real regression, it's testing the wrong thing.
