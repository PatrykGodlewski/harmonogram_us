> **ARCHIWALNE (2026-11-19).** Zastąpione przez `docs/superpowers/specs/2026-11-19-produkt-design.md`. Zostaje jako zapis historii; nie jest źródłem prawdy.

# Group Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teachers register groups for an event and its agenda items. Students join by emailed invitation or join link and confirm in one step. Places are held in the live counts until a deadline, and a pg-boss worker sends emails and releases expired holds.

**Architecture:**
- New group tables. Holds are folded into the trigger-maintained seat counts from project 1.
- Domain logic lives in `@repo/db/queries/groups*`, integration-tested against Postgres.
- A small Better Auth plugin turns a long-lived invitation token into a session.
- `@repo/jobs` (pg-boss send) is shared by the API and a new `apps/worker`.

**Tech Stack:** Drizzle 0.45, Postgres 16 triggers, Better Auth 1.6 (plugin API, `internalAdapter`, `setSessionCookie`), pg-boss 12, react-email + Nodemailer, TanStack Start/Router/Query/Form, Electric collections (unchanged), `qrcode`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-group-registration-design.md`, including the "Settled after the builder review" section.

## Global Constraints

- All project-1 conventions in CLAUDE.md apply:
  - no barrel files
  - `@repo/env` for env
  - pl + en messages, then `pnpm messages:compile`
  - Europe/Warsaw times via `@repo/ui/time`
  - Biome
  - Conventional Commits ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Trigger refresh functions keep the lock-first rule: `PERFORM … FOR UPDATE`, then recount in a separate statement.
- New error codes (exact strings), added to `RegistrationErrorCode`:
  - `GROUP_PLACES_UNAVAILABLE`, `GROUP_FULL`, `GROUP_CLOSED`, `GROUP_DEADLINE_PASSED`
  - `GROUP_NOT_FOUND`, `NOT_GROUP_OWNER`, `INVITATION_INVALID`
  - `EMAIL_NOT_VERIFIED`, `ITEM_NOT_IN_GROUP`
- Statuses (exact):
  - group: `open` | `closed` | `cancelled`
  - member: `invited` | `confirmed`
  - `invited_via`: `email` | `link`
- Tokens: 32 random bytes as base64url. Store `sha256(token)` as hex in `token_hash`. Join codes: 16 random bytes as base64url (22 characters).
- Deadline: `events.date - events.group_deadline_hours * interval '1 hour'`, default 48. The single SQL helper `group_deadline(event_id)` is used by both the queries and the cron.
- Queues (exact names): `group-invitations` (policy `short`, `singletonKey = memberId`; jobs are queued inside the data transaction via `fromDrizzle`) with payload `{ memberId: string, locale: "pl" | "en" }`, and `close-expired-groups` with cron `*/5 * * * *` in tz `Europe/Warsaw`.
- Before every commit: `pnpm test && pnpm typecheck && pnpm lint`.

## Review Focus

1. **A teacher holds the last free places while a member of the public registers at the same moment.** Expected: no oversell. One gets `GROUP_PLACES_UNAVAILABLE` or `EVENT_FULL`, and the counts are exact. Pinned in Task 2 (`concurrent group vs individual`).
2. **The same invitation is confirmed twice**, for example by a double click or two tabs. Expected: one success, then `INVITATION_INVALID`. One registration only. Pinned in Task 3 (`token is single use`).
3. **A confirmed student leaves while the group is open.** Expected: the place returns to the group as a hold, so public counts don't change; after close, the seat is free. Pinned in Task 3 (`leaving returns place to group`).
4. **Places are reduced below the current member count.** Expected: rejected with `GROUP_FULL`. Pinned in Task 2 (`places cannot drop below members`).
5. **A join link is used after the deadline, or on a closed group.** Expected: `GROUP_DEADLINE_PASSED` / `GROUP_CLOSED`, and no member is created. Pinned in Task 2 (`join after deadline`).

---

### Task 1: Schema, hold-aware count triggers

**Files:**
- Create: `packages/db/src/schema/groups.ts` (`registrationGroups`, `registrationGroupItems`, `registrationGroupMembers`, `registrationGroupMemberItems`, plus relations)
- Modify:
  - `packages/db/src/schema/events.ts`: `groupDeadlineHours: integer("group_deadline_hours").notNull().default(48)`
  - `packages/db/src/schema/event-registrations.ts`: `groupId` → `registration_groups.id`, `onDelete: "set null"`
  - `packages/db/src/client.ts`: register the new tables
- Generate: `0007_*` (tables), then custom `0008_group_holds.sql`
- Test: `packages/db/test/group-holds.test.ts`
- Modify `packages/db/test/helpers.ts`:
  - `resetDb` truncates the 4 new tables
  - add `createGroupRow(eventId, ownerId, { places, itemIds?, status? })` and `addMemberRow(groupId, email, { status?, itemIds? })`, both raw inserts

**Interfaces:**
- Produces: table and column names exactly as in the spec's data model.
- Produces the SQL function `group_deadline(event_id text) returns timestamptz`.
- Produces the trigger rules below, which Tasks 2 and 3 rely on.

Column notes:
- `registration_group_members.event_registration_id` → `event_registrations.id` with **`ON DELETE CASCADE`**. Deleting a confirmed student's registration (they left, or were removed) deletes the member row. This implements the "place returns to group" call.
- `CHECK (places > 0)`.
- `UNIQUE (group_id, email)`.
- `token_hash` is UNIQUE.

`0008_group_holds.sql` replaces `refresh_event_seat_count` and `refresh_agenda_item_seat_count`, keeping lock-first:

```
event:  seats_remaining = max_seats - count(event_registrations)
        - Σ_{open groups g of event} (g.places - count(members of g with status='confirmed'))
