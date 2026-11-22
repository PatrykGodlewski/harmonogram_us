# Architecture

Read the sections relevant to the task. Cross-cutting transaction and live-sync rules are in [data-flows.md](data-flows.md); commands are in [development.md](development.md).

## Workspace

Packages are consumed as TypeScript source without a build step, through explicit `package.json#exports` subpaths. Add exports when adding public files, particularly in `collections`, `router-utils`, and `env`. Never add barrel files.

| Package | Responsibility |
| --- | --- |
| `@repo/db` | Drizzle client, `schema/*`, data-access functions in `queries/*`; migrations in `src/migrations`. API calls these functions rather than owning data access. |
| `@repo/api` | TanStack Start server functions and Query `queryOptions` factories grouped by domain (`events/`, `admin/`, `auth/`, `notifications/`). |
| `@repo/env` | Central validation/typing with `@t3-oss/env-core` and Zod; loads the root `.env`. Client-safe values: `@repo/env/client`. |
| `@repo/ui` | shadcn primitives in `components/`, shared app-level UI in `composed/`. |
| `@repo/i18n` | Paraglide; `src/paraglide/` is generated and gitignored. |
| `@repo/router-utils` | Paraglide router rewrite, `requireAuthenticatedUser` for `beforeLoad`, root document head builders. |
| `@repo/collections` | TanStack DB collections and Electric shapes/proxy. |
| `@repo/jobs` | pg-boss queue names, payload schemas, `enqueue*` helpers (`@repo/jobs/client`) shared by API and worker. |

## Apps and server functions

`apps/web` (port 3000) is the public event-discovery and registration site; event state and seat counts update live. `apps/admin` (3001) manages events, agenda, registrants and lookup data (faculties, rooms, event types). Use Indico event management as scope inspiration, with a simpler mobile-first UI.

Both apps have near-identical `vite.config.ts`, `router.tsx` and `server.ts` setups. Stack: TanStack Start SSR, Vite 8, Nitro, file-based TanStack Router, Query, DB/ElectricSQL, Drizzle/Postgres, Better Auth, Paraglide, Tailwind/shadcn, Biome. React Compiler runs through Babel.

- `src/server.ts` wraps Start with `paraglideMiddleware`; `envDir` points to the workspace root; `~` aliases app `src`.
- Never edit generated `routeTree.gen.ts`.
- Better Auth is mounted at `routes/api/auth/$.ts` in each app.
- Admin pages use the `_authenticated` layout; the layout only hides the panel, servers decide. Roles: `user.role` is `user | organizer | admin`. `organizer` (and `admin`) may **create** events; a row in `event_organizers` lets anyone **manage** that one event (co-organisers are added by e-mail); admins manage everything. `AuthenticatedUser` carries `role` and `hasPanelAccess`.
- Event roles: an `event_organizers` row has `role` `manager` (runs the event) or `checkin` (a helper: scanner and attendance only; `assertCanCheckIn`). The panel event page shows helpers a door view (`access: "checkin"` on the admin event details).
- Panel server functions use `panelQueryFn`/`panelActionFn` (`packages/api/src/auth/panel-middleware.ts`) and must call a check from `packages/api/src/auth/event-access.ts` in the handler: `assertCanManageEvent`, `assertCanManageAgendaItem`, `assertCanCreateEvents`, `assertCanDeleteEvent` (organisers delete only drafts; published events are cancelled). `packages/api/test/event-access.test.ts` fails if a panel function in `admin/*.ts` skips the check; add new files to its list. Lookups and roles (`admin/users.ts`) stay behind `adminMiddleware`.
- Event lifecycle: `events.status` is `draft | published | cancelled` (publishing needs a place and/or an online link for the attendance mode; cancelling is irreversible, keeps registrations and e-mails everyone). `events.visibility` `authenticated` hides an event from anonymous visitors; its page redirects to login. Public reads use `getEventById/getEventPage` with `audience: { kind: "public", signedIn }` (no drafts, no meeting link); the panel uses `{ kind: "manage" }`. The meeting link reaches only registered people (`getEventOnlineUrl` after `isRegisteredForEvent`).
- Both roots render `HydrationMarker` (`<html data-hydrated="true">`); e2e waits for it before interacting.
- `packages/api/src/procedures.ts` provides `publicQueryFn` (GET) and `protectedActionFn` (POST + `authMiddleware`); some mutations check `getCurrentSession()` inline.
- Server functions validate input with `.validator()` (TanStack Start v1). `errorStatusMiddleware` sets an app error's 4xx status only for browser calls (`/_serverFn/…`); during server rendering it would override the loader's redirect.
- Guests (F17) register through Better Auth plugin endpoints (`guest-registration-plugin.ts`: `/guest-registration/request` under CAPTCHA and `limitAuth`, `/guest-registration/confirm` signs the guest in), like group invitations. Pages that act on e-mail links (`/guest/confirm`, `/registrations/:id/withdraw`) need a button press: mail scanners fetch links.
- Rethrow domain errors as `appError(CODE)`. Add each code to `@repo/db/queries/domain-errors` and map it to Polish/English messages in `@repo/ui/app-errors`.

## Auth and localisation

