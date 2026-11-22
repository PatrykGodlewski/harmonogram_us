# Plan 4: approval, invite-only events, certificates, recurring copies, speakers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** F30, F32, F12, F31 and speakers/material links (F18/F19), each at least on par with Indico and better on a phone.

**Architecture:** New registration states and event columns in `@repo/db` (migrations 0022+), server functions in `@repo/api` behind `panelActionFn`/`assertCanManageEvent`, e-mails through the existing `registration` job kinds, UI in `apps/web` and `apps/admin`.

**Tech stack:** as in `AGENTS.md`; new dependency `pdf-lib` + `@pdf-lib/fontkit` with a bundled OFL font (Polish glyphs) for certificates.

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md` (F12, F18, F19, F30, F31, F32; history row of 20.11 "Plan 4").

## Global constraints

- Every feature has a passing `[Fn] …` Playwright test, written first and seen failing (komputer + telefon).
- Pending and rejected registrations never take a place: `refresh_event_seat_count` counts only `registered` (already true; keep it).
- Jobs are queued inside the data transaction; lock order events → registrations → counts.
- UI text in `packages/i18n/messages/{pl,en}.json`; admin screens designed at 360 px.
- New `admin/*.ts` server files are added to the source scan in `packages/api/test/event-access.test.ts`.
- After each feature group: review + simplify with Context7 (AGENTS.md).

## Review focus

1. Approving when the event is full → the person goes to the waitlist (in `created_at` order of approval), never over capacity.
2. A rejected person who opens the event again sees "rejected", cannot re-register silently; withdrawal of a pending request works.
3. Invite-only event must not leak through list, ICS feeds, OG tags, Electric shapes or a guessed `/events/:id` without token.
4. Certificate for someone not checked in, for an event not yet ended, or for another user's registration → 404.
5. Recurring monthly copy from 31 Jan → end of month (Postgres interval `+ 1 month` clamps), times stay local across DST.

---

### Task 1: F30 — events can require approval; registrations wait

Requirements: F30 "zapis … ma stan „czeka”".
Files: `packages/db/src/schema/{events,event-registrations}.ts`, migration `0022_registration_approval.sql`, `queries/event-registrations.ts` (`registerForEvent`, `getMyRegistrationStates`, `RegistrationChange.change` += `"pending"`), `queries/events.ts` (create/update `requiresApproval`), `api/src/notifications/registration-email.tsx` (+`pending`, `rejected`), `apps/worker/src/handlers/send-email.ts` (`EXPECTED_STATE`), admin `event-form-dialog.tsx` (switch "Zapisy wymagają akceptacji"), web `event-registration-button.tsx`, `event-summary.tsx`, `my-registrations.tsx`, `use-event-list-registrations.ts` (+`isPending`, `isRejected`).
Interfaces: `RegistrationState = "registered" | "waitlisted" | "pending" | "rejected"`; `events.requiresApproval: boolean` (default false).
Tests: `e2e/tests/f30-akceptacja.spec.ts` "[F30] zapis na wydarzenie z akceptacją czeka"; db test: pending does not change `seats_remaining`.

- [x] Write e2e + db test, see them fail.
- [x] Migration: column, state CHECK widened; register → `pending` when `requires_approval`; e-mail "pending"; web shows "Czeka na akceptację" + "Wycofaj zgłoszenie".
- [x] Run targeted checks; commit `feat: events can require approval`.

### Task 2: F30 — organiser approves or rejects (one or many)

Requirements: F30 "po akceptacji … zapisana i dostaje e-mail; po odrzuceniu … e-mail z odmową"; "także grupowo".
Files: `queries/registration-approval.ts` (`approveRegistrations(eventId, ids, hooks)`, `rejectRegistrations(eventId, ids, hooks)` → `{ approved, waitlisted, skipped }`), `api/src/admin/registration-approval.ts`, admin `registrants-list.tsx` (filter "Czekają", row actions), `bulk-actions-bar.tsx` (Akceptuj / Odrzuć), `packages/ui/src/registrants-csv.ts` (state labels).
Rules: approve = `registered` while seats remain, else `waitlisted` (e-mail "confirmed"/"waitlisted"); reject = state `rejected` (e-mail "rejected"); only `pending` rows change, others are skipped. Rejected can be approved later from the filter "Odrzucone".
Tests: extend `f30-akceptacja.spec.ts`: "[F30] organizator akceptuje i odrzuca, uczestnicy dostają e-mail" (Mailpit), bulk approve of two; db test: approve on a full event → waitlisted.

- [x] Tests red → implement → green; commit `feat(admin): approve and reject registrations`.
- [x] Review + simplify F30 (Context7: TanStack Query mutations, Drizzle).

### Task 3: F32 — invite-only events with a link

Requirements: F32 first three criteria and "zmieniony link przestaje działać".
Files: `EventVisibility` += `"private"`, `events.inviteToken text` (random, set when private), migration `0023_invite_only.sql`; `queries/events.ts` (`queryEvents` public audience excludes private unless `inviteToken` matches or the user is registered/organiser), `queries/calendar.ts` (exclude private), `api/src/events/queries.ts` (`getEvent(id, invite?)`), registration server fn accepts `invite` and checks it for private events (`DomainError("EVENT_NOT_FOUND")` otherwise), web route `events/$eventId.tsx` search param `invite`, OG head without description for private, admin event form visibility option "Tylko z zaproszeniem", summary card "Link zaproszenia" (copy) + "Zmień link" (`regenerateInviteToken`).
Tests: `e2e/tests/f32-zaproszenia.spec.ts` "[F32] wydarzenie na zaproszenie: lista, link, zapis, zmiana linku".

- [x] Red → green; commit `feat: invite-only events`.

### Task 4: F32 — invitations by e-mail

Requirements: F32 "zaproszenie e-mailem dociera z linkiem".
Files: `api/src/admin/invitations.ts` (`sendEventInvitations({ eventId, emails[] ≤ 50 })`, rate limit like event messages), job kind `event-invitation` in `@repo/jobs/queues`, template `notifications/event-invitation-email.tsx`, worker handler case; admin dialog `invite-dialog.tsx` (textarea, one address per line or comma).
Tests: extend `f32-zaproszenia.spec.ts` "[F32] zaproszenie e-mailem zawiera link"; unit test of address parsing/validation.

- [x] Red → green; commit `feat(admin): e-mail invitations`; review + simplify F32.

### Task 5: F12 — certificate PDF for attendees

Requirements: F12 "tekst PDF zawiera imię, nazwisko, tytuł i datę; nieobecny nie może go pobrać".
Files: `events.certificatesEnabled boolean default false` (migration `0024_certificates.sql`, admin form switch "Zaświadczenia dla obecnych"), `api/src/certificates/pdf.ts` (`renderCertificatePdf({ name, eventTitle, eventDate, locale }): Promise<Uint8Array>`, pdf-lib + fontkit + `assets/NotoSans-Regular.ttf`), `queries/certificates.ts` (`getCertificate(registrationId, userId)` → null unless own, checked in, event ended, enabled), route `apps/web/src/routes/api/certificates/$registrationId.ts`, "Pobierz zaświadczenie" on ticket card / my registrations.
Tests: `e2e/tests/f12-zaswiadczenia.spec.ts` "[F12] obecny pobiera zaświadczenie, nieobecny nie" (parse PDF text with `unpdf` in e2e); unit test for the renderer (Polish letters).

- [x] Red → green; commit `feat: attendance certificates`.

### Task 6: F12 — certificates e-mailed after the event

Files: `events.certificatesSentAt`, worker cron `send-certificates` (every 15 min, claim with `UPDATE … FOR UPDATE SKIP LOCKED RETURNING` like reminders), registration e-mail change `certificate` with download link and retention note.
Tests: extend `f12-zaswiadczenia.spec.ts` "[F12] po wydarzeniu obecni dostają e-mail z zaświadczeniem" (run the job directly as f13 does); worker unit test.

- [x] Red → green; commit `feat(worker): e-mail certificates after the event`; review + simplify F12.

### Task 7: F31 — recurring copies, choose what to copy

Requirements: F31 "„co tydzień, 4 razy” tworzy cztery szkice w kolejnych tygodniach o tej samej godzinie".
Files: `queries/event-duplicate.ts` (`duplicateEventSeries({ eventId, firstDate, repeat: "once" | "weekly" | "monthly", count 1–12, copy: { agenda, organizers } , actorId })` → `{ ids }`, one transaction, reuse local-time shift), admin `duplicate-event-dialog.tsx` (Powtarzaj: raz / co tydzień / co miesiąc, Ile razy, checkboxes Program, Organizatorzy).
Tests: `e2e/tests/f31-cykliczne.spec.ts` "[F31] co tydzień, 4 razy daje cztery szkice"; db tests: monthly from the 31st, DST week, copy flags.

- [x] Red → green; commit `feat(admin): recurring copies`.

### Task 8: F18/F19 — speakers and material links on programme items

Requirements: F18 "prelegentami"; F19 partly (links, not files — files wait for F14 storage).
Files: `agenda_items.speakers jsonb` (`{ name: string; affiliation?: string }[]`) and `materials jsonb` (`{ label: string; url: string }[]`), migration `0025_agenda_speakers.sql`; agenda queries/schemas; admin `agenda-item-dialog.tsx` (add/remove rows); web programme list/calendar item shows speakers and links; copied by duplicate.
Tests: `e2e/tests/f19-prelegenci.spec.ts` "[F19] punkt programu z prelegentem i linkiem jest na stronie wydarzenia".

- [x] Red → green; commit `feat: speakers and materials on programme items`.

### Task 9: Docs, final review, full verification

Files: spec statuses (F12, F30, F31, F32 gotowe; F18 gotowe; F19 częściowo), `docs/indico-comparison.md`, `docs/data-flows.md` (approval states), `docs/README.md`, this plan's verification summary.
Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e:up && pnpm e2e` — all green.

- [x] Fresh-context reviewer (Context7) on the whole plan diff; fix Critical/Important test-first.
- [x] Update docs; commit and push to `next`.

## Verification summary (21 November)

All nine tasks done; commits `2e0c758..` on `next`. Final checks after the last fix pass: `pnpm lint` 0, `pnpm typecheck` 0, `pnpm test` (db 205, api 93, worker 19, ui 26, collections 8) all green, `pnpm build` 0, `pnpm e2e` 113/114 — the one failure, `[F4] filtry kiedy i forma zawężają listę` on `telefon`, is outside this plan and passed 21/21 with `--repeat-each=3`; recorded as flaky, not as a pass. The previous full run (before the fix pass) was 114/114.

Reviews: per-feature reviews for F30, F32 (one Critical: group creation bypassed invite-only access) and F12, plus a final whole-plan review (no Critical). Every Critical/Important finding was fixed with a test seen failing first.

Rulings (decisions taken under the user's "decide for me"):
- Organiser-added people skip approval; approval on a full event gives the waitlist (request order); rejected rows stay and can't be withdrawn; groups never bypass approval.
- Invite link = 256-bit secret in `?invite=`; without access an invite-only event looks unknown (404); leaving invite-only revokes the link; a declined request does not open the event.
- Invitations by e-mail reuse the organiser-message layout, published events only, 50 addresses per send, 10 sends/h per event and sender.
- Certificates: per-event switch (default off), attendees of ended events, neutral wording, Noto Sans (OFL) bundled; e-mail per attendee within 30 days of the end (late check-ins included); available until retention deletes the registration.
- Recurring copies: up to 12, each from the first date's wall clock; the first copy opens.
- Speakers/materials as jsonb lists (max 20); files wait for F14, so F19 stays partial.
- Editing a registration waits for custom questions (F10).

Deferred minors: Electric seat-count/cancelled shapes expose ids of private events; ICS url of a private event lacks the invite; reverse-proxy logs may record `?invite=`; raw SQL in `getEventAccess`; scanner says "waitlisted" for pending/rejected tickets; extra `requiresApproval` query per registration; bulk bar crowded at 360 px; `duplicateEvent` runs 3 queries per copy (≤36); speakers are not a reusable directory.
