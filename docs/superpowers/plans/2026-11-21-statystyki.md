# F15 Statistics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organisers see registered, present and no-show numbers for their event; administrators see events and registrations per month.

**Architecture:** Event statistics are computed from the registrant list the event page already loads (no new query; they follow check-ins as the list refreshes). Monthly activity is one SQL query (`date_trunc` in the installation time zone) behind an admin-only server function, shown on the panel home page to administrators.

**Tech Stack:** Drizzle/Postgres, TanStack Start/Query, shadcn Card/Table, Vitest, Playwright.

**Spec:** [product spec F15](../specs/2026-11-19-produkt-design.md) — "Organizator widzi zapisanych, obecnych i odsetek nieobecnych. Administrator widzi liczbę wydarzeń i zapisów w czasie." Acceptance: "liczby zgadzają się z danymi testowymi". The owner delegated design calls to Claude (21 November 2026).

## Design (short)

- **Event card ("Statystyki")** on the panel event page, for managers and check-in helpers:
  - counts: registered (`state = registered`), present (registered and checked in), waitlisted, awaiting approval (`pending`)
  - no-shows (registered − present) and their share, shown only once the event has ended (before that, everyone not yet checked in is simply "not yet")
- **Monthly activity** on the panel home page, administrators only, for the last 12 months including the current one, oldest first, months without data shown as 0:
  - events: not drafts, counted by the month of `events.date`
  - registrations: all rows except `rejected`, counted by the month of `created_at`
  - totals for the period
  - an accessible table, with a CSS bar per row (no chart library)
  - months bucketed in `VITE_APP_TIME_ZONE`
- **Limitation, stated in the UI note:** registrations removed by the retention job (F9) or by account deletion are not counted.

## Global Constraints

- AGENTS.md rules: TDD with `[F15]` Playwright tests written first; phones first (360 px); UI text in `pl.json` and `en.json` + `pnpm messages:compile`; no barrels; Biome; `@repo/env` only.
- Panel server functions: admin-only data behind `adminMiddleware` (like `admin/users.ts`); add new panel files to `packages/api/test/event-access.test.ts` only if they use `panelQueryFn`.
- No unbounded reads: the monthly query aggregates in SQL.

## Review Focus

1. An event with no registrants: card shows zeros and no division by zero (no-show share hidden). Owned by Task 1 (`registrantStats` test).
2. Month boundaries in Warsaw time: a registration at 23:30 UTC on the last day of a month counts in the next month locally. Owned by Task 3 (db test).
3. A check-in helper (not a manager) sees the card but no editing (Task 2 e2e reuses a helper? no, covered by existing F29 test staying green).
4. An organiser (not admin) opening the panel home does not see platform statistics and cannot call the server function (Task 4 test).
5. Rejected registrations are not counted anywhere (Tasks 1 and 3).

---

### Task 1: `registrantStats`

**Files:** Create `packages/ui/src/registrant-stats.ts`, `packages/ui/test/registrant-stats.test.ts`; modify `packages/ui/package.json` exports (`./registrant-stats`).

**Interfaces:** Produces `registrantStats(registrants: { state: RegistrationState; checkedInAt: Date | string | null }[], ended: boolean): { registered: number; present: number; waitlisted: number; pending: number; absent: number | null; absentShare: number | null }` — `absent`/`absentShare` are null before the end; `absentShare` is null when nobody is registered; share in 0..1.

- [ ] **Step 1:** tests `counts by state` (2 registered of which 1 checked in, 1 waitlisted, 1 pending, 1 rejected → 2/1/1/1), `no-shows only after the end` (ended false → null; true → absent 1, share 0.5), `nobody registered` (ended true → absent 0, share null).
- [ ] **Step 2:** `pnpm --filter @repo/ui test -- registrant-stats` — FAIL (module missing).
- [ ] **Step 3:** implement.
- [ ] **Step 4:** test passes; commit `feat(ui): registrant statistics`.

### Task 2: Event statistics card

