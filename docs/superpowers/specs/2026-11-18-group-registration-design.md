# Group registration — design

Date: 2026-11-18 · Project 2 of 3. Builds on project 1 (agenda, per-item registration, trigger-maintained seat counts).
Status: decided with the stakeholder in the brainstorming conversation, with "decide yourself and continue" for the rest. My own calls are marked **(call)**.

## Intent

Stakeholder requirement: "Możliwość rejestracji więcej niż jedna osoba jako nauczyciel rejestruje grupę uczniów". A teacher registers a class for an event (an open day, for example), often for only part of the agenda (say 12:00–16:00 of a 9:00–20:00 programme). Every attendee must be a real, verified person ("email based to avoid any fake registrars"). The first time is allowed to be a little harder, but after that it's frictionless: an email address is an account.

## Goals

1. Any signed-in user with a verified email can create a **group** for an event (**call**: no special teacher role). For the group they choose:
   - the number of places to hold,
   - which agenda items the group attends (a subset; possibly none, meaning the event only).
2. Students can join a group in two ways. The teacher may use both on one group.
   - **Email list:** the teacher pastes emails. Each gets an invitation email.
   - **Join link:** one shareable link and QR code. A student opens it, enters their email, and gets the same invitation email.
3. **One-step acceptance.** The invitation link opens a confirm page, and one button verifies the email, creates the account if needed, signs the student in and confirms their place, all in one click. Any email address is allowed (private or university), subject to the existing disposable-domain and MX checks.
4. **Places are held** from the moment the group is created, against the event and against each of the group's items. Live public counts show held places as taken.
5. **Confirmation deadline.** Unconfirmed places are released at the deadline.
   - Default: 48 h before the event's start (**call**).
   - Admins can override it per event.
   - Invitations stop working after it.
6. **Teacher view:**
   - Members with status (invited, joined via link, confirmed).
   - Resend an invitation, remove a member (frees the place), close the join link, change the place count.
   - Move individual students between the group's items (splitting the class).
