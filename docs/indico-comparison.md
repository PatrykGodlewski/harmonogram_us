# Indico comparison

Snapshot: 2026-11-21, branch `next` (updated after plan 4; first snapshot at `e209a1e`). Indico is inspiration, not a parity target ([product spec](superpowers/specs/2026-11-19-produkt-design.md)); this page shows where we stand and where the gaps are.

**Sources.** Our side: code and the passing `[Fn]` e2e tests named below (`pnpm e2e`, 77/77 at `e209a1e`). Indico side: the Indico source (`master` at `f20ab92`, latest release 3.3.15) and its changelog (`CHANGES.rst`), learn.getindico.io, the check-in PWA repository, and the source-derived inventory in [`superpowers/parity/inwentarz-indico.json`](superpowers/parity/inwentarz-indico.json). Nothing here comes from memory alone.

**Legend.** ✅+ better than Indico · ✅ on par · 🟡 partly (behind in places) · ❌ missing · ⏸ deliberately "later" in the spec.

## Summary

| Area | Indico | Us | Verdict |
|---|---|---|---|
| Accounts and sign-in | Local accounts, LDAP, SAML, OAuth, SSO | Magic link and password, captcha, breached-password check; no profile language, no university sign-in | 🟡 |
| Roles and permissions | Category permissions; event ACLs with users, groups, e-mails, IP networks, roles; fine-grained permissions (registration: all / moderation only / check-in only); protection modes; access keys | Roles user / organiser / admin, co-organisers by e-mail, check-in helpers per event (scanner and attendance only), "signed-in users only" and invite-only events, server-side access checks | 🟡 (✅ on the check-in-only helper and invite-only events) |
| Event lifecycle: draft and publishing | No event-level draft; "unlisted events" (admin opt-in, 3.1) | Draft → publish with a checklist that says what is missing and fixes it in place | ✅+ |
| Event lifecycle: cancellation | No cancel action; a "cancelled" label (2.2.7) that stops reminders | Cancel closes registration, e-mails everyone registered or waitlisted, flips open pages live, keeps history | ✅+ |
| Event lifecycle: cloning, lock, video | Clone once, at intervals or by pattern, choosing what to copy (ACLs, materials, registration forms, registrations…); lock; videoconference rooms (Zoom plugin) | Duplicate once or weekly/monthly up to 12 drafts, keeping local time across DST, choosing programme and organisers; settings (approval, certificates, visibility with a fresh invite link) copied; no lock, no video integration | 🟡 (✅ on recurring copies) |
| Panel event list | 25 per page, sortable, "show all"; search module | 50 per page with "show more", server-side search, data with the page | ✅ |
| Campus calendar | Category calendars, search, iCal | Paged list with search and filters (date: today / 7 / 30 days, format, unit, type, place), live seat counts, ICS feeds (all events; my registrations behind a private link), "add to calendar", Open Graph link previews; cancelled events stay in feeds marked cancelled; no month view | ✅+ |
| Registration | Custom forms, moderation (approval), registration limit; **no waitlist** | One tap, capacity with an automatic waitlist that survives concurrent sign-ups, groups (F26), per-agenda-item registration (F27), approval (approving on a full event puts people on the waitlist); no custom questions | 🟡 (✅+ on capacity and approval) |
| E-mails | Registration emails to registrants and managers, approval/rejection, configurable reminders; **no cancellation or change notices** | Confirmation, waitlist, promotion, cancellation, change of date/place (old → new), reminders (a day before by default; 1 h / 2 days / off), organiser messages to a group or to selected people | ✅+ |
| Registrant list | Filters and columns, CSV/XLSX/PDF export, CSV import, create/edit/delete/withdraw, approve/reject, bulk actions, tags, e-mail to selected people with placeholders | Search and state filter (incl. waiting / declined), "N waiting" prompt, add/remove (waitlist moves up), approve/decline one or many, bulk check-in / message / remove, CSV and XLSX, attendance; no PDF, import, tags or editing a registration (waits for custom questions) | 🟡 (✅ on approval, bulk actions and exports) |
| Tickets and check-in | PDF ticket with QR, Google/Apple Wallet (experimental), check-in PWA with the phone camera, manual and bulk check-in with time, badges | Ticket page with QR, camera scanner in the panel, manual and bulk check-in with time, check-in helpers, attendance in the CSV; no PDF ticket, wallet or badges | ✅ core, 🟡 extras |
| Certificates | Document templates (organiser generates) | PDF for attendees of ended events (per-event switch), downloaded from the account and e-mailed automatically; no custom templates | ✅ (✅+ on automatic delivery, 🟡 on templates) |
| Materials | Files, links, folders | — | ❌ |
| Statistics and logs | Event log, Matomo plugin | — | ❌ |
| Programme | Sessions, contributions, editor, PDF | List and calendar, parallel sessions, live "now" line, rooms, days, speakers with affiliation, material links; no PDF | ✅ |
| Speakers and talks | Contributions with speakers, materials | Speakers and material links per programme item; no files, no speaker directory | 🟡 |
| Surveys | Built in | — | ❌ |
| Payments | Manual, PayPal, Stripe | — | ❌ |
| Event web page | Layout, logo, custom pages | — | ❌ |
| Video calls | Zoom plugin | — (spec targets Teams) | ❌ |
| API and widgets | HTTP API, iCal | — | ❌ |
| Personal data (GDPR) | Privacy settings, data retention | Notice at sign-up, privacy page (controller, basis, retention, rights), automatic deletion after the retention period, export and delete my data (with safeguards for the last admin and sole organisers) | ✅ |
| Accessibility | Partial | Polish and English, no audit | 🟡 |
| Private / invite-only events | Protected events with access lists, access keys | Invite-only events: not listed or in feeds; open with an invite link (copy, change to revoke), to registrants and organisers; invitations by e-mail (up to 50 at once) | ✅ |
| Guests without accounts | Depends on the form | — | ❌ |
| Abstracts and peer review | Full workflow | — | ⏸ |
| Room booking | Full module | — | ⏸ |

