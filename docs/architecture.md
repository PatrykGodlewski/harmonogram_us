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
- Panel server functions use `panelQueryFn`/`panelActionFn` (`packages/api/src/auth/panel-middleware.ts`) and must call a check from `packages/api/src/auth/event-access.ts` in the handler: `assertCanManageEvent`, `assertCanManageAgendaItem`, `assertCanCreateEvents`, `assertCanDeleteEvent` (organisers delete only drafts; published events are cancelled). `packages/api/test/event-access.test.ts` fails if a panel function in `admin/*.ts` skips the check; add new files to its list. Lookups and roles (`admin/users.ts`) stay behind `adminMiddleware`.
- Event lifecycle: `events.status` is `draft | published | cancelled` (publishing needs a place and/or an online link for the attendance mode; cancelling is irreversible, keeps registrations and e-mails everyone). `events.visibility` `authenticated` hides an event from anonymous visitors; its page redirects to login. Public reads use `getEventById/getEventPage` with `audience: { kind: "public", signedIn }` (no drafts, no meeting link); the panel uses `{ kind: "manage" }`. The meeting link reaches only registered people (`getEventOnlineUrl` after `isRegisteredForEvent`).
- Both roots render `HydrationMarker` (`<html data-hydrated="true">`); e2e waits for it before interacting.
- `packages/api/src/procedures.ts` provides `publicQueryFn` (GET) and `protectedActionFn` (POST + `authMiddleware`); some mutations check `getCurrentSession()` inline.
- Rethrow domain errors as `appError(CODE)`. Add each code to `@repo/db/queries/domain-errors` and map it to Polish/English messages in `@repo/ui/app-errors`.

## Auth and localisation

Better Auth configuration: `packages/api/src/auth/better-auth.ts`. It uses the Drizzle adapter, magic links, optional social providers, Postgres rate limiting (`app_rate_limits`, `consumeRateLimit`), disposable-email and HIBP password checks, Nodemailer and react-email. Production refuses to start without `TURNSTILE_SECRET_KEY`.

Every locale is URL-prefixed (`/pl/...`, `/en/...`). URL patterns and route strategies in `packages/i18n/*.js` are shared by both Vite configs and `scripts/compile-paraglide.mjs`; keep them in sync. Edit both message JSON files and run `pnpm messages:compile`, not generated Paraglide output.

Server functions have no locale prefix: `getLocale()` there returns the base locale. Pass the UI locale from the client when needed (as `registerForEventServer` does).

## Configuration and deployment

- Shared `.env` lives at repo root. Use validated `@repo/env`, never direct `process.env` reads in application code.
- `VITE_APP_TIME_ZONE` configures UI, email and cron; default `Europe/Warsaw`. Build-time values win over runtime (`@repo/env/runtime-env`). Use `formatEventDate/Time/DateTime` from `@repo/ui/time`.
- `SMTP_FROM` configures the email sender.
- `VITE_*` is inlined at build time, passed through Turbo and Docker build args. Do not put secrets there.
- Railway has one service per app (`apps/*/railway.toml`). Per-service variables are documented at the bottom of `.env.example`.

## Observability and SSR pitfalls

Each app records request counts/durations per normalised route through `@repo/api/observability/metrics` and request middleware in `src/start.ts`, plus Node runtime metrics. `/api/metrics` requires bearer `METRICS_TOKEN`; unset means 404. `routeLabel` must never include IDs, tokens or codes.

Prometheus/Grafana live in `observability/`, enabled by the Compose `observability` profile. See development commands for e2e ports.

`@prometheus-io/client` pulls in `@opentelemetry/api`, aliased to its ESM build in both Vite configs because its CJS build breaks the SSR bundle (as does `tslib`'s). Preserve these aliases. Global function middleware maps app errors to 4xx. Start discovers `src/start.ts` by name inside `src/`.
