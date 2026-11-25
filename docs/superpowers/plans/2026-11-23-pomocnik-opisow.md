# Pomocnik opisów wydarzeń (F34) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; repo workflow: one ledger, inline execution, final fresh-context review). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An organiser gets a Polish draft of an event description with one click from the title and keywords, in the admin event form.

**Architecture:** A small LLM foundation lands in `packages/api` (env config, OpenAI-compatible chat client, availability server function). A draft server function builds a prompt from public event fields only. The admin event form gains a "Generuj opis" button next to the description field. In e2e, a deterministic `llm-mock` service replaces the LLM (same pattern as `teams-mock`). This plan also owns the foundation that plans 2–3 (PL/EN content, recommendations) consume.

**Tech Stack:** TanStack Start server functions, zod, @t3-oss/env-core, Vitest, Playwright e2e. No database changes in this plan.

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md` — item "pomocnik opisu" from the "Później" section; the F34 row is added by Task 1.

## Global Constraints

- RODO: the LLM receives only public, non-identifying event content (title, description, type/faculty labels). Never names, e-mails, registrations or questionnaire answers.
- AI is off by default: everything is invisible and inert unless both `LLM_BASE_URL` and `LLM_API_KEY` are set. No new required env vars.
- The LLM endpoint is any OpenAI-compatible `POST {base}/chat/completions`; a university may self-host it (`LLM_BASE_URL` is configurable).
- e2e never calls external networks: the suite uses `e2e/llm-mock/server.mjs`, configured in `e2e/ports.env`.
- UI text goes into both `packages/i18n/messages/{pl,en}.json`, then `pnpm messages:compile`. Never edit generated `src/paraglide/`.
- Biome: tabs, double quotes, organized imports. No barrel index files; import `@repo/*` subpaths from `package.json#exports`.
- The feature requires a passing Playwright test named `[F34] …`, written first with observed failure.
- Admin screens are designed for phones first (360 px).
- Conventional Commits, concise imperative description, no scope.
- DB tests truncate only `harmonogram_us_test` (none in this plan).

## Review Focus

Inputs the spec implies but no happy-path test exercises; each line's test is pinned to the owning task.

1. **LLM not configured** (no `LLM_API_KEY`): the "Generuj opis" button is hidden, the draft server function rejects with a domain error, and the app boots normally. → Task 2 (`llm-config.test.ts`) + Task 5 (`description-draft.test.ts`).
2. **LLM failure mid-click** (500 / timeout): the user sees a generic error toast, form values are untouched, and saving still works. → Task 7 e2e (mock returns 500 for prompts containing `LLM_FAIL`).
3. **Description field already has text**: overwriting happens only after an explicit confirm; cancelling leaves the text intact. → Task 7 e2e.
4. **LLM output longer than 5000 chars**: the draft is truncated to 5000 before it reaches the form, so form validation still passes. → Task 5 unit test.
5. **Prompt content (RODO pin)**: the request body sent to the LLM contains only title, keywords, type and faculty labels — never the organiser's name or e-mail. → Task 5 unit test (prompt builder) + Task 7 e2e (mock `GET /__last`).

## File Structure

- Modify: `packages/env/src/index.ts` — server block gains `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.
- Create: `packages/api/src/llm/config.ts` — `llmEnabled()`.
- Create: `packages/api/src/llm/client.ts` — `LlmError`, `complete()`.
- Create: `packages/api/src/llm/status.ts` — `llmStatusServer`.
- Create: `packages/api/src/events/description-draft.ts` — `buildDescriptionPrompt`, `createDescriptionDraftServer`.
- Modify: `packages/api/package.json` — `exports` entries for the new subpaths.
- Create: `packages/api/test/llm-config.test.ts`, `packages/api/test/llm-client.test.ts`, `packages/api/test/description-draft.test.ts`.
- Create: `e2e/llm-mock/server.mjs` — stand-in OpenAI endpoint.
- Modify: `e2e/ports.env` — `LLM_PORT`, `LLM_BASE_URL`, `LLM_API_KEY`.
- Modify: `docker-compose.yml` — `llm-mock` service (`profiles: [e2e]`, modelled on `teams-mock`) and `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` in the env of the `admin`, `web` and `worker` services (server functions run in the app processes; the worker needs the client for plan 3).
- Create: `apps/admin/src/components/generate-description-button.tsx` — the button, confirm and error handling.
- Modify: `apps/admin/src/components/event-form-dialog.tsx` — renders the button beside the description field (the field block at ~line 425).
- Modify: `packages/i18n/messages/pl.json`, `packages/i18n/messages/en.json`.
- Create: `e2e/tests/f34-pomocnik-opisow.spec.ts`.
- Modify: `docs/superpowers/specs/2026-11-19-produkt-design.md` (Task 1).

---

### Task 1: Spec entry for F34

**Files:**
- Modify: `docs/superpowers/specs/2026-11-19-produkt-design.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the F34 feature row that the e2e test name (`[F34] …`) and the ledger reference.

- [ ] **Step 1: Add the F34 row**

Move "pomocnik opisu" from the "Pźniej" list into the feature table as F34 with acceptance: in the admin event form the organiser enters title (and optionally keywords) and one click fills the description field with a generated draft; the feature is invisible when the LLM is not configured; a passing e2e `[F34] …` is required. Add a change-log line dated 2026-11-23.

- [ ] **Step 2: Verify and commit**

Run: `git diff docs/superpowers/specs/2026-11-19-produkt-design.md`
Expected: the F34 row and change-log line only.

```bash
git add docs/superpowers/specs/2026-11-19-produkt-design.md
git commit -m "docs: spec F34 assisted event descriptions"
```

---

### Task 2: LLM env config and availability

**Files:**
- Modify: `packages/env/src/index.ts` (server block, next to the TEAMS/S3 pattern)
- Create: `packages/api/src/llm/config.ts`
- Create: `packages/api/test/llm-config.test.ts`
- Modify: `packages/api/package.json` (exports)

**Interfaces:**
- Consumes: `createEnv`/server env pattern from `@repo/env`.
- Produces:
  - env vars `LLM_BASE_URL` (`z.url().optional()`), `LLM_API_KEY` (`z.string().optional()`), `LLM_MODEL` (`z.string().default("gpt-4o-mini")`) — all optional, empty string counts as unset (existing `emptyStringAsUndefined` behavior).
  - `llmEnabled(): boolean` from `@repo/api/llm/config` — true only when both `LLM_BASE_URL` and `LLM_API_KEY` are set.

- [ ] **Step 1: Write the failing test**

`packages/api/test/llm-config.test.ts`: mock the `@repo/env` module (`vi.mock`) with three fixtures — both set (→ `llmEnabled()` true), only `LLM_BASE_URL` (→ false), neither (→ false).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/api test llm-config`
Expected: FAIL — `@repo/api/llm/config` does not exist.

- [ ] **Step 3: Implement**

Add the three vars to the server block of `packages/env/src/index.ts` using the same zod style as `TEAMS_*`. Create `packages/api/src/llm/config.ts` exporting `llmEnabled()` that reads `env` at call time (not module load, so the test can mock it).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/api test llm-config`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/env/src/index.ts packages/api/src/llm/config.ts packages/api/test/llm-config.test.ts packages/api/package.json
git commit -m "feat: LLM env config and availability check (F34)"
```

---

### Task 3: LLM client

**Files:**
- Create: `packages/api/src/llm/client.ts`
- Create: `packages/api/test/llm-client.test.ts`

**Interfaces:**
- Consumes: `env` from `@repo/env` (read at call time).
- Produces (consumed by this plan's Task 5 and by plans 2–3):
  - `class LlmError extends Error`
  - `complete(input: { system: string; prompt: string }, options?: { maxTokens?: number }): Promise<string>` — POST `{env.LLM_BASE_URL}/chat/completions` with `Authorization: Bearer {env.LLM_API_KEY}` and body `{ model: env.LLM_MODEL, messages: [{ role: "system", content: input.system }, { role: "user", content: input.prompt }], max_tokens: options?.maxTokens }`; returns `choices[0].message.content` trimmed; throws `LlmError` on a non-2xx response, a fetch rejection, or empty content. 30 s abort timeout.

- [ ] **Step 1: Write the failing tests**

`packages/api/test/llm-client.test.ts` with a fake `fetch` injected (module reads `globalThis.fetch`; the test stubs it):
- success: returns the mocked `choices[0].message.content` (assert it is trimmed); the captured request has the right URL, bearer header, `model` and the two messages in order.
- non-2xx (500): rejects with `LlmError`.
- fetch rejection (network down): rejects with `LlmError`.
- empty content (`"  "`): rejects with `LlmError`.
- env not set (mocked env without key): rejects with `LlmError` without calling fetch.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/api test llm-client`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `complete` in `packages/api/src/llm/client.ts`**

One native `fetch` call with `AbortSignal.timeout(30_000)`; parse the JSON body and map every failure path to `LlmError` (message generic — never include the URL or key).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/api test llm-client`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/llm/client.ts packages/api/test/llm-client.test.ts
git commit -m "feat: OpenAI-compatible LLM client (F34)"
```

---

### Task 4: e2e llm-mock service

**Files:**
- Create: `e2e/llm-mock/server.mjs`
- Modify: `e2e/ports.env`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: the mock-service pattern of `e2e/teams-mock/server.mjs` (plain `node:http`, env-configured port) and the compose `teams-mock` block.
- Produces (consumed by this plan's Task 7 and by plans 2–3):
  - ports.env: `LLM_PORT=18084`, `LLM_BASE_URL=http://llm.localhost:18084/v1`, `LLM_API_KEY=***
  - mock contract: `POST /v1/chat/completions` — 401 unless `Authorization: Bearer e2e-llm-key`; if the user message contains `LLM_FAIL` → 500 `{"error":"mock failure"}`; otherwise 200 with `choices[0].message.content = "MOCKLLM: " + (user message first 60 chars)`. `GET /__last` returns the last received request body (tests assert on prompt content).

- [ ] **Step 1: Write `e2e/llm-mock/server.mjs`**

Mirror the `teams-mock` structure (env: `PORT`, `API_KEY`); implement the contract above, including the in-memory `lastBody`.

- [ ] **Step 2: Wire env and compose**

Add the three lines to `e2e/ports.env`. In `docker-compose.yml`: add the `llm-mock` service copied from the `teams-mock` block (`profiles: [e2e]`, mounts `./e2e/llm-mock/server.mjs:/srv/server.mjs:ro`, `PORT: ${LLM_PORT:-18084}`, `API_KEY: ${LLM_API_KEY:-e2e-llm-key}`, port mapping) and add `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` to the env of the `admin`, `web` and `worker` services.

- [ ] **Step 3: Verify the mock standalone**

Run (background the server, then curl, then kill):
`node e2e/llm-mock/server.mjs` (with `PORT=18099 API_KEY=*** exported)
- `curl -s -o /dev/null -w '%{http_code}' -X POST localhost:18099/v1/chat/completions -d '{}'` → `401`
- same with the right bearer and a normal body → `200` and body contains `"MOCKLLM:"`
- body containing `LLM_FAIL` → `500`
- `curl -s localhost:18099/__last` → the last request body

- [ ] **Step 4: Verify compose config parses**

Run: `COMPOSE_FILE=docker-compose.yml docker compose --profile e2e config -q`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add e2e/llm-mock/server.mjs e2e/ports.env docker-compose.yml
git commit -m "feat: e2e llm-mock service (F34)"
```

---

### Task 5: Draft server function and prompt builder

**Files:**
- Create: `packages/api/src/events/description-draft.ts`
- Create: `packages/api/test/description-draft.test.ts`
- Modify: `packages/api/package.json` (exports)

**Interfaces:**
- Consumes: `complete`, `LlmError` (Task 3), `llmEnabled` (Task 2), the zod schemas and auth pattern of `packages/api/src/events/mutations.ts` / `packages/api/src/admin/mutations.ts`.
- Produces (consumed by Task 7):
  - `buildDescriptionPrompt(input: { title: string; keywords?: string; typeLabel?: string; facultyLabel?: string }): { system: string; prompt: string }` — pure; the prompt mentions only those four values (Review Focus 5).
  - `createDescriptionDraftServer` — `createServerFn({ method: "POST" })`, validator `z.object({ title: z.string().min(1).max(200), keywords: z.string().max(500).optional(), typeLabel: z.string().max(100).optional(), facultyLabel: z.string().max(100).optional() })`, same auth/role guard as `createAdminEventServer` (organizer or above). Returns `{ draft: string }` — trimmed and truncated to 5000. Domain errors: `llm_unavailable` when `!llmEnabled()`; `llm_error` (generic) on `LlmError`.

- [ ] **Step 1: Write the failing tests**

`packages/api/test/description-draft.test.ts` (mock `@repo/api/llm/client` and `@repo/api/llm/config`):
- `buildDescriptionPrompt`: output contains the title, keywords and both labels; a prompt built from `{ title: "Test" }` contains none of `jan@uni.test`, `"Kowalski"`.
- disabled (`llmEnabled` false): the handler rejects with the `llm_unavailable` domain error; `complete` is never called.
- success: returns `{ draft }` equal to the mock output trimmed; a 6000-char mock output comes back as exactly 5000 chars (Review Focus 4).
- `LlmError` from the client: rejects with `llm_error` (Review Focus 2).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/api test description-draft`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Follow the module structure of `packages/api/src/events/mutations.ts` (zod validator, session/role guard, `withDomainErrors` from `packages/api/src/errors.ts` — check the exact helper names there).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @repo/api test description-draft`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/events/description-draft.ts packages/api/test/description-draft.test.ts packages/api/package.json
git commit -m "feat: event description draft server function (F34)"
```

---

### Task 6: e2e spec for F34 (failing first)

**Files:**
- Create: `e2e/tests/f34-pomocnik-opisow.spec.ts`

**Interfaces:**
- Consumes: the admin login flow and event-form navigation used by `e2e/tests/f33-sesje.spec.ts` / `f3-szkic-i-publikacja.spec.ts`; the llm-mock contract (Task 4).
- Produces: the `[F34]` acceptance tests Task 7 must make pass.

- [ ] **Step 1: Write the spec**

Four tests (Polish titles, same style as the existing specs):
1. `[F34] Organizator generuje opis z tytułu i słów kluczowych` — as organizer, open the new-event form, set title "Seminarium o sieciach neuronowych" and keywords "ML", click "Generuj opis" (accessible name), wait, assert the description textarea contains `MOCKLLM`, save, assert the published event page shows the description.
2. `[F34] Generowanie nad istniejącym opisem wymaga potwierdzenia` — type "Moja treść" into the description, click generate, assert the confirm dialog appears, cancel → textarea still "Moja treść"; confirm → textarea contains `MOCKLLM`.
3. `[F34] Błąd LLM nie psuje formularza` — title containing `LLM_FAIL`, click generate, assert an error toast with the generic AI message and the textarea untouched; the form still saves.
4. `[F34] Do LLM trafiają tylko publiczne dane wydarzenia` — after test 1's generation, `GET {LLM_BASE_URL without /v1}/__last` (via the host, port from `e2e/ports.env`): the user message contains the title and keywords and does NOT contain the organizer's e-mail or name (Review Focus 5 pin).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm e2e:up && pnpm exec playwright test tests/f34-pomocnik-opisow.spec.ts`
Expected: FAIL — "Generuj opis" button not found (the UI does not exist yet).

- [ ] **Step 3: Commit the failing spec**

```bash
git add e2e/tests/f34-pomocnik-opisow.spec.ts
git commit -m "test: failing e2e for F34 assisted descriptions"
```

---

### Task 7: Admin form button

**Files:**
- Create: `apps/admin/src/components/generate-description-button.tsx`
- Modify: `apps/admin/src/components/event-form-dialog.tsx` (description field block, ~line 425)
- Modify: `packages/i18n/messages/pl.json`, `packages/i18n/messages/en.json`

**Interfaces:**
- Consumes: `createDescriptionDraftServer` (Task 5); `llmStatusServer` — add it here as `createServerFn({ method: "GET" }).handler(() => ({ enabled: llmEnabled() }))` in `packages/api/src/llm/status.ts` with an exports entry; the TanStack Form `useForm` API already used in `event-form-dialog.tsx`; Paraglide messages from `@repo/i18n/paraglide/messages`.
- Produces: the UI behavior the e2e spec (Task 6) asserts.

- [ ] **Step 1: Add i18n keys and compile**

Keys in both files (pl / en):
- `admin_button_generate_description`: "Generuj opis" / "Generate description"
- `admin_confirm_replace_description_title`: "Zastąpić opis?" / "Replace description?"
- `admin_confirm_replace_description_body`: "Pole zawiera już treść. Wygenerowany opis ją zastąpi." / "The field already has text. The generated description will replace it."
- `admin_error_ai`: "Generowanie nie powiodło się. Spróbuj ponownie." / "Generation failed. Try again."

Run: `pnpm messages:compile`
Expected: exit 0; the four keys exist in `apps/admin/src/paraglide/messages.js` (generated — do not hand-edit).

- [ ] **Step 2: Create `llmStatusServer`**

`packages/api/src/llm/status.ts`: `export const llmStatusServer = createServerFn({ method: "GET" }).handler(() => ({ enabled: llmEnabled() }));` plus the exports entry in `packages/api/package.json`.

- [ ] **Step 3: Implement `generate-description-button.tsx`**

The component takes the form's description field (value + setter, same shape the form already passes to its fields) plus the title/keywords/type/faculty values from form state:
- `useQuery` on `llmStatusServer` (query key `["llm", "status"]`); render nothing while pending or when `enabled` is false (Review Focus 1).
- Button `type="button"`, loading state while the mutation is pending (disabled + busy label), calls `createDescriptionDraftServer` with the current form values.
- On success: description empty → set the value to the draft; non-empty → open a confirm dialog (reuse the confirm-dialog pattern already present in the admin app — check `apps/admin/src/components/`; if none, an inline two-button confirm) — confirm sets the value, cancel leaves it (Review Focus 3).
- On `llm_error`: `toast.admin_error_ai()` via the existing sonner setup (Review Focus 2).
- Mobile-first at 360 px: the button sits under the description textarea, full width.

- [ ] **Step 4: Wire it into `event-form-dialog.tsx`**

Render `<GenerateDescriptionButton …>` right after the description `form.Field` block, passing the needed field values.

- [ ] **Step 5: Run the e2e spec**

Run: `pnpm e2e:up && pnpm exec playwright test tests/f34-pomocnik-opisow.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/llm/status.ts packages/api/package.json apps/admin/src/components/generate-description-button.tsx apps/admin/src/components/event-form-dialog.tsx apps/admin/src/paraglide/ packages/i18n/messages/
git commit -m "feat: generate description button in the event form (F34)"
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
Expected: all specs pass, including `[F34]`.

- [ ] **Step 3: Update the ledger**

Check off Tasks 1–8 in this file and append a verification summary (commands run, results, any findings) above the footer.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-11-23-pomocnik-opisow.md
git commit -m "docs: verification summary for F34 assisted descriptions"
```
