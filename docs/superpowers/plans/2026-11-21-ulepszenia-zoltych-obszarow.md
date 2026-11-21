# Plan 5: lift the 🟡 areas of the Indico comparison

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax.

**Goal:** move the yellow rows of `docs/indico-comparison.md` up: accounts (F1 profile language), registration (F10 custom questions), registrant list (answers in exports, editing a registration, PDF attendance sheet), tickets (PDF ticket), certificates (organiser text), accessibility (F8 audit + statement).

**Architecture:** new tables in `@repo/db` (migrations 0028+), server functions in `@repo/api` behind the existing access helpers, UI in `apps/web` / `apps/admin`; PDFs reuse `packages/api/src/certificates` (pdf-lib, Noto, `fitLines`).

**Tech stack:** as in `AGENTS.md`; new dev dependency `@axe-core/playwright` (e2e only).

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md` (F1, F7, F8, F10, F11, F12; decision row of 21.11 "Plan 5"). User request (21.11): "improve existing features marked yellow"; decisions delegated to Claude as before.

## Global constraints

- Every feature has a passing `[Fn] …` Playwright test, written first and seen failing (komputer + telefon).
- An event without questions keeps one-tap registration (F10 criterion).
- Answers are personal data: deleted with the registration (cascade) and included in "Pobierz moje dane" (F9).
- UI text in both message files; admin screens at 360 px; review + simplify after each feature group (AGENTS.md).

## Review focus

1. Required question missing or a choice value not in the options → refused on the server (not only in the form).
2. Changing or deleting questions after people answered: answers of a deleted question disappear, a changed label keeps the answer.
3. Registering from the list card on an event with questions → leads to the form, never registers without answers.
4. Profile language vs registration language: e-mails follow the profile language once set.
5. PDF ticket / attendance sheet for someone without access → 404/403; long names wrap.

---

### Task 1: F1 — profile name and language

Requirements: F1 "zmienia imię i język, a interfejs przełącza się na wybrany język".
Files: `user.locale` (`'pl'|'en'`, nullable), `queries/users.ts` (`updateProfile`), `api/src/auth/profile.ts` (`updateProfileServer`), web `components/account/my-profile.tsx` on `/account`, sign-in redirect to the profile language, registration e-mails use `coalesce(user.locale, registration.locale)`.
Tests: `e2e/tests/f1-profil.spec.ts` "[F1] zmiana imienia i języka przełącza interfejs"; db test for the e-mail locale.

### Task 2: F10 — organiser defines registration questions

Requirements: F10 "Pola tekst, wybór i tak/nie, wymagane albo opcjonalne".
Files: table `event_questions(id, event_id, label, kind text|choice|yesno, options jsonb, required, position)`, `queries/event-questions.ts`, `api/src/admin/questions.ts`, admin `questions-card.tsx` (add/edit/delete/reorder up-down).
Tests: `e2e/tests/f10-pytania.spec.ts` "[F10] organizator dodaje pytania"; db tests.

### Task 3: F10 — participants answer; answers on the list and in exports

Requirements: F10 "wymagane pole blokuje zapis bez odpowiedzi; odpowiedzi są na liście i w CSV".
Files: table `registration_answers(registration_id, question_id, value)`, `registerForEvent(…, { answers })` validates against the questions (`ANSWERS_INVALID`), web registration dialog when the event has questions (list card links to the event page), admin registrant row shows answers, CSV/XLSX columns per question, account data export.
Tests: extend `f10-pytania.spec.ts` "[F10] wymagane pytanie blokuje zapis; odpowiedzi w CSV"; db validation tests.

### Task 4: Editing a registration

Requirements: Indico "edit registration" (comparison row Registrant list).
Files: `updateRegistrationAnswers(registrationId, answers, actor)`; participant "Zmień odpowiedzi" on the event page while the event is open; organiser "Edytuj odpowiedzi" on the registrant row.
Tests: `e2e/tests/f10-pytania.spec.ts` "[F10] uczestnik i organizator zmieniają odpowiedzi".

### Task 5: F11 — PDF ticket

Files: `api/src/tickets/pdf.ts` (QR via `qrcode` → PNG embedded), route `/api/tickets/$registrationId/pdf` (own registration with a place), "Pobierz PDF" on the ticket page.
Tests: `e2e/tests/f11-bilety.spec.ts` "[F11] bilet PDF z kodem"; unit test (text contains name, event, code).

### Task 6: F7 — PDF attendance sheet

Files: `api/src/admin/attendance-sheet.ts` (route `/api/admin/events/$eventId/attendance.pdf` in admin, `canCheckIn`), columns: no., name, e-mail, state, signature; "Lista obecności (PDF)" next to CSV/XLSX.
Tests: `e2e/tests/f7-zapisani.spec.ts` "[F7] lista obecności PDF"; unit test of the layout (pagination).

### Task 7: F12 — certificate text set by the organiser

Files: `events.certificate_issuer`, `certificate_signer`, `certificate_note` (nullable text), admin form fields shown when certificates are on, PDF draws them.
Tests: extend `f12-zaswiadczenia.spec.ts` "[F12] zaświadczenie z podpisem organizatora"; unit test.

### Task 8: F8 — accessibility audit and statement

Requirements: F8 "skan axe (WCAG 2.1 A i AA) na każdym ekranie uczestnika i organizatora nie zgłasza naruszeń; deklaracja istnieje w obu językach".
Files: `@axe-core/playwright` in e2e, `e2e/tests/f8-dostepnosc.spec.ts` scanning list, event, account, ticket, login, privacy, accessibility statement, admin list, admin event, scanner; fixes in components; route `/accessibility` (pl/en) linked in the footer.
Tests: the scan spec itself (red first).

### Task 9: Docs, final review, full verification

Spec statuses, `docs/indico-comparison.md`, `docs/data-flows.md`, this plan's verification summary; `pnpm lint`, `typecheck`, `test`, `build`, `e2e` all green; fresh whole-plan review, fixes test-first; push to `next`.
