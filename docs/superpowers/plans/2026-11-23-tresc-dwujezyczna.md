# Treść wydarzenia w dwóch językach (F35) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; repo workflow: one ledger, inline execution, final fresh-context review). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Event content exists in both Polish and English: the organiser can translate the description with one click (or type the English version manually), and the public event page shows the version matching the visitor's locale, falling back to Polish.

**Architecture:** A nullable `description_en` column on `events`. A translation server function reuses the F34 LLM client to draft the English version. The admin event form gains an English description field with a "Przetłumacz" button. Public rendering is a pure column read — no LLM in the read path.

**Tech Stack:** Drizzle + Postgres migration, TanStack Start server functions, zod, Vitest, Playwright e2e.

**Prerequisite:** Plan 1 (F34) is landed — this plan consumes `@repo/api/llm/client` (`complete`, `LlmError`), `@repo/api/llm/config` (`llmEnabled`), `@repo/api/llm/status` (`llmStatusServer`) and the e2e `llm-mock`.

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md` — item "treść w dwóch językach" from the "Pźniej" section; the F35 row is added by Task 1.

## Global Constraints

- RODO: the LLM receives only the Polish description text (public event content). Never names, e-mails, registrations or questionnaire answers.
- AI is off by default: the translate button is invisible when the LLM is not configured; the English field itself always works (manual entry).
- Polish is the source of truth: the PL page always shows `description`; the EN page shows `description_en` when set, else falls back to `description`.
- UI text goes into both `packages/i18n/messages/{pl,en}.json`, then `pnpm messages:compile`. Never edit generated `src/paraglide/`.
- Biome: tabs, double quotes, organized imports. No barrel index files; import `@repo/*` subpaths from `package.json#exports`.
- The feature requires a passing Playwright test named `[F35] …`, written first with observed failure.
- Admin screens are designed for phones first (360 px).
- Conventional Commits, concise imperative description, no scope.
- DB tests truncate only `harmonogram_us_test`.

## Review Focus

1. **No English description set**: the EN page falls back to the Polish text — no empty description area. → Task 5 e2e (event with PL only).
2. **Both versions set, visitor in PL**: the PL page shows the Polish text, not the translation (locale switching never loses the original). → Task 5 e2e.
3. **LLM output longer than 5000 chars**: the translated draft is truncated to 5000 before it reaches the field. → Task 4 unit test.
4. **LLM not configured**: the "Przetłumacz" button is hidden, the English textarea is fully usable by hand. → Task 2 unit (`llmEnabled` gating) + Task 5 e2e (manual entry path works regardless).
5. **Prompt content (RODO pin)**: the translation request body contains only the Polish description text — nothing else. → Task 4 unit test.

## File Structure

- Modify: `packages/db/src/schema/events.ts` — `descriptionEn: text("description_en")` after `description`.
- Create: `packages/db/src/migrations/<timestamp>_f35_description_en.ts` — generated.
- Modify: `packages/api/src/events/schemas.ts` — `descriptionEn: descriptionSchema` in `createEventSchema` and `updateEventSchema`.
- Modify: `packages/db/src/queries/events.ts` — ensure the admin event selects carry `descriptionEn` into `EventWithRelations` (check how the rows are selected; add the column where `description` is projected).
- Create: `packages/api/src/events/translation-draft.ts` — `buildTranslationPrompt`, `createTranslationDraftServer`.
- Create: `packages/api/test/translation-draft.test.ts`.
- Create: `apps/admin/src/components/translate-description-button.tsx` — the "Przetłumacz" button (confirm-replace behavior identical to the F34 button).
- Modify: `apps/admin/src/components/event-form-dialog.tsx` — `descriptionEn` form value + English textarea + button.
- Modify: `packages/i18n/messages/pl.json`, `packages/i18n/messages/en.json`.
- Modify: `apps/web/src/components/event-details/event-summary.tsx` — locale-aware description (the block at ~line 96).
- Create: `e2e/tests/f35-tresc-dwujezyczna.spec.ts`.
- Modify: `docs/superpowers/specs/2026-11-19-produkt-design.md` (Task 1).

---

### Task 1: Spec entry for F35

**Files:**
- Modify: `docs/superpowers/specs/2026-11-19-produkt-design.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the F35 row the e2e test name and ledger reference.

- [ ] **Step 1: Add the F35 row**

Move "treść w dwóch językach" from "Później" into the feature table as F35 with acceptance: the event form stores a Polish and an English description; one click drafts the English from the Polish; the public page shows the English version on EN routes with fallback to Polish; a passing e2e `[F35] …` is required. Change-log line dated 2026-11-23.

- [ ] **Step 2: Verify and commit**

Run: `git diff docs/superpowers/specs/2026-11-19-produkt-design.md`
Expected: the F35 row and change-log line only.

```bash
git add docs/superpowers/specs/2026-11-19-produkt-design.md
git commit -m "docs: spec F35 bilingual event content"
```

---

### Task 2: Migration — `description_en` column

**Files:**
- Modify: `packages/db/src/schema/events.ts`
- Create: `packages/db/src/migrations/<timestamp>_f35_description_en.ts` (generated)

**Interfaces:**
- Consumes: nothing.
- Produces: `events.descriptionEn: string | null` (nullable, no default) on the Drizzle `events` table — every later task in this plan reads it.

- [ ] **Step 1: Add the column to the schema**

In `packages/db/src/schema/events.ts`, right after `description: text("description"),` add `descriptionEn: text("description_en"),` with the comment `/** English version of the description (F35); shown on EN routes, fallback to `description`. */`.

- [ ] **Step 2: Generate the migration and inspect it**

Run: `pnpm --filter @repo/db db:generate`
Expected: one new migration file in `packages/db/src/migrations/` containing exactly `ALTER TABLE "events" ADD COLUMN "description_en" text;` and nothing else.

- [ ] **Step 3: Verify types and apply to the dev database**

Run: `pnpm typecheck` (exit 0), then apply to the local dev DB the way the repo normally does (`pnpm --filter @repo/db db:push` against the dev stack), and confirm the column exists (`SELECT column_name FROM information_schema.columns WHERE table_name='events' AND column_name='description_en'` → one row).

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/events.ts packages/db/src/migrations/
git commit -m "feat: events table gains description_en column (F35)"
```

