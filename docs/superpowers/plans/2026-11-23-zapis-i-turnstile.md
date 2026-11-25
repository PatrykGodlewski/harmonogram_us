# One place to register; Turnstile only when needed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A signed-out visitor registers for an event from one place — the sign-in page for that event — choosing between an account (default) and an e-mail link without a password; and the CAPTCHA disappears from forms, running invisibly and appearing as a popup only when Cloudflare asks for proof.

**Spec:** F1, F17 (guests), F5. User (23.11): "Zapis bez konta should work similar to how Zapisz się works … one unified place where user can choose … by default people get to be registered … registering without creating account should be available for all events … during login/register page. Also refactor turnstile widget make it as a popup during some actions if necessary … server side validated by turnstile and if suspicious then client side verified and then proceeded"; approved the proposal (guests also on signed-in-only events).

## Decisions

- Event page, signed out: one button „Zarejestruj się” → `/login?redirect=/events/<id>&event=<id>[&invite=…]`. The guest dialog is removed.
- `/login` with `event`: heading „Zapis na: <title>” and a choice (radio): „Mam konto lub je założę” (default: today's sign-in, link to sign-up keeps the parameters) / „Bez konta — wyślij mi link” (name, e-mail, the event's questions; then „Sprawdź skrzynkę”). Title and questions come from `fetchGuestFormServer(eventId, invite)` (published events the visitor may open: invite-only needs its link; signed-in-only allowed).
- Guests on every event: `GUESTS_NOT_ALLOWED` goes (request and confirm); invite-only events still need the current invite link.
- Turnstile: one `HumanCheckProvider` per app renders one widget (`execution: "execute"`, `appearance: "interaction-only"`) in an overlay that becomes visible only while Cloudflare needs interaction („Potwierdź, że nie jesteś botem”). `useHumanCheck()` returns `run(action)` — gets a token, runs `action(token)`; on `CAPTCHA_REQUIRED`/`CAPTCHA_FAILED` from the server it resets the widget and tries once more. The server keeps verifying every token (Better Auth captcha plugin, `assertTurnstile`). Used by sign-in (link and password), sign-up, admin sign-in, the guest form and joining a group.
- Out of scope: risk scoring of our own beyond Cloudflare's (rate limits stay as they are).

## Tasks

### Task 1: Guests on every event (db)
- [x] Test: a guest request and its confirmation succeed for a signed-in-only event (was `GUESTS_NOT_ALLOWED`). Fail, remove the check and the code, pass.

### Task 2: Human check on demand (ui)
- [x] `packages/ui/src/composed/auth/human-check.tsx` (provider + hook); replace `Captcha` in login, sign-up, admin sign-in, join; providers in both roots; e2e fixtures stop waiting for a visible widget. Existing `[F1]`/`[F26]` sign-in and join tests pass (forms without a widget).

### Task 3: One registration place (web)
- [x] e2e first: `[F17] gość wybiera zapis bez konta na stronie logowania wydarzenia @uczestnik` (one button on the event page → sign-in page with the event title → „Bez konta” → form → e-mail link → registered) and `[F17] zapis bez konta działa też na wydarzeniu tylko dla zalogowanych @uczestnik`; `[F5]` default path (account) keeps working. Fail, implement (`fetchGuestFormServer`, login route `event`/`invite` search, `GuestRegistrationForm` moved out of the dialog), pass. pl/en; docs; full checks; review; push.

## Verification summary (23.11)

- Task 1: guest request for a signed-in-only event RED (`GUESTS_NOT_ALLOWED`) → GREEN; API tests updated to the new rule.
- Task 2: `HumanCheckProvider`/`useHumanCheck` replace the visible widget in sign-in, sign-up, admin sign-in, guest form and group join; existing sign-in and join tests pass without a visible widget.
- Task 3: `[F17]` unified-flow tests RED (old guest button) → GREEN; the accessibility audit found low contrast on the selected choice → fixed.
- Final review (fresh, opus): no Critical. Important fixed:
  - invite lost after signing in (redirect without `?invite=`) — `[F17] z linku zaproszenia: logowanie hasłem wraca na wydarzenie` RED→GREEN;
  - human check could hang (blocked script, widget errors, raw English timeout) — `runWithHumanCheck` (`packages/ui/test/human-check-run.test.ts`, RED→GREEN): one retry on server rejection only, a token that cannot be had becomes `CAPTCHA_UNAVAILABLE` (localized), cancel passes through; the provider waits at most 15 s for the widget and stops on widget errors;
  - guest form offered for cancelled/ended events — `loadGuestForm` (`packages/api/test/guest-form.test.ts`, RED→GREEN), also a lighter query; moved to a server-only module after the first run showed it pulled the database client into the browser bundle (every page failed to hydrate);
  - overlay keyboard use: focus moves to the challenge and back, Escape and „Anuluj” cancel, the page behind is `inert` — no automated test (a forced interactive challenge needs a separate test site key build); checked by review of the code only.
  - Password sign-in on the event page returns to the event (finding 4) — reproduced as passing: Better Auth's `callbackURL` navigates; covered by the invite test.
- Deferred minors: widget remount on crossing 768 px during a visible challenge; two actions at once share one widget; `safePath` lets a backslash through (not exploitable today); switching the choice resets the guest form; page title stays „Logowanie”; sign-up ignores `redirect` for signed-in users; no e2e for the interactive overlay or for the account path auto-registering.
- Checks: `pnpm test` db 274, api 170, worker 24, ui 44, rpc 3; lint and typecheck clean; `pnpm e2e` on a freshly built stack: 212 passed, 1 skipped.