7. **Item choices belong to each student.** They default to the group's items, and the teacher can change them per student. Students can't add items through the group, but they can leave the event or an item themselves, which frees the place.
8. **Admin:** the event page lists groups (teacher, places, confirmed, pending) under registrants. Group members are labelled with their group.
9. A background **worker** sends invitation emails and releases expired holds (pg-boss on the existing Postgres, #22).

## Non-goals

- Teacher role or approval flow, group chat, and messaging the group.
- Waiting lists, and students picking items within the group.
- Event cancellation emails (#16): the worker makes them easy later, but they're out of scope.
- Docker packaging of the worker (project 3). Here it runs with `pnpm --filter worker dev`.

## Anti-goals

- A held place that never gets released: a missed deadline must free seats even if no one is looking at the page.
- Seat counts that drift from real registrations and holds. The trigger invariants from project 1 must hold, including recounting under lock.
- A join link that lets someone take more places than the teacher held.
- Invitation tokens that are guessable, reusable after use, or valid after the deadline.

## Approaches considered

**Counting holds**
- **A. Holds folded into the existing count triggers (chosen).** `seats_remaining = max − registrations − active held places`. This keeps the single source of truth and the live sync unchanged.
- **B. Placeholder registration rows per held place.** This pollutes registrations and breaks "one row per user".
- **C. App-computed holds.** Rejected for the same drift reason as in project 1.

**Signing in from an invitation**
- **A. A custom Better Auth plugin endpoint (chosen).** It verifies our own long-lived invitation token, then uses `internalAdapter.findUserByEmail`/`createUser({ emailVerified: true })`/`createSession`, and then `setSessionCookie`. This is the same pattern Better Auth's magic-link plugin uses, verified in `better-auth/dist/plugins/magic-link`.
- **B. Invitation page, then a standard magic link.** This means two emails, and the magic link expires after 15 minutes.
- **C. Make the invitation a magic link with a long expiry.** Magic-link expiry is global (15 minutes for normal sign-in), so it can't vary per invitation.

**Background jobs**
- **A. pg-boss worker app (chosen; #22).** It needs no new infrastructure and is retryable.
- **B. Send emails inline and use lazy expiry.** Lazy expiry can't release holds, because counts only change on writes.
- **C. pg_cron.** It needs a Postgres extension that isn't present in the stock image or on Railway Postgres.

## Design

### Data model (migration `0007_*`, plus SQL for triggers)

`events`:
- `group_deadline_hours integer NOT NULL DEFAULT 48`.
- The deadline is `date − group_deadline_hours`. **(call)** `0` means groups confirm until the event starts.

`registration_groups`:
- `id`, `event_id → events CASCADE`, `owner_user_id → user CASCADE`, `name text NULL` (e.g. "3B, LO nr 5").
- `places int NOT NULL CHECK (places > 0)`.
- `status text NOT NULL DEFAULT 'open'`: one of `open`, `closed` (deadline passed or teacher closed it), `cancelled`.
- `join_code text UNIQUE NULL`: 22 random url-safe characters, or null when the link is disabled.
- `created_at`, `updated_at`.

`registration_group_items`: `(group_id, agenda_item_id)` primary key. These are the group's default items.

`registration_group_members`:
- `id`, `group_id → CASCADE`, `email text NOT NULL` (lowercased).
- `status text NOT NULL`: `invited` or `confirmed`. Removing a member deletes the row.
- `invited_via text NOT NULL`: `email` or `link`.
- `token_hash text UNIQUE NULL`: SHA-256 of the invitation token. Cleared once used or on removal.
- `user_id NULL`, `event_registration_id → event_registrations SET NULL NULL`.
- `invited_at`, `confirmed_at NULL`.
- `UNIQUE (group_id, email)`.

`registration_group_member_items`: `(member_id, agenda_item_id)` primary key. Per-student items, copied from the group defaults on creation and editable by the teacher.

`event_registrations.group_id → registration_groups SET NULL NULL`. This labels group members in admin views.

### Hold arithmetic (in the trigger refresh functions, under the existing lock-first rule)

For an open group `g`:
- Event hold = `g.places − confirmed(g)`.
- Item hold for item `i`:
  - pending members of `g` who have `i`,
  - plus unclaimed places when `i` is a group default item, where unclaimed = `g.places − members(g)`.

`seats_remaining` becomes:
- event: `max − registrations − Σ event holds of open groups`
- item: `max − item registrations − Σ item holds of open groups`

For items, `NULL` max still means NULL remaining. A held place for an unlimited item never blocks anything.

Triggers must also refresh counts on changes to `registration_groups` (places, status), to members (insert, delete, status) and to member/group items. The `CHECK (seats_remaining >= 0)` constraints now also stop a teacher from holding more places than are free. That error maps to `GROUP_PLACES_UNAVAILABLE`.

### Flows

**Create a group** (`createGroup`): signed in and verified, the event is open (the project 1 end checks) and before its group deadline. Steps:
1. Lock the event, then the items in id order.
2. Insert the group, its items, and email members (status `invited`, a token each).
3. Enqueue one invitation email per member.

Seat CHECKs enforce capacity. The error codes are `GROUP_PLACES_UNAVAILABLE`, `EVENT_ENDED` and `GROUP_DEADLINE_PASSED`.

**Invite more, or join via link** (`inviteToGroup`, `joinGroup`):
- Total members can't exceed `places`. Errors: `GROUP_FULL`, `GROUP_CLOSED`.
- Joining by link (anonymous, rate-limited like magic-link requests, with Turnstile) creates a member with `invited_via = 'link'` and sends the same email.
- Re-joining with an existing email only resends the invitation.

**Accept** (confirm page `/invite/$token`, which POSTs to the Better Auth plugin endpoint `POST /api/auth/group-invitation/accept`; see "Settled after the builder review"): in one transaction, with the same locks as registering:
1. Validate the token hash: the member must be `invited`, the group `open`, and the deadline not passed.
2. Find or create the user with `emailVerified = true`.
3. If they aren't registered for the event yet, register them (`event_registrations.group_id = g`). The held place converts into a registration, so the counts are unchanged.
4. Register the member's items; ones they already have are skipped.
5. Mark the member `confirmed`, clear the token, and create a session cookie.
6. Redirect to `/events/$eventId?joined=1` on the web app.

If they're already registered for the event individually, the place still confirms without creating a duplicate, and the hold is released.

Error pages, at `/invite/error?code=…`: `INVITATION_INVALID` (unknown or used token), `GROUP_CLOSED`, `GROUP_DEADLINE_PASSED`, `ITEM_FULL`. Item capacity was held, so `ITEM_FULL` should only happen on edge cases.

**Teacher edits:**
- `removeMember`: deletes the row; if confirmed, it also deletes the student's event registration, which cascades to their items.
- `resendInvitation`: issues a new token and enqueues the email.
- `setMemberItems`: must be a subset of the event's items. For confirmed members it also adds or removes their item registrations, guarded by item capacity.
- `updateGroup`: places (≥ members), name, join link on, off or regenerate.
- `closeGroup`: releases unclaimed holds and keeps confirmed students.

Only the group owner or an admin can do these.

**Deadline:** a pg-boss scheduled job every 5 minutes sets `status = 'closed'` for open groups past their deadline. The triggers then release the holds, and Electric pushes the new counts. Lazy guards (token acceptance, joining) also check the deadline, so correctness doesn't depend on job timing.

### Worker (`apps/worker`, new)

- A Node and tsx process using `pg-boss` with the existing `DATABASE_URL`.
- Queues:
  - `group-invitation-email` `{ memberId, locale }`: renders a react-email template with the event, the items and the accept link, then sends it with the existing Nodemailer transport. Retries 3 times with backoff.
  - `close-expired-groups`: cron `*/5 * * * *`.
- The API enqueues through a small `@repo/jobs` package (a pg-boss `send` wrapper plus queue names and payload zod schemas) shared by the API and the worker.
- Root `pnpm dev` also starts the worker.

### UI

Web, mobile-first:
- **Event page:** "Register a group" button (signed in) → `/events/$eventId/groups/new`: places, items checklist (defaults to the items the event allows), optional name, emails textarea (paste with commas, newlines or spaces), and a join-link toggle.
- **`/groups/$groupId`** (teacher view):
  - Summary: confirmed / invited / free.
  - Join link with copy button and QR code (rendered client-side with a small QR library; **(call)** `qrcode` from npm).
  - Members list with status and per-member item chips. Editing items opens a sheet with checkboxes.
  - Actions: resend, remove, add emails, change places, close group.
  - Live counts come through the existing Electric collections.
- **`/join/$code`:** event summary, group name, places left and an email field. Submitting shows "Check your inbox".
- **`/account`:** "My groups" list.

Admin: on the event page, a "Groups" section (owner email, name, places, confirmed/pending, status), and a group badge on registrants.

i18n: every string in pl and en.

### Security

- Tokens are 32 random bytes in base64url; only the SHA-256 is stored, and comparison is by hash lookup.
- Single use, and invalid after the deadline or when the group closes.
- Join codes are random and can be regenerated. Join requests are rate-limited per IP and code, and protected by Turnstile.
- Every teacher action checks ownership (or admin) on the server.
- Invitation emails reveal only the event, the group name and the inviting teacher's name.

### Testing

- DB tests (Vitest, real Postgres):
  - hold arithmetic for event and items, including unclaimed and pending members with split items,
  - confirming a place doesn't change counts,
  - closing a group releases holds,
  - a group larger than the free seats is rejected (`GROUP_PLACES_UNAVAILABLE`),
  - join beyond places is rejected (`GROUP_FULL`),
  - token is single-use and expires,
  - accepting while already individually registered,
  - concurrency: two groups racing for the last places,
  - removing a confirmed member frees the seat.
- Worker job handlers are unit-tested against the test DB, with pg-boss `work` replaced by direct handler calls.
- Plugin endpoint tests call `auth.handler` with a Request.
- Browser checks with the headless CDP harness: create a group, accept an invitation from Mailpit's API in an isolated context, see live counts.

## Settled after the builder review (2026-11-18)

Stakeholder answers:
- **Accepting is scanner-safe.** The invitation email links to a web page `/invite/$token`, a GET with no side effects. It shows the event, the group, the student's items and the email address, plus one **"Confirm my place"** button. The button POSTs to the plugin endpoint `POST /api/auth/group-invitation/accept` with `{ token }`. That request verifies, signs in, registers, and returns the redirect target. Link scanners can open the page without using up the token.
- **Account safety.**
  1. The takeover risk is closed generically with a Better Auth `databaseHooks.user.update.before` hook. When `emailVerified` changes from false to true, it deletes the user's `credential` accounts (passwords) and all their sessions before the update. This covers invitation acceptance and magic-link verification alike.
  2. Password sign-ups get a verification email (`emailVerification.sendVerificationEmail`, `sendOnSignUp: true`), using the existing Nodemailer transport and a pl/en template. Sign-in without verification still works as today.
  3. Creating a group requires `emailVerified`.
- **The worker is deployed with this project.**
  - The Dockerfile builds `APP=worker`. The worker bundles to `dist/index.mjs` with esbuild through a `build` script, so the runner works the same way as the apps.
  - `apps/worker/railway.toml` sets `startCommand = "node apps/worker/dist/index.mjs"`, or the equivalent the builder finds cleanest.
  - The `.env.example` Railway section lists the worker's variables (`DATABASE_URL` and the SMTP settings).

My calls:
- **Student items:** a teacher can assign only the group's own items. They can edit the group's items later; new items are added to members who had the old defaults, and holds follow automatically through the triggers. Adding an item fails with `GROUP_PLACES_UNAVAILABLE` if it lacks capacity.
- **A confirmed student leaves the event:** the member row is deleted (via `unregisterFromEvent`, or `ON DELETE` of the linked registration in the trigger path). The place returns to the group as an unclaimed hold while the group is open, so the teacher can invite a replacement. After the deadline it simply frees the seat.
- **Signed in as someone else when accepting:** the session is replaced with the invited user's, and the page says so ("Signed in as …").
- **The teacher doesn't take a place** unless they register themselves.
- **When accepting:** items that have ended or don't need registration are skipped silently, and the student is confirmed for the rest.
- **Email locale:** the inviter's request locale for email invitations, and the joiner's locale for join links.

### Job reliability (decided 2026-11-18, after comparing DBOS and pg-boss)

- We keep pg-boss, hardened:
  - Invitation jobs are queued inside the same database transaction as the group change (pg-boss `fromDrizzle(tx, sql)`), so they commit or roll back together.
  - The invitations queue (`group-invitations`) uses policy `short` with `singletonKey = memberId`, so at most one send per member is queued.
  - Handlers are idempotent: a member who is no longer invited, or a group that is closed, is skipped.
- DBOS was considered and set aside for now:
  - Its exactly-once DB steps need all queries routed through its Drizzle datasource.
  - Recovering workflows across deploys needs a pinned application version and `DBOS.patch()`, or Enterprise auto-upgrade with Conductor.
  - Our pipelines are short: one transaction, then a fan-out of emails.
- "Revert" means DB transactions roll back automatically. No tool can undo a sent email, so compensations are explicit jobs.

## Left to the builder

- Exact component structure, the QR rendering details, and copy (pl and en).
- pg-boss configuration details (schema name, retention), as long as the queues and cron above exist.
- Email template layout.

## Calls I made without asking

- Any verified user can create groups, with no teacher role.
- The default deadline is 48 h before the event, admins can set it per event, and `0` means groups confirm until the event starts.
- Re-joining with an email that's already in the group only resends the invitation.
- A student who was already individually registered simply confirms, and their held place is released.
- QR codes use the `qrcode` npm package.
- The worker is a new `apps/worker` with a shared `@repo/jobs` package. Docker comes in project 3.
