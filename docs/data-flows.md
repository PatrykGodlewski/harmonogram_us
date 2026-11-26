# Registration, fresh data and jobs

Read before changing capacity, registration, waitlists, groups, page refresh or transactional jobs. These invariants span packages and apps.

## Database capacity and concurrency

Programme sessions (F33, `agenda_sessions`): an item with `session_id` must lie within its session's times (checked under a lock on the session row, both when an item and when a session changes); deleting a session deletes its items; `copyAgendaSession` makes an independent copy shifted to a new start. Seat counts stay per event and per item.

`event_seat_counts` and `agenda_item_seat_counts` are maintained by Postgres triggers from registration rows and capacity columns (`0003_seat_count_triggers.sql`). **Never write these count tables directly**, including from seeds. `CHECK (seats_remaining >= 0)` enforces capacity.

Refresh functions must first lock the count row, then recount in a separate statement (migration `0006`). Under READ COMMITTED, a single UPDATE that waits for the lock recounts using a stale snapshot. Regression coverage: `packages/db/test/concurrency.test.ts`.

Only `registered` registrations take a place; `waitlisted` registrations wait in `created_at` order. On events with `requires_approval`, self-registration creates `pending` (no place); `approveRegistrations` takes the event lock and gives free places to requests in request (`created_at`) order, the rest become `waitlisted`; `rejectRegistrations` sets `rejected` (kept, so withdrawing cannot re-ask; it can still be approved later). Organiser-added people, groups and agenda items never bypass approval: organisers skip it (`byOrganizer`), groups are refused on approval events, agenda items need an approved registration (`APPROVAL_REQUIRED`). Groups also hold places through the count triggers. Every operation freeing capacity (withdrawal, higher limit, smaller/closed/expired group) must promote from the waitlist in the same transaction with the event row locked; preserve the existing promotion/notification helper (`promoteFromWaitlist` / the current notifying wrapper).

Global row-lock order:

1. `events` row.
2. `agenda_items` rows ordered by ID.
3. `registration_groups`.
4. `registration_group_members`.
5. Count rows (locked by triggers).

Foreign-key insertion takes a key-share lock on the parent: lock parents first.

Only `published` events take registrations or promote from the waitlist (`assertEventOpen`: drafts are `EVENT_NOT_FOUND`, cancelled ones `EVENT_CANCELLED`); a cancelled event can't be edited. Organiser add/remove (`addRegistrantByEmail`, `removeRegistrant`) follow the same rules and share `withdraw()` with self-service. Attendance is `event_registrations.checked_in_at`, set by `checkInByTicketCode` (first scan wins; a re-scan reports the original time) or the manual switch.

Registration questions (`event_questions`) and answers (`registration_answers`, cascade with the registration and the question): `registerForEvent(…, { answers })` validates them in the transaction (`saveAnswers`: required, choice in options, yes/no); organiser-added people and group members may skip required answers; editing a question removes answers that no longer fit; `getEventRegistrants(…, { withAnswers })` hides answers from check-in helpers. E-mails use `coalesce(user.locale, registration.locale)`.

