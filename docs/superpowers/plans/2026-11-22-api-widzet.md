# Public API and "upcoming events" widget (F24) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Other university sites can read upcoming public events as JSON and embed a small "upcoming events" list.

**Architecture:** One query (`listUpcomingPublicEvents`) feeds both a versioned JSON route (`GET /api/v1/events`, CORS `*`, cached 60 s) and a bare web page (`/{locale}/widget`) meant for an `<iframe>`. The iframe reuses the app's styles and needs no script on the host page, so a host can never run our code or leak its visitors' data to us. Both take the same filters (`faculty`, `type`, `limit`).

**Tech Stack:** Drizzle/Postgres, TanStack Start server routes, React, Paraglide, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md` (F24: „Publiczne API do odczytu wydarzeń i widżet »najbliższe wydarzenia«. Gotowe, gdy API zwraca nadchodzące wydarzenia; widżet na testowej stronie pokazuje trzy najbliższe”). Decisions are the architect's (user delegated decisions).

## Decisions

- Only `published` events with `visibility = 'public'` whose effective end is in the future; cancelled, draft, signed-in-only and invite-only events never appear. Ordered by start, then id.
- JSON fields per event: `id`, `title`, `startsAt`, `endsAt` (ISO), `place` (location · room or null), `attendanceMode`, `faculty` and `type` (`{ id, label }` or null), `seatsRemaining` (null without a limit), `url` (absolute link to the event page in `lang`). No descriptions, organisers or registrant data.
- Query parameters: `limit` 1–50 (default 20), `faculty` and `type` (dictionary ids, as in the site filters), `lang` `pl|en` (default base locale). Invalid values → 400 with `{ error }`.
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

- [ ] db tests: lists only published public upcoming events in start order; excludes draft, cancelled, `authenticated`, `private`, ended; filters by faculty and type; respects limit; seats remaining from `event_seat_counts`.
- [ ] api tests: parameter parsing (defaults, 400 on `limit=0|abc|51`, unknown `lang`), response shape (absolute `url` with lang), headers.
- [ ] `[F24] API zwraca nadchodzące wydarzenia @uczestnik`: GET `/api/v1/events?faculty=<unique>` returns the two published public events of a unique faculty in order, not its draft or private one; CORS header present.
- [ ] Run — fail; implement; run — pass. Commit `feat(api): public events API (F24)`.

### Task 2: Embeddable widget

**Files:**
- Create: `apps/web/src/routes/widget.tsx`, `packages/api/src/public/widget.ts` (server fn + query options over `listUpcomingPublicEvents`)
- Modify: `apps/web/src/routes/__root.tsx` (no header/footer/toaster on the widget route)
- Test: `e2e/tests/f24-api-widzet.spec.ts` (widget part)

- [ ] `[F24] widżet na stronie zewnętrznej pokazuje trzy najbliższe @uczestnik` (phone): a test page (`page.setContent`) with `<iframe src="…/pl/widget?limit=3&faculty=<unique>">`; four upcoming events of that faculty → three items, nearest first, links to `/pl/events/<id>` with `target="_blank"`; no site header inside; `expectAccessible` on the widget page opened directly.
- [ ] Run — fail; implement; run — pass. Commit `feat(web): upcoming events widget (F24)`.

### Task 3: Docs, review, verification

- [ ] `docs/embedding.md` (API reference and widget snippet, pl/en sites); spec F24 status and changelog; `README.md` row and missing list; `docs/README.md` plan 12; `docs/architecture.md` public API line.
- [ ] Full suite: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e:up && pnpm e2e`.
- [ ] Fresh-context review; fix Critical/Important test-first; verification summary here.
