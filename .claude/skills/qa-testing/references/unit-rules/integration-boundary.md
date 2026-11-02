# unit-tests · Unit vs Integration Boundary

> Load this when the target is a **repository/DAO** or a **service that touches a DB or another service** — the case people accidentally turn into a slow integration test and call a unit test.

| Target | Unit test approach | Push to integration test |
|---|---|---|
| **Service / use-case** with a repo dependency | Mock/fake the repository interface; assert the service's logic, branching, and what it asks the repo to do | The service + real repo + real DB wired together |
| **Repository / DAO** (the code that *is* the query) | Usually **not** a unit test — its whole job is to talk to the DB. Don't mock the driver to "unit test" a query; you'd be asserting your own mock | **Integration test** against a real DB (Testcontainers, embedded/in-memory DB, or a test schema). The query correctness IS the thing under test |
| **ORM mapping / migrations** | — | Integration only — needs a real engine |
| **Pure logic** (calculations, validation, mapping) with no I/O | Unit test, no doubles needed | — |

Rules:
- A **unit test never opens a real socket, file, or DB connection.** If it needs one, it's an integration test — say so, and either write it as one (clearly separated: `*_integration_test`, tagged, or in the integration suite) or ask whether that's in scope.
- **Don't mock a DB driver / query builder to fake a query result** and pretend the query is tested — that only tests your mock. Query correctness belongs in an integration test with a real (or realistic embedded) DB.
- Testing a service? Mock the **repository interface you own**, not the DB library underneath it (see mocking-fidelity: "don't mock types you don't own").
- No integration setup and one is needed? Don't silently fake it — flag that the repo/DB layer needs an integration test and let the user decide.

## Related language-specific rules

- **Unit ≠ integration.** Don't boot the whole app/container (no `@SpringBootTest`, no full DI container, no real DB) in a unit test.
- **Verify logs/output explicitly** only when logging *is* the behavior (log-capture extension / captured stdout), not incidentally.
- **Isolate I/O and time.** Inject clock, IDs, random, HTTP, and DB as dependencies so they can be stubbed deterministically.
- **Match project conventions** over any default whenever the repo already has an established test style.