Better Auth (1.7) configuration: `packages/api/src/auth/better-auth.ts`. It uses the Drizzle adapter, magic links, the university's OpenID Connect provider (`genericOAuth`; the client signs in with `signIn.social`, callback `/api/auth/callback/university`), Postgres rate limiting (`app_rate_limits`, `consumeRateLimit`, keyed by IP and e-mail; Better Auth's own per-IP, per-process limiter is off because a campus network shares one address), disposable-email and HIBP password checks, Nodemailer and react-email. A verified university address may join an account nobody verified (`requireLocalEmailVerified: false`), after the account hook removes the stranger's password and sessions. Production refuses to start without `TURNSTILE_SECRET_KEY`.

Every locale is URL-prefixed (`/pl/...`, `/en/...`). URL patterns and route strategies in `packages/i18n/*.js` are shared by both Vite configs and `scripts/compile-paraglide.mjs`; keep them in sync. Edit both message JSON files and run `pnpm messages:compile`, not generated Paraglide output.

Server functions have no locale prefix: `getLocale()` there returns the base locale. Pass the UI locale from the client when needed (as `registerForEventServer` does).

## Configuration and deployment

- Shared `.env` lives at repo root. Use validated `@repo/env`, never direct `process.env` reads in application code.
- `VITE_APP_TIME_ZONE` configures UI, email and cron; default `Europe/Warsaw`. Build-time values win over runtime (`@repo/env/runtime-env`). Use `formatEventDate/Time/DateTime` from `@repo/ui/time`.
- `SMTP_FROM` configures the email sender.
- `VITE_*` is inlined at build time, passed through Turbo and Docker build args. Do not put secrets there.
- Railway has one service per app (`apps/*/railway.toml`). Per-service variables are documented at the bottom of `.env.example`.

## Services over gRPC

Internal services talk gRPC; the contracts live in `proto/` (checked by `buf`, no breaking changes in place). Design: [Rust services over gRPC](superpowers/specs/2026-11-21-rust-grpc-uslugi-design.md).

- `services/documents` (Rust, tonic) renders every PDF: tickets, certificates, attendance sheets (pdf-lib is gone). Stateless: no database; TypeScript keeps permission checks and queries and sends **display-ready text** (Paraglide, `Intl`; `@repo/api/documents/dates` for long dates), so translations stay in one place. Labels with numbers only the service knows (the sheet's "Strona X z Y") go as templates with `{page}`/`{pages}`.
- Public read API (F24): `GET /api/v1/events` (`@repo/api/public/events-api`) and the iframe widget `/{locale}/widget` share `listUpcomingPublicEvents` (`@repo/db/queries/public-events`): published, `visibility = 'public'`, not ended. The API sends CORS `*` and caches 60 s; the widget route renders without the site header/footer (`__root.tsx`). See [embedding](embedding.md).
- Callers use `documentsClient()` from `@repo/rpc/documents` (Connect-ES gRPC transport, bearer `DOCUMENTS_TOKEN`, 5 s deadline, one retry when unreachable). `pdfResponse` (`@repo/api/documents/http`) turns "busy" errors (unavailable, deadline, overloaded) into 503 + `Retry-After`.
- The service listens on 50051 (gRPC, health `grpc.health.v1`) and 9464 (`/metrics` behind `METRICS_TOKEN`, unset = 404; `/healthz` without a token for Railway, 503 once shutdown begins); refuses to start without a 32-byte token; rejects fields over 2 000 characters; renders on a bounded pool and answers `RESOURCE_EXHAUSTED` when full. Generated TypeScript (`packages/rpc/src/gen`) is gitignored and produced by `prepare` and `@repo/rpc`'s build.

## Observability and SSR pitfalls

Each app records request counts/durations per normalised route through `@repo/api/observability/metrics` and request middleware in `src/start.ts`, plus Node runtime metrics. `/api/metrics` requires bearer `METRICS_TOKEN`; unset means 404. `routeLabel` must never include IDs, tokens or codes.

Prometheus/Grafana live in `observability/`, enabled by the Compose `observability` profile. See development commands for e2e ports.

`@prometheus-io/client` pulls in `@opentelemetry/api`, aliased to its ESM build in both Vite configs because its CJS build breaks the SSR bundle (as does `tslib`'s). Preserve these aliases. Global function middleware maps app errors to 4xx. Start discovers `src/start.ts` by name inside `src/`.

## Calendar feeds and link previews

`packages/api/src/calendar/ics.ts` writes iCalendar (escaping, folding, UTC). `feeds.ts` is **server-only** (imported only by the routes under `apps/web/src/routes/api/calendar/`); the account page's feed URL comes from the server function in `my-calendar-url.ts`. Never import a module with plain server exports into a component: it pulls the database into the browser bundle. Links in feeds use `?lang=` from the page (server functions have no locale prefix). The event route's loader returns Open Graph data for `head`.

## Personal data

`REGISTRATION_RETENTION_DAYS` (default 365) drives the daily `prune-old-registrations` job; `PRIVACY_CONTROLLER` and `PRIVACY_CONTACT_EMAIL` fill the privacy page. Account deletion (`deleteMyAccountServer`) needs a sign-in from the last 24 hours, refuses the last admin and the sole manager of an upcoming event, and withdraws registrations the normal way first.
