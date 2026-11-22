# File storage, event materials (F14) and speaker files (F19) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Organizers attach files and links to an event, and files to a programme item; people who can open the event page see and download them.

**Architecture:** Files live in an S3-compatible bucket: Cloudflare R2 in production (user: "best international provider"; S3 API, no egress fees, EU jurisdiction available), SeaweedFS in a Docker container for dev and e2e (user: "use docker image for bucket storage"; MinIO's community edition is retired). The app speaks plain S3 through `aws4fetch` (2.5 kB, signs requests and presigned URLs), so any S3 provider works. Uploads go through an admin server function (FormData; the server checks size, type and count, so the bucket needs no CORS and no public access). Downloads go through `/api/files/{id}` on web (event page rules) and admin (event managers), which answer with a 302 to a 60-second presigned GET carrying `Content-Disposition: attachment`. Rows live in `event_files`; a trigger records the storage key of every deleted row (also cascades from deleted events and programme items) in `stored_file_deletions`, and a worker cron removes those objects.

**Tech Stack:** Drizzle/Postgres (trigger via custom migration), aws4fetch, TanStack Start server functions and server routes, pg-boss cron, React, Paraglide, Playwright; SeaweedFS `chrislusf/seaweedfs` pinned by digest (single `weed mini` container: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`).

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md` — F14 „Pliki i linki przy wydarzeniu. Gotowe, gdy dodany plik i link widać na stronie wydarzenia, a pobrany plik ma tę samą zawartość”; F19 (file part) „wystąpienie z prelegentem i plikiem jest na stronie wydarzenia”. F22 (logo, header image, sub-pages) is the next plan on the same storage. Decisions are the architect's (user delegated decisions).

## Decisions

- Config (server-only; files are off and the panel hides upload unless all are set): `S3_ENDPOINT` (e.g. `https://<account>.r2.cloudflarestorage.com`, dev `http://localhost:8333`), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` (default `auto`). Path-style URLs `{endpoint}/{bucket}/{key}`. One endpoint for the server and the browser: e2e reaches the container as `storage.localhost:18083` from both, like the OIDC and Teams stand-ins.
- Files: at most 25 MB each, at most 50 per event. Allowed by extension (the server sets the content type, never the client's): pdf, doc, docx, ppt, pptx, xls, xlsx, odt, odp, ods, txt, csv, png, jpg, jpeg, webp, zip. Names: base name only, control characters removed, at most 200 characters, kept for display and download. Key `events/{eventId}/{uuid}` (no user text in keys).
- A file belongs to the event, optionally to one programme item (F19). Upload order: put object, then insert the row; if the insert fails, delete the object (on failure record it in `stored_file_deletions`).
- Event-level links: `events.materials` jsonb `{ label, url }[]` (the same shape as programme-item links), at most 30, `http(s)` only, edited in the panel's "Materiały" card. Programme-item links stay in the programme-item dialog.
- Who sees files: whoever can open the event page (draft only for its managers in the panel). Invite-only events: links carry the page's `invite` secret. Downloads are `attachment` from the bucket's origin, so an uploaded HTML or SVG never runs on our domain.
- Duplicating an event copies links (already true for programme items), not files.
- Out of scope: inline preview, uploads by speakers themselves, per-file visibility, virus scanning, image thumbnails.

## Global Constraints

- TDD; `[F14]` and `[F19]` Playwright tests seen failing first; admin screens phone first (360 px).
- UI text pl/en + `pnpm messages:compile`; `@repo/env` only, bucket keys never reach the browser; no barrel files; Biome; migrations through `db:generate` (`--custom` for the trigger).

## Review Focus

- A file of a draft, signed-in-only or invite-only event must not be downloadable by someone who cannot open that event page (guessing a file id is not enough).
- Oversized, disallowed or misnamed uploads (`../x.pdf`, `x.html`, a 26 MB file, the 51st file) are refused before anything is stored.
- Only managers of the event (not check-in helpers) can upload or delete; a file id from another event cannot be deleted through this one.
- No stored object outlives its row: deleting a file, a programme item or a whole event leads to deleting the objects.
- Presigned URLs are short-lived and carry `attachment` with a safely encoded (Polish) filename.

---

### Task 1: Storage client, config, SeaweedFS in compose

**Files:**
- Create: `packages/api/src/storage/s3.ts` — `storageConfig(): StorageConfig | null`, `putObject(config, key, body: ArrayBuffer, contentType): Promise<void>`, `deleteObject(config, key): Promise<void>` (404 counts as deleted), `presignDownload(config, key, filename, expiresSeconds = 60): Promise<string>`; `contentDisposition(filename): string` (ASCII fallback + RFC 5987 `filename*`).
- Modify: `packages/env/src/index.ts`, `.env.example`, `docker-compose.yml` (`storage` service, dev port 8333, volume; e2e alias `storage.localhost`), `e2e/ports.env`, `packages/api/package.json` (aws4fetch, export).
- Test: `packages/api/test/storage.test.ts` (global fetch stub): PUT to `{endpoint}/{bucket}/{key}` with an AWS4 `authorization` header and the content type; throws on non-2xx with the status only; delete treats 404 as done; presigned URL has `X-Amz-Expires=60`, `X-Amz-Signature`, `response-content-disposition`; `contentDisposition("Prezentacja żółć.pdf")` gives `attachment; filename="Prezentacja zolc.pdf"; filename*=UTF-8''Prezentacja%20%C5%BC%C3%B3%C5%82%C4%87.pdf`; `storageConfig()` null when incomplete.
- [x] Red, implement, green. Commit `feat(api): s3 storage client and local seaweedfs`.

### Task 2: Files and links in the database

**Files:**
- Create: `packages/db/src/schema/event-files.ts` (`eventFiles {id, eventId fk cascade, agendaItemId fk cascade null, name, contentType, size, storageKey unique, createdAt}`, index `(event_id, created_at)`; `storedFileDeletions {storageKey pk, createdAt}`), `packages/db/src/queries/event-files.ts` — `addEventFile(input)` (EVENT_FILES_LIMIT past 50; the programme item must belong to the event → NOT_FOUND), `listEventFiles(eventId)`, `deleteEventFile(eventId, id)` (null when not in that event), `getEventFile(id)`, `setEventMaterialLinks(eventId, links)`, `takeStoredFileDeletions(limit)`, `forgetStoredFileDeletions(keys)`, `recordStoredFileDeletion(key)`.
- Modify: `events.ts` schema (`materials` jsonb default `[]`), `getEventById` (adds `materials`, `files: {id, name, size, agendaItemId}[]`), domain errors (`EVENT_FILES_LIMIT`, `FILE_TOO_LARGE`, `FILE_TYPE`, `FILES_NOT_CONFIGURED`) + `app-errors.ts` + messages.
- Migrations: generated table migration; custom migration with the `AFTER DELETE` trigger on `event_files` inserting `OLD.storage_key` into `stored_file_deletions` (ON CONFLICT DO NOTHING).
- Test: `packages/db/test/event-files.test.ts`: add/list in order; limit 50; programme item from another event refused; delete through the wrong event returns null and keeps the row; deleting a file, a programme item, or an event leaves its keys in `stored_file_deletions`; take/forget; links round-trip; `getEventById` carries files and links.
- [x] Red, implement, green. Commit `feat(db): event files and material links`.

### Task 3: Upload, delete, links and download endpoints

**Files:**
- Create: `packages/api/src/files/rules.ts` (`MAX_FILE_BYTES = 25 * 1024 * 1024`, `fileTypeFor(name): string | null`, `cleanFileName(name): string`), `packages/api/src/admin/materials.ts` (`uploadEventFileServer(FormData: eventId, agendaItemId?, file)`, `deleteEventFileServer({eventId, id})`, `eventFilesQueryOptions(eventId)`, `setEventMaterialLinksServer({eventId, links})`, `filesAvailableQueryOptions`), `packages/api/src/files/download.ts` (`fileDownloadResponse(fileId, canSee: (eventId) => Promise<boolean>)` → 302 / 404, `cache-control: private, no-store`), `apps/web/src/routes/api/files/$fileId.ts` (event page rules, reusing the details access check with `?invite=`), `apps/admin/src/routes/api/files/$fileId.ts` (`canManageEvent`).
- Modify: `packages/api/src/events/queries.ts` (extract `canViewEvent(eventId, session, invite)` used by details and download).
- Test: `packages/api/test/file-rules.test.ts` (allowed and refused names, `../../x.pdf` → `x.pdf`, control characters, 200-char cut); `packages/api/test/file-download.test.ts` (unknown id 404, `canSee` false 404, otherwise 302 to the presigned URL with no-store).
- [x] Red, implement, green. Commit `feat(api): event file upload and download`.

### Task 4: Stored-object clean-up job

**Files:**
- Modify: `packages/jobs/src/queues.ts` (`QUEUE_DELETE_STORED_FILES = "delete-stored-files"`, cron `*/15 * * * *`), worker registration.
- Create: `apps/worker/src/jobs/delete-stored-files.ts` (`deleteStoredFiles(deps)`: takes up to 500 keys, deletes each object, forgets those deleted; skipped when storage is not configured).
- Test: `apps/worker/test/delete-stored-files.test.ts` (deleted keys forgotten, a failing delete keeps its key for the next run).
- [x] Red, implement, green. Commit `feat(worker): delete objects of removed files`.

### Task 5: Panel and event page, e2e

**Files:**
- Create: `apps/admin/src/components/admin-event-detail/materials-card.tsx` (files: name, size, programme item, download, delete with confirmation; upload: file input + "Dotyczy" select "Całe wydarzenie" / programme items; links: label + URL, add/remove), `apps/web/src/components/event-details/event-materials.tsx` (section "Materiały": links and event-level files with size).
- Modify: `apps/admin/src/routes/_authenticated/events.$eventId.tsx`, `apps/web/src/components/event-details/agenda-item-row.tsx` (item files next to its links), event summary/details view, messages.
- Test: `e2e/tests/f14-materialy.spec.ts`:
  - `[F14] organizator dodaje plik i link, uczestnik pobiera ten sam plik @organizator` (phone): upload a small PDF and add a link in the panel; on the public page both are listed; the download's bytes equal the uploaded ones; delete in the panel → gone from the page and its download link answers 404; a 26 MB-named `.html` upload is refused with a message; `expectAccessible` of the panel page.
  - `[F14] plik szkicu nie jest dostępny publicznie`: a file of a draft event → its public link 404, the panel link downloads.
  - `[F19] wystąpienie z prelegentem i plikiem jest na stronie wydarzenia`: programme item with a speaker, file uploaded for that item → shown under the item with the speaker, downloads.
- [x] Red, implement, green. Commit `feat: event materials and speaker files (F14, F19)`.

### Task 6: Docs, review, verification

- [x] `docs/development.md` (storage container, R2 setup), `docs/architecture.md` (storage, download flow), `docs/data-flows.md` (deletion trigger), `docs/security.md` if it lists data stores, privacy page sentence if files hold personal data (they do not by design), spec F14 status, F19 status, changelog, `README.md`, `docs/README.md` plan 14.
- [x] Full suite; fresh-context review; fix Critical/Important test-first; verification summary here.

## Verification summary (2026-11-22)

- Commits: d9bc285 (plan) → dffc572 storage client and SeaweedFS → 2873b94 files and links in the database → 8e3d08a upload and download → 7ba905e clean-up job → 1ab3ece panel and event page → 6a049ba docs → 5b998b3 e2e scoping → review fixes.
- After the fixes: `pnpm lint`, `pnpm typecheck`, `pnpm test` (db 262, api 159, worker 24, ui 33, collections 8, rpc 3), `pnpm build` exit 0; `pnpm e2e:up && pnpm e2e` → 196 passed, 1 skipped (the existing intentional skip). Before the fixes: 195 passed, 1 skipped.
- `[F14]`/`[F19]` tests: upload a PDF and add a link in the panel, the visitor downloads the same bytes under the Polish name; deletion removes it from the page and its link answers 404; an `.html` upload is refused with a message; a draft's file is 404 publicly and downloads in the panel; a programme item's file is shown under the item with its speaker; the panel answers 413 to a request announcing 30 MB before reading it; WCAG audit of the panel page.
- Fresh-context review (opus): no Critical. Important, fixed test-first:
  - duplicating an event dropped its own links (`copies the event's own links but not its files (F14)`, RED→GREEN);
  - Start reads a server function's whole body into memory before any check, so any client could send gigabytes → global request middleware `requestSizeMiddleware` on web and admin: 413 above 26 MB, 411 without a length (`request-size.test.ts` RED→GREEN; e2e `panel odrzuca zbyt duże żądanie` failed with 500 on the old build). Start answers server-function requests with its own response status, so the middleware sets it explicitly.
- Rulings: dev/e2e endpoint `storage.localhost:{STORAGE_PORT}` serves server and browser; `storeEventFile` and `canViewEvent` with own tests; panel downloads for managers only; clean-up job in `handlers/`, 20 deletes at a time; no separate files query (event details carry files); e2e refuses by type, size is unit-tested; native select for "Dotyczy"; panel programme section is a labelled region.
- Deferred minors: an object stays orphaned if the process dies between upload and row insert; a programme item of another event is refused only after the upload; `canViewEvent` loads event access twice; `getEventById` makes a separate query for links; concurrent link edits overwrite each other; deleting another event's file id reports success; a worker without S3 settings does not warn; a signed-out visitor following a copied file link of a signed-in-only event gets 404, not a sign-in prompt; a proxy body limit (Railway/Cloudflare) is still advisable as a second layer.
- To switch on in production: Cloudflare R2 bucket with EU jurisdiction, an R2 API token with Object Read & Write on it; `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` on web, admin and worker.
