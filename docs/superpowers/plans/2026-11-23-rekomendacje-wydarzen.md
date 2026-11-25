# Rekomendacje wydarzeń (F36) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; repo workflow: one ledger, inline execution, final fresh-context review). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in visitors see a small "Dla Ciebie" section on the event list: upcoming events ranked by how well they match what the visitor has already registered for.

**Architecture:** The LLM runs offline — a worker job assigns a few theme tags to each published event (public content only) and stores them on the event; a cron poll keeps them fresh when an event changes. The list page calls a server function that derives the visitor's interest profile from their registrations, then ranks candidates with a pure, deterministic scoring function. No LLM in the read path.

**Tech Stack:** Drizzle + Postgres migration, boss queues (worker cron), TanStack Start server functions, Vitest, Playwright e2e.

**Prerequisite:** Plan 1 (F34) is landed — this plan consumes `@repo/api/llm/client` (`complete`, `LlmError`), `@repo/api/llm/config` (`llmEnabled`) and the e2e `llm-mock`.

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md` — item "rekomendacje wydarzeń" from the "Później" section; the F36 row is added by Task 1.

## Global Constraints

- RODO: the LLM receives only public event content (title, description, type/faculty labels). The interest profile is computed server-side from the visitor's own registrations and is never sent to the LLM.
- AI is off by default: when the LLM is not configured, no tags are ever produced and the "Dla Ciebie" section is hidden; everything else on the list page is unchanged.
- Determinism: ranking is a pure function of stored data; equal scores tie-break by start time then id, so refreshes never shuffle the list.
- Cost guard: the tagging job processes at most 20 events per run; a failing LLM skips the event (retried on the next run), never crashes the job.
- UI text goes into both `packages/i18n/messages/{pl,en}.json`, then `pnpm messages:compile`. Never edit generated `src/paraglide/`.
- Biome: tabs, double quotes, organized imports. No barrel index files; import `@repo/*` subpaths from `package.json#exports`.
- The feature requires a passing Playwright test named `[F36] …`, written first with observed failure.
- Conventional Commits, concise imperative description, no scope.
- DB tests truncate only `harmonogram_us_test`.

## Review Focus

1. **Anonymous visitor**: no "Dla Ciebie" section at all (no section header, no skeleton), list page renders normally. → Task 6 e2e.
2. **Visitor with no registrations** (signed in, empty history): section hidden — an empty profile must not produce a "top 3" of noise. → Task 6 e2e.
3. **LLM disabled**: the worker job no-ops, tags stay empty, section hidden — the whole feature degrades to invisible, nothing errors. → Task 4 (handler no-op) + Task 6 e2e (anonymous/no-section path exercises the same hide rule).
4. **Equal ranking scores**: stable order across refreshes (tie-break startsAt, then id) — the section does not shuffle. → Task 3 unit test.
5. **One cron run over many events**: the batch cap (20) is respected — the job never fires hundreds of LLM calls at once. → Task 4 (handler) — pinned by a unit test with a mocked `complete` that counts calls.

## File Structure

- Modify: `packages/db/src/schema/events.ts` — `tags: text("tags", { array: true }).$type<string[]>().notNull().default([])` and `taggedAt: timestamp("tagged_at", { withTimezone: true })`.
- Create: `packages/db/src/migrations/<timestamp>_f36_event_tags.ts` (generated).
- Modify: `packages/jobs/src/queues.ts` — `QUEUE_EVENT_TAGS = "event-tags"`, `EVENT_TAGS_CRON` (env-overridable, default `"*/30 * * * *"`).
- Create: `apps/worker/src/handlers/tag-events.ts` — the tagging job body.
- Modify: `apps/worker/src/index.ts` — `boss.work` + `boss.schedule` for the tag job.
- Create: `packages/api/src/events/recommendations.ts` — pure types + `rankRecommendedEvents`.
- Create: `packages/api/test/recommendations.test.ts`.
- Modify: `packages/db/src/queries/public-events.ts` — `getUserInterestProfile` + tag-aware candidate list.
- Create: `packages/db/test/recommendations.test.ts` — DB test for the profile query.
- Modify: `packages/api/src/events/queries.ts` — `fetchRecommendedEventsServer`.
- Create: `apps/web/src/components/home-recommendations-section.tsx` + wire into the home list (`apps/web/src/routes/index.tsx` / `home-event-list-section.tsx` — follow where the existing list section is composed).
- Modify: `packages/i18n/messages/pl.json`, `packages/i18n/messages/en.json`.
- Create: `e2e/tests/f36-rekomendacje.spec.ts`.
- Modify: `docs/superpowers/specs/2026-11-19-produkt-design.md` (Task 1).

