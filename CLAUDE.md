# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A campus event platform where people find events and sign up from their phones. The single source of truth for what we build is `docs/superpowers/specs/2026-11-19-produkt-design.md` (features F1–F27 with priorities, rules, deferred monetisation). Indico, the software the university uses now, is only inspiration.

- **Public site** (`apps/web`, port 3000): a simple way to find an event and register. Content is live, so seat counts and event state update without a refresh. This runs on Postgres → ElectricSQL → TanStack DB, across the whole TanStack stack (Start, Router, Query, DB).
- **Admin panel** (`apps/admin`, port 3001): a modern, mobile-first tool for creating and managing events and their agenda, managing the people registered for each event, and managing lookup data (faculties, rooms, event types). Design admin screens for phones first, then scale up. When planning admin features, use Indico's event-management features as the reference for scope.

Built and tested: registration with capacity and a waitlist with automatic promotion, and "my registrations" on the account page (F5), registration e-mails with a ticket link (F6), a ticket page with a QR code per registration (F11, `ticket_code`; scanning comes with plan 2), the agenda as a list or a calendar grid with parallel sessions side by side (F18, `layoutAgenda` in `@repo/ui/agenda`), group registration by a teacher (F26), per-agenda-item registration (F27).

The UI is in Polish and English. GitHub issues are written in Polish.

## Commands