Guest requests (F17, `guest_registration_requests`: hashed token, 24 h) are **not registrations and hold no place**: `createGuestRequest` validates the event (open, not signed-in only, invite link for invite-only) and the answers, and queues the confirmation e-mail in its transaction; confirming (`/api/auth/guest-registration/confirm`) takes the request once, finds or creates a verified account (`ensureVerifiedUser`, which removes a stranger's unverified password) and calls `registerForEvent`, so capacity, waitlist and approval rules apply unchanged. Expired requests go in the daily prune job. Withdraw links in registration e-mails are an HMAC of the registration id (`withdraw-link.ts`) and withdraw through `removeRegistrant` (waitlist promoted).

Invite-only events (`visibility = 'private'`, CHECK: `invite_token` not null) are never listed or in feeds; `canOpenEvent` (`packages/api/src/events/access.ts`) opens them for the current invite link, a non-declined registration, or organisers, and is checked by the event page, registration, agenda-item registration, group creation and the single-event ICS.

## Fresh data on open pages

Open pages refetch the data they already load; there is no separate sync channel.

1. `eventsQueryOptions` (lists) and `eventDetailsQueryOptions` (event page) refetch every `LIVE_REFRESH_MS` (15 s, `packages/api/src/events/live-refresh.ts`): seat counts, programme-item counts and cancellations come with them. `myRegistrationsQueryOptions` refetches at the same pace only while the user is on a waitlist (a promotion happens in someone else's action).
2. TanStack Query pauses the interval in hidden tabs and refetches when a tab regains focus. A background refetch does not mark the list busy (`refetching` means "previous filter's results shown").
3. Registration actions go through `useRegistrationActions` in `apps/web/src/lib/registration/`: call the server, then invalidate the user's registrations, the event page and the lists.
4. A count on screen may be up to one interval old; the server decides capacity under the event lock, so a stale count never overbooks.

## Worker and transactional email

`apps/worker` runs pg-boss on the same Postgres. Queue names, payload schemas and enqueue helpers live in `@repo/jobs/client`; handlers in `apps/worker/src/handlers`.

- `emails`: verification, registration confirmed/waitlisted/promoted/cancelled, and organiser messages (`event-message`, reply-to the sender, limited per event and per sender). Registration state changes flow through `RegistrationHooks.onChanged(tx, changes)` → `registrationEmailHooks`; `cancelEvent` reports every registered and waitlisted person as `cancelled`; `updateEvent` reports a published event's new date or place through `onEventChanged` (registered and waitlisted). `enqueueEmails` inserts in batches of 500 inside the caller's transaction; DB functions that pick recipients take a hook (`messageRegistrants(eventId, audience, onRecipients)`), since `@repo/db` does not depend on `@repo/jobs`.
- `group-invitations`: policy `short`, `singletonKey = memberId`, at most one queued send per member. Only invitation-token hashes are stored; the email job issues a fresh token when sending.
- `event-reminders`: every five minutes, one statement claims due events (`queueDueReminders`) and queues reminder e-mails (registered people only).
- `prune-old-registrations`: daily, deletes registrations and groups of events that ended more than `REGISTRATION_RETENTION_DAYS` ago.
- `certificate-emails`: every 15 minutes; `queueReadyCertificates` claims attendees (registered + checked in, published ended event with `certificates_enabled`, ended within 30 days) whose `certificate_emailed_at` is null, with `FOR UPDATE SKIP LOCKED`, and queues `registration`/`certificate` e-mails in the same transaction (late check-ins are picked up on a later run).
- `survey-emails`: every 15 minutes; `queueSurveyInvitations` claims registrations whose survey is open (registered, published event with survey questions, ended less than 30 days ago) and whose `survey_emailed_at` is null and `survey_answered` is false, with `FOR UPDATE SKIP LOCKED`, and queues `registration`/`survey` e-mails in the same transaction. `submitSurvey` sets `survey_answered` and inserts the answers in one transaction; `survey_responses`/`survey_answers` carry no registration or user id (anonymous; they survive account deletion and retention). Neither side stores a precise time (`survey_answered` is a flag, `survey_responses.created_at` is the day), so a response cannot be matched to a person by time.
- `delete-stored-files`: every 15 minutes; deletes bucket objects listed in `stored_file_deletions` (up to 500 per run, 20 at a time) and then their keys; a failed delete stays for the next run. A trigger on `event_files` adds the key of every deleted row, so files removed one by one, with their programme item or with their event all leave no object behind. Event files and programme item images record their key before the upload and forget it in the transaction that saves the row (`addEventFile`, `setAgendaItemImage`), so an upload that never gets its row (a crash, a failed insert, a deleted event or item) is cleaned up too; when the row cannot be saved, the upload deletes its object at once and forgets the key, or leaves the key if the delete fails. Cover images record no key in advance: the pipeline records the stored key when saving fails or the event is gone. Nothing younger than one hour (`STORED_FILE_GRACE_MS`) is deleted, whatever recorded it, so an upload in progress keeps its object.
- `close-expired-groups`: every five minutes; closing groups releases held seats through triggers and promotes waitlisted registrations.
- `event-images`: policy `stately`, `singletonKey = eventId` (one queued and one running job per event), `retryLimit: 0` (each attempt is a paid image), `expireInSeconds: 300`, dead letter `event-images-dead`. An event save (in a savepoint of the save transaction) or an organiser's "regenerate" sets `events.image_status = 'pending'` and queues `{ eventId, force }`. The worker sets `ready` (only while `image_source_hash` still matches) or `failed`; any other error is rethrown, so pg-boss fails the job.
- `event-images-dead`: event-image jobs pg-boss failed (the handler threw, the job ran longer than 5 minutes, or a worker shutdown cut it off; a job whose worker died is failed by the next worker's supervisor). The handler sets a cover that is still `pending` to `failed`, which makes "regenerate" available again. It retries 3 times, 60 s apart, because a retry here generates nothing.
- Queue options in `QUEUES` (`@repo/jobs/queues`) are applied to existing queues on every process start (`ensureQueues`). Removing an option there does not clear it in the database.

**Enqueue jobs inside the same Drizzle transaction as the data, never after commit.** Example: `enqueueInvitationEmails(jobs, { tx })`, using pg-boss `fromDrizzle`; DB group functions take `onInvited(tx, refs)` hooks.

Worker tests use the test DB: `pnpm --filter worker test`. esbuild bundles to `dist/index.mjs`; Docker builds with `APP=worker`; Railway config is `apps/worker/railway.toml`.

pg-boss was chosen over DBOS intentionally for short pipelines. DBOS would require a datasource refactor for exactly-once DB steps and version pinning for recovery across deploys. Revisit only if long multi-step workflows with compensation appear.
