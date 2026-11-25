# @repo/db

Drizzle schema, migrations, queries and seeds. Commands: `docs/development.md`.

## Schema changes

- Change the schema only through `pnpm db:generate`. Inspect the generated SQL in `src/migrations/`, then run `pnpm db:migrate`.
- `db:push` is not part of the approved workflow. Verification must use the schema that the migrations produce.

## Tests

- Tests create and migrate `harmonogram_us_test` automatically and truncate only that database. **Never point tests at the dev DB.**
- Regression coverage for concurrency is in `test/concurrency.test.ts`. Extend it when you change locking or seat counts.

## Invariants

- Never write `event_seat_counts` or `agenda_item_seat_counts` directly, seeds included. Postgres triggers keep them in sync (`src/migrations/0003_seat_count_triggers.sql`).
- Before you change registrations, groups, capacity or waitlists, read `docs/data-flows.md`. It covers the row-lock order, lock-then-recount, waitlist promotion in the same transaction, and approval rules.