pnpm 10 + Turbo monorepo, Node ≥ 22.12 (`package.json#engines`; the README's "≥ 20" is out of date).

```bash
pnpm install                 # also compiles Paraglide messages (prepare hook)
cp .env.example .env         # .env lives at the repo root, shared by all apps
docker compose up -d         # Postgres (wal_level=logical), Mailpit, Electric
pnpm db:migrate              # or `pnpm db:push` for a quick schema sync
pnpm db:seed                 # sample events, registrations with a waitlist, a group, and test accounts (password: SEED_ACCOUNT_PASSWORD in .env); idempotent, refuses NODE_ENV=production
pnpm db:account --email a@b.pl --role admin   # create/update any account; prints a generated password unless --password/--link-only

pnpm dev                     # web (:3000) + admin (:3001) + worker (pg-boss jobs)
pnpm --filter web dev        # a single app
pnpm build
pnpm lint                    # biome check, per package via turbo
pnpm format                  # biome check --write
pnpm test                    # vitest (needs `docker compose up -d db`)
pnpm typecheck               # tsc --noEmit in every package (Vite builds don't type-check)
pnpm --filter @repo/db test  # DB integration tests; uses database harmonogram_us_test (auto-created + migrated)
pnpm --filter @repo/db exec vitest run test/registrations.test.ts   # a single test file
pnpm --filter @repo/ui lint  # lint one package
pnpm db:generate             # create a Drizzle migration after schema changes
pnpm messages:compile        # regenerate Paraglide output after editing packages/i18n/messages/*.json
pnpm dlx shadcn@latest add <component>   # run inside packages/ui

pnpm e2e:up                  # full stack from production images as compose project "harmonogram-e2e" (ports in e2e/ports.env: web 3100, admin 3101, Mailpit 18025) + migrations
pnpm e2e                     # Playwright: projects "komputer" (1280px) and "telefon" (360px, tests tagged @uczestnik)
pnpm e2e:down                # stop the e2e stack and drop its data
```

Automated checks: `pnpm lint`, `pnpm typecheck`, `pnpm test` (Vitest; DB tests run against real Postgres and truncate tables in `harmonogram_us_test`, never the dev DB) and `pnpm e2e` (after `pnpm e2e:up`; rebuild with `pnpm e2e:up` after code changes, the stack runs built images). CI (`.github/workflows/ci.yml`) runs all of them.

**How we work** (spec, section "Zasady"): a feature is done when its Playwright test passes; test names carry the feature number (`[F5] …`); write the e2e test first and see it fail. One active plan at a time (about 10 tasks), each task a feature or a coherent part with its test; executed inline (`superpowers:executing-plans`) with one review at the end. No temporary solutions, no code "for the future".

Mailpit inbox for local email (magic links): http://localhost:8025.

## Architecture

**Stack:** TanStack Start (SSR, Vite 8, Nitro), TanStack Router (file-based) and Query, TanStack DB + ElectricSQL for live sync, Drizzle ORM on Postgres, Better Auth, Paraglide i18n, Tailwind and shadcn, Biome. React Compiler is turned on through Babel in both apps.

**Workspace packages** (`@repo/*`). These are consumed as TypeScript source with no build step, and exposed only through `package.json#exports` subpaths:
- `db`: Drizzle client, `schema/*`, and `queries/*`. Data-access functions live in `queries/`, and the API layer calls them. Migrations go in `src/migrations`.
- `api`: TanStack Start server functions (`createServerFn`) plus `queryOptions` factories, grouped by domain (`events/`, `admin/`, `auth/`, `notifications/`). `procedures.ts` provides `publicQueryFn` (GET) and `protectedActionFn` (POST + `authMiddleware`). Some mutations check the session inline with `getCurrentSession()` instead. Domain errors are rethrown as `appError(CODE)`; every code is listed in `@repo/db/queries/domain-errors` and mapped to a message in `@repo/ui/app-errors`.
- `env`: The single source of validated env vars (`@t3-oss/env-core` + zod). It loads the root `.env` itself. Client-safe values come from `@repo/env/client`.
- `ui`: shadcn primitives in `components/`, app-level shared pieces in `composed/`.
- `i18n`: Paraglide project. `src/paraglide/` is generated and gitignored. Every locale is URL-prefixed (`/en/...`, `/pl/...`). The URL patterns and route strategies in `packages/i18n/*.js` are imported by both `vite.config.ts` files and by `scripts/compile-paraglide.mjs`, so keep them in sync.
- `router-utils`: The Paraglide router `rewrite`, `requireAuthenticatedUser` for `beforeLoad`, and root document `head` builders.
- `collections`: TanStack DB collections (for example, the Electric-backed `eventSeatCountsCollection`).
- `jobs`: pg-boss queue names, payload schemas and `enqueue*` helpers (`@repo/jobs/client`), shared by the API (sends) and `apps/worker` (works).

**Apps.** `apps/web` and `apps/admin` have near-identical setups (`vite.config.ts`, `router.tsx`, `server.ts`). `src/server.ts` wraps the TanStack Start handler in `paraglideMiddleware`. `envDir` points at the workspace root. `~` aliases to the app's `src`. `routeTree.gen.ts` is generated, so never edit it. Better Auth is mounted at `routes/api/auth/$.ts` in each app. Admin pages sit under the `_authenticated` layout route; every admin server function goes through `adminMiddleware` (`user.role = 'admin'`, else `FORBIDDEN`). Both roots render `HydrationMarker` (`<html data-hydrated="true">`), which e2e tests wait for before interacting.

**Live seat counts (the most cross-cutting flow):**
1. `event_seat_counts` and `agenda_item_seat_counts` are Postgres tables maintained by triggers (migration `0003_seat_count_triggers.sql`) from the registration rows and capacity columns. `CHECK (seats_remaining >= 0)` enforces capacity, so never write these tables directly. Trigger refresh functions must lock the count row first, then recount in a separate statement (migration `0006`); under READ COMMITTED a single UPDATE that waits on the lock recounts from a stale snapshot. `packages/db/test/concurrency.test.ts` guards this. Only registrations in state `registered` take a place; `waitlisted` ones wait in `created_at` order, and every change that frees places (withdrawal, higher limit, closed or smaller group, expired group) calls `promoteFromWaitlist` in the same transaction with the event row locked. **Global row-lock order** in transactions: `events` row → `agenda_items` rows (by id) → `registration_groups` → `registration_group_members` → count rows (taken by triggers). Inserting a row with a FK takes a key-share lock on the parent, so lock parents first. The mutation returns the Postgres `txid` (`queries/txid.ts`).
2. Electric streams those tables. Shapes are declared once in `@repo/collections/shapes` (proxy path, table, columns). Each web route under `apps/web/src/routes/api/electric/` is a one-liner calling `proxyShape()` (`@repo/collections/electric-proxy`), which forwards only Electric protocol params (the server decides table, columns and filter) and adds `ELECTRIC_SECRET` server-side. To add a live table: add a `shapes` entry, a proxy route, and a collection.
3. Collections in `@repo/collections/*` sync via `shapeUrl(shapes.x.path)`. The Electric client needs an absolute URL, and a relative one silently never syncs. Every registration action goes through one hook, `useRegistrationActions` (`apps/web/src/lib/registration/`): call the server, await the `txid` on the collection the action changes, refetch if Electric doesn't confirm in time.
4. Local dev over plain HTTP: Chrome allows 6 connections per origin across all tabs, and each open page holds one Electric long-poll per shape. Several app tabs in one browser can stall live updates. This is fine over HTTPS/HTTP2 (production). For multi-viewer manual tests use separate browser profiles.

**Worker:** `apps/worker` is a pg-boss process on the same Postgres. It sends transactional e-mails (`emails`: verification, registration confirmed / waitlisted / promoted; registration state changes reach it through `RegistrationHooks.onChanged(tx, changes)` → `registrationEmailHooks`), group invitation emails (`group-invitations`; policy `short` with `singletonKey = memberId`, so there's at most one queued send per member) and closes groups past their deadline every 5 minutes (`close-expired-groups`, which releases held places through the count triggers). Handlers live in `apps/worker/src/handlers` and are tested against the test DB (`pnpm --filter worker test`). It's bundled by esbuild into `dist/index.mjs`. The Dockerfile builds it with `APP=worker`, and Railway uses `apps/worker/railway.toml`. Invitation tokens are stored only as hashes, so the email job issues a fresh token when it sends. Jobs are queued **inside the same Drizzle transaction** as the data (`enqueueInvitationEmails(jobs, { tx })`, which uses pg-boss `fromDrizzle`): `@repo/db` group functions take an `onInvited(tx, refs)` hook. Never enqueue after commit. We chose pg-boss over DBOS on purpose (short pipelines; DBOS would need a datasource refactor for exactly-once DB steps, plus version pinning to recover workflows across deploys). Revisit DBOS if long multi-step flows with compensations appear.

**Auth:** Better Auth (`packages/api/src/auth/better-auth.ts`) with a Drizzle adapter, magic link, Turnstile captcha (production refuses to start without `TURNSTILE_SECRET_KEY`), optional social providers, rate limiting in Postgres (`app_rate_limits`, `consumeRateLimit`), disposable-email and HIBP password checks, and Nodemailer + react-email for mail. Server functions have no locale prefix, so `getLocale()` there returns the base locale: pass the UI locale from the client when a server action needs it (as `registerForEventServer` does).

**Configuration:** the installation time zone is `VITE_APP_TIME_ZONE` for UI, e-mails and cron (default `Europe/Warsaw`; the build-time value wins over the runtime one, `@repo/env/runtime-env`; helpers `formatEventDate/Time/DateTime` in `@repo/ui/time`), the sender is `SMTP_FROM`. `VITE_*` values are inlined at build time (Turbo passes them to builds, the Dockerfile takes them as build args).

**Deployment:** Railway, with one service per app (`apps/*/railway.toml`). See the bottom of `.env.example` for the variables each service needs.

## Conventions (from `.cursor/rules`)

- **No barrel files.** Never create `index.ts` re-export files. Import by direct subpath (`@repo/db/schema/events`, `@repo/ui/composed/login`). When adding a new top-level file to a package with explicit exports (`collections`, `router-utils`, `env`), add it to `package.json#exports`.
- Read env vars through `import { env } from "@repo/env"`, never `process.env`. Browser values use `VITE_*`.
- Use `z.email()`, not the deprecated `z.string().email()`.
- Prefer existing shadcn components in `packages/ui` and existing `@repo/*` packages over adding new dependencies.
- Keep exactly one `@tanstack/db` version: `@tanstack/react-db` and `@tanstack/electric-db-collection` must share it, or collection types break. It's pinned via `pnpm.overrides` in the root `package.json`, so bump the override and the packages together.
- TanStack Form with a Zod schema: the schema's input type must match the form values. Don't use `z.coerce`/`.optional()` for fields the form always holds as `number`/`string`. Parse in `onSubmit` if you need transformed output.
- Biome style: tabs, double quotes, organized imports.
- Keep changes minimal and scoped. Mirror patterns in nearby files, and ask before large refactors.
- Name event handlers `handle*`, and give explicit types to public APIs.
- Use Conventional Commits (`feat:`, `fix:`, `refactor:`, ...).

## Roadmap

The plan order is in the product spec: priority 1 is split into plans; plan 1 (`docs/superpowers/plans/2026-11-19-fundament-i-lista-rezerwowa.md`) built the e2e foundation, simplifications, the waitlist and registration e-mails. Next: plan 2 (roles and `/manage` for organisers, event publish/cancel/duplicate, cancellation e-mail, organiser panel), then plan 3 (profile language, campus calendar with ICS and Open Graph, accessibility, GDPR). Known issue: group invitation e-mails always link to `/en/` (server-function locale, see Auth), fixed with the profile language in plan 3. Check `gh issue list` for GitHub issues; the spec decides scope.
