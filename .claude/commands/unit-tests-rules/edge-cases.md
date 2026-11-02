# unit-tests · Domain Edge Cases

> Load this when the target touches **money, time, permissions, state, or validation** — the business bugs, not the syntax ones.

The INCLUDE list covers *code* branches. These are the **business** edge cases that don't look like branches but are where real money-losing bugs hide. Scan the target and add a case when present — don't wait for an explicit `if`:

| Category | What to test | Classic bug it catches |
|---|---|---|
| **Money / amounts** | Rounding direction, precision (never `float` for currency), smallest unit (cents), negative/zero, currency mismatch, overflow | Rounding half-up vs half-even losing cents at scale |
| **Time / timezone** | UTC vs local, DST boundary, midnight rollover, month/year end, leap year, "start of day" per timezone | Off-by-one-day because server is UTC and user isn't |
| **Locale / i18n** | Decimal comma vs dot, uppercase in Turkish (`i`/`İ`), date formats, sorting/collation | `"1.000"` parsed as 1 instead of 1000 |
| **Null / empty / missing** | `null` vs `""` vs `0` vs absent field vs empty collection — each distinct when the type allows it | Empty list treated as "all" instead of "none" |
| **Boundaries** | min, max, min-1, max+1, off-by-one on ranges and pagination | `<=` vs `<` on a limit |
| **Permission matrix** | For each role × action: allowed / forbidden(403) / unauthenticated(401) / not-found(404). Test the *deny* paths, not just the happy allow | Owner-only action accessible by any logged-in user |
| **Status / state transitions** | Every legal transition **and** rejected illegal ones (can't refund a `pending` order, can't cancel a `shipped` one) | An illegal transition silently allowed |
| **Validation matrix** | Each field × each rule (required, length, format, range) — one failing case per rule + the all-valid case | A regex that accepts an invalid email |
| **Idempotency / uniqueness** | Duplicate submit, unique-constraint violation, "already exists" path | Double-charge on a retried request |

> Rule of thumb: for anything involving **money, time, permissions, or state**, assume there's an edge case the code forgot — write the test that proves it handles it or doesn't.
