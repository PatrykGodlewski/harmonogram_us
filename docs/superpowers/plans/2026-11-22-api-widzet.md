# Public API and "upcoming events" widget (F24) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Other university sites can read upcoming public events as JSON and embed a small "upcoming events" list.

**Architecture:** One query (`listUpcomingPublicEvents`) feeds both a versioned JSON route (`GET /api/v1/events`, CORS `*`, cached 60 s) and a bare web page (`/{locale}/widget`) meant for an `<iframe>`. The iframe reuses the app's styles and needs no script on the host page, so a host can never run our code or leak its visitors' data to us. Both take the same filters (`faculty`, `type`, `limit`).

**Tech Stack:** Drizzle/Postgres, TanStack Start server routes, React, Paraglide, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md` (F24: „Publiczne API do odczytu wydarzeń i widżet »najbliższe wydarzenia«. Gotowe, gdy API zwraca nadchodzące wydarzenia; widżet na testowej stronie pokazuje trzy najbliższe”). Decisions are the architect's (user delegated decisions).

## Decisions

- Only `published` events with `visibility = 'public'` whose effective end is in the future; cancelled, draft, signed-in-only and invite-only events never appear. Ordered by start, then id.
- JSON fields per event: `id`, `title`, `startsAt`, `endsAt` (ISO), `place` (location · room or null), `attendanceMode`, `faculty` and `type` (`{ id, label }` or null), `seatsRemaining` (null without a limit), `url` (absolute link to the event page in `lang`). No descriptions, organisers or registrant data.
- Query parameters: `limit` 1–50 (default 20), `faculty` and `type` (dictionary slugs, as in the site filters — corrected after review from ids), `lang` `pl|en` (default base locale). Invalid values → 400 with `{ error }`.
- Headers: `access-control-allow-origin: *` (read-only, no credentials), `cache-control: public, max-age=60`. No auth, no API keys: the data is already public on the site.
- Widget: `/{locale}/widget?limit=3&faculty=…&type=…` (limit 1–10, default 5), no site header or footer, links open the event in a new tab, a "Wszystkie wydarzenia" link, an empty state. Height is set by the host (`height` attribute); the snippet in the docs uses 3 events ≈ 360 px.
- Out of scope: API keys, write access, JavaScript widget, pagination beyond `limit`.

## Global Constraints

- TDD; `[F24]` Playwright tests seen failing first; phone first.
- UI text in pl and en, `pnpm messages:compile`. `@repo/env` only. No barrel files. Biome.

## Review Focus

- Signed-in-only, invite-only, draft and cancelled events must never leak through the API or the widget.
- Bad query values (`limit=0`, `limit=abc`, `limit=1000`) must not cause 500s or unbounded reads.
- The widget page must not carry the signed-in user's chrome or data (cookies are not sent in third-party iframes, but the page must not depend on that).
- Links in the widget and `url` in the API must point to this site only.

---

### Task 1: Upcoming public events query and JSON API

**Files:**
- Create: `packages/db/src/queries/public-events.ts` (`listUpcomingPublicEvents(now: Date, filters: { limit: number; facultyId?: string; typeId?: string }): Promise<PublicEvent[]>`), `packages/api/src/public/events-api.ts` (`publicEventsResponse(request: Request): Promise<Response>`), `apps/web/src/routes/api/v1/events.ts`
- Test: `packages/db/test/public-events.test.ts`, `packages/api/test/public-events-api.test.ts`, `e2e/tests/f24-api-widzet.spec.ts` (API part)

- [x] db tests: lists only published public upcoming events in start order; excludes draft, cancelled, `authenticated`, `private`, ended; filters by faculty and type; respects limit; seats remaining from `event_seat_counts`.
- [x] api tests: parameter parsing (defaults, 400 on `limit=0|abc|51`, unknown `lang`), response shape (absolute `url` with lang), headers.
- [x] `[F24] API zwraca nadchodzące wydarzenia @uczestnik`: GET `/api/v1/events?faculty=<unique>` returns the two published public events of a unique faculty in order, not its draft or private one; CORS header present.
- [x] Run — fail; implement; run — pass. Commit `feat(api): public events API (F24)`.

### Task 2: Embeddable widget

**Files:**
- Create: `apps/web/src/routes/widget.tsx`, `packages/api/src/public/widget.ts` (server fn + query options over `listUpcomingPublicEvents`)
- Modify: `apps/web/src/routes/__root.tsx` (no header/footer/toaster on the widget route)
- Test: `e2e/tests/f24-api-widzet.spec.ts` (widget part)

- [x] `[F24] widżet na stronie zewnętrznej pokazuje trzy najbliższe @uczestnik` (phone): a test page (`page.setContent`) with `<iframe src="…/pl/widget?limit=3&faculty=<unique>">`; four upcoming events of that faculty → three items, nearest first, links to `/pl/events/<id>` with `target="_blank"`; no site header inside; `expectAccessible` on the widget page opened directly.
- [x] Run — fail; implement; run — pass. Commit `feat(web): upcoming events widget (F24)`.

### Task 3: Docs, review, verification

- [x] `docs/embedding.md` (API reference and widget snippet, pl/en sites); spec F24 status and changelog; `README.md` row and missing list; `docs/README.md` plan 12; `docs/architecture.md` public API line.
- [x] Full suite: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e:up && pnpm e2e`.
- [x] Fresh-context review; fix Critical/Important test-first; verification summary here.

## Verification summary (2026-11-22)

- Commits: d35a88c (plan) → cdbada7 API → cd24370 widget → b7feff6 docs → review fix.
- After the fix: `pnpm lint`, `pnpm typecheck`, `pnpm test` (db 251, api 127, worker 21, ui 32, collections 8, rpc 3), `pnpm build` exit 0. Full `pnpm e2e` after `pnpm e2e:up`: 183 passed, 1 skipped, 2 failed — both the new widget test's own expected link format (`/pl/?…` vs the real `/pl?…`); corrected and rerun: `f24-api-widzet` + `f4-lista-wydarzen` 11 passed. Before the fix the full run was 185 passed, 1 skipped.
- `[F24]` tests: API returns the faculty's two published public events in order, not its draft or invite-only one, with CORS, and 400 for `limit=1000`; an external test page embedding `/pl/widget?limit=3&faculty=…` shows the three nearest of four, links open the event in a new tab, no site header/footer, "All events" keeps the faculty filter; WCAG audit of the widget page.
- Fresh-context review (opus): no Critical. Important, fixed test-first: filters keyed on lookup ids while the site filters by slug (panel-created faculties have generated ids), so documented embeds showed nothing → filters and JSON use `slug`; db test with id ≠ slug RED→GREEN; e2e now creates the faculty as the panel does and failed against the old build; docs corrected.
- Rulings: `seatsRemaining` is always a number (`max_seats` NOT NULL); widget parameters fall back to defaults when malformed.
- Deferred minors: numeric faculty slug in the widget URL is parsed as a number and dropped; widget SSR does a session lookup and sends no cache header; effective-end filter scans; new-tab links have no hint; widget page lacks `noindex`; API 5xx without CORS header.