item:   held = Σ_{open groups g} ( count(members of g, status='invited', having item)
        + CASE WHEN item ∈ g's items THEN g.places - count(members of g) ELSE 0 END )
        seats_remaining = CASE WHEN max_seats IS NULL THEN NULL ELSE max_seats - count(item regs) - held END
        registered_count stays = count(item regs)
```

New AFTER triggers call the refreshers:
- `registration_groups` INSERT, DELETE, and UPDATE OF places/status: refresh the event and all items of the event.
- `registration_group_members` INSERT, DELETE, and UPDATE OF status: refresh the event and the member's items. On DELETE, refresh every item of the event, because the member's item rows are already gone.
- `registration_group_items` and `registration_group_member_items` INSERT/DELETE: refresh that item.

For items, refreshing the event's items is fine. Events have few items.

- [ ] **Step 1: Write failing tests** (`beforeEach(resetDb)`). Use event max 30 and item `i1` max 20 unless stated.
  - `open group holds places on event and default items`: group places 5 with items `[i1]` → event remaining 25, `i1` remaining 15. Another item `i2` not in the group → unchanged.
  - `pending member with split item moves hold`: places 2, items `[i1]`; member A invited with items `[i2]` → `i1` held = 1 unclaimed + 0 pending = 1, `i2` held = 1 (A pending).
  - `confirming converts hold to registration without changing counts`: places 2; member confirmed plus an event registration with `group_id` → event remaining still 28.
  - `closing group releases unclaimed holds`: places 5, 1 confirmed → set status `closed` → event remaining 29.
  - `group bigger than free seats is rejected`: event max 3 with 2 registered → group places 2 rejects with constraint `event_seat_counts_seats_remaining_nonnegative`.
  - `deleting the confirmed registration deletes the member and returns the place to the group`: places 2, 1 confirmed → delete their `event_registrations` row → member row gone, event remaining = 28.
  - `group_deadline uses group_deadline_hours`: event date T, hours 48 → `group_deadline` = T − 48h.
- [ ] **Step 2:** Run `pnpm --filter @repo/db exec vitest run test/group-holds.test.ts`. Expected: FAIL (missing schema).
- [ ] **Step 3:** Schema, `pnpm db:generate`, custom `0008`, `pnpm db:migrate`.
- [ ] **Step 4:** Run `pnpm --filter @repo/db test`. Expected: PASS, including all project-1 tests.
- [ ] **Step 5:** Run the checks and commit: `feat(db): group tables and hold-aware seat counts`.

---

### Task 2: Group lifecycle queries (create, invite, join, update, close)

**Files:**
- Create: `packages/db/src/queries/groups.ts`, `packages/db/src/queries/group-tokens.ts`
- Modify: `packages/db/src/queries/event-registrations.ts` (error codes; `mapConstraintError` maps seat CHECKs to `GROUP_PLACES_UNAVAILABLE` in a new context `"group"`)
- Test: `packages/db/test/groups.test.ts`

**Interfaces:**
- Produces (`group-tokens.ts`):
  - `createInvitationToken(): { token: string; tokenHash: string }`
  - `hashToken(token: string): string`
  - `createJoinCode(): string`
- Produces (`groups.ts`). Every function takes `actorUserId` where an owner is required. Admin bypass comes in through an `actorIsAdmin = false` option.

  ```ts
  type GroupMemberRef = { memberId: string; email: string; token: string } // tokens returned so the caller can enqueue emails
  createGroup(input: { eventId; ownerUserId; places: number; itemIds: string[]; name?: string|null; emails: string[]; joinLinkEnabled: boolean }):
    Promise<{ groupId: string; joinCode: string|null; invited: GroupMemberRef[] }>
  inviteToGroup(groupId, actorUserId, emails: string[], opts?): Promise<GroupMemberRef[]>        // existing emails → new token (resend semantics)
  joinGroup(joinCode: string, email: string): Promise<GroupMemberRef>                              // invited_via='link'
  resendInvitation(memberId, actorUserId, opts?): Promise<GroupMemberRef>
  updateGroup(groupId, actorUserId, patch: { places?; name?; itemIds?; joinLink?: "enable"|"disable"|"regenerate" }, opts?): Promise<GroupDetails>
  closeGroup(groupId, actorUserId, opts?): Promise<void>
  closeExpiredGroups(now?: Date): Promise<number>                                                 // returns count closed
  getGroupDetails(groupId, actorUserId, opts?): Promise<GroupDetails>
  getGroupByJoinCode(joinCode): Promise<PublicGroupInfo|null>
  listMyGroups(userId): Promise<GroupSummary[]>
  listGroupsForEvent(eventId): Promise<GroupSummary[]>                                            // admin
  type GroupSummary = { id; eventId; eventTitle; eventDate; name; ownerEmail; places; confirmed; invited; status; deadline: Date }
  type GroupDetails = GroupSummary & { joinCode: string|null; itemIds: string[]; members: Array<{ id; email; status; invitedVia; itemIds: string[]; confirmedAt: Date|null }> }
  type PublicGroupInfo = { groupId; eventId; eventTitle; eventDate; name; ownerName: string|null; placesLeft: number; status; deadline: Date }
  ```

- Rules:
  - Emails are trimmed, lowercased and deduplicated. Invalid emails are rejected with zod `z.email()` in the API layer, not here.
  - `createGroup` requires the owner's `emailVerified` (`EMAIL_NOT_VERIFIED`), the event open (`EVENT_ENDED`) and `now < group_deadline` (`GROUP_DEADLINE_PASSED`). Items must belong to the event and require registration (`ITEM_NOT_FOUND`).
  - Total members must never exceed places (`GROUP_FULL`).
  - Lock order: `registration_groups` row, then `events` row, then items by id.

- [ ] **Step 1: Write failing tests**:
  - `create holds places and returns tokens for each email` (2 emails → 2 refs, counts held)
  - `create rejects unverified owner`
  - `create after deadline → GROUP_DEADLINE_PASSED`
  - `more emails than places → GROUP_FULL`
  - `concurrent group vs individual` (event max 3, two registered; `createGroup(places 1)` racing `registerForEvent` → exactly one fulfilled, and remaining 0 with no negative)
  - `join via code creates link member and returns token`
  - `join with existing email reissues token, no new member`
  - `join after deadline` (`GROUP_DEADLINE_PASSED`, no member)
  - `join on closed group` (`GROUP_CLOSED`)
  - `places cannot drop below members` (`GROUP_FULL`)
  - `updating items adds new item to members who had old defaults`
  - `non-owner update → NOT_GROUP_OWNER`, and admin bypass allowed
  - `closeExpiredGroups closes only past-deadline open groups and returns count`
  - `listGroupsForEvent / listMyGroups shape`
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm --filter @repo/db test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): group lifecycle queries`.

---

### Task 3: Acceptance, member changes, account-safety helpers

**Files:**
- Create: `packages/db/src/queries/group-members.ts`, `packages/db/src/queries/account-safety.ts`
- Test: `packages/db/test/group-members.test.ts`, `packages/db/test/account-safety.test.ts`

**Interfaces:**
- Produces:

  ```ts
  getInvitation(token: string): Promise<{ memberId; email; status; group: PublicGroupInfo; itemTitles: string[] } | null>   // for the confirm page; no side effects
  acceptInvitation(token: string, userId: string): Promise<{ eventId: string; txid: number }>
  removeMember(memberId, actorUserId, opts?): Promise<{ txid: number }>
  setMemberItems(memberId, actorUserId, itemIds: string[], opts?): Promise<{ txid: number }>   // ⊆ group items else ITEM_NOT_IN_GROUP
  reissueInvitationToken(memberId: string): Promise<string|null>   // new token for an invited member of an open group; null otherwise (used by the email job)
  // account-safety.ts
  resetUnverifiedAccount(userId: string): Promise<boolean>   // if !email_verified: delete credential accounts + all sessions; returns whether it reset
  findMagicLinkEmail(token: string): Promise<string|null>    // verification.identifier = base64url(sha256(token)); value JSON .email
  ```

- `acceptInvitation`, in one transaction:
  1. Lock the member by `token_hash`. Missing, or not `invited` → `INVITATION_INVALID`.
  2. Lock the group (not open → `GROUP_CLOSED`), then the event. Deadline passed → `GROUP_DEADLINE_PASSED`.
  3. Find or create the event registration (`group_id`). An existing individual registration is reused; set its `group_id` if it's null.
  4. Insert item registrations for the member's items that require registration and haven't ended, skipping existing ones.
  5. Set the member to `confirmed`, `user_id`, `event_registration_id`, `confirmed_at`, `token_hash = NULL`.
  6. Return the txid.
- The caller (Task 5) finds or creates the user and the session; this function takes `userId`.
- `removeMember`: if confirmed, delete the event registration (the cascade removes the member and its items); otherwise delete the member row.

- [ ] **Step 1: Write failing tests**:
  - `accept registers event and items, counts unchanged`
  - `token is single use` (second call → `INVITATION_INVALID`; one registration)
  - `concurrent double accept` (`Promise.allSettled` → one fulfilled)
  - `accept after group closed / deadline`
  - `accept while already individually registered keeps one registration and sets group_id`
  - `ended item skipped on accept`
  - `leaving returns place to group` (confirmed member → `unregisterFromEvent` → member gone, event remaining unchanged while open; after `closeGroup` → +1)
  - `removeMember confirmed frees registration and returns place`
  - `setMemberItems outside group items → ITEM_NOT_IN_GROUP`
  - `setMemberItems on confirmed member adds/removes item registrations`
  - `reissueInvitationToken invalidates the previous token` (old token → INVITATION_INVALID, new one accepts)
  - account-safety:
    - `resetUnverifiedAccount wipes password and sessions of unverified user only`
    - `findMagicLinkEmail resolves hashed identifier` (insert a `verification` row with identifier = `base64url(sha256("tok"))` and value `{"email":"a@x.test"}`)
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm --filter @repo/db test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): invitation acceptance and member management`.

---

### Task 4: `@repo/jobs`, worker app, invitation email, deployment

**Files:**
- Create `packages/jobs` (package `@repo/jobs`, exports below; deps `pg-boss@^12`, `zod`, `@repo/env`):
  - `src/queues.ts`: names and zod payload schemas
  - `src/client.ts`: lazy singleton `getBoss()` that does `start()` and `createQueue()` once, plus `enqueueInvitationEmails(items: {memberId; locale}[])`
- Create `apps/worker`:
  - `package.json`: scripts `dev` = `tsx watch src/index.ts`, `build` = `esbuild src/index.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/index.mjs`, `start` = `node dist/index.mjs`, plus `typecheck` and `lint`
  - `src/index.ts`: start pg-boss, create queues, register `work`, `schedule('close-expired-groups', '*/5 * * * *', null, { tz: 'Europe/Warsaw' })`, and shut down on SIGTERM with `boss.stop()`
  - `src/handlers/send-invitation.ts`, `src/handlers/close-expired.ts`
  - `railway.toml`
- Create: `packages/api/src/notifications/group-invitation-email.tsx` (react-email; pl/en; event title, Warsaw date/time, item titles, teacher name, button to `${BETTER_AUTH_URL}/{locale}/invite/{token}`)
- Modify:
  - `Dockerfile`: the runner stage copies `apps/${APP}/dist` when present
  - `apps/worker/railway.toml`: `startCommand`
  - root `package.json` `dev`: add `--filter=worker`
  - `.env.example` Railway section: worker variables
  - CLAUDE.md: worker, jobs, how to run
- Test: `apps/worker/test/handlers.test.ts` (vitest; uses `harmonogram_us_test`, same setup as `@repo/db`. A shared `vitest` config can import `packages/db/test/global-setup.ts`.)

**Interfaces:**
- `@repo/jobs/queues`:
  - `QUEUE_GROUP_INVITATION_EMAIL = "group-invitation-email"`, `QUEUE_CLOSE_EXPIRED_GROUPS = "close-expired-groups"`
  - `groupInvitationEmailPayload` (zod `{ memberId: string, locale: "pl"|"en" }`)
- `@repo/jobs/client`: `enqueueInvitationEmails(jobs: Array<{ memberId: string; locale: "pl"|"en" }>): Promise<void>` (retryLimit 3, retryBackoff true)
- Handlers:
  - `sendInvitationEmail(payload, deps: { send: typeof sendTransactionalEmail; issueToken: (memberId) => Promise<string|null> }): Promise<"sent"|"skipped">`. The token is re-issued at send time, because only the hash is stored. Skipped when the member isn't `invited` or the group isn't open.
  - `closeExpired(): Promise<number>`, which delegates to `closeExpiredGroups`.
- Because emails need the raw token and only the hash is stored, **the email job issues a fresh token** with `reissueInvitationToken` (Task 3). `createGroup`/`inviteToGroup`/`joinGroup` still return tokens for tests, but the API only enqueues memberIds.

- [ ] **Step 1: Write failing tests**:
  - `sends to invited member with link containing a token that accepts` (capture the `send` call, take the token from the link, `acceptInvitation(token, user)` succeeds)
  - `skips confirmed member`
  - `skips closed group`
  - `closeExpired closes past-deadline groups`
- [ ] **Step 2:** Run `pnpm --filter worker test`. Expected: FAIL.
- [ ] **Step 3:** Implement the packages, worker, template, Docker/Railway and docs.
- [ ] **Step 4:** Run `pnpm test && pnpm --filter worker build`, then `node apps/worker/dist/index.mjs` for about 5 s against the dev DB. Expected: tests pass, and the worker logs "worker started" and creates the queues. Stop it with SIGTERM; it exits 0.
- [ ] **Step 5:** Commit: `feat(worker): pg-boss worker for invitation emails and hold expiry`.

---

### Task 5: Auth: invitation plugin, account-safety hooks, password verification email

**Files:**
- Create: `packages/api/src/auth/group-invitation-plugin.ts`, `packages/api/src/notifications/verify-email.tsx`
- Modify: `packages/api/src/auth/better-auth.ts`
  - add the plugin
  - `hooks.before` for `/magic-link/verify`: `findMagicLinkEmail(ctx.query.token)`, then the user by email, then `resetUnverifiedAccount`
  - `emailVerification: { sendOnSignUp: true, sendVerificationEmail }` without awaiting the send (`void`), per the Better Auth docs
- Modify: `packages/i18n/messages/*.json` (verification email copy)

**Interfaces:**
- Plugin `groupInvitation()`, id `"group-invitation"`, endpoint `createAuthEndpoint("/group-invitation/accept", { method: "POST", body: z.object({ token: z.string().min(1) }) })`:
  1. `getInvitation(token)`; null → 400 `INVITATION_INVALID`.
  2. `user = internalAdapter.findUserByEmail(email)?.user`.
  3. If the user exists and isn't verified: `resetUnverifiedAccount(user.id)`, then `internalAdapter.updateUser(id, { emailVerified: true })`.
  4. If there's no user: `internalAdapter.createUser({ email, name: email.split("@")[0], emailVerified: true })`.
  5. `acceptInvitation(token, user.id)`. Map domain errors to a 400 with `{ code }`.
  6. `session = internalAdapter.createSession(user.id)`, then `setSessionCookie(ctx, { session, user })` (from `better-auth/cookies`).
  7. Return `ctx.json({ eventId, redirectTo: "/events/" + eventId + "?joined=1" })`.
- Rate-limit the endpoint by IP with the existing `RateLimiterRedis` pattern (10 per 15 minutes).

- [ ] **Step 1: Write failing tests** in `@repo/db` for the pieces with logic: the account-safety functions are in Task 3. Here, add `packages/api/test/group-invitation-plugin.test.ts` (vitest; `test.env.DATABASE_URL` = test DB). It calls `auth.handler(new Request(BETTER_AUTH_URL + "/api/auth/group-invitation/accept", { method: "POST", headers: { "content-type": "application/json", origin: BETTER_AUTH_URL }, body }))` and asserts:
  - `valid token → 200, Set-Cookie session, member confirmed`
  - `reused token → 400 INVITATION_INVALID`
  - `unverified password account gets reset before session` (seed a credential account with `email_verified = false` → after accept, there's no credential account and the old session row is deleted)

  If importing `better-auth.ts` outside Start fails because of `tanstackStartCookies`, record a ruling and test the endpoint handler function directly by exporting `acceptGroupInvitation(ctxLike)`.
- [ ] **Step 2:** Run `pnpm --filter @repo/api test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(auth): group invitation sign-in and unverified account reset`.

---

### Task 6: API server functions

**Files:**
- Create: `packages/api/src/groups/schemas.ts`, `packages/api/src/groups/queries.ts`, `packages/api/src/groups/mutations.ts`
- Modify: `packages/api/src/admin/queries.ts` (`adminEventGroupsQueryOptions(eventId)`), `packages/api/src/events/schemas.ts` (admin event schemas gain `groupDeadlineHours: z.number().int().min(0).max(720)`)

**Interfaces:**
- Schemas:
  - `createGroupSchema = { eventId, places: int 1..500, itemIds: string[], name?: string ≤ 120 | null, emails: z.array(z.email()).max(500), joinLinkEnabled: boolean }`
  - `emailsInputSchema`: parses one pasted string on `[\s,;]+` into unique lowercased emails, and returns the invalid ones separately (`{ valid: string[], invalid: string[] }`) for UI feedback. Export a pure `parseEmailList(text)` and unit-test it in `packages/api/test/parse-email-list.test.ts`.
- Server functions use `protectedActionFn`/`authMiddleware`, plus the owner check inside the queries via `actorIsAdmin: user.isAdmin`:
  - `createGroupServer`, `inviteToGroupServer`, `resendInvitationServer`, `removeMemberServer`, `setMemberItemsServer`, `updateGroupServer`, `closeGroupServer`
  - `myGroupsQueryOptions` (key `["my-groups"]`), `groupDetailsQueryOptions(groupId)` (key `["group", groupId]`)
- Public (no auth): `fetchJoinGroupInfoServer(code)`, `joinGroupServer({ code, email, locale })` (rate-limited per IP and code, 10 per 15 minutes, plus Turnstile token verification when `TURNSTILE_SECRET_KEY` is set), `fetchInvitationServer(token)`.
- After each mutation that creates or reissues members, call `enqueueInvitationEmails`. The locale comes from `getLocale()` on the server request.
- Domain errors are rethrown as `Error(code)` via `withDomainErrors`.

- [ ] **Step 1:** Write `parseEmailList` tests: commas, newlines, semicolons, duplicates, uppercase, invalid kept apart. Expected: FAIL.
- [ ] **Step 2:** Implement the schemas and server functions. Then `pnpm --filter @repo/api test && pnpm typecheck`. Expected: PASS and clean.
- [ ] **Step 3:** Commit: `feat(api): group server functions`.

---

### Task 7: Web UI (create, teacher view, join, invite confirm, account)

**Files:**
- Create routes:
  - `apps/web/src/routes/events/$eventId.groups.new.tsx`
  - `apps/web/src/routes/groups/$groupId.tsx`
  - `apps/web/src/routes/join/$code.tsx`
  - `apps/web/src/routes/invite/$token.tsx`
- Create components: `apps/web/src/components/groups/*`
  - `group-form.tsx` (places, items checklist, name, emails textarea with live `parseEmailList` feedback, join link toggle)
  - `group-members.tsx`
  - `member-items-sheet.tsx` (uses `@repo/ui/components/sheet`)
  - `join-link-card.tsx` (copy button; QR via `qrcode` `toDataURL`, client-only)
- Modify:
  - `apps/web/src/components/event-details/event-summary.tsx`: "Register a group" link when signed in and before the group deadline
  - `apps/web/src/routes/account.tsx`: "My groups" list
  - `apps/web/src/lib/event-registration/errors.ts`: new codes
  - i18n
- Add dependency `qrcode` (+ `@types/qrcode`) to `apps/web`.

Behaviour:
- `/invite/$token`: the GET shows the event, group, items, email and a "Confirm my place" button. The POST goes through `authClient.$fetch("/group-invitation/accept", { method: "POST", body: { token } })`, then `window.location.assign(redirectTo)`, which is a full reload so the new session cookie applies. If a different user is signed in, the page says "You'll be signed in as {email}". Error codes render friendly text.
- `/join/$code`: email field, Turnstile when configured, submit, then "Check your inbox at {email}".
- `/groups/$groupId`:
  - non-owners get NOT_GROUP_OWNER and see "not found"
  - live counts via the existing collections
  - actions: add emails, resend, remove (confirm dialog), change places, close (confirm), join link enable/disable/regenerate
- `/events/$eventId?joined=1`: success toast "You're registered with {group}".

- [ ] **Step 1:** i18n keys (pl + en) for all copy, then `pnpm messages:compile`.
- [ ] **Step 2:** Implement the routes and components.
- [ ] **Step 3:** Run `pnpm typecheck && pnpm lint && pnpm --filter web build`. Expected: clean.
- [ ] **Step 4:** Browser check with the headless CDP harness. Run the worker and Mailpit; use isolated contexts.
  1. The seed admin creates a group of 3 for `evt-1` with items `[web]` and one email.
  2. The public page counts drop by 3 (event) and 3 (web).
  3. Fetch the invitation link from the Mailpit API (`GET http://localhost:8025/api/v1/messages`, then the message text).
  4. Open it in a new context and confirm → land on the event page registered for the event and `web`, and the counts don't change.
  5. Open the join link in another context and submit an email → a second Mailpit message arrives.
  6. The teacher removes the confirmed member → that member's row disappears and the counts don't change.
  7. Close the group → counts rise by the unclaimed places.

  Expected: all steps observed.
- [ ] **Step 5:** Commit: `feat(web): group registration, join links and invitation confirmation`.

---

### Task 8: Admin: groups on the event page, deadline setting

**Files:**
- Create: `apps/admin/src/components/admin-event-detail/groups-list.tsx`
- Modify:
  - `apps/admin/src/routes/_authenticated/events.$eventId.tsx`: Groups section
  - `apps/admin/src/components/admin-event-detail/registrants-list.tsx`: group badge (needs `groupName` on `EventRegistrant`; add it in `getEventRegistrants` with a left join)
  - `apps/admin/src/components/admin-events-page.tsx`: a `groupDeadlineHours` number field, default 48, with the hint "Group places are released this many hours before the event"
  - i18n

- [ ] **Step 1:** Write a failing DB test: `getEventRegistrants includes groupName for group members`.
- [ ] **Step 2:** Implement the query change and the UI.
- [ ] **Step 3:** Run `pnpm test && pnpm typecheck && pnpm lint && pnpm build`. Expected: clean.
- [ ] **Step 4:** Browser check: the admin event page shows the group (owner, places, confirmed, invited, status) and the badge on a group registrant; setting the deadline hours to 0 saves.
- [ ] **Step 5:** Commit: `feat(admin): groups on event page and group deadline setting`.
