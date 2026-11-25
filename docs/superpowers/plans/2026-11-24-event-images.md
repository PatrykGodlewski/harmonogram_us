# Auto-generated event cover images — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every event gets an automatically generated cover image that matches the mood of its title and description. The image does not need to be accurate or polished — it gives a feel for the event at a glance. Speed and low cost over quality. User request (24.11): "Generate an image for each event from its description".

**Scope note:** no F# — a user-requested feature outside the product-spec F# universe (do not add a spec table row, do not title this plan `# … (F<N>)`). Per the user's spec, verification is unit tests + a sample-image script, not a `[Fn]` Playwright test.

## Global constraints (read before any task)

- **Parallel sessions share this checkout.** Session `20261123_233247_cb94da18` (repo tooling plan `2026-11-23-narzedzia-agentow.md`) runs `claude -p` children here, and another agent owns the uncommitted "szczegoly punktu" work (agenda item details, migration 0040).
  - **Path-scoped commits only:** `git add` exactly the files of the task; never `git add -A`/`-a`, never stage or modify files outside the task's list.
  - **Never touch** the parallel sessions' files: `packages/db/src/migrations/0040_agenda_item_details.sql`, `packages/db/src/migrations/meta/0040_snapshot.json`, `packages/db/src/schema/agenda.ts`, `packages/db/src/queries/agenda-*.ts`, `packages/db/src/queries/event-duplicate.ts`, `packages/api/src/admin/materials.ts`, `packages/api/src/errors.ts`, `packages/api/src/files/*`, `packages/api/src/storage/s3.ts`, `packages/api/test/storage.test.ts`, `apps/admin/src/components/admin-event-detail/agenda-item-*.tsx`, `apps/{web,admin}/src/routes/api/agenda-items/`, `packages/ui/*`, `e2e/tests/f18-*`, `docs/superpowers/plans/2026-11-24-szczegoly-punktu.md`, and the root `scripts/doctor.mjs`/`scripts/generate-status.mjs` family.
  - **Hold rule for shared files:** `packages/db/src/migrations/meta/_journal.json`, `apps/web/src/routeTree.gen.ts`, `apps/admin/src/routeTree.gen.ts`, `packages/i18n/messages/pl.json`, `packages/i18n/messages/en.json`, root `package.json`. Before committing one of these, check `git diff HEAD -- <file>`: if the diff contains **only** this plan's changes, commit it; if it also contains another session's uncommitted work, **leave it uncommitted** (the working-tree change stays in place for its owner) and list it in the report as "held".
- **No new npm dependencies.** Anthropic, fal and Cloudflare are plain HTTPS calls via global `fetch` (Node ≥22 has it). Storage reuses `packages/api/src/storage/s3.ts` (`putObject`, `presignDownload`).
- **No push.** The parent lands everything on `main` after final verification.
- **GPG quirk:** if `git commit` fails with a 1Password/GPG signing error, retry `git -c commit.gpgsign=false commit` (keep the message) and note in the report that the commit is unsigned.
- **Never write seat-count tables or registration data**; this feature only touches `events` rows, the image queue and image objects.
- Enqueue jobs **inside the data transaction** (pg-boss `fromDrizzle`), same pattern as e-mails (`docs/data-flows.md`).
- Biome: tabs, double quotes. `@repo/api` exports are wildcarded (`./*` → `./src/*.ts`) — new subpaths need no `package.json` edit. No barrel/index files.

## Decisions

