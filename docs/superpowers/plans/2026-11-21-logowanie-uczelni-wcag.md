# Plan 6: university sign-in and a full WCAG AA audit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** people sign in with their university account (F1, conflict K1), and every participant and organiser screen passes an automated WCAG 2.1 and 2.2 AA audit that also checks what axe cannot (titles, reflow, keyboard, focus) (F8).

**Architecture:** Better Auth `genericOAuth` with one OpenID Connect provider `university`, configured only through env (`UNIVERSITY_SSO_*`); the login and signup screens get the provider's name from a server function and show the button only when it is configured. The e2e stack runs a small Node OIDC mock (`e2e/oidc-mock/server.mjs`, image `node:22-alpine`, host `oidc.localhost` so the browser and the containers use one URL). Accessibility checks live in `e2e/fixtures/a11y.ts`.

**Tech stack:** as in `AGENTS.md`; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md` (F1, F8, K1; decision row 21.11 "Plan 6"). User request (21.11): "add university sign in, ensure wcag AA audits"; decisions delegated to Claude.

## Global constraints

- Every feature has a passing `[Fn] …` Playwright test, written first and seen failing (komputer + telefon).
- Sign-in methods are configuration, not code (spec: "sposób logowania są konfiguracją"); with no `UNIVERSITY_SSO_*` the app behaves as today minus the dead Google button.
- UI text in both message files; admin screens at 360 px; review + simplify after each feature group.

## Review focus

1. A person who already has an account (magic link or password) signs in with the university for the same e-mail → the same account, with their registrations.
2. The identity provider refuses or the person cancels → back on the login page with a readable error, not a JSON page.
3. Provider sends no `name` → the account still gets a name (given + family name, else the e-mail).
4. University not configured → no university button anywhere, and `/api/auth/sign-in/oauth2` refuses.
5. Dialogs and menus (registration answers, question editor, message, add person, bulk actions) are audited open, not only the pages under them.

---

### Task 1: F1 — university sign-in (OIDC)

Files: `packages/env` (`UNIVERSITY_SSO_DISCOVERY_URL`, `_CLIENT_ID`, `_CLIENT_SECRET`, `_NAME`), `packages/api/src/auth/university.ts` (provider config, `universityProfileToUser`, `signInOptionsQueryOptions`), `better-auth.ts` (plugin, trusted provider for linking; Google removed), web `authClient` with `genericOAuthClient`, `Login`/`Signup` take `university: { name } | null`, login shows `?error`. Compose service `oidc-mock` (profile `e2e`), `e2e/ports.env` values.
Tests: `e2e/tests/f1-uczelnia.spec.ts` "[F1] logowanie kontem uczelni łączy konto po adresie e-mail", "[F1] odmowa u dostawcy wraca do logowania z komunikatem"; unit test of `universityProfileToUser`.

### Task 2: F8 — page titles (WCAG 2.4.2)

Files: `head` on every web and admin route: "<page> · <app>"; event page keeps the event title.
Tests: `f8-dostepnosc.spec.ts` checks every audited screen has its own title.

### Task 3: F8 — audit every screen and dialog, WCAG 2.1 + 2.2 AA, reflow

Files: `e2e/fixtures/a11y.ts` (`expectAccessible(page, screen)`: axe tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa`, no horizontal scroll at 320 px); scan list (list + calendar), event (with questions dialog open), signup, account (archive open), ticket, group new/group page, invite, join, privacy, statement; admin dashboard, events, event (registrants, bulk bar, questions/message/add-person dialogs), dictionaries, users, scanner; fixes in components.
Tests: the scan specs themselves (red first).

### Task 4: F8 — keyboard and visible focus (WCAG 2.1.1, 2.4.3, 2.4.7)

Files: `a11y.ts` (`expectVisibleFocus`), fixes in components.
Tests: "[F8] zapis i bilet obsługiwane samą klawiaturą" (Tab/Enter from the list to a registration and the ticket, each focused element has a visible focus indicator); "[F8] panel organizatora obsługiwany klawiaturą" (open event, open a dialog, Escape returns focus to its trigger).

### Task 5: Docs, final review, full verification

Spec statuses (F1, F8, K1), `docs/indico-comparison.md`, `docs/development.md` (how to configure the university), accessibility statement text, this plan's verification summary; `pnpm lint`, `typecheck`, `test`, `build`, `e2e` all green; fresh whole-plan review, fixes test-first; push to `next`.

## Verification summary (21 November)

All five tasks done on `next` (`169351d..`). Final checks after the review fix pass: `pnpm lint` 0, `pnpm typecheck` 0, `pnpm test` (db 222, api 112, worker 19, ui 27, collections 8) green, `pnpm build` 0, `pnpm e2e` 156/156. The run before the fix pass had one failure (`[F1] rejestracja konta hasłem wysyła e-mail weryfikacyjny`, e-mail not delivered right after the stack rebuild); it passed 9/9 on rerun and in the final run. The worker has no healthcheck, so `e2e:up --wait` does not wait for it (likely cause, not fixed).

Final whole-plan review (fresh reviewer): no Critical; four Important, all fixed test-first:
- `useReturnFocus` took `<body>` as the opener in Safari/iOS (buttons are not focused on tap) and overrode Radix's return to its Trigger — `[F8] okno otwarte dotknięciem oddaje fokus przyciskowi (Safari)` RED→GREEN.
- An address the university reassigns could open the previous owner's account (link by e-mail to an account that already has another university identity) — `[F1] adres przekazany innej osobie na uczelni nie otwiera starego konta` RED→GREEN; `email_verified: false` is now respected and `trustedProviders` dropped (unit test RED→GREEN).
- Account reset kept the calendar feed token a stranger could have copied — db test RED→GREEN (token rotated).
- F8 status claimed every dialog — more dialogs audited (duplicate, cancel, edit answers, dictionary form, delete account) and the status narrowed to "main dialogs".

Rulings (decisions delegated by the user):
- University sign-in is generic OpenID Connect (`UNIVERSITY_SSO_*`), covering Entra ID, CAS 6+, Keycloak, Shibboleth via an OIDC proxy; USOS as an identity provider (OAuth 1.0a) is out of scope.
- The always-shown, unconfigured Google button is removed.
- The admin panel keeps password sign-in (the OAuth callback lands on the public site's origin).
- Provider errors return to `/<Accept-Language>/login?error=` (Better Auth ignores the per-request error URL there; Paraglide has no cookie strategy).
- A university sign-in joins the account with the same e-mail when the address is verified (missing `email_verified` counts as verified); one university identity per account; joining an unverified account drops its password, sessions and calendar feed.
- Page titles "<page> · <site>"; home pages keep the site title.
- Audit tags include WCAG 2.2 AA; Turnstile is compact on phones; the university button wraps; dialogs return focus to their opener (shared `useReturnFocus`).

Deferred minors: login after an error loses the `redirect` destination and shows one generic message for all error codes; Better Auth's own state errors still reach `/api/auth/error`; linking through `POST /oauth2/link` while signed in resets an unverified user without verifying them (no UI uses it); the university button stays disabled after Back from the provider (bfcache); phones briefly render the full-size captcha before the compact one; the focus check ignores outline colour and the reflow check uses `innerWidth`; the OIDC mock does not check PKCE or `redirect_uri`; no test that a verified password user keeps the password after linking; focus shown after a toast hands focus back is not visible; not every AlertDialog and the member sheet are audited open; e2e has no WebKit project; the event page has no link to the ticket after registering.
