# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A university platform where people sign up for events. It is meant to cover the same features as [Indico](https://getindico.io), the event software the university uses now, with better UX and a mobile-first design.

- **Public site** (`apps/web`, port 3000): a simple way to find an event and register. Content is live, so seat counts and event state update without a refresh. This runs on Postgres → ElectricSQL → TanStack DB, across the whole TanStack stack (Start, Router, Query, DB).
- **Admin panel** (`apps/admin`, port 3001): a modern, mobile-first tool for creating and managing events and their agenda, managing the people registered for each event, and managing lookup data (faculties, rooms, event types). Design admin screens for phones first, then scale up. When planning admin features, use Indico's event-management features as the reference for scope.

Latest stakeholder requirements:
- **Group registration:** one registration can cover more than one person. For example, a teacher registers a group of students. Seat counts must go down by the group size, and capacity checks (#19) must account for the whole group.
- **Per-agenda registration:** the event details page shows the agenda, and people can register for each agenda item separately. Registering for an agenda item also registers for the parent event (#8), and each agenda item can have its own capacity.

The UI is in Polish and English. GitHub issues are written in Polish.

## Commands

pnpm 10 + Turbo monorepo, Node ≥ 22.12 (`package.json#engines`; the README's "≥ 20" is out of date).

```bash
pnpm install                 # also compiles Paraglide messages (prepare hook)
cp .env.example .env         # .env lives at the repo root, shared by all apps
docker compose up -d         # Postgres (wal_level=logical), Mailpit, Redis, Electric
pnpm db:migrate              # or `pnpm db:push` for a quick schema sync
pnpm db:seed                 # seed sample data (packages/db/src/seed)

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
```

Automated checks: `pnpm test` (Vitest in `@repo/db`, `@repo/ui`, `@repo/collections`), `pnpm typecheck`, `pnpm lint` (Biome) and `pnpm build`. Run all four before committing. DB tests run against real Postgres and truncate tables in `harmonogram_us_test`, never the dev DB.

Mailpit inbox for local email (magic links): http://localhost:8025.

## Architecture

**Stack:** TanStack Start (SSR, Vite 8, Nitro), TanStack Router (file-based) and Query, TanStack DB + ElectricSQL for live sync, Drizzle ORM on Postgres, Better Auth, Paraglide i18n, Tailwind and shadcn, Biome. React Compiler is turned on through Babel in both apps.

**Workspace packages** (`@repo/*`). These are consumed as TypeScript source with no build step, and exposed only through `package.json#exports` subpaths:
- `db`: Drizzle client, `schema/*`, and `queries/*`. Data-access functions live in `queries/`, and the API layer calls them. Migrations go in `src/migrations`.
- `api`: TanStack Start server functions (`createServerFn`) plus `queryOptions` factories, grouped by domain (`events/`, `admin/`, `auth/`, `notifications/`). `procedures.ts` provides `publicQueryFn` (GET) and `protectedActionFn` (POST + `authMiddleware`). Some mutations check the session inline with `getCurrentSession()` instead. Domain errors are rethrown as `new Error(CODE)`, and the apps map those codes to messages (`apps/*/src/lib/format-*-error.ts`, `apps/web/src/lib/event-registration/errors.ts`).
- `env`: The single source of validated env vars (`@t3-oss/env-core` + zod). It loads the root `.env` itself. Client-safe values come from `@repo/env/client`.
- `ui`: shadcn primitives in `components/`, app-level shared pieces in `composed/`.
- `i18n`: Paraglide project. `src/paraglide/` is generated and gitignored. Every locale is URL-prefixed (`/en/...`, `/pl/...`). The URL patterns and route strategies in `packages/i18n/*.js` are imported by both `vite.config.ts` files and by `scripts/compile-paraglide.mjs`, so keep them in sync.
- `router-utils`: The Paraglide router `rewrite`, `requireAuthenticatedUser` for `beforeLoad`, and root document `head` builders.
- `collections`: TanStack DB collections (for example, the Electric-backed `eventSeatCountsCollection`).
- `jobs`: pg-boss queue names, payload schemas and `enqueue*` helpers (`@repo/jobs/client`), shared by the API (sends) and `apps/worker` (works).

**Apps.** `apps/web` and `apps/admin` have near-identical setups (`vite.config.ts`, `router.tsx`, `server.ts`). `src/server.ts` wraps the TanStack Start handler in `paraglideMiddleware`. `envDir` points at the workspace root. `~` aliases to the app's `src`. `routeTree.gen.ts` is generated, so never edit it. Better Auth is mounted at `routes/api/auth/$.ts` in each app. Admin pages sit under the `_authenticated` layout route. That route only checks for a session; there is no ADMIN role check yet (see issue #12).

**Live seat counts (the most cross-cutting flow):**
1. `event_seat_counts` and `agenda_item_seat_counts` are Postgres tables maintained by triggers (migration `0003_seat_count_triggers.sql`) from the registration rows and capacity columns. `CHECK (seats_remaining >= 0)` enforces capacity, so never write these tables directly. Trigger refresh functions must lock the count row first, then recount in a separate statement (migration `0006`); under READ COMMITTED a single UPDATE that waits on the lock recounts from a stale snapshot. `packages/db/test/concurrency.test.ts` guards this. **Global row-lock order** in transactions: `events` row → `agenda_items` rows (by id) → `registration_groups` → `registration_group_members` → count rows (taken by triggers). Inserting a row with a FK takes a key-share lock on the parent, so lock parents first. The mutation returns the Postgres `txid` (`queries/txid.ts`).
2. Electric streams those tables. Shapes are declared once in `@repo/collections/shapes` (proxy path, table, columns). Each web route under `apps/web/src/routes/api/electric/` is a one-liner calling `proxyShape()` (`@repo/collections/electric-proxy`), which forwards only Electric protocol params (the server decides table, columns and filter) and adds `ELECTRIC_SECRET` server-side. To add a live table: add a `shapes` entry, a proxy route, and a collection.
3. Collections in `@repo/collections/*` sync via `shapeUrl(shapes.x.path)`. The Electric client needs an absolute URL, and a relative one silently never syncs. The details page (`apps/web/src/lib/event-details/`) awaits the mutation's `txid` on the collection the action changes. The home list (`apps/web/src/lib/event-registration/*`) adds optimistic adjustments and cross-tab sync.
4. Local dev over plain HTTP: Chrome allows 6 connections per origin across all tabs, and each open page holds one Electric long-poll per shape. Several app tabs in one browser can stall live updates. This is fine over HTTPS/HTTP2 (production). For multi-viewer manual tests use separate browser profiles.

**Worker:** `apps/worker` is a pg-boss process on the same Postgres. It sends group invitation emails (`group-invitations`; policy `short` with `singletonKey = memberId`, so there's at most one queued send per member) and closes groups past their deadline every 5 minutes (`close-expired-groups`, which releases held places through the count triggers). Handlers live in `apps/worker/src/handlers` and are tested against the test DB (`pnpm --filter worker test`). It's bundled by esbuild into `dist/index.mjs`. The Dockerfile builds it with `APP=worker`, and Railway uses `apps/worker/railway.toml`. Invitation tokens are stored only as hashes, so the email job issues a fresh token when it sends. Jobs are queued **inside the same Drizzle transaction** as the data (`enqueueInvitationEmails(jobs, { tx })`, which uses pg-boss `fromDrizzle`): `@repo/db` group functions take an `onInvited(tx, refs)` hook. Never enqueue after commit. We chose pg-boss over DBOS on purpose (short pipelines; DBOS would need a datasource refactor for exactly-once DB steps, plus version pinning to recover workflows across deploys). Revisit DBOS if long multi-step flows with compensations appear.

**Auth:** Better Auth (`packages/api/src/auth/better-auth.ts`) with a Drizzle adapter, magic link, Turnstile captcha, optional social providers, Redis-backed rate limiting, disposable-email and HIBP password checks, and Nodemailer + react-email for mail.

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

## Roadmap (open GitHub issues, as of 2026-11)

Check `gh issue list` for the current list. Notable gaps between issues and code:
- **#12** asks for admin access restricted to role ADMIN. No role column or check exists yet. The admin app is a separate app, not `/admin/*`.
- **#18** asks for SSE for real-time seats. This is already implemented with ElectricSQL instead (see above).
- **#19** asks for overselling protection (row locks / CHECK in a transaction) for registrations.
- **#7, #8, #14** mention event agenda items, and **#11, #20** mention QR tickets with an `isQrRequired` flag. The `events` schema has no agenda, status, or QR fields yet. **#16** (cancel events) needs a status column, and **#22** (pg-boss) would send its notifications in the background.
- **Group and per-agenda registration** (the latest requirements above) have no issue yet and need schema changes. Right now `event_registrations` allows one row per user per event (a unique index on `event_id, user_id`), with no attendee count or attendee list, no agenda reference, and `event_seat_counts` only counts per event.
- Others: #5 layout/header, #6 list filtering, #9 unregister confirmation dialog, #10 account page, #13 lookup CRUD, #15 active/archived lists, #17 email notifications, #23 optimistic updates, #24 PWA offline tickets, #25 a11y for the live seat counter.