---

### Task 1: Spec entry for F36

**Files:**
- Modify: `docs/superpowers/specs/2026-11-19-produkt-design.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the F36 row the e2e test name and ledger reference.

- [ ] **Step 1: Add the F36 row**

Move "rekomendacje wydarzeń" from "Później" into the feature table as F36 with acceptance: published events get offline theme tags; signed-in visitors see a "Dla Ciebie" section (max 3) ranked by their registration history; anonymous visitors and users without history see no section; the feature is invisible when the LLM is not configured; a passing e2e `[F36] …` is required. Change-log line dated 2026-11-23.

- [ ] **Step 2: Verify and commit**

Run: `git diff docs/superpowers/specs/2026-11-19-produkt-design.md`
Expected: the F36 row and change-log line only.

```bash
git add docs/superpowers/specs/2026-11-19-produkt-design.md
git commit -m "docs: spec F36 event recommendations"
```

---

### Task 2: Migration — tags and taggedAt on events

**Files:**
- Modify: `packages/db/src/schema/events.ts`
- Create: `packages/db/src/migrations/<timestamp>_f36_event_tags.ts` (generated)

**Interfaces:**
- Consumes: nothing.
- Produces: `events.tags: string[]` (not null, default `[]`) and `events.taggedAt: Date | null` — consumed by Task 4 (writes) and Task 5 (reads).

- [ ] **Step 1: Add the columns**

In `packages/db/src/schema/events.ts` after `descriptionEn`:
`tags: text("tags", { array: true }).$type<string[]>().notNull().default([])` (comment: theme tags assigned offline by the LLM (F36)) and `taggedAt: timestamp("tagged_at", { withTimezone: true })` (comment: when `tags` was last computed; null = never tagged).

- [ ] **Step 2: Generate the migration and inspect it**

Run: `pnpm --filter @repo/db db:generate`
Expected: one new migration containing exactly the two `ALTER TABLE "events" ADD COLUMN` statements (`tags text[] NOT NULL DEFAULT '{}'::text[]`, `tagged_at timestamp with time zone`).

- [ ] **Step 3: Verify types and apply to the dev database**

Run: `pnpm typecheck` (exit 0); apply to the dev DB as in the F35 plan and confirm both columns exist via `information_schema.columns`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/events.ts packages/db/src/migrations/
git commit -m "feat: events table gains offline theme tags (F36)"
```

---

### Task 3: Pure ranking function

**Files:**
- Create: `packages/api/src/events/recommendations.ts`
- Create: `packages/api/test/recommendations.test.ts`
- Modify: `packages/api/package.json` (exports)

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (consumed by Task 6):
  - `type InterestProfile = { tags: string[]; typeIds: string[]; facultyIds: string[] }`
  - `type RecommendationCandidate = { id: string; title: string; startsAt: Date; endsAt: Date | null; place: string | null; attendanceMode: AttendanceMode; faculty: { slug: string; label: string } | null; type: { slug: string; label: string } | null; seatsRemaining: number; tags: string[]; typeId: string; facultyId: string | null }` (the `PublicEvent` shape from `packages/db/src/queries/public-events.ts` plus `tags`, `typeId`, `facultyId`)
  - `rankRecommendedEvents(profile: InterestProfile, candidates: RecommendationCandidate[], limit: number): RecommendationCandidate[]` — score per candidate: +2 per shared tag, +1 if `typeId` is in `profile.typeIds`, +1 if `facultyId` is in `profile.facultyIds`; keep score ≥ 1, sort by score desc, then `startsAt` asc, then `id` (Review Focus 4), take `limit`.