---

### Task 3: Schemas and query wiring

**Files:**
- Modify: `packages/api/src/events/schemas.ts`
- Modify: `packages/db/src/queries/events.ts`
- Modify: `packages/api/src/events/queries.ts` (event-details server function — ensure the details payload carries `descriptionEn`)

**Interfaces:**
- Consumes: `events.descriptionEn` (Task 2); `descriptionSchema` (already `z.string().max(5000).nullable().optional()` at line 61 of `schemas.ts`).
- Produces: `descriptionEn: string | null` in `CreateEventParams`, `UpdateEventParams` and in `EventWithRelations` / the event-details payload — what the admin form (Task 6) and the public page (Task 7) read.

- [ ] **Step 1: Add the field to the zod schemas**

In `packages/api/src/events/schemas.ts`: `descriptionEn: descriptionSchema` in `createEventSchema` (~line 99, next to `description`) and `updateEventSchema` (~line 124).

- [ ] **Step 2: Carry the column through the queries**

In `packages/db/src/queries/events.ts`, find where `description` is selected/projected into `EventWithRelations` and add `descriptionEn` beside it. In `packages/api/src/events/queries.ts`, ensure `fetchEventDetailsServer`'s returned object includes `descriptionEn` (it flows from the same query — add the projection if it is explicit).

- [ ] **Step 3: Verify and commit**

Run: `pnpm typecheck`
Expected: exit 0 — the new field flows through without gaps.

```bash
git add packages/api/src/events/schemas.ts packages/db/src/queries/events.ts packages/api/src/events/queries.ts
git commit -m "feat: carry description_en through event schemas and queries (F35)"
```

---

### Task 4: Translation server function and prompt builder

**Files:**
- Create: `packages/api/src/events/translation-draft.ts`
- Create: `packages/api/test/translation-draft.test.ts`
- Modify: `packages/api/package.json` (exports)

**Interfaces:**
- Consumes: `complete`, `LlmError` from `@repo/api/llm/client`; `llmEnabled` from `@repo/api/llm/config` (plan 1); the auth pattern of `packages/api/src/events/mutations.ts`.
- Produces (consumed by Task 6):
  - `buildTranslationPrompt(description: string): { system: string; prompt: string }` — pure; system says: translate a Polish university-event description into natural English, keep the meaning and tone, return only the translation; the user message is exactly the description text (Review Focus 5).
  - `createTranslationDraftServer` — `createServerFn({ method: "POST" })`, validator `z.object({ description: z.string().min(1).max(5000) })`, same auth/role guard as `createAdminEventServer`. Returns `{ draft: string }` — trimmed, truncated to 5000 (Review Focus 3). Domain errors: `llm_unavailable` when `!llmEnabled()`; `llm_error` on `LlmError`.

- [ ] **Step 1: Write the failing tests**