**Files:** Create `apps/admin/src/components/admin-event-detail/event-stats-card.tsx`; modify `apps/admin/src/routes/_authenticated/events.$eventId.tsx`, `packages/i18n/messages/{pl,en}.json`; test `e2e/tests/f15-statystyki.spec.ts`.

i18n: `stats_title` "Statystyki"/"Statistics", `stats_registered` "Zapisani"/"Registered", `stats_present` "Obecni"/"Present", `stats_absent` "Nieobecni"/"No-shows", `stats_waitlisted` "Rezerwowi"/"Waitlisted", `stats_pending` "Czekają na akceptację"/"Awaiting approval", `stats_absent_share` "{share} nieobecnych"/"{share} no-shows", `stats_absent_after_end` "Nieobecnych policzymy po zakończeniu."/"No-shows are counted after the event ends.".

- [ ] **Step 1:** `[F15] organizator widzi zapisanych, obecnych i nieobecnych @organizator`: organiser's event that ended (`startsInDays: -1`), 4 registered (3 checked in via `checkInRegistration`/db update), 1 waitlisted → the region "Statystyki" shows Zapisani 4, Obecni 3, Nieobecni 1, "25% nieobecnych", Rezerwowi 1.
- [ ] **Step 2:** run — FAIL.
- [ ] **Step 3:** card: definition list in a Card (`role="region"`, `aria-labelledby` title), percent with `Intl.NumberFormat(locale, { style: "percent" })`; placed after the summary card for both access levels.
- [ ] **Step 4:** test passes on komputer and telefon; f8 accessibility spec stays green; commit `feat(admin): event statistics`.

### Task 3: Monthly activity query

**Files:** Create `packages/db/src/queries/activity.ts`, `packages/db/test/activity.test.ts`; modify `packages/db/package.json` exports if needed.

**Interfaces:** Produces `getMonthlyActivity(months: number, timeZone: string, now?: Date): Promise<{ month: string; events: number; registrations: number }[]>` (`month` = `YYYY-MM`, oldest first, exactly `months` rows).

- [ ] **Step 1:** tests `counts events and registrations per month` (published + cancelled counted, draft not; rejected not), `fills empty months with zeros` (length 12, oldest first), `buckets in the given time zone` (registration at `2026-10-31T23:30:00Z` counts as `2026-11` in `Europe/Warsaw`).
- [ ] **Step 2:** FAIL. **Step 3:** one query with `generate_series` of month starts in the time zone, left-joined counts. **Step 4:** pass; commit `feat(db): monthly activity`.

### Task 4: Activity on the panel home

**Files:** Create `packages/api/src/admin/activity.ts` (`adminActivityServer` with `adminMiddleware`, `adminActivityQueryOptions`); create `apps/admin/src/components/admin-activity.tsx`; modify `apps/admin/src/routes/_authenticated/index.tsx`, i18n (`activity_title` "Aktywność w ostatnich 12 miesiącach"/"Activity in the last 12 months", `activity_month` "Miesiąc"/"Month", `activity_events` "Wydarzenia"/"Events", `activity_registrations` "Zapisy"/"Registrations", `activity_total` "Razem"/"Total", `activity_note` "Bez szkiców i odrzuconych zapisów; dane usunięte zgodnie z RODO nie są liczone."/"Drafts and rejected registrations are not counted, nor data deleted for GDPR.").

- [ ] **Step 1:** `[F15] administrator widzi wydarzenia i zapisy w czasie @organizator`: admin opens the home page, reads the current month's row, creates 2 published events this month (one with 3 registrations), reloads → events +2, registrations +3; an organiser's home page has no "Aktywność" heading.
- [ ] **Step 2:** FAIL. **Step 3:** implement (month label `Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })`; table with caption; bar `div` width = value / max). **Step 4:** pass; commit `feat(admin): monthly activity for administrators`.

### Task 5: Docs and verification

- [ ] Update the product spec F15 status, `docs/README.md` (plan 9), README feature table (Statistics row); run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e:up && pnpm e2e`; write the verification summary; commit; push to `next`.