- [ ] **Step 1: Write the failing tests**

`packages/api/test/recommendations.test.ts` — fixed fixtures (3–4 candidates with distinct tags/types/faculties):
- a candidate sharing two tags beats one sharing a type only (2·2 > 1).
- empty profile (`{ tags: [], typeIds: [], facultyIds: [] }`) → `[]` for any candidates (nothing with score ≥ 1).
- equal scores → ordered by `startsAt` asc, then `id` (Review Focus 4).
- `limit` truncates the result.
- a candidate sharing only its type (score 1) is included; one sharing nothing is excluded.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/api test recommendations`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `rankRecommendedEvents`**

Straight map-score-filter-sort-slice; no DB, no LLM.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/api test recommendations`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/events/recommendations.ts packages/api/test/recommendations.test.ts packages/api/package.json
git commit -m "feat: deterministic recommendation ranking (F36)"
```

---

### Task 4: Worker tagging job

**Files:**
- Modify: `packages/jobs/src/queues.ts`
- Create: `apps/worker/src/handlers/tag-events.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/work-options.ts` (add the job options constant if needed — check what `EMAIL_WORK` covers)
- Modify: `docker-compose.yml` — pass `EVENT_TAGS_CRON` to the `worker` service (e2e sets `"*/1 * * * *"` via `e2e/ports.env`-style env; dev default `"*/30 * * * *"`)

**Interfaces:**
- Consumes: `events.tags`, `events.taggedAt` (Task 2); `complete`, `LlmError` from `@repo/api/llm/client`; `llmEnabled` from `@repo/api/llm/config` (plan 1); the queue-constant pattern of `packages/jobs/src/queues.ts` and the `boss.work`/`boss.schedule` pattern of `apps/worker/src/index.ts`.
- Produces: filled `tags`/`taggedAt` on published events — what Task 5's queries read. Behavior pinned:
  - select published events where `tags = '{}'` OR `updatedAt > taggedAt`, order by `updatedAt` desc, limit 20 (Review Focus 5);
  - per event: prompt from title + description + type/faculty labels only (system: "reply with up to 8 short lowercase theme tags, one per line"); parse: lines → trim → lowercase → dedupe → max 8; store tags + `taggedAt = now` in a single update per event;
  - `!llmEnabled()` → return 0 without touching anything (Review Focus 3);
  - `LlmError` or empty tag list for one event → skip it (`taggedAt` untouched, retried next run), continue with the rest; the job never throws.

- [ ] **Step 1: Write the failing unit test for the handler**

`apps/worker/test/tag-events.test.ts` (mock `@repo/db` selects/updates via vi.mock, or inject the DB layer as a parameter — follow the DI style the existing handler tests use; check `apps/worker/` for existing tests and their mocking approach, and use the same):
- disabled (`llmEnabled` false): no LLM calls, no updates, returns 0 (Review Focus 3).
- batch cap: 25 stale events → `complete` called exactly 20 times (Review Focus 5).
- per-event failure: first event's `complete` throws `LlmError` → it is skipped (no update for it), second event is tagged, function does not throw.
- tag parsing: `complete` returns "Sieci\nKAWA\nkawa\n " → stored `["sieci", "kawa"]`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/worker test tag-events` (if the worker package has no test script, add one mirroring `packages/api/package.json` — vitest is already in the monorepo)
Expected: FAIL — handler missing.

- [ ] **Step 3: Implement**

`packages/jobs/src/queues.ts`: `QUEUE_EVENT_TAGS = "event-tags"` and `EVENT_TAGS_CRON` read from env (`z.string().default("*/30 * * * *")` via the client env if the cron strings can live there — check how other CRON constants are defined; keep them as plain string constants overridable through env in the compose file). `apps/worker/src/index.ts`: `boss.work(QUEUE_EVENT_TAGS, …)` calling the handler, `boss.schedule(QUEUE_EVENT_TAGS, EVENT_TAGS_CRON, …)` with `JOBS_TIME_ZONE` like the other schedules.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/worker test tag-events`
Expected: PASS (4 tests). Then `pnpm typecheck` exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/queues.ts apps/worker/ docker-compose.yml
git commit -m "feat: offline event tagging worker job (F36)"
```