`packages/api/test/translation-draft.test.ts` (mock `@repo/api/llm/client` and `@repo/api/llm/config`):
- `buildTranslationPrompt`: the prompt's user message equals the input description; the system message is the same regardless of input.
- disabled: rejects with `llm_unavailable`; `complete` never called.
- success: 6000-char mock output → exactly 5000 chars back, trimmed.
- `LlmError`: rejects with `llm_error`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/api test translation-draft`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Mirror `packages/api/src/events/description-draft.ts` (plan 1, Task 5) — same module shape, same error mapping.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/api test translation-draft`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/events/translation-draft.ts packages/api/test/translation-draft.test.ts packages/api/package.json
git commit -m "feat: translation draft server function (F35)"
```

---

### Task 5: e2e spec for F35 (failing first)

**Files:**
- Create: `e2e/tests/f35-tresc-dwujezyczna.spec.ts`

**Interfaces:**
- Consumes: admin login + event form flow from existing specs; the llm-mock contract (`MOCKLLM:` prefix, plan 1 Task 4); web locale routes (Paraglide route strategy — EN route is the `/en/…` prefix; check `packages/i18n/paraglide-route-strategies.js` for the exact shape).
- Produces: the `[F35]` acceptance tests Tasks 6–7 must make pass.

- [ ] **Step 1: Write the spec**

Five tests (Polish titles):
1. `[F35] Organizator tłumaczy opis jednym kliknięciem` — organizer: fill PL description, click "Przetłumacz", assert the English textarea contains `MOCKLLM`, save.
2. `[F35] Strona po angielsku pokazuje wersję angielską` — after test 1, the event's EN route page shows the English description (`MOCKLLM` marker) and the PL route page shows the Polish text (Review Focus 2).
3. `[F35] Bez wersji angielskiej strona EN pokazuje polski opis` — an event saved with only a PL description: the EN route shows the Polish text (fallback, Review Focus 1).
4. `[F35] Wersję angielską można wpisać ręcznie` — no LLM interaction: type into the English textarea, save, EN route shows it (Review Focus 4 — the field works regardless of LLM config).
5. `[F35] Nad istniejącą treścią angielską tłumaczenie wymaga potwierdzenia` — type EN text "Old", click translate, confirm dialog, cancel → still "Old"; confirm → `MOCKLLM`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm e2e:up && pnpm exec playwright test tests/f35-tresc-dwujezyczna.spec.ts`
Expected: FAIL — the English description field does not exist in the form.

- [ ] **Step 3: Commit the failing spec**

```bash
git add e2e/tests/f35-tresc-dwujezyczna.spec.ts
git commit -m "test: failing e2e for F35 bilingual content"
```

---

### Task 6: Admin form — English field and translate button

**Files:**
- Create: `apps/admin/src/components/translate-description-button.tsx`
- Modify: `apps/admin/src/components/event-form-dialog.tsx`
- Modify: `packages/i18n/messages/pl.json`, `packages/i18n/messages/en.json`

**Interfaces:**
- Consumes: `createTranslationDraftServer` (Task 4); `llmStatusServer` from `@repo/api/llm/status` (plan 1); the F34 button's confirm-replace pattern (`apps/admin/src/components/generate-description-button.tsx` — reuse the same confirm dialog approach, do not duplicate its logic into a second copy: if both buttons share the confirm flow, factor the confirm into one small shared component in the same directory).
- Produces: the form behavior the e2e spec (Task 5) asserts.

- [ ] **Step 1: Add i18n keys and compile**

Keys in both files (pl / en):
- `admin_field_description_en`: "Opis po angielsku (English description)" / "English description"
- `admin_button_translate_description`: "Przetłumacz" / "Translate"
- `admin_confirm_replace_description_en_title`: "Zastąpić opis po angielsku?" / "Replace English description?"
- `admin_confirm_replace_description_en_body`: "Pole zawiera już treść. Wygenerowane tłumaczenie ją zastąpi." / "The field already has text. The generated translation will replace it."

(`admin_error_ai` already exists from plan 1 — reuse it.)

Run: `pnpm messages:compile`
Expected: exit 0.

- [ ] **Step 2: Extend the form**

In `event-form-dialog.tsx`:
- `descriptionEn` in `EMPTY_VALUES` (`""`), in the edit-mode init (`event.descriptionEn ?? ""`), in the form zod schema (`z.string().max(5000)`), and in the submit mapping (`values.descriptionEn.trim() || null`) — beside the `description` equivalents.
- Render an English `Textarea` (label `admin_field_description_en`) directly under the Polish description field, and the `<TranslateDescriptionButton>` under it — it reads the PL `description` value, hides when the PL description is empty or the LLM is disabled, and fills the EN field with the confirm-replace flow (mobile-first at 360 px).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/ apps/admin/src/paraglide/ packages/i18n/messages/
git commit -m "feat: English description field with translate button (F35)"
```

---

### Task 7: Public rendering with locale fallback

**Files:**
- Modify: `apps/web/src/components/event-details/event-summary.tsx` (the description block at ~line 96)

**Interfaces:**
- Consumes: `descriptionEn` in the event-details payload (Task 3); `getLocale()` from `@repo/i18n/paraglide/runtime` (already used in `apps/web/src/routes/events/$eventId.tsx`).
- Produces: the fallback rule the e2e spec asserts — EN locale: `descriptionEn ?? description`; PL locale: `description`.

- [ ] **Step 1: Implement the fallback**

In `event-summary.tsx`, choose the text to render: `getLocale() === "en" && event.descriptionEn ? event.descriptionEn : event.description` — render exactly one `<p>` as today. Pass `descriptionEn` through from wherever the event object reaches the component (check the props chain from `event-details-view.tsx`).

- [ ] **Step 2: Run the e2e spec**

Run: `pnpm e2e:up && pnpm exec playwright test tests/f35-tresc-dwujezyczna.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/event-details/
git commit -m "feat: event page shows the English description with Polish fallback (F35)"
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
Expected: all specs pass, including `[F35]` and the still-green `[F34]`.

- [ ] **Step 3: Update the ledger**

Check off Tasks 1–8 in this file and append a verification summary (commands run, results, findings).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-11-23-tresc-dwujezyczna.md
git commit -m "docs: verification summary for F35 bilingual content"
```
