# Turnout

Campus event registration for universities, in Polish and English.

## Features

What Turnout does today, what it does not do yet, and how it compares with [Indico](https://getindico.io), the event system most universities use for this.

- **Snapshot:** 21 November 2026, branch `next`. There is no tagged release yet.
- **Indico side:** taken from the Indico source (`master` at `f20ab92`, release 3.3.15), its changelog and learn.getindico.io. The detailed, sourced comparison is in [docs/indico-comparison.md](docs/indico-comparison.md).
- **Our side:** every feature marked ✅ has a passing Playwright acceptance test named `[Fn] …` in `tooling/e2e/tests` (156 tests on desktop and 360 px phone viewports at this snapshot). Feature status and acceptance criteria are in the [product spec](docs/superpowers/specs/2026-11-19-produkt-design.md).

**Legend:** ✅ works · 🟡 partly · ❌ not built · ⏸ deliberately postponed. In the Indico column, ✅ means Indico has it.

### Scope

Turnout is for campus events: talks, workshops, open days, school visits. One installation serves one university. It does not try to cover everything Indico does; conference management (abstracts, peer review, room booking) is out of scope for now.

### How it is built

These are facts about the implementation, not claims that it is better in general.

| | Turnout | Indico |
|---|---|---|
| Primary target | Phones first: every participant and organiser screen is tested at 360 px | Desktop web application |
| Stack | TypeScript; React 19, TanStack Start/Router/Query, PostgreSQL with Drizzle, Better Auth, pg-boss job queue, Tailwind | Python (Flask, SQLAlchemy), PostgreSQL, Celery, React in parts |
| Fresh data on open pages | Seat counts, cancellations and waitlist promotions refresh on open pages without a reload (every 15 s) | Page reloads |
| Background work | E-mails and reminders go through a queue with retries, written in the same database transaction as the change | Celery tasks |
| Heavy work | PDFs (tickets, certificates, attendance sheets) are rendered by a separate Rust service called over gRPC, so a burst of downloads does not slow the website | Generated in the web process |
| Tests | Playwright acceptance test per feature (desktop and phone), Vitest against a real PostgreSQL | Python unit tests |
| Accessibility checks | Automated WCAG 2.1 and 2.2 AA audit in the e2e suite | not verified |
| Operations | Docker images, Prometheus metrics endpoint, Grafana dashboard, k6 load tests, Railway configuration | Mature deployment guides, many production installations |
| Languages | Polish and English interface and e-mails | Many interface languages |
| Maturity | Early, no release, no production deployment yet | Developed at CERN for many years, used by many institutions |

### Feature comparison

#### Accounts and access

| Feature | Turnout | Indico |
|---|---|---|
| Sign in with an e-mail link (no password) | ✅ | not verified |
| Local account with password | ✅ with breached-password check and CAPTCHA | ✅ |
| University single sign-on | ✅ OpenID Connect (Entra ID, CAS 6+, Keycloak, Shibboleth through an OIDC proxy); joins an existing account with the same verified e-mail | ✅ LDAP, SAML, OAuth/OIDC |
| LDAP or direct SAML | ❌ | ✅ |
| Single sign-on in the admin panel | ❌ password only | ✅ |
| Profile name and language; e-mails follow the language | ✅ | ✅ |
| Roles | 🟡 user, organiser, admin; co-organisers per event; check-in helpers per event | ✅ category and event access lists with users, groups, e-mails, IP networks, fine-grained permissions |
| Events for signed-in users only | ✅ | ❌ no built-in option |
| Invite-only events (hidden, open with an invite link or e-mail invitation) | ✅ | ✅ protected events, access keys |
| User groups | ❌ | ✅ |
| Guests without an account | ✅ name and e-mail, confirmed by a link (nothing reserved until then); withdraw by a signed link in every registration e-mail | 🟡 depends on the form |

#### Events

| Feature | Turnout | Indico |
|---|---|---|
| Draft, then publish | ✅ with a checklist that shows what is missing and fixes it in place | ❌ no event-level draft (admin-enabled "unlisted" events) |
| Cancel an event | ✅ closes registration, e-mails everyone registered or waitlisted, keeps history | 🟡 a "cancelled" label, nobody is told |
| Notice when date or place changes | ✅ e-mail with old and new values | ❌ |
| Duplicate an event | ✅ once, weekly or monthly (up to 12 drafts), keeps local time across DST | ✅ once, at intervals or by pattern, more choice of what to copy |
| Lock an event | ❌ | ✅ |
| Category tree | ❌ flat event types, units and places | ✅ |
| Event web page with custom layout and pages | ❌ | ✅ |
| Event content in two languages | ❌ | not verified |

#### Campus calendar

| Feature | Turnout | Indico |
|---|---|---|
| Public list with search and filters | ✅ date, format, unit, type, place | ✅ category pages and search |
| Free-seat counts that refresh on open pages | ✅ | ❌ |
| ICS feed of all events | ✅ cancelled events stay in the feed, marked cancelled | ✅ iCal |
| Private ICS feed of my registrations | ✅ | not verified |
| "Add to calendar" for one event | ✅ | ✅ |
| Link previews when shared (Open Graph) | ✅ | not verified |
| Month view | ❌ | ✅ category calendar |
| Import of events from Indico | ❌ | — |

#### Registration

| Feature | Turnout | Indico |
|---|---|---|
| Register in one tap when there are no questions | ✅ | not verified |
| Capacity limit | ✅ | ✅ |
| Automatic waitlist with promotion | ✅ safe under concurrent sign-ups | ❌ |
| Organiser approval | ✅ approving on a full event puts the person on the waitlist | ✅ moderation |
| Custom questions | 🟡 text, choice, yes/no; required or optional; checked on the server | ✅ full form builder |
| File upload fields in the form | ❌ | ✅ |
| Conditional fields | ❌ | not verified |
| Several registration forms per event | ❌ | ✅ |
| Change my answers after registering | ✅ while the event is open | ✅ |
| Group registration (teacher holds places, students confirm) | ✅ with e-mail invitations and a join link | ❌ |
| Registration for single programme items | ✅ | ❌ |
| Payments | ❌ | ✅ manual, PayPal, Stripe |

#### E-mails

| Feature | Turnout | Indico |
|---|---|---|
| Confirmation, waitlist, promotion | ✅ | 🟡 confirmation (no waitlist) |
| Approval and rejection | ✅ | ✅ |
| Reminder before the event | ✅ a day before by default; 1 hour, 2 days or off | ✅ configurable |
| Cancellation and change notices | ✅ | ❌ |
| Organiser message to everyone or to selected people | ✅ | ✅ with placeholders |
| Placeholders in organiser e-mails | ❌ | ✅ |

#### Registrant management

| Feature | Turnout | Indico |
|---|---|---|
| Search and filter by state | ✅ | ✅ more filters and columns |
| Add and remove people (waitlist moves up) | ✅ | ✅ (no waitlist) |
| Bulk actions: check in, message, remove, approve, decline | ✅ | ✅ |
| Answers on the list | ✅ | ✅ |
| CSV and XLSX export, a column per question | ✅ | ✅ |
| PDF attendance sheet with signature column | ✅ | ✅ PDF export |
| CSV import | ❌ | ✅ |
| Tags | ❌ | ✅ |

#### Tickets, check-in, certificates

| Feature | Turnout | Indico |
|---|---|---|
| Ticket page with QR code | ✅ | ✅ |
| PDF ticket | ✅ with QR | ✅ |
| Google or Apple Wallet pass | ❌ | 🟡 experimental |
| Camera scanner in the browser | ✅ in the organiser panel | ✅ check-in PWA |
| Manual and bulk check-in with time | ✅ | ✅ |
| Check-in-only helper role | ✅ | ✅ |
| Badges | ❌ | ✅ |
| Attendance certificates | ✅ PDF for attendees of ended events, organiser's issuer, signer and note, e-mailed automatically | ✅ document templates generated by the organiser |
| Certificate logo or custom layout | ❌ | ✅ |

#### Programme and speakers

| Feature | Turnout | Indico |
|---|---|---|
| Programme as list and calendar, parallel sessions, rooms, several days | ✅ with a live "now" line | ✅ timetable |
| Programme sessions (theme, room, time), copied to another room and time | ✅ | ✅ sessions (no copy) |
| Speakers with affiliation | ✅ | ✅ |
| Links to materials per programme item | ✅ | ✅ |
| Files and links for the whole event | ✅ PDF, office documents, images, ZIP up to 25 MB; downloads follow the event page's visibility | ✅ materials |
| Speakers' files per programme item | ✅ | ✅ |
| Uploaded files and folders | ❌ | ✅ |
| Speaker directory | ❌ | not verified |
| Timetable PDF | ❌ | ✅ |
| Abstracts and peer review | ⏸ | ✅ |
| Room booking | ⏸ | ✅ |

#### Personal data and accessibility

| Feature | Turnout | Indico |
|---|---|---|
| Privacy notice at sign-up and privacy page (controller, basis, retention, rights) | ✅ text to be confirmed by the university's data protection officer | ✅ privacy settings |
| Automatic deletion of registrations after a retention period | ✅ | ✅ data retention |
| Export and delete my own data | ✅ | not verified |
| WCAG 2.1 AA | 🟡 automated audit of every participant and organiser screen and the main dialogs (axe with 2.1 and 2.2 AA rules, page titles, reflow at 320 px, keyboard-only flows, visible focus, focus return); no expert audit; PDFs are not tagged | 🟡 partial |
| Accessibility statement | ✅ Polish and English; to be confirmed by the university | not verified |

#### Integrations and reporting

| Feature | Turnout | Indico |
|---|---|---|
| Statistics for organisers | ✅ per event: registered, present, no-shows and their share, waitlisted, awaiting approval; administrators see events and registrations per month for 12 months | ✅ Matomo plugin (page views and downloads) |
| Event change log | ❌ | ✅ |
| Surveys | ✅ after the event: rating 1–5, choice, yes/no and text questions; personal e-mail link (works for guests), one anonymous response per person, summary with averages, shares and text answers | ✅ |
| Video calls | ✅ one-click Microsoft Teams meeting for online and hybrid events (Graph, configured by the university); the join link is shown only to registered people | ✅ Zoom plugin |
| HTTP API and embeddable widget | ✅ public JSON API of upcoming events (filters by faculty and type, CORS) and an iframe "upcoming events" widget; see [docs/embedding.md](docs/embedding.md) | ✅ HTTP API |
| USOS integration (faculty limits, timetable clashes) | ❌ | ❌ |
| Plugin system | ❌ | ✅ |

### Not built yet

From the product spec, in no particular order: speaker directory (F19), payments (F21), event web page (F22), USOS integration (F25). Also missing compared with Indico: LDAP/SAML, user groups, category tree, form builder extras (file fields, several forms), CSV import, tags, e-mail placeholders, badges, wallet passes, timetable PDF, event lock, plugins.

### Known limitations

- Invitation e-mails are written in the sender's language, not the invitee's.
- PDFs use Noto Sans: characters it lacks (emoji, Chinese, Arabic and other non-Latin scripts) print as boxes, and PDFs are not tagged for screen readers.
- The admin panel signs in with e-mail and password only.
- The privacy page and the accessibility statement need confirmation by the university.
- No expert accessibility audit, and no Safari/iOS browser in the automated tests.

## Development

Full guide: [docs/development.md](docs/development.md). Architecture: [docs/architecture.md](docs/architecture.md).

### Prerequisites

- Node ≥ 22.12 and pnpm 10 (`corepack enable`)
- Docker (Postgres, Mailpit, file storage and the Rust documents service run in Compose; no Rust toolchain needed)

### Setup

```bash
pnpm install                 # also compiles translations and generates the gRPC client
cp .env.example .env         # local defaults work; see the file for production values
docker compose up -d         # Postgres, Mailpit (http://localhost:8025), storage, documents
pnpm db:migrate
pnpm db:seed                 # sample events and accounts
pnpm dev                     # web :3000, admin :3001, worker
```

### Common commands

| Command | Description |
|---|---|
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | Biome, TypeScript, production builds |
| `pnpm test` | Vitest (needs `docker compose up -d db documents`) |
| `pnpm e2e:up && pnpm e2e` | Playwright against production images |
| `pnpm load`, `pnpm load:documents` | k6 load tests against the e2e stack |
| `pnpm rust:test`, `pnpm rust:lint` | Rust service checks (local cargo or Docker) |
| `pnpm proto:lint` | gRPC contract lint |
| `pnpm db:generate` / `pnpm db:migrate` | Create / apply migrations (no `db:push`) |
| `pnpm messages:compile` | After editing `packages/i18n/messages/*.json` |

### Structure

```
apps/            web (public site), admin (management panel), worker (queued jobs),
                 documents (Rust gRPC service that renders PDFs)
packages/        api, db, env, ui, i18n, jobs, router-utils, rpc (gRPC client), config,
                 proto (gRPC contracts shared by Rust and TypeScript, checked by buf)
tooling/         e2e (Playwright tests, k6 load tests, test doubles), scripts (repo tasks)
infra/           Terraform for the hosting options
observability/   Prometheus and Grafana configuration
docs/            architecture, development, data flows, product spec and plans
```

## Licence and contributing

Turnout is licensed under the [Functional Source License, FSL-1.1-ALv2](LICENSE.md), the licence
Sentry uses. You may use, change and self-host it for any purpose except offering it as a competing
commercial product or service; every version becomes Apache-2.0 two years after it is published. It is
source-available ("fair source"), not OSI open source.

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities privately as described in
[SECURITY.md](SECURITY.md); the security process is in [docs/security.md](docs/security.md).

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/PatrykGodlewski/harmonogram_us?utm_source=oss&utm_medium=github&utm_campaign=PatrykGodlewski%2Fharmonogram_us&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)