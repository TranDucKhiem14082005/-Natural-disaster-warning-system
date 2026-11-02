# unit-tests · Async / Concurrency / Retry / Idempotency

> Load this when the target does anything async — queues, webhooks, retries, background jobs, concurrent access.

Most real backend bugs aren't in the sync happy path — they're in timing. Add cases for:

- **Timeout / slow dependency** — collaborator exceeds the deadline → code times out cleanly (not hangs, not swallows).
- **Retry behavior** — transient failure then success: retried the right number of times, with backoff if specified; a permanent failure is **not** retried forever.
- **Idempotency** — the same request/message delivered twice produces **one** effect (one charge, one row), not two. Critical for webhooks, queues, at-least-once delivery.
- **Race / ordering** — two operations on the same resource interleave (double-spend, lost update, check-then-act). Assert the guard (lock, version, unique constraint, compare-and-set) holds.
- **Cancellation** — a cancelled/aborted context stops the work and cleans up (no leaked goroutine/promise/thread).
- **Partial failure** — in a multi-step flow, step 2 fails after step 1 succeeded → rolls back or compensates, doesn't leave half-done state.
- **Ordering guarantees** — if order matters (events, sagas), out-of-order arrival is handled or rejected, not silently mis-applied.

> Keep these **deterministic**: drive time with a fake clock, force failures with a stubbed collaborator, control interleaving explicitly (barriers/latches/awaits) — never `sleep()` and hope. A flaky concurrency test is worse than none.