---

### Task 5: Profile and candidate queries

**Files:**
- Modify: `packages/db/src/queries/public-events.ts`
- Create: `packages/db/test/recommendations.test.ts`

**Interfaces:**
- Consumes: `events.tags`/`taggedAt` (Task 2); the existing `listUpcomingPublicEvents` and the `registrations` tables (check `packages/db/src/schema/event-registrations.ts` for the user→event relation columns).
- Produces (consumed by Task 6):
  - `getUserInterestProfile(userId: string): Promise<InterestProfile>` — union of `tags`, distinct `typeId`s and distinct `facultyId`s (non-null only) over the events this user has a registration for.
  - `listRecommendationCandidates(now: Date, limit: number): Promise<RecommendationCandidate[]>` — same selection rules as `listUpcomingPublicEvents` (published, public, not ended) plus `tags`, `typeId`, `facultyId`, capped at 100 candidates.

- [ ] **Step 1: Write the failing DB test**

`packages/db/test/recommendations.test.ts` (repo DB-test pattern: truncate `harmonogram_us_test`, insert fixtures):
- user A registered for events with tags `["a","b"]`/`["b","c"]` → profile.tags = `["a","b","c"]` (deduped) plus the right `typeIds`/`facultyIds`.
- a user with no registrations → `{ tags: [], typeIds: [], facultyIds: [] }`.
- `listRecommendationCandidates` returns only published+public+upcoming events and includes `tags`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/db test recommendations`
Expected: FAIL — functions missing.

- [ ] **Step 3: Implement both queries**

Follow the SQL style of `listUpcomingPublicEvents` in the same file (drizzle `sql` fragments, `effectiveEventEndSql`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/db test recommendations`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/public-events.ts packages/db/test/recommendations.test.ts
git commit -m "feat: interest profile and recommendation candidate queries (F36)"
```

---

### Task 6: e2e spec for F36 (failing first)

**Files:**
- Create: `e2e/tests/f36-rekomendacje.spec.ts`
- Modify: `e2e/llm-mock/server.mjs` (extend, do not break the F34/F35 contract)
- Modify: `e2e/ports.env` (if a new LLM env var is needed)

**Interfaces:**
- Consumes: the llm-mock contract from plan 1; the tagging cron (Task 4, e2e runs it every minute); admin + student login flows from existing specs.
- Produces: the `[F36]` acceptance tests Task 7 must make pass. The mock extension is pinned here: when the user message contains the marker line `TAG TASK`, the mock replies with the tag `t-<word>` for each of the words `sieci, kawa, fizyka, sport` present in the rest of the message (deterministic, lowercase), one per line — so an event titled "Seminarium o sieciach" gets `["t-sieci"]`. The F34/F35 behavior (`MOCKLLM:` prefix, `LLM_FAIL`) stays unchanged.

- [ ] **Step 1: Extend the mock and verify it**

Add the `TAG TASK` branch to `e2e/llm-mock/server.mjs`. Verify standalone as in plan 1 Task 4 Step 3: a `TAG TASK` message mentioning "sieci" and "kawa" returns exactly the two tag lines; a normal message still returns the `MOCKLLM:` prefix.

- [ ] **Step 2: Write the spec**

Four tests (Polish titles):
1. `[F36] Zalogowany użytkownik widzi sekcję „Dla Ciebie" dopasowaną do historii` — organizer publishes two events, both titled with the `TAG TASK` marker: "Kawiarnia naukowa o sieciach" and "Seminarium o sieciach i kawie" (plus an unrelated third event). Student A registers for the first. Poll the list page (up to 120 s; the e2e tagging cron runs every minute) until the "Dla Ciebie" section appears, then assert it shows the second event first (shares tags `t-sieci`, `t-kawa`) and the unrelated event is not in the top 3.
2. `[F36] Anonimowy użytkownik nie widzi sekcji „Dla Ciebie"` — logged-out list page: no section, no header, after the same polling window.
3. `[F36] Użytkownik bez zapisów nie widzi sekcji` — a second student who never registered: no section.
4. `[F36] Wydarzenie bez tagów nie psuje listy` — an event published without the `TAG TASK` marker keeps no tags; the list page still renders and the section (if visible for A) does not include it unless scored.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm e2e:up && pnpm exec playwright test tests/f36-rekomendacje.spec.ts`
Expected: FAIL — the "Dla Ciebie" section never appears (web part not implemented).

- [ ] **Step 4: Commit the mock extension and the failing spec**

```bash
git add e2e/llm-mock/server.mjs e2e/ports.env e2e/tests/f36-rekomendacje.spec.ts
git commit -m "test: failing e2e for F36 recommendations"
```

---

### Task 7: Server function and web section

**Files:**
- Modify: `packages/api/src/events/queries.ts` — `fetchRecommendedEventsServer`
- Create: `apps/web/src/components/home-recommendations-section.tsx`
- Modify: the home list composition (check `apps/web/src/routes/index.tsx` and `apps/web/src/components/home-event-list-section.tsx` for where the section slots in)
- Modify: `packages/i18n/messages/pl.json`, `packages/i18n/messages/en.json`

**Interfaces:**
- Consumes: `getUserInterestProfile`, `listRecommendationCandidates` (Task 5); `rankRecommendedEvents` (Task 3); the session access used by other server functions in `queries.ts`.
- Produces: `fetchRecommendedEventsServer` — `createServerFn({ method: "GET" })` → `{ events: RecommendationCandidate[] }`, max 3; returns `{ events: [] }` when there is no session, when the profile is empty, or when `!llmEnabled()` (never errors on an unconfigured LLM). The web section: heading "Dla Ciebie" / "For you" (i18n key `web_section_for_you`), up to 3 event cards reusing the existing home event card component, rendered above the main list only when `events` is non-empty (Review Focus 1–2).

- [ ] **Step 1: Add the i18n key and compile**

`web_section_for_you`: "Dla Ciebie" / "For you" in both files; run `pnpm messages:compile`, expect exit 0.

- [ ] **Step 2: Implement the server function**

In `packages/api/src/events/queries.ts` beside `fetchEventsServer`: get the session (same pattern as `fetchEventDetailsServer`'s optional auth); no session or `!llmEnabled()` → `{ events: [] }`; else profile → `[]` short-circuit → candidates → `rankRecommendedEvents(profile, candidates, 3)`.

- [ ] **Step 3: Implement the web section and wire it in**

`home-recommendations-section.tsx`: a `useQuery`/loader-fed section (follow how `HomeEventListSection` receives its data in `apps/web/src/routes/index.tsx`); render nothing for an empty list; cards link to the event pages. Mobile-first at 360 px.

- [ ] **Step 4: Run the e2e spec**

Run: `pnpm e2e:up && pnpm exec playwright test tests/f36-rekomendacje.spec.ts`
Expected: PASS (4 tests; test 1 polls up to the tagging cron).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/events/queries.ts apps/web/src/ packages/i18n/messages/
git commit -m "feat: for-you recommendations on the event list (F36)"
```

---

### Task 8: Full verification and ledger

**Files:**
- Modify: this plan file (check off tasks, add the verification summary)

- [ ] **Step 1: Run the package checks**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all exit 0.

- [ ] **Step 2: Run the full e2e suite**

Run: `pnpm e2e:up && pnpm e2e`
Expected: all specs pass, including `[F36]` and the still-green `[F34]`/`[F35]`.

- [ ] **Step 3: Update the ledger**

Check off Tasks 1–8 in this file and append a verification summary (commands run, results, findings).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-11-23-rekomendacje-wydarzen.md
git commit -m "docs: verification summary for F36 recommendations"
```
