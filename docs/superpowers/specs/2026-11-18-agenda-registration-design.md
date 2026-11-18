# Agenda and per-item registration — design

Date: 2026-11-18 · Status: approved by delegation ("decide yourself and continue"), builder-checked · Project 1 of 3

## Intent

The university currently uses Indico. This platform replaces it with better UX and a mobile-first design. Stakeholders asked that "the event details page shows the agenda, and people can register for each agenda item". Events like a faculty open day run from 9:00 to 20:00, with parallel and offset sessions in different rooms. Visitors (school pupils, students, the public) pick the parts they attend, and organizers need a per-session headcount.

Indico supports a free-form timetable but has no real per-session registration. Organizers fake it with choice fields in the registration form. This project makes per-item registration first-class, with live per-item seat counts.

This is project 1 of 3. Project 2 (teacher group registration with email invitations and join links) and project 3 (full Docker setup) build on it, so the data model must leave room for them (see "Forward compatibility").

## Goals

1. Admins can create, edit and delete agenda items for an event: title, optional description, start/end time, optional room, optional own seat limit, and whether it needs registration.
2. A public event details page (`/events/$eventId`) shows the event and its agenda as a mobile-first timeline. Parallel and offset items are both shown clearly.
3. A signed-in user can register for the event alone, or for any agenda item that needs registration. Registering for an item also registers them for the event if they aren't already. Users can unregister from a single item, or from the whole event (which also removes all their item registrations).
4. Seat counts for the event and for every limited item update live through Electric, without a refresh.
5. Fix the existing bug: `event_seat_counts` is only written by the seed, so live counts never change. Counts must be correct no matter which code path writes registrations.
6. Overselling protection (#19): concurrent registrations can never push an event or item over its limit.
7. Admins can see who registered for an event and for each item (read-only).
8. Events get an optional description shown on the details page (#7).

## Non-goals

- Group registration, invitations, held seats: project 2.
- Docker changes: project 3.
- The blueprint visual theme: a separate track. Use the existing shadcn styling.
- Waiting lists, approval flows, QR tickets, cancelling events, admin role checks (#12). These are separate issues.
- Indico-style nested sessions or session blocks. Agenda items are a flat list. A room is the only grouping.

## Anti-goals (failure even if it works)

- Live counts that drift from reality. Counts must be derived in the database, not by every app code path remembering to update them.
- An item registration without an event registration.
- Blocking users from overlapping items. Offset sessions often overlap by a few minutes, so show a warning, never block.
- An admin agenda editor that's unusable on a phone.

## Constraints

- Stack and conventions from `CLAUDE.md`: Drizzle schema plus generated migrations, server functions in `@repo/api`, no barrel files, `@repo/env`, Paraglide messages in `pl` and `en`, Biome.
- Electric syncs tables, not views. Live data must live in plain tables with primary keys.
- There's no test framework today.

## Approaches considered (for keeping counts correct)

| Approach | Trade-off |
|---|---|
| **A. Postgres triggers maintain count tables** from registration rows and from capacity changes on `events` and `agenda_items` | One source of truth. Works for any writer (admin, seed, project 2 holds). Needs a hand-written SQL migration. |
| B. App code updates count rows in the same transaction as each write | Simple, but every writer must remember to do it. That's exactly how the current bug happened. |
| C. Electric syncs registration rows and clients count | Exposes who registered to every visitor (privacy), and sends far more data. |

**Chosen: A.** On top of it, `CHECK (seats_remaining >= 0)` on the count tables gives a database-level overselling guarantee, alongside the row locks in the register transaction.

## Design

### Data model (new migration `0002_*`)

- `events.description text NULL`.
- `agenda_items`
  - `id text PK default gen_random_uuid()::text`, `event_id → events.id ON DELETE CASCADE`
  - `title text NOT NULL`, `description text NULL`
  - `starts_at timestamptz NOT NULL`, `ends_at timestamptz NOT NULL`, `CHECK (ends_at > starts_at)`
  - `location_id → event_locations.id NULL` (the room)
  - `max_seats integer NULL`. `NULL` means no limit of its own, which is still implicitly bounded by the event, since attendees must be registered for it.
  - `requires_registration boolean NOT NULL DEFAULT true`. False is for breaks, lunch, open talks: shown, but not registrable.
  - `created_at`, `updated_at`. Index on `(event_id, starts_at)`.
- `agenda_item_registrations`
  - `id text PK`, `agenda_item_id → agenda_items.id ON DELETE CASCADE`
  - `event_registration_id → event_registrations.id ON DELETE CASCADE`. This ties the item registration to the event registration, so unregistering from the event removes item registrations automatically, and an item registration can't exist without an event registration.
  - `user_id → user.id ON DELETE CASCADE`, `created_at`
  - `UNIQUE (agenda_item_id, user_id)`
- `agenda_item_seat_counts` (synced by Electric)
  - `agenda_item_id PK → agenda_items.id ON DELETE CASCADE`, `event_id text NOT NULL`
  - `max_seats integer NULL`, `seats_remaining integer NULL`, `registered_count integer NOT NULL DEFAULT 0`, `updated_at`
  - `CHECK (seats_remaining IS NULL OR seats_remaining >= 0)`
- `event_seat_counts`: add `CHECK (seats_remaining >= 0)`. Backfill existing rows from real registration counts in the migration.

### Triggers (same migration, hand-written SQL)

- After insert/delete on `event_registrations`: recompute that event's `event_seat_counts` row (`max_seats - count(*)`).
- After insert or update of `max_seats` on `events`: upsert its `event_seat_counts` row.
- After insert/delete on `agenda_item_registrations`, and after insert or update of `max_seats` on `agenda_items`: upsert that item's `agenda_item_seat_counts` row. When `max_seats` is null, `seats_remaining` is null.
- Recompute from `count(*)` rather than doing `±1`. It's self-correcting, and the cost is trivial at these volumes.
- When an admin lowers `max_seats` below the registered count, the CHECK fails. The API maps that to error code `MAX_SEATS_BELOW_REGISTERED`.

### Queries (`@repo/db/queries`)

- `agenda-items.ts`: list by event (ordered by `starts_at`, then `title`), create, update, delete. Validates that the item belongs to the given event.
- `event-registrations.ts`:
  - `registerForEvent` keeps its contract, but relies on the trigger for counts. `CHECK` violations map to `EVENT_FULL`.
  - New `registerForAgendaItem(itemId, userId)`, all in one transaction:
    1. Lock the item row (`FOR UPDATE`) and then the event row, always in that order to avoid deadlocks.
    2. Reject if not found (`ITEM_NOT_FOUND`), if `requires_registration = false` (`ITEM_NOT_REGISTRABLE`), or if already registered (`ALREADY_REGISTERED`).
    3. If the user has no event registration, create one, checking event capacity (`EVENT_FULL`).
    4. Check item capacity (`ITEM_FULL`), then insert.
    5. Return `{ txid, eventRegistered: boolean }`, where the flag says whether this call created the event registration.
  - New `unregisterFromAgendaItem(itemId, userId)` → `{ txid }`, or `NOT_REGISTERED`. The event registration stays.
  - `unregisterFromEvent`: unchanged. The cascade removes item registrations.
  - New `getMyRegistrations(userId)` → `{ eventIds: string[], agendaItemIds: string[] }`.
  - New `getEventRegistrants(eventId)` for admin: user email and name, registered at, and the agenda item ids they registered for.
- `events.ts`: `getEventById(id)` with relations, description and the agenda.

### API (`@repo/api`)

- `events/queries.ts`: `fetchEventDetailsServer` and `eventDetailsQueryOptions(eventId)`, giving the event and its agenda items (with room labels).
- `events/mutations.ts`: `registerForAgendaItemServer`, `unregisterFromAgendaItemServer`. Same pattern as the existing event mutations, with domain errors rethrown as codes.
- `events/my-registrations.ts`: `myRegistrationsQueryOptions` (event and item ids). Keep the existing `myRegisteredEventIdsQueryOptions` working for the home list.
- `admin/`: agenda item CRUD server functions plus `adminEventDetailsQueryOptions(eventId)` and `adminEventRegistrantsQueryOptions(eventId)`. Event create/update accept `description`.

### Live sync

- New proxy route `apps/web/src/routes/api/electric/agenda-item-seat-counts.ts`, mirroring the existing one, with columns `agenda_item_id,event_id,seats_remaining,max_seats,registered_count,updated_at`.
- New collection `@repo/collections/agenda-item-seat-counts` (add it to `exports`), with the same options as the event collection.
- The details page reads event and item counts from the collections, falling back to server data until sync arrives. After a mutation, await the returned `txid` on the relevant collection(s), then invalidate `myRegistrations`.

### Public event details page (`apps/web/src/routes/events/$eventId.tsx`)

Mobile layout (desktop widens the same column, with a sticky summary at `lg`):

```
Title · date · faculty · type
Room · ● 212/300 places left           [Register for event] / [Registered ✓ · Unregister]
Description
Agenda (grouped by start time; items starting while an earlier one runs are indented as parallel)
 09:00–10:00  Opening lecture   Aula A   ● 120/300   [Register]
 12:00–13:30  Lasers            Lab 2    ● 4/20      [Registered ✓]
 12:30–14:00  ┊ Robotics        Lab 5    Full
 13:30–14:00  Coffee break      —        (no registration)
```

- An item button registers for that item (and the event, if needed). A registered item shows an unregister action.
- If a user registers for an item that overlaps one they already have, show an inline warning on both items ("Overlaps with …"). Registration still goes ahead.
- Unregistering from the event warns that their item registrations will be removed too (an AlertDialog, in the spirit of #9).
- Signed-out users get a login link that redirects back to the event.
- Home list event cards link to the details page.
- Error codes map to messages, extending `apps/web/src/lib/event-registration/errors.ts` with `ITEM_FULL`, `ITEM_NOT_FOUND`, `ITEM_NOT_REGISTRABLE`, `ITEM_ENDED`.

### Admin

- The events table links each row to `apps/admin/src/routes/_authenticated/events.$eventId.tsx`. That page is mobile-first and stacks:
  1. An event summary with an edit button (the existing dialog, plus a description textarea).
  2. The agenda as a list of item rows (time, title, room, `registered/max`), with an add button. Add and edit use `AdminFormDialog` with fields title, description, date, start time, end time, room select, limit (blank = none) and needs registration. Delete asks for confirmation.
  3. Registrants: a list with email, name, registration time and their items, plus a count per item.
- Validation: `ends_at > starts_at`. Items outside the event's date are allowed. The current event has a single `date` and no end time, so the admin form doesn't enforce item dates against it.

### Testing

- Add Vitest to `@repo/db` with integration tests against a real Postgres (`DATABASE_URL`, using the Docker db). Cover:
  - trigger counts on insert/delete and on capacity changes
  - `registerForAgendaItem` creating the event registration
  - `ITEM_FULL` and `EVENT_FULL`
  - unregistering from the event cascading to items
  - concurrent registrations for the last seat: exactly one succeeds
  - `MAX_SEATS_BELOW_REGISTERED`
- UI: `pnpm lint`, `pnpm build`, and a manual browser check of the details page and the admin agenda on a phone-sized viewport.

### Forward compatibility (project 2)

Groups will add held seats. Because counts are recomputed in triggers from source tables, project 2 extends the trigger formula (`max − registered − held`) instead of touching every writer. Item registrations are per user, which matches project 2's decision that choices are stored per student.

### Settled after the builder review

- **Existing oversold events.** Before adding the CHECK, the migration raises `events.max_seats` to the registered count for any event that's oversold, and emits a `RAISE NOTICE` for each one. Then it backfills `event_seat_counts`. It never deletes registrations, and it never blocks a deploy. Old app instances keep working during a deploy, because the triggers maintain counts regardless of which code version writes.
- **Time zone.** All event and agenda times are **Europe/Warsaw**:
  - Admin date and time inputs are read as Warsaw wall-clock time, then converted to `timestamptz`.
  - All display formatting passes `timeZone: "Europe/Warsaw"` to `Intl`, so server and client render the same output with no hydration mismatch.
  - Overlap detection compares absolute timestamps.
  - Put the helpers in one shared module (e.g. `@repo/ui/utils` or a new `@repo/router-utils`-style subpath, following exports rules) and use them in both apps. Update the existing `formatEventDate` to pass the zone.
- **Seed.** Stop writing `event_seat_counts` directly and rely on the triggers. Optionally seed a sample agenda for one event.
- **Event delete.** The count triggers on `event_registrations` and `agenda_item_registrations` only `UPDATE` existing count rows. Count rows are created by the `events` and `agenda_items` insert triggers, so a cascade during event deletion never tries to insert a row for a deleted parent.
- **Matching IDs.** The query layer guarantees that an item registration's `user_id` and event match its parent `event_registration`. No composite foreign keys.
- **Admin routes.** Rename `apps/admin/src/routes/_authenticated/events.tsx` to `events.index.tsx`, so the new `events.$eventId.tsx` is a sibling, not a child.
- **Electric shape.** Item counts are synced unfiltered, as one small table, like the event shape.
- **Late registration.** Registering for an item that has already ended is rejected with `ITEM_ENDED`. Items in progress can still be registered for.

## Left to the builder

- Component breakdown, hook structure, and how far to reuse the existing optimistic and cross-tab registration machinery for items. At minimum, item mutations must await the `txid` and invalidate queries. Optimistic count adjustments for items are optional.
- Exact message keys and copy (pl and en).
- How the Vitest database is isolated (a separate test database or a transaction per test), as long as `pnpm --filter @repo/db test` works with the Docker db running.

## Calls I made without asking

- Flat agenda items, not Indico sessions or blocks: simpler, and enough for open days.
- `max_seats NULL` means no item limit of its own.
- Overlap warns, never blocks.
- A one-off backfill of `event_seat_counts` in the migration.
- Vitest integration tests in `@repo/db` only. The UI is verified manually.
- An `events.description` column (needed by #7 and the details page).
