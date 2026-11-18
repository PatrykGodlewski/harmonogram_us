# Agenda and Per-Item Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins (role-restricted) build an agenda per event, and users register for the event and for individual agenda items, with live per-item seat counts and database-enforced capacity.

**Architecture:** New `agenda_items`, `agenda_item_registrations` and `agenda_item_seat_counts` tables. Postgres triggers derive every count table from the source rows, and `CHECK (seats_remaining >= 0)` enforces capacity. Electric streams both count tables to the web app. Query functions in `@repo/db` are integration-tested with Vitest against the Docker Postgres. Server functions in `@repo/api` are consumed by a new public `/events/$eventId` page and a new admin event page.

**Tech Stack:** Drizzle ORM 0.45 / drizzle-kit 0.31, Postgres 16, ElectricSQL + TanStack DB, TanStack Start/Router/Query/Form, Paraglide, shadcn, Vitest (new).

**Spec:** `docs/superpowers/specs/2026-11-18-agenda-registration-design.md`

## Global Constraints

- No barrel files. Import by direct subpath. Every new package-level file gets an explicit `package.json#exports` entry where the package uses explicit exports (`@repo/collections`, `@repo/ui` for non-`components/`/`composed/` files).
- Read env through `@repo/env`, never `process.env` (test config may set `process.env.DATABASE_URL` before import, since that's tooling, not app code).
- Use `z.email()` if emails are validated.
- Every user-facing string goes in `packages/i18n/messages/en.json` **and** `pl.json`. Run `pnpm messages:compile` after editing.
- All event and agenda times are **Europe/Warsaw**. Display uses `Intl` with `timeZone: "Europe/Warsaw"`, and admin inputs are read as Warsaw wall-clock time.
- Error codes (exact strings): `EVENT_NOT_FOUND`, `EVENT_FULL`, `ALREADY_REGISTERED`, `NOT_REGISTERED`, `ITEM_NOT_FOUND`, `ITEM_FULL`, `ITEM_NOT_REGISTRABLE`, `ITEM_ENDED`, `MAX_SEATS_BELOW_REGISTERED`, `EVENT_ENDED`, `ITEM_LIMIT_ABOVE_EVENT`, `FORBIDDEN`.
- Constraint names (exact, used for error mapping): `event_seat_counts_seats_remaining_nonnegative`, `agenda_item_seat_counts_seats_remaining_nonnegative`, `agenda_items_ends_after_starts`.
- Overlapping items **warn, never block**.
- Biome: tabs, double quotes. `pnpm lint` must pass at the end of every task that touches TS.
- Commits: Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Two people register for the last seat of an item at the same time** → exactly one succeeds, the other gets `ITEM_FULL`, and the count ends at 0. Pinned in Task 2 (`concurrent last item seat`).
2. **Registering for an item when the event is full but the user isn't registered for it** → `EVENT_FULL`, with no item registration and no event registration left behind. Pinned in Task 2 (`item registration rolls back when event full`).
3. **Deleting an event that has registrations and agenda registrations** → the delete succeeds, and no orphan count rows are left or inserted. Pinned in Task 1 (`deleting event cascades without errors`).
4. **Time display around the DST change** (e.g. an item on 2026-03-29 at 10:00 Warsaw) → admin input and public display agree on 10:00. Pinned in Task 4 (`warsaw wall time across DST`).
5. **An admin changes an item from limited to unlimited (`max_seats` → null) and back** → the count row follows (`seats_remaining` null, then recomputed). Pinned in Task 1 (`item capacity toggles to unlimited and back`).

---

### Task 1: Schema, migrations, count triggers, and the DB test harness

**Files:**
- Create: `packages/db/src/schema/agenda.ts` (tables `agendaItems`, `agendaItemRegistrations`, `agendaItemSeatCounts`, plus relations)
- Modify: `packages/db/src/schema/events.ts` (add `description: text("description")`)
- Modify: `packages/db/src/client.ts` (register the new tables and relations in `schema`)
- Generate: `packages/db/src/migrations/0002_*.sql` (`pnpm db:generate`)
- Create (custom): `packages/db/src/migrations/0003_seat_count_triggers.sql` (`pnpm --filter @repo/db exec drizzle-kit generate --custom --name=seat_count_triggers`)
- Create: `packages/db/vitest.config.ts`, `packages/db/test/global-setup.ts`, `packages/db/test/helpers.ts`, `packages/db/test/seat-counts.test.ts`
- Modify: `packages/db/package.json` (devDependency `vitest`, script `"test": "vitest run"`), `turbo.json` (task `"test": { "cache": false }`), root `package.json` (script `"test": "turbo test"`)
- Modify: `CLAUDE.md` Commands (the test command and test DB note) and the "Live seat counts" step 1 (triggers maintain counts)

**Interfaces:**
- Produces (schema, `@repo/db/schema/agenda`):
  - `agendaItems { id, eventId, title, description, startsAt, endsAt, locationId, maxSeats: number|null, requiresRegistration: boolean, createdAt, updatedAt }`
  - `agendaItemRegistrations { id, agendaItemId, eventRegistrationId, userId, createdAt }`
  - `agendaItemSeatCounts { agendaItemId, eventId, maxSeats: number|null, seatsRemaining: number|null, registeredCount: number, updatedAt }`
  - Column names exactly as in the spec's Data model section.
- Produces (test helpers, `packages/db/test/helpers.ts`):
  - `resetDb(): Promise<void>`: truncates all app tables plus `user`, with CASCADE
  - `createUser(email?: string): Promise<string>`: returns the user id
  - `createEvent(opts?: { maxSeats?: number; date?: Date }): Promise<string>`
  - `createItem(eventId: string, opts?: { maxSeats?: number|null; requiresRegistration?: boolean; startsAt?: Date; endsAt?: Date }): Promise<string>`
  - `readEventCount(eventId)` / `readItemCount(itemId)` return the count row or `undefined`
- Test DB: `harmonogram_us_test` on the same server. `global-setup.ts` creates it if missing (connecting to the `postgres` DB), then runs `migrate()` from `drizzle-orm/postgres-js/migrator` with `migrationsFolder: "src/migrations"`. `vitest.config.ts` sets `test.env.DATABASE_URL` to `postgresql://postgres:postgres@localhost:5432/harmonogram_us_test`, `fileParallelism: false`, and `globalSetup`.

- [ ] **Step 1: Local setup**

Run: `cp .env.example .env && pnpm install && docker compose up -d db && pnpm db:migrate`
Expected: install finishes, and the migrations `0000` and `0001` apply without error.

- [ ] **Step 2: Add Vitest to `@repo/db` with the harness and the failing trigger tests**

`seat-counts.test.ts` (`beforeEach(resetDb)`):
- `event insert creates count row`: `createEvent({maxSeats: 3})` → `readEventCount` equals `{maxSeats: 3, seatsRemaining: 3}`
- `event registration insert/delete updates count`: insert 2 `event_registrations` → `seatsRemaining` 1. Delete one → 2.
- `event max_seats update recomputes`: 1 registration, update `max_seats` to 5 → `seatsRemaining` 4
- `lowering max_seats below registered fails with named constraint`: 2 registrations, update to 1 → rejects with an error whose `constraint_name` is `event_seat_counts_seats_remaining_nonnegative`
- `item insert creates count row; unlimited item has null remaining`: `createItem(e, {maxSeats: 10})` → `{maxSeats: 10, seatsRemaining: 10, registeredCount: 0}`. `createItem(e, {maxSeats: null})` → `{maxSeats: null, seatsRemaining: null, registeredCount: 0}`
- `item registration updates count`: one item registration → `{seatsRemaining: 9, registeredCount: 1}`
- `item capacity toggles to unlimited and back`: 1 registration, set `max_seats` null → `seatsRemaining` null, `registeredCount` 1. Set back to 4 → `seatsRemaining` 3
- `deleting event registration cascades item registrations`: delete the event registration → item `registeredCount` 0
- `deleting event cascades without errors`: event with registrations and item registrations, `DELETE FROM events` → resolves, and both count tables have no rows for that event or item
- `ends_at must be after starts_at`: inserting an item with `endsAt <= startsAt` rejects with constraint `agenda_items_ends_after_starts`

- [ ] **Step 3: Run the tests and watch them fail**

Run: `pnpm --filter @repo/db test`
Expected: FAIL. Imports of `../src/schema/agenda` are unresolved, or the tables don't exist.

- [ ] **Step 4: Write the schema and generate `0002`**

Write `schema/agenda.ts`: FKs with `onDelete: "cascade"` as the spec says, `uniqueIndex("agenda_item_registrations_item_user_unique")` on `(agendaItemId, userId)`, index `agenda_items_event_starts_idx` on `(eventId, startsAt)`, and `check("agenda_items_ends_after_starts", sql\`${t.endsAt} > ${t.startsAt}\`)`. **Do not** declare the count-table CHECKs in Drizzle; they live in `0003` (ordering with the backfill). Then run `pnpm db:generate`.
Expected: a new `0002_*.sql` creating the three tables and `events.description`.

- [ ] **Step 5: Write `0003_seat_count_triggers.sql`, in this order**

1. Raise oversold events: `UPDATE events e SET max_seats = c.n FROM (SELECT event_id, count(*) n FROM event_registrations GROUP BY event_id) c WHERE c.event_id = e.id AND c.n > e.max_seats`. A `DO` block emits `RAISE NOTICE` per affected event id.
2. Backfill `event_seat_counts` for **every** event (`INSERT … ON CONFLICT (event_id) DO UPDATE`), with `seats_remaining = max_seats - registered`.
3. `ALTER TABLE event_seat_counts ADD CONSTRAINT event_seat_counts_seats_remaining_nonnegative CHECK (seats_remaining >= 0)`. Same for `agenda_item_seat_counts` with `CHECK (seats_remaining IS NULL OR seats_remaining >= 0)`.
4. Functions and triggers (`AFTER … FOR EACH ROW`, plpgsql, recompute from `count(*)`):
   - `events` AFTER INSERT OR UPDATE OF max_seats → upsert its count row
   - `event_registrations` AFTER INSERT OR DELETE → `UPDATE` only (no insert) the count row for `NEW/OLD.event_id`
   - `agenda_items` AFTER INSERT OR UPDATE OF max_seats → upsert its count row (`seats_remaining = CASE WHEN max_seats IS NULL THEN NULL ELSE max_seats - registered END`)
   - `agenda_item_registrations` AFTER INSERT OR DELETE → `UPDATE` only
   - All of them set `updated_at = now()`.

Use `--> statement-breakpoint` between statements, as the generated migrations do. Run `pnpm db:migrate`.
Expected: `0002` and `0003` apply cleanly on the dev DB.

- [ ] **Step 6: Run the tests and see them pass**

Run: `pnpm --filter @repo/db test`
Expected: PASS, 10 tests.

- [ ] **Step 7: Update the seed and CLAUDE.md, then lint and commit**

Remove the direct `eventSeatCounts` insert from `packages/db/src/seed/index.ts` (the triggers do it now). In CLAUDE.md:
- add `pnpm test` / `pnpm --filter @repo/db test` with "needs `docker compose up -d db`; uses database `harmonogram_us_test`"
- remove the "no test framework" line
- change Live seat counts step 1 to say "maintained by Postgres triggers (migration `0003`)"

Run: `pnpm --filter @repo/db lint && pnpm db:seed`
Expected: lint clean, and the seed finishes.

```bash
git add packages/db turbo.json package.json pnpm-lock.yaml CLAUDE.md
git commit -m "feat(db): add agenda tables and trigger-maintained seat counts"
```

---

### Task 2: Registration queries for agenda items

**Files:**
- Modify: `packages/db/src/queries/event-registrations.ts`
- Test: `packages/db/test/registrations.test.ts`

**Interfaces:**
- Consumes: Task 1 schema and helpers.
- Produces:
  - `EventRegistrationError.code` is widened to the full error-code union from Global Constraints. Export `type RegistrationErrorCode`.
  - `registerForEvent(eventId, userId): Promise<{ txid: number }>`: unchanged contract. A CHECK violation (`event_seat_counts_seats_remaining_nonnegative`) maps to `EVENT_FULL`.
  - `registerForAgendaItem(itemId: string, userId: string): Promise<{ txid: number; eventRegistered: boolean }>`
  - `unregisterFromAgendaItem(itemId: string, userId: string): Promise<{ txid: number }>`
  - `getMyRegistrations(userId: string): Promise<{ eventIds: string[]; agendaItemIds: string[] }>`
  - `unregisterFromEvent` and `getRegisteredEventIdsForUser`: unchanged.

- Also in this task: add `endsAt: timestamp("ends_at", { withTimezone: true })` (nullable) to `events`, then `pnpm db:generate` (→ `0004_*`) and `pnpm db:migrate`. Export `getEffectiveEventEnd(tx, eventId): Promise<Date>` = `coalesce(events.ends_at, max(agenda_items.ends_at), events.date + interval '1 day')`.

- [ ] **Step 1: Write the failing tests** (`beforeEach(resetDb)`)

- `EVENT_ENDED for event registration after effective end`: event `date` 2 days ago with no `ends_at` and no items → `registerForEvent` rejects `EVENT_ENDED`. Same event with `ends_at` 1 hour ahead → succeeds.
- `EVENT_ENDED for item registration after event end`: event `ends_at` 1 hour ago, item ending 1 hour ahead → `registerForAgendaItem` rejects `EVENT_ENDED`.
- `effective end falls back to last agenda item`: event `date` 2 days ago, no `ends_at`, item ending 3 hours ahead → event registration succeeds.
- `registers item and creates event registration`: → `{eventRegistered: true}`. `getMyRegistrations` → `eventIds [e]`, `agendaItemIds [i]`. Item `seatsRemaining` decreases by 1, and the event's too.
- `second item reuses event registration`: → `{eventRegistered: false}`. Event `seatsRemaining` decreases only once.
- `ITEM_FULL when item has no seats`: item `maxSeats 1`, user A registers, user B → rejects `EventRegistrationError` with code `ITEM_FULL`.
- `item registration rolls back when event full`: event `maxSeats 1` already taken by A; B registers for an item → `EVENT_FULL`. B has no event or item registration afterwards.
- `ITEM_NOT_REGISTRABLE` for `requiresRegistration: false`. `ITEM_NOT_FOUND` for an unknown id. `ALREADY_REGISTERED` on a repeat.
- `ITEM_ENDED`: item with `endsAt` 1 hour ago → rejects. Item with `startsAt` 1 hour ago and `endsAt` 1 hour ahead → succeeds.
- `unregister item keeps event registration`: → `getMyRegistrations` has `eventIds [e]` and `agendaItemIds []`. Unregistering again → `NOT_REGISTERED`.
- `unregister event removes item registrations`: `unregisterFromEvent` → `agendaItemIds []`, and the item count is restored.
- `concurrent last item seat`: item `maxSeats 1`, two users, `Promise.allSettled` of both `registerForAgendaItem` calls → exactly one fulfilled, one rejected with `ITEM_FULL`, and `seatsRemaining` is 0.
- `concurrent last event seat`: the same, with `registerForEvent` and event `maxSeats 1` → one `EVENT_FULL`.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter @repo/db test registrations`
Expected: FAIL (`registerForAgendaItem is not a function`).

- [ ] **Step 3: Implement**

`registerForEvent` gains the same `EVENT_ENDED` check after locking the event. Lock order is **item row, then event row** (`.for("update")`). Steps:
1. If not found → `ITEM_NOT_FOUND`. If `!requiresRegistration` → `ITEM_NOT_REGISTRABLE`. If the effective event end has passed → `EVENT_ENDED`. If `endsAt <= now()` → `ITEM_ENDED`. If already registered → `ALREADY_REGISTERED`.
2. Find or create the event registration. On create, check the event count (`EVENT_FULL`).
3. Check the item count when `maxSeats` isn't null (`ITEM_FULL`), then insert. `eventRegistrationId` is the found or created row's id.

Wrap DB errors: postgres `code === "23514"` with the event or item constraint name → `EVENT_FULL` / `ITEM_FULL`. Unique violation `23505` → `ALREADY_REGISTERED`. Share one `mapConstraintError(error): never` helper.

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm --filter @repo/db test`
Expected: PASS (all of Task 1 and Task 2).

- [ ] **Step 5: Lint and commit**

Run: `pnpm --filter @repo/db lint` → clean.
`git commit -m "feat(db): register and unregister for agenda items"`

---

### Task 3: Agenda CRUD, event details, and registrant queries

**Files:**
- Create: `packages/db/src/queries/agenda-items.ts`
- Modify: `packages/db/src/queries/events.ts` (`description` and `endsAt` in create/update/types, `getEventById`, map `MAX_SEATS_BELOW_REGISTERED`)
- Modify: `packages/db/src/queries/event-registrations.ts` (`getEventRegistrants`)
- Modify: `packages/db/src/seed/data.ts`, `packages/db/src/seed/index.ts` (a sample agenda for the first seeded event: 4 items, including two that overlap and one with `requiresRegistration: false`)
- Test: `packages/db/test/agenda-items.test.ts`

**Interfaces:**
- Produces:
  - `type AgendaItem = { id; eventId; title; description: string|null; startsAt: Date; endsAt: Date; locationId: string|null; locationLabel: string|null; maxSeats: number|null; requiresRegistration: boolean; seatsRemaining: number|null; registeredCount: number }`
  - `listAgendaItems(eventId: string): Promise<AgendaItem[]>`, ordered by `startsAt`, then `title` (joins the location and the count row)
  - `type AgendaItemInput = { eventId: string; title: string; description?: string|null; startsAt: Date; endsAt: Date; locationId?: string|null; maxSeats?: number|null; requiresRegistration?: boolean }`
  - `createAgendaItem(input: AgendaItemInput): Promise<AgendaItem>`
  - `updateAgendaItem(id: string, input: Partial<Omit<AgendaItemInput,"eventId">>): Promise<AgendaItem|null>`
  - `deleteAgendaItem(id: string): Promise<{ id: string }|null>`
  - Both create and update throw `EventRegistrationError("MAX_SEATS_BELOW_REGISTERED")` on the item CHECK violation. `updateEvent` throws the same on the event CHECK. Re-use `mapConstraintError` from Task 2, extended with this mapping, which applies when the constraint fires during an UPDATE of `max_seats`.
  - Create and update throw `EventRegistrationError("ITEM_LIMIT_ABOVE_EVENT")` when `maxSeats` exceeds the event's `max_seats` (read in the same transaction).
  - `type EventDetails = EventWithRelations & { description: string|null; endsAt: Date|null; effectiveEndsAt: Date; agenda: AgendaItem[] }`
  - `getEventById(id: string): Promise<EventDetails|null>`
  - `type EventRegistrant = { registrationId: string; userId: string; email: string; name: string|null; registeredAt: Date; agendaItemIds: string[] }`
  - `getEventRegistrants(eventId: string): Promise<EventRegistrant[]>`, ordered by `registeredAt`

- [ ] **Step 1: Write the failing tests**

- `create/list orders by start then title`. List includes `locationLabel` and `seatsRemaining`.
- `update item max_seats below registered → MAX_SEATS_BELOW_REGISTERED`
- `item limit above event limit → ITEM_LIMIT_ABOVE_EVENT`: event `maxSeats 10`, so `createAgendaItem({maxSeats: 11})` rejects, and `updateAgendaItem(id, {maxSeats: 11})` rejects. `maxSeats: 10` and `null` succeed.
- `update event max_seats below registered → MAX_SEATS_BELOW_REGISTERED`
- `getEventById returns description and agenda`. Unknown id → `null`.
- `getEventRegistrants lists users with their item ids`

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter @repo/db test agenda-items` → FAIL (module not found).

- [ ] **Step 3: Implement the queries and the seed agenda**

- [ ] **Step 4: Run all DB tests and the seed**

Run: `pnpm --filter @repo/db test && pnpm db:seed`
Expected: PASS, and the seed finishes.

- [ ] **Step 5: Lint and commit**

`git commit -m "feat(db): agenda item CRUD, event details and registrants queries"`

---

### Task 4: Shared Warsaw-time and agenda-layout helpers

**Files:**
- Create: `packages/ui/src/time.ts`, `packages/ui/src/agenda.ts`
- Create: `packages/ui/vitest.config.ts`, `packages/ui/test/time.test.ts`, `packages/ui/test/agenda.test.ts`
- Modify: `packages/ui/package.json` (exports `"./time": "./src/time.ts"` and `"./agenda": "./src/agenda.ts"`, devDependency `vitest`, script `"test": "vitest run"`)
- Modify: `apps/web/src/lib/events/format-event-date.ts` (use `formatWarsawDate`)

**Interfaces:**
- Produces (`@repo/ui/time`):
  - `EVENT_TIME_ZONE = "Europe/Warsaw"`
  - `formatWarsawDate(date: Date|string, locale: string): string` (`{year:"numeric",month:"short",day:"numeric"}`)
  - `formatWarsawTime(date: Date|string, locale: string): string` (`{hour:"2-digit",minute:"2-digit",hourCycle:"h23"}`)
  - `toWarsawDateInput(date: Date): string` → `"YYYY-MM-DD"`. `toWarsawTimeInput(date: Date): string` → `"HH:mm"`
  - `fromWarsawWallTime(date: string /*YYYY-MM-DD*/, time: string /*HH:mm*/): Date`. Resolves the offset via `Intl.DateTimeFormat(..., {timeZone, timeZoneName:"longOffset"})`, with no new dependency.
- Produces (`@repo/ui/agenda`):
  - `type AgendaTimed = { id: string; startsAt: Date|string; endsAt: Date|string; title: string }`
  - `markParallel<T extends AgendaTimed>(items: T[]): Array<T & { parallel: boolean }>`. Sorts by start, then title. An item is `parallel` when some earlier item in that order ends after it starts.
  - `findOverlaps<T extends AgendaTimed>(items: T[], selectedIds: ReadonlySet<string>): Map<string, string[]>` maps each selected item id to the titles of the **other selected** items it overlaps (`a.start < b.end && b.start < a.end`). Items that only touch (end = start) don't overlap.

- [ ] **Step 1: Write the failing tests**

- `warsaw wall time across DST`: `fromWarsawWallTime("2026-03-29","10:00").toISOString()` === `"2026-03-29T08:00:00.000Z"`. `("2026-01-15","10:00")` → `"2026-01-15T09:00:00.000Z"`. The round trip `toWarsawTimeInput(fromWarsawWallTime(d,t)) === t` holds for both.
- `formatWarsawTime is zone-fixed`: `formatWarsawTime("2026-01-15T09:00:00Z","pl")` === `"10:00"`
- `markParallel`: items 9:00–10:00, 12:00–13:30, 12:30–14:00, 13:30–14:00 → flags `[false, false, true, true]`. The fourth is parallel because 12:30–14:00 is still running at 13:30. Separately, 12:00–13:30 followed by 13:30–14:00 alone → `[false, false]`, since touching isn't parallel.
- `findOverlaps`: with 12:00–13:30 and 12:30–14:00 selected → each maps to the other's title. With touching 12:00–13:30 and 13:30–14:00 → empty map. Unselected items are ignored.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter @repo/ui test` → FAIL (module not found).

- [ ] **Step 3: Implement both modules, and switch `formatEventDate` to `formatWarsawDate(date, getLocale())`**

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm --filter @repo/ui test && pnpm --filter @repo/ui build`
Expected: PASS, and tsc is clean.

- [ ] **Step 5: Lint and commit**

`git commit -m "feat(ui): Warsaw time and agenda layout helpers"`

---

### Task 5: API server functions, Electric proxy and collection

**Files:**
- Modify: `packages/api/src/events/queries.ts`, `packages/api/src/events/mutations.ts`, `packages/api/src/events/my-registrations.ts`, `packages/api/src/events/schemas.ts`
- Modify: `packages/api/src/admin/queries.ts`, `packages/api/src/admin/mutations.ts`, `packages/api/src/admin/schemas.ts`
- Create: `apps/web/src/routes/api/electric/agenda-item-seat-counts.ts`
- Create: `packages/collections/src/agenda-item-seat-counts.ts`. Modify `packages/collections/package.json` exports.

**Interfaces:**
- Consumes: Task 2 and Task 3 query functions.
- Produces:
  - `fetchEventDetailsServer({ data: { eventId } })` → `EventDetails` (throws `Error("EVENT_NOT_FOUND")` on null). `eventDetailsQueryOptions(eventId)` with key `["event-details", eventId]` and `staleTime: 30_000`.
  - `registerForAgendaItemServer({ data: { agendaItemId } })` → `{ txid, eventRegistered }`. `unregisterFromAgendaItemServer({ data: { agendaItemId } })` → `{ txid }`. Same auth and error-rethrow pattern as `registerForEventServer`.
  - `myRegistrationsQueryOptions` with key `["my-registrations"]` → `{ eventIds, agendaItemIds }` (empty arrays when signed out).
  - Admin (all behind `authMiddleware`):
    - `adminEventDetailsQueryOptions(eventId)` with key `["admin","event",eventId]`
    - `adminEventRegistrantsQueryOptions(eventId)` with key `["admin","event",eventId,"registrants"]`
    - `createAdminAgendaItemServer`, `updateAdminAgendaItemServer` (`{ id, ...partial }`), `deleteAdminAgendaItemServer` (`{ id }`)
    - The zod `agendaItemSchema`: `title 1–500`, `description ≤5000` nullable, `startsAt`/`endsAt` `z.coerce.date()` with `refine(endsAt > startsAt)`, `maxSeats` int ≥0 nullable, `requiresRegistration` boolean, `locationId` nullable
    - `createEventSchema`/`updateEventSchema` gain `description: z.string().max(5000).nullable().optional()`
    - Domain `EventRegistrationError` → `Error(code)`, same as the existing pattern.
  - Collection `agendaItemSeatCountsCollection` (id `"agenda-item-seat-counts"`, key `agenda_item_id`, zod row `{agenda_item_id, event_id, max_seats: number|null, seats_remaining: number|null, registered_count: number, updated_at?}`) and `ensureAgendaItemSeatCountsSync()`, mirroring `event-seat-counts.ts`.
  - Proxy: copy of the event proxy with `table=agenda_item_seat_counts` and `columns=agenda_item_id,event_id,seats_remaining,max_seats,registered_count,updated_at`.

- [ ] **Step 1: Implement the server functions, proxy and collection**

- [ ] **Step 2: Verify types and build**

Run: `pnpm --filter @repo/api lint && pnpm --filter @repo/collections lint && pnpm --filter web build`
Expected: all clean, and the web build succeeds.

- [ ] **Step 3: Smoke-test the proxy**

Run: `docker compose up -d electric`, then `pnpm --filter web dev`, then `curl -s "http://localhost:3000/api/electric/agenda-item-seat-counts?offset=-1" | head -c 300`
Expected: a JSON array containing seeded `agenda_item_id` rows. If Electric can't reach the DB because of the `localhost` URL issue (project 3), set `DATABASE_URL=postgresql://postgres:postgres@db:5432/harmonogram_us` for the electric service in a `docker-compose.override.yml` (gitignored, local only). Record that as a ruling.

- [ ] **Step 4: Commit**

`git commit -m "feat(api): event details, agenda registration and admin agenda endpoints"`

---

### Task 6: Public event details page

**Files:**
- Create: `apps/web/src/routes/events/$eventId.tsx`
- Create: `apps/web/src/components/event-details/event-summary.tsx`, `agenda-timeline.tsx`, `agenda-item-row.tsx`, `unregister-event-dialog.tsx`
- Create: `apps/web/src/lib/event-details/use-event-details-registrations.ts`, `use-live-agenda-counts.ts`
- Modify: `apps/web/src/lib/event-registration/errors.ts` (add the `ITEM_*` codes and `EVENT_ENDED` with messages)
- Modify: `apps/web/src/components/home-event-card.tsx` (the title links to `/events/$eventId`)
- Modify: `packages/i18n/messages/en.json`, `pl.json`
- Add the shadcn `alert-dialog` to `packages/ui` if it's missing (`pnpm dlx shadcn@latest add alert-dialog`, run in `packages/ui`)

**Interfaces:**
- Consumes: `eventDetailsQueryOptions`, `myRegistrationsQueryOptions`, the register/unregister server functions for events and items, both seat-count collections, `markParallel`, `findOverlaps`, `formatWarsawTime`, `formatWarsawDate`.
- Produces:
  - `useEventDetailsRegistrations(eventId)` → `{ isEventRegistered, isItemRegistered(id), registerEvent(), unregisterEvent(), registerItem(id), unregisterItem(id), pendingKey: string|null }`
  - Every mutation awaits `awaitTxId(txid)` on the relevant collection(s) (catching errors), then invalidates `["my-registrations"]`, `["my-registered-event-ids"]` and `["event-details", eventId]`. Errors go to `showRegistrationErrorToast`. No cross-tab or optimistic machinery.
  - `useLiveAgendaCounts()` → `{ getItemCount(itemId, fallback) }`, a live query over `agendaItemSeatCountsCollection`, the same shape as `useEventSeatCounts`.

Page behavior (spec "Public event details page"):
- The loader prefetches `eventDetailsQueryOptions` and, when signed in, `myRegistrationsQueryOptions`. An `EVENT_NOT_FOUND` error renders a not-found message.
- Sync starts client-side only (`ClientOnly`, or an effect calling `ensure*Sync()`, following the home list's pattern).
- The summary shows title, Warsaw date, type, faculty and location badges, description, live event count, and the event register button. When registered, the unregister button opens `UnregisterEventDialog` ("Your agenda registrations will be removed too").
- The timeline uses `markParallel(agenda)`. A parallel row gets `pl-6` plus a left dashed border. Each row shows Warsaw time range, title, location, a live count (`x/y` or "Full"; nothing when `maxSeats` is null), and either a button (Register / Registered ✓ + Unregister) or a "No registration needed" note.
- Rows for registered items that appear in `findOverlaps(agenda, registeredItemIds)` show `Overlaps with {titles}`.
- When signed out, buttons are a `Link` to `/login` with `search: { redirect: "/events/<id>" }`.
- Mobile-first: one column, with `max-w-3xl`. Buttons are full-width below `sm`.

- [ ] **Step 1: Add the i18n messages (en and pl) and compile**

Keys (en text, write natural Polish for pl):
- `event_details_agenda` "Agenda"
- `event_details_no_agenda` "No agenda yet."
- `event_details_no_registration` "No registration needed"
- `event_details_full` "Full"
- `event_details_overlaps` "Overlaps with {titles}"
- `event_details_unregister_title` "Unregister from this event?"
- `event_details_unregister_body` "Your agenda registrations for this event will be removed too and your places freed."
- `event_details_unregister_confirm` "Unregister"
- `event_details_not_found` "This event doesn't exist or was removed."
- `event_details_back` "All events"
- `events_item_full` "This session is full."
- `events_item_ended` "This session has already ended."
- `events_item_not_registrable` "This session doesn't need registration."
- `events_item_not_found` "This session no longer exists."
- `events_event_ended` "Registration for this event has closed."
- `events_item_register_success` "Registered for {title}."
- `events_item_unregister_success` "Unregistered from {title}."

Run: `pnpm messages:compile` → OK.

- [ ] **Step 2: Implement the hooks, components and route. Link the home card.**

- [ ] **Step 3: Verify the build**

Run: `pnpm --filter web lint && pnpm --filter web build`
Expected: clean.

- [ ] **Step 4: Check in the browser, at 390×844 and at 1280×800**

With `pnpm dev`, Electric up and the seed loaded, open the seeded event with an agenda from the home list:
- The overlapping item is indented.
- Signed out: the buttons go to login.
- Signed in (seed admin): registering for an item registers for the event and decrements both counts live.
- Opening a second tab shows the counts change without a refresh.
- Registering for both overlapping items shows the overlap warning.
- Unregistering from the event shows the dialog and clears item registrations.

Expected: all of the above observed. Record anything that differs as a fix or a ruling.

- [ ] **Step 5: Commit**

`git commit -m "feat(web): event details page with agenda registration"`

---

### Task 7: Admin event page with agenda editor and registrants

**Files:**
- Rename: `apps/admin/src/routes/_authenticated/events.tsx` → `events.index.tsx` (route id `/_authenticated/events/`)
- Create: `apps/admin/src/routes/_authenticated/events.$eventId.tsx`
- Create: `apps/admin/src/components/admin-event-detail/event-summary-card.tsx`, `agenda-editor.tsx`, `agenda-item-dialog.tsx`, `registrants-list.tsx`
- Modify: `apps/admin/src/components/admin-events-page.tsx` (each title cell is a `Link` to `/events/$eventId`, the form gets a `description` textarea and optional end date and time (`endsAt`), and its date input is read as Warsaw time via `fromWarsawWallTime`/`toWarsawDateInput`/`toWarsawTimeInput`, replacing `parseDateTimeLocal`/`formatDateTimeLocal`)
- Modify: `apps/admin/src/lib/format-mutation-error.ts` (map `MAX_SEATS_BELOW_REGISTERED`, `ITEM_LIMIT_ABOVE_EVENT`, `FORBIDDEN`)
- Modify: `packages/i18n/messages/en.json`, `pl.json`

**Interfaces:**
- Consumes: the Task 5 admin server functions, `@repo/ui/time`, `AdminFormDialog`, the existing `Select`/`Input`/`Textarea` components.
- Produces: the admin route `/events/$eventId`.

Behavior (spec "Admin"):
- The page stacks on mobile; at `lg` it's two columns (summary and agenda on the left, registrants on the right).
- The agenda editor lists items: Warsaw time range, title, room, `registered/max` or `registered` when unlimited, and edit/delete buttons. A delete confirms before deleting. "Add item" opens the dialog.
- `AgendaItemDialog` uses TanStack Form, matching `admin-events-page.tsx`. Fields: title, description, date (defaults to the event's Warsaw date), start time, end time, room (select, with none allowed), seat limit (blank = no limit), needs registration (checkbox, default on). Client validation: end after start.
- Registrants list: email, name, registered at (Warsaw date + time), and item titles as small badges. The header shows the total count.
- Mutations invalidate `["admin","event",eventId]` (prefix) and `["admin","events"]`. Errors use `formatMutationError`.

- [ ] **Step 1: Add the i18n messages (en and pl) and compile**

Keys:
- `admin_event_agenda` "Agenda"
- `admin_event_agenda_add` "Add item"
- `admin_event_registrants` "Registrants ({count})"
- `admin_event_registrants_empty` "No one has registered yet."
- `admin_field_description` "Description"
- `admin_field_start_time` "Start time"
- `admin_field_end_time` "End time"
- `admin_field_room` "Room"
- `admin_field_seat_limit` "Seat limit"
- `admin_field_seat_limit_hint` "Leave empty for no limit"
- `admin_field_requires_registration` "Needs registration"
- `admin_error_end_before_start` "End time must be after start time."
- `admin_error_max_seats_below_registered` "More people are registered than this limit allows."
- `admin_error_item_limit_above_event` "A session can't have more places than the event."
- `admin_field_ends_at` "Ends (optional)"
- `admin_no_access_title` "No access"
- `admin_no_access_body` "Your account doesn't have admin rights. Ask an administrator to grant them."

Run: `pnpm messages:compile`.

- [ ] **Step 2: Do the route rename and implement the page, components and form changes**

- [ ] **Step 3: Verify the build**

Run: `pnpm lint && pnpm build`
Expected: the whole monorepo is clean.

- [ ] **Step 4: Check in the browser at 390×844 and at 1280×800**

Log in to the admin (seed admin, credentials in `packages/db/src/seed/data.ts`):
- Open an event and add an item at 10:00. The public page shows 10:00.
- Edit the limit below the registered count → the error message shows.
- Set the limit to blank → the public page shows no count.
- Delete an item.
- Registrants show the registrations made in Task 6.

Expected: all observed.

- [ ] **Step 5: Run the full test suite, then commit**

Run: `pnpm test` → PASS (db and ui).
`git commit -m "feat(admin): event page with agenda editor and registrants"`

---

### Task 8: Admin role (#12)

**Files:**
- Modify: `packages/db/src/schema/better-auth.ts` (`role: text("role").notNull().default("user")` on `authUsers`), then `pnpm db:generate` (→ `0005_*`) and migrate
- Create: `packages/db/src/queries/roles.ts`
- Modify: `packages/db/src/seed/index.ts` (the seed admin gets `role: "admin"`, on insert and on re-run)
- Create: `packages/api/src/auth/admin-middleware.ts`
- Modify: `packages/api/src/admin/queries.ts`, `packages/api/src/admin/mutations.ts` (every server function switches from `authMiddleware` to `adminMiddleware`)
- Modify: `apps/admin/src/routes/_authenticated.tsx` and the admin root context (non-admins see a no-access page with a logout link)
- Test: `packages/db/test/roles.test.ts`

**Interfaces:**
- Produces:
  - `type UserRole = "user" | "admin"`
  - `getUserRole(userId: string): Promise<UserRole | null>`
  - `isAdmin(userId: string): Promise<boolean>`
  - `adminMiddleware`: like `authMiddleware`, plus `if (!(await isAdmin(user.id))) throw new Error("FORBIDDEN")`. The context adds `isAdmin: true`.
  - The admin root `beforeLoad` context gains `isAdmin: boolean` (from a new `fetchIsAdminServer` in `packages/api/src/auth/`).

- [ ] **Step 1: Write the failing tests**: `new users default to role user` (`getUserRole` → `"user"`, `isAdmin` → false). `admin role detected` (after `UPDATE` → `isAdmin` true). Unknown id → `getUserRole` → `null`.
- [ ] **Step 2: Run them**: `pnpm --filter @repo/db test roles` → FAIL (module not found).
- [ ] **Step 3: Implement the column, migration, queries, seed, middleware and route gate.**
- [ ] **Step 4: Run** `pnpm test && pnpm lint && pnpm build` → PASS and clean.
- [ ] **Step 5: Browser check**: sign up a fresh user on web through Mailpit's magic link, then open admin → the no-access page. The seed admin still has full access.
- [ ] **Step 6: Commit**: `git commit -m "feat(admin): restrict admin panel to admin role"`
