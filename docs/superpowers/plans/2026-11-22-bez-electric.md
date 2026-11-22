# Replace ElectricSQL with polling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** The public site keeps seat counts, programme-item counts, cancellations and waitlist promotions current on open pages without ElectricSQL: TanStack Query refetches the data the pages already load.

**Architecture:** Electric fed three read-only shapes (event seat counts, programme-item seat counts, cancelled events) that overlaid data the server already returns in `fetchEventsServer`, `fetchEventDetailsServer` and `fetchMyRegistrationsServer`. Those queries get a refetch interval of 15 s (`LIVE_REFRESH_MS`) while the page is visible (TanStack Query pauses intervals in hidden tabs and refetches on focus); the registrations query polls only while the user waits on a waitlist. Views read counts from their own data; the Electric layer (`@repo/collections`, `/api/electric/*` proxies, `txid` plumbing, the `electric` service, `wal_level=logical`, `ELECTRIC_*` settings) is removed.

**Tech Stack:** TanStack Query, TanStack Start, React, Drizzle, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md` — F27 acceptance „licznik punktu zmienia się na żywo” becomes „licznik punktu odświeża się na otwartej stronie bez przeładowania”. User: "is it really beneficial to run electric … unnecessary feature that adds a lot of complexity" → "do as you recommend" (remove it, poll instead).

## Decisions

- `LIVE_REFRESH_MS = 15_000` in `packages/api/src/events/live-refresh.ts`; `eventsQueryOptions` and `eventDetailsQueryOptions` use it as `refetchInterval`; `myRegistrationsQueryOptions` uses it only while any entry is `waitlisted`. At ~1000 open pages this is ~70 requests/s of indexed reads.
- Background refetches do not mark the list busy: `refetching` (aria-busy, dimmed cards) means "showing the previous filter's results" (`isPlaceholderData`), not every poll.
- Registration actions refetch the affected queries after the server answers (they already invalidate); no waiting for a sync confirmation. Domain queries stop returning `txid`.
- The SSR/interactive split of the list and event page stays (it gates buttons until hydration); only the Electric overlays go. The event page renders `EventDetailsView` inside `ClientOnly` without a lazy chunk.
- Railway: five services (no `electric`); Postgres needs no logical replication. An existing Electric replication slot must be dropped, or Postgres keeps WAL for it forever (documented).
- Dev HTTPS/HTTP-2 stays (still removes the per-origin connection limit for dev).

## Global Constraints

- Behaviour is guarded by `[Fn]` Playwright tests added first and seen passing on the Electric build (characterisation), then passing on the polling build; waits allow one refresh interval (`{ timeout: 20_000 }`).
- No `process.env`; no barrels; Biome; UI text unchanged; docs updated (AGENTS.md stack line, architecture, data flows, development, README, spec).

## Review Focus

- A background poll must not reset focus, scroll, open dialogs or form input on the event page (data object replaced every 15 s).
- Hidden tabs must not poll (no `refetchIntervalInBackground`).
- Invite-only events: the polled details query keeps its `invite` key part, so access does not fail after a refresh.
- A cancelled event seen on an open page disables registration (status from refetched details).
- Nothing still imports `@repo/collections` or reads `ELECTRIC_*`; compose and CI start without Electric.

---

### Task 1: Characterisation tests (before the change)

**Files:** `e2e/tests/f5-zapisy.spec.ts`, `e2e/tests/f27-punkty-programu.spec.ts`, `e2e/tests/f3-*.spec.ts` (cancellation).

- [ ] `[F5] liczba wolnych miejsc odświeża się na otwartej stronie, gdy zapisze się ktoś inny @uczestnik` (event page and home list).
- [ ] `[F27] licznik punktu odświeża się na otwartej stronie, gdy zapisze się ktoś inny @uczestnik`.
- [ ] `[F3] odwołanie wydarzenia widać na otwartej stronie bez przeładowania @uczestnik` (registration button gone, "odwołane" shown).
- [ ] Existing `[F5] awans z listy widać na otwartej stronie bez odświeżania` waits up to one interval.
- [ ] Run on the current (Electric) e2e stack: pass. Commit.

### Task 2: Poll instead of Electric (client)

**Files:** `packages/api/src/events/{live-refresh,queries,my-registrations}.ts`, `apps/web/src/lib/events/*`, `apps/web/src/lib/event-details/*`, `apps/web/src/lib/registration/use-registration-actions.ts`, `apps/web/src/components/{home-event-card,home-event-list,home-event-list-live,event-details/*}.tsx`, `apps/web/src/routes/{__root,events/$eventId}.tsx`.

- [ ] Unit test: `myRegistrationsRefetchInterval(data)` → 15 000 with a waitlisted entry, `false` otherwise; query options carry `refetchInterval` 15 000. See it fail, implement, pass.
- [ ] Remove overlays and count sources; views read `event.seatsRemaining`, `item.seatsRemaining`, `event.status`; delete `WaitlistLiveRefresh`, `EventSeatCountsSync`, `EventDetailsLive`, the `use-*` live hooks, `seat-count.ts`, `query-seat-counts.ts`.
- [ ] typecheck, lint; commit.

### Task 3: Remove the Electric layer (server, packages, infrastructure)

- [ ] Domain queries and server functions stop returning `txid` (`queries/txid.ts` deleted; tests updated).
- [ ] Delete `packages/collections`, `apps/web/src/routes/api/electric/*` (route tree regenerated), deps `@repo/collections`, `@tanstack/react-db`, the `@tanstack/db` override.
- [ ] `docker-compose.yml` without `electric` and `wal_level`; `ELECTRIC_*` out of env, `.env.example`, `e2e/ports.env`, CI; metrics test example route.
- [ ] lint, typecheck, `pnpm test`, build; commit.

### Task 4: Docs, full checks, review

- [ ] AGENTS.md, docs (architecture, data-flows, development, README, docs/README), spec F27 + changelog; plan verification summary.
- [ ] `pnpm e2e:up` + `pnpm e2e`; fresh review; push `next`.
