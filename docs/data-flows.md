# Registration, live sync and jobs

Read before changing capacity, registration, waitlists, groups, Electric shapes or transactional jobs. These invariants span packages and apps.

## Database capacity and concurrency

`event_seat_counts` and `agenda_item_seat_counts` are maintained by Postgres triggers from registration rows and capacity columns (`0003_seat_count_triggers.sql`). **Never write these count tables directly**, including from seeds. `CHECK (seats_remaining >= 0)` enforces capacity.

Refresh functions must first lock the count row, then recount in a separate statement (migration `0006`). Under READ COMMITTED, a single UPDATE that waits for the lock recounts using a stale snapshot. Regression coverage: `packages/db/test/concurrency.test.ts`.

Only `registered` registrations take a place; `waitlisted` registrations wait in `created_at` order. Groups also hold places through the count triggers. Every operation freeing capacity (withdrawal, higher limit, smaller/closed/expired group) must promote from the waitlist in the same transaction with the event row locked; preserve the existing promotion/notification helper (`promoteFromWaitlist` / the current notifying wrapper).

Global row-lock order:

1. `events` row.
2. `agenda_items` rows ordered by ID.
3. `registration_groups`.
4. `registration_group_members`.
5. Count rows (locked by triggers).

Foreign-key insertion takes a key-share lock on the parent: lock parents first. Mutations return the Postgres transaction ID via `queries/txid.ts` for live-sync confirmation.

## Electric → TanStack DB → UI

1. Declare shapes once in `@repo/collections/shapes` (proxy path, table, columns).
2. Each route under `apps/web/src/routes/api/electric/` delegates to `proxyShape()` from `@repo/collections/electric-proxy`. Forward only Electric protocol parameters. The server owns table, columns and filter, and adds `ELECTRIC_SECRET` server-side.
3. Collections use `shapeUrl(shapes.x.path)`. Electric requires an **absolute URL**; a relative URL silently fails to sync.
4. To add a live table, add a shape, proxy route and collection.
5. Registration actions go through `useRegistrationActions` in `apps/web/src/lib/registration/`: call server, await its `txid` on the collection changed by that action, refetch if Electric does not confirm in time.

Keep exactly one `@tanstack/db` version, shared by `@tanstack/react-db` and `@tanstack/electric-db-collection`, or collection types break. Update the root `pnpm.overrides` pin and dependent packages together.

Local plain HTTP has Chrome's six-connections-per-origin limit across tabs. Every open page holds a long-poll per shape; multiple app tabs can stall updates. Use separate browser profiles for multi-viewer manual testing. Production HTTPS/HTTP2 avoids this limitation.

## Worker and transactional email

`apps/worker` runs pg-boss on the same Postgres. Queue names, payload schemas and enqueue helpers live in `@repo/jobs/client`; handlers in `apps/worker/src/handlers`.

- `emails`: verification, registration confirmed/waitlisted/promoted. Registration state changes flow through `RegistrationHooks.onChanged(tx, changes)` → `registrationEmailHooks`.
- `group-invitations`: policy `short`, `singletonKey = memberId`, at most one queued send per member. Only invitation-token hashes are stored; the email job issues a fresh token when sending.
- `close-expired-groups`: every five minutes; closing groups releases held seats through triggers and promotes waitlisted registrations.

**Enqueue jobs inside the same Drizzle transaction as the data, never after commit.** Example: `enqueueInvitationEmails(jobs, { tx })`, using pg-boss `fromDrizzle`; DB group functions take `onInvited(tx, refs)` hooks.

Worker tests use the test DB: `pnpm --filter worker test`. esbuild bundles to `dist/index.mjs`; Docker builds with `APP=worker`; Railway config is `apps/worker/railway.toml`.

pg-boss was chosen over DBOS intentionally for short pipelines. DBOS would require a datasource refactor for exactly-once DB steps and version pinning for recovery across deploys. Revisit only if long multi-step workflows with compensation appear.