## Verification of the areas marked done on 20 November

Earlier the same day, F2, F3, F7 and F11 were summarised as "✅ done". Done means the spec's acceptance criteria pass; it does not mean "as good as Indico". Checked against Indico:

1. **Roles and permissions (F2): 🟡, not on par.** Indico's access control is richer: groups, IP networks, access keys, protected events with access lists, and split permissions (a helper who can only check people in, or only approve registrations). We are ahead only on "signed-in users only", which Indico has no built-in option for. Gaps worth taking: a check-in-only helper role; private events (see the open design).
2. **Event lifecycle (F3): split.** Draft and publishing are **better** (Indico has no event-level draft, only admin-enabled unlisted events). Cancellation is **better** (Indico only labels an event "cancelled" and tells nobody). Cloning is **behind** (Indico repeats on an interval or pattern and lets you choose what to copy), and we have no lock or video integration.
3. **Registrant list (F7): 🟡, not on par.** Indico adds XLSX and PDF exports, CSV import, editing a registration, approve/reject, bulk actions, tags and placeholders in e-mails. We are ahead on what removal does (the waitlist moves up automatically, because Indico has no waitlist) and on the phone layout.
4. **Tickets and check-in (F11): ✅ on the core flow.** Both scan a QR code with the phone camera in a browser and record the check-in time, both allow manual check-in. Indico adds a PDF ticket, wallet passes, badges and bulk check-in; its check-in app also needs a connection to check someone in.
5. **Panel event list: ✅.** Paging, search and data that arrive with the page match Indico's management list.
6. **Registration capacity (F5): ✅+.** Indico closes the form at the limit; we put people on a waitlist and promote them automatically, also under concurrent sign-ups. Custom questions (F10) and approval are still missing.

## Changes in plan 3 (20 November)

GDPR (F9), reminders and change notices (F13), calendar feeds and link previews (F4), bulk actions and XLSX (F28) and check-in helpers (F29) closed the gaps listed below as 1, 2 and 4 and part of 3. Verified by the e2e tests named in the spec; Indico side unchanged.

## Changes in plan 4 (20–21 November)

Approval (F30), invite-only events (F32), certificates (F12), recurring copies (F31) and speakers with material links (F18/F19) close gaps 3 (approval), 5, 6 and 7. Verified by the e2e tests named in the spec.

## Biggest gaps, in suggested order

1. ~~Personal data (F9)~~ done in plan 3.
2. ~~Reminders and change notices (F13)~~ done in plan 3.
3. Registrant management extras: editing a registration remains (needs custom questions, F10); approval, bulk actions, XLSX and a check-in helper are done.
4. ~~Campus calendar subscription and link previews (F4)~~ done in plan 3.
5. ~~Certificates (F12)~~ done in plan 4 (available until retention deletes the registration).
6. ~~Cloning options (F31)~~ done in plan 4.
7. ~~Speakers (F18/F19)~~ done in plan 4; speaker files wait for file storage (F14).
8. Custom registration questions (F10), materials and files (F14), statistics (F15).