- **Columns on `events`** (migration 0041 — 0040 belongs to the parallel session; do not modify it): `image_url` (text), `image_prompt` (text), `image_seed` (integer), `image_status` (text, check `IN ('pending','ready','failed')`, null = never generated), `image_source_hash` (text), `image_key` (text — storage object key; **beyond the user's field list, required** to sign/serve; report it). All nullable, no defaults.
- **URL:** `image_url` is always the app route `/api/event-images/{eventId}` (no signed data in the DB). New route in both apps (one file each): reads the event (web: only if the event is open to the viewer, reuse `packages/api/src/events/access.ts`; admin: managers), then 302s to `presignDownload` (inline) when S3 is configured, or streams the bytes from the local dir otherwise.
- **Local storage fallback:** env `EVENT_IMAGE_DIR` (default `data/event-images` resolved from cwd; `pnpm dev` runs from the repo root, so `data/event-images` there — add `data/` to `.gitignore`). When `storageConfig()` is null, images are written there as `{key}` files and served from the same route.
- **Pipeline:**
  1. **Prompt** — Anthropic Messages API (`https://api.anthropic.com/v1/messages`), model `claude-haiku-5-5` (env override `EVENT_IMAGE_MODEL`), `max_tokens: 150`, the exact system prompt from the user spec, user content = title + description (any language, incl. Polish). In code: append the style suffix (env `EVENT_IMAGE_STYLE`, default `flat editorial illustration, soft grain, wide composition, no text, no lettering, no watermark`). **Fallback** if the LLM call fails (after its own retry is not required — one attempt, any failure triggers fallback): `atmospheric scene for <title with digits and quotes removed>, <style suffix>`.
  2. **Image** — provider interface `generateImage(prompt, { seed, width: 1024, height: 576 }) → { bytes, mimeType }`, selected by env `IMAGE_PROVIDER` (`fal` default | `cloudflare`):
     - `fal`: `fal-ai/flux/schnell` at `https://fal.run/fal-ai/flux/schnell`, header `Authorization: Key *** key `FAL_KEY`, body with `prompt`, `image_size` landscape 16:9 (1024×576 where the model supports it), `seed`; response `image.url` → download bytes. Verify the current request/response shape in the fal docs before coding.
     - `cloudflare`: Workers AI `@cf/black-forest-labs/flux-1-schnell`, `POST https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`, header `Authorization: Bearer {CLOUDFLARE_API_TOKEN}`, body `prompt`, `width`, `height`, `seed`; the response body **is** the PNG bytes. Verify in the Cloudflare docs before coding.
     - Use the provider's default step count for schnell. **Random 32-bit seed per generation, saved on the event.** 30 s timeout per attempt (`AbortSignal.timeout`), **1 retry** on network/5xx.
  3. **Store** — `putObject` (S3) or file write (local dir), key `event-images/{eventId}/{uuid}`.
  4. **Save** — update the event row: `image_url`, `image_prompt`, `image_seed`, `image_status = 'ready'`, `image_source_hash`.
- **Hash:** sha256 hex of `title + "\n" + (description ?? "") + "\n" + styleSuffix` (node:crypto). Only regenerate when it changes (or forced).
- **When:** after event create and after any update, **inside the transaction** via a hook argument on the db functions (the `RegistrationHooks` pattern — `@repo/db` must not import `@repo/jobs`; pass an optional `onImageSourceChanged(tx, eventId)` hook from the mutation layer). Condition: `EVENT_IMAGE_ENABLED` (default true, `z.enum(["true","false"])` — **never `z.coerce.boolean()`**, it turns `"false"` into true) and a provider is configured (ANTHROPIC_API_KEY + (`FAL_KEY` or both CLOUDFLARE vars)) and the new hash ≠ stored hash and status is not already `pending` for the same hash. The hook sets `image_status='pending'` + new hash in-tx and enqueues `{ eventId, force: false }` on a new queue `event-images`.
- **Worker** (`apps/worker/src/handlers/event-image.ts`): load the event; if not force and the stored hash ≠ current hash, recompute the prompt from the **current** values (stale-queue safety); build prompt → generate → store → update row (`ready` + fields) or set `failed` on provider error (image stays placeholder). Never throws unhandled. On replacement, the old `image_key` goes to `stored_file_deletions` (same trigger pattern as `event_files` — add a trigger on `events` in migration 0041 for delete and for `image_key` change; the existing `delete-stored-files` worker gets a local-dir branch when S3 is off).
- **Regenerate action:** new admin server function `regenerateEventImage` (event organizer/manager, same middleware as `updateAdminEventServer` in `packages/api/src/admin/mutations.ts`), **rate-limited 10/hour/user** via the existing `app_rate_limits` machinery (`packages/db/src/queries/rate-limits.ts` — read it first; if the existing helper doesn't fit, an upsert on `app_rate_limits` in the same style). Sets `pending` and enqueues `{ eventId, force: true }` (worker picks a fresh seed).
- **Env** (add to `packages/env/src/index.ts` server schema + `.env.example`, with comments): `ANTHROPIC_API_KEY` (optional), `IMAGE_PROVIDER` (`fal`|`cloudflare`, default `fal`), `FAL_KEY` (optional), `CLOUDFLARE_ACCOUNT_ID` (optional), `CLOUDFLARE_API_TOKEN` (optional), `EVENT_IMAGE_STYLE` (optional, code default above), `EVENT_IMAGE_ENABLED` (default `"true"`), `EVENT_IMAGE_DIR` (optional), `EVENT_IMAGE_MODEL` (default `claude-haiku-5-5`).
- **Feature off / provider unconfigured:** create/update succeed unchanged, nothing is enqueued, `image_status` stays null, UI shows the placeholder, regenerate answers a `DomainError` (new code, e.g. `EVENT_IMAGE_DISABLED` — extend `packages/api/src/errors.ts` **only if** the parallel session's uncommitted diff is not in that file at commit time, else hold and report).
- **UI:** image (16:9, `object-cover`) where events are shown; neutral placeholder while `pending`/`failed`/never (match the existing placeholder style of the agenda item page — pixel checkerboard band — reuse its look, do not import their untracked component). Admin: image + status + "regenerate" button for managers (disabled while pending).
- **Event duplication:** no change to `event-duplicate.ts` (owned by the parallel session) — a copy goes through `createEvent` and gets its own generated image like any new event.

## File map

**New:**
- `packages/db/src/migrations/0041_*.sql`, `packages/db/src/migrations/meta/0041_snapshot.json`
- `packages/db/src/queries/event-images.ts` (hash/status helpers, `markImagePending`, `setEventImage`, `failEventImage`)
- `packages/api/src/event-images/prompt.ts`, `providers.ts`, `store.ts`, `pipeline.ts`, `serve.ts`, `regenerate.ts`
- `packages/api/test/event-images-prompt.test.ts`, `event-images-providers.test.ts`, `event-images-flow.test.ts`
- `apps/worker/src/handlers/event-image.ts`
- `apps/web/src/routes/api/event-images/$eventId.ts`, `apps/admin/src/routes/api/event-images/$eventId.ts`
- `packages/api/scripts/generate-sample-event-images.ts`
- `docs/superpowers/plans/2026-11-24-event-images.md` (this file)

**Edited (owned by this plan unless marked HOLD):**
- `packages/db/src/schema/events.ts`, `packages/db/src/queries/events.ts` (hook params on create/update + expose new fields on the event rows the UI queries — check which queries feed web list, web detail and admin detail)
- `packages/api/src/admin/mutations.ts` (wire the image hook into the create/update server functions)
- `packages/jobs/src/queues.ts` (`QUEUE_EVENT_IMAGES` + payload schema + `enqueueEventImage`), `apps/worker/src/index.ts` (`boss.work`)
- `apps/worker/src/handlers/delete-stored-files.ts` (local-dir branch)
- `packages/env/src/index.ts`, `.env.example`, `.gitignore`
- web UI: event list card + event detail (find the existing card/detail components under `apps/web/src`); admin UI: `apps/admin/src/components/admin-event-detail/` (event summary/detail)
- `packages/api/src/errors.ts` (only the new DomainError code — HOLD rule applies, the parallel session edits this file)
- HOLD: `packages/db/src/migrations/meta/_journal.json`, `apps/web/src/routeTree.gen.ts`, `apps/admin/src/routeTree.gen.ts` (regenerated by the router when the new route files land — expected), `packages/i18n/messages/{pl,en}.json` (placeholder + regenerate strings, pl **and** en, then `pnpm messages:compile`), root `package.json` (one script: `"sample:event-images": "pnpm --filter @repo/api exec node scripts/generate-sample-event-images.ts"`)

## Findings

(facts corrected during execution land here, with the task that needed correcting — children read this section before their task)

- **fal API verified (24.11, fal.ai model page):** `POST https://fal.run/fal-ai/flux/schnell`, header `Authorization: Key *** value of `FAL_KEY` — **not** `Bearer`), JSON body: `prompt` (required), `image_size` — pass the object form `{ "width": 1024, "height": 576 }` (the enum `landscape_16_9` also exists), `seed` (integer; the response echoes the seed used), `output_format: "png"`; leave `num_inference_steps` at its default (4). Response JSON: `images: [{ url, content_type }]` — GET `images[0].url` to download the bytes — plus `seed`, `prompt`, `timings`.
- **Cloudflare verified (24.11):** the old docs path (`workers-ai/models/text-to-image/flux-1-schnell`) is gone; the current page is `developers.cloudflare.com/workers-ai/models/flux-1-schnell/`. `POST https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`, header `Authorization: Bearer {CLOUDFLARE_API_TOKEN}`, JSON body `{ prompt, width: 1024, height: 576, seed }`; the HTTP response **is** the image bytes (`application/octet-stream`). Default step count (the page documents no step parameter — do not send one).
- **Anthropic:** Messages API `POST https://api.anthropic.com/v1/messages`, headers `x-api-key: *** ANTHROPIC_API_KEY>` and `anthropic-version: 2023-06-01`; body `{ model, max_tokens: 150, system, messages: [{ role: "user", content }] }` → `content[0].text`. Model `claude-haiku-5-5` is from the user spec (verify only at run time, not in tests).

## Tasks

### Task 1: Data layer — migration 0041, schema, queries, db tests

Requirements: the columns and check from Decisions; a trigger on `events` recording `image_key` into `stored_file_deletions` on delete and on change (pattern: the `event_files` trigger in migration 0040 territory / F14); query helpers in `queries/event-images.ts`; new fields exposed on the event rows returned to the UI (web list, web detail, admin detail — find the exact query functions, no new query surface beyond that).

Acceptance: `pnpm db:generate` produces exactly one new migration (0041) — its SQL inspected and sane; `pnpm db:migrate` applies to the dev DB; `pnpm --filter @repo/db test` passes (the test global-setup migrates `harmonogram_us_test` from the working-tree journal, which already contains the parallel session's 0040 — that is expected locally).

- [ ] Write the db test first (migrate applies; a new event has null image fields; `markImagePending`/`setEventImage`/`failEventImage` transitions; the deletion trigger records the old key), observe failure.
- [ ] Schema change, `pnpm db:generate`, inspect SQL, trigger, queries; `pnpm --filter @repo/db test` passes.
- [ ] Commit (message: `feat(db): event cover image columns and deletion tracking`). `_journal.json` and the schema files of the parallel session: HOLD rule.

### Task 2: Pipeline — prompt, providers, storage, queue, worker, regeneration

Requirements: Decisions "Pipeline", "When", "Worker", "Regenerate action", "Env". New queue `event-images` in `@repo/jobs/queues.ts` (payload `{ eventId, force }` zod schema), worker handler registered in `apps/worker/src/index.ts`, hook wiring in `packages/api/src/admin/mutations.ts` for create and update, `regenerateEventImage` server function with the 10/hour/user rate limit, env vars in `@repo/env` and `.env.example`.

Acceptance: unit tests pass with the LLM and providers **mocked** (inject `fetch`/deps like `store.ts` does — follow the existing `deps`-injection pattern):
- prompt: style suffix appended; LLM failure → fallback prompt (`atmospheric scene for <cleaned title>, <suffix>`); `sourceHash` stable for equal inputs, changes when any of title/description/suffix changes;
- providers: correct request shape per provider (assert URL, headers, body), seed passed through, one retry on 5xx, timeout honoured (fake or short timeout), bytes returned;
- flow (real `harmonogram_us_test` DB, mocked provider): create event with changed hash → status `pending` + job enqueued; worker run with ok provider → `ready`, url/seed/prompt/hash stored; with failing provider → `failed`; unchanged hash → no enqueue; `force` regenerates with a new seed;
- regenerate server function: unauthorized (non-organizer) refused; 11th call within an hour refused.

- [ ] Tests first, observe failure.
- [ ] Implement; `pnpm --filter @repo/api test`, `pnpm --filter @repo/jobs typecheck`, `pnpm --filter @repo/worker typecheck` (or the package's own commands) pass.
- [ ] Commit (message: `feat(api): event image prompt, providers and queue` — split into a second commit `feat(worker): event image generation handler` if the diffs are cleaner that way).

### Task 3: UI — image in web and admin, placeholder, regenerate button, i18n

Requirements: Decisions "UI" + "URL". The serving route in both apps (web with the event-access check, admin for managers); web: image with placeholder on the event list card and the event detail page; admin: image + status + regenerate button wired to `regenerateEventImage` (managers only, disabled while pending); i18n strings in **both** `pl.json` and `en.json` following the existing key conventions, `pnpm messages:compile`.

Acceptance: `pnpm --filter @repo/web lint typecheck` and the same for `@repo/admin` pass; both builds succeed (`pnpm --filter @repo/web build`, `pnpm --filter @repo/admin build` — or the repo's build command); the new route files land and `routeTree.gen.ts` is regenerated (HOLD rule for committing it); i18n keys present in both locales.

- [ ] Implement + compile; lint/typecheck/build pass.
- [ ] Commit (message: `feat(web): event cover image with placeholder` / `feat(admin): cover image and regenerate action`). Held files listed in the report.

### Task 4: Sample script, `.env.example`, docs

Requirements: `packages/api/scripts/generate-sample-event-images.ts` — runs these five sample events through the **full pipeline** (real LLM + real provider, no DB) and writes the images plus `prompts.txt` (per event: title, final prompt, seed, provider, status, any error) to `data/sample-event-images/`:
1. "Jazz night in a Kazimierz basement bar, Friday 20:00, live quartet"
2. "Wieczór planszówek w kawiarni – przynieś ulubioną grę!"
3. "Sunrise 10k charity run along the Vistula, medals for all finishers"
4. "Intro to Rust workshop for backend developers, laptops required"
5. "Summer rooftop techno party, DJs until 4am"

It loads the repo `.env` (same mechanism the tests use — check `@repo/env`/test setup), runs serially (5 images, cost), and exits non-zero on any failed image. Root script `sample:event-images` (root `package.json` — HOLD rule). When a key is missing it fails fast with a readable message naming the missing variable. Also: `.env.example` block (all new vars, commented), and a short section in `docs/development.md` is NOT wanted (the parallel session owns recent edits there — instead document running the script in this plan's verification summary and the final report).

Acceptance: the script runs to completion — with keys present: 5 images + `prompts.txt` on disk (parent inspects them); without keys: the exact missing-variable message. The provider docs were checked (note any shape deviation in Findings).

- [ ] Implement + run (whatever the key situation is) + report output.
- [ ] Commit (message: `feat(scripts): sample event image generator`).

### Final: full checks, land on main (parent)

- `pnpm lint`, `pnpm typecheck` (or the repo equivalents), full unit test run, builds — per `docs/testing.md` for the touched packages.
- Push `next`; merge `next` → `main` the way the repo does it (PR `#40` was "Merge next into main"); verify `origin/main` contains the feature commits.
- Report: files changed, migrations (0041 + trigger), how to run the sample script, estimated cost per image (haiku prompt tokens + flux-schnell price — verify current fal/Cloudflare pricing and note the free daily quota), held files and why, sample images (paths), and the `image_key` extra-column deviation.
