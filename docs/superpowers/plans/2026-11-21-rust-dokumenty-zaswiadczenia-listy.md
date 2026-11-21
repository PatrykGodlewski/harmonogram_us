# Rust documents service, part 2: certificates, attendance sheets, pdf-lib removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The documents service renders all three PDFs; pdf-lib leaves the codebase; Railway gets an HTTP health check; Grafana shows the service.

**Architecture:** Two additive RPCs on `harmonogram.documents.v1.DocumentService` (`RenderCertificate`, `RenderAttendanceSheet`), Rust ports of `certificates/pdf.ts` and `admin/attendance-sheet-pdf.ts`, TypeScript builds display-ready requests and answers through `pdfResponse` (Plan 7). Pagination lives only in Rust; the page footer comes as a Paraglide template with `{page}`/`{pages}` placeholders.

**Tech Stack:** as Plan 7 (tonic, krilla, Connect-ES, Vitest, Playwright).

**Spec:** [2026-11-21-rust-grpc-uslugi-design.md](../specs/2026-11-21-rust-grpc-uslugi-design.md); Plan 7 (`2026-11-21-rust-dokumenty-bilet.md`) and its verification summary.

## Global Constraints

- Everything in Plan 7's Global Constraints still holds (one renderer per document, display-ready text, 2 000-character fields, no people cap, 5 s deadline, 503 + `Retry-After: 5` on busy, no personal data in logs/labels, `#![forbid(unsafe_code)]`, clippy `-D warnings`).
- Contract changes are additive only (`buf breaking` stays green against `next`).
- Layout values are copied from the TypeScript renderers: certificate A4 landscape 842 × 595, border inset 24 width 2 NAVY, text width 682; sheet A4 portrait 595 × 842, margin 40, row 28, first page 24 rows, then 27, columns x = 40 / 70 / 250 / 430, row line colour (204, 209, 217).
- Colours NAVY (15, 41, 87), GREY (89, 97, 107).

## Review Focus

1. A certificate for a very long name: shrinks then wraps to two lines, never cut while it fits two lines at 14 pt (Task 4 TS test with the 120-character name, unchanged).
2. An attendance sheet with 0 people: one page with the header and "Strona 1 z 1", no panic (Task 2 Rust test).
3. A sheet with thousands of people (2 000): renders within the 5 s deadline on dev hardware (Task 5 TS test, timed).
4. Long names and e-mails stay inside their column (x + width ≤ 250 for names), title inside the margin (Task 5 TS layout test, unchanged).
5. Railway health: `/healthz` answers 200 without a token while gRPC serves, and 503 once shutdown starts (Task 6 Rust test).

---

### Task 1: Certificate in Rust

**Files:**
- Modify: `proto/harmonogram/documents/v1/documents.proto`
- Create: `services/documents/src/certificate.rs`, `services/documents/src/draw.rs` (shared `centered`, colours, `fill`)
- Modify: `services/documents/src/ticket.rs` (use `draw.rs`), `src/lib.rs`

**Interfaces:**
- Produces (proto): `rpc RenderCertificate(RenderCertificateRequest) returns (RenderCertificateResponse)`; `RenderCertificateRequest { string document_title = 1; optional string issuer = 2; string title = 3; string person_label = 4; string name = 5; string intro = 6; string event_title = 7; string date_line = 8; optional string note = 9; optional string signer = 10; string footer = 11; }`; `RenderCertificateResponse { bytes pdf = 1; }`.
- Produces (Rust): `certificate::render(req: &RenderCertificateRequest, fonts: &Fonts) -> Vec<u8>`; `draw::centered(surface, text, y_from_bottom, font, size, color, page_width, page_height)`, `draw::NAVY`, `draw::GREY`.

Layout (port of `certificates/pdf.ts`): border rect; issuer [13,11] 1 line at y 515 grey; title bold 34 at 470; person label 13 grey −56; name bold [26,22,18,14] ≤ 2 lines (−34, then −(size+6) per extra line); −46 intro 13 grey; event title bold [20,17,14] ≤ 3 lines, each −(size+10); −40 date line 14; note [12,10] 1 line at date y − 22; signer [11,9] 1 line width 260, right-aligned at x = 762, y 88, with a 0.75 grey line from x 502 to 762 at y 104; footer 10 grey at 52.

- [ ] **Step 1: Write failing tests** in `certificate.rs`: `one_a4_landscape_page` (lopdf: 1 page, MediaBox `[0 0 842 595]`, title metadata = `document_title`); `renders_without_optional_lines` (issuer/note/signer `None` → parseable); `renders_extreme_text` (2 000-char name of one word, 2 000-char title → parseable).
- [ ] **Step 2: Run** `pnpm rust:test` — Expected: FAIL (not defined).
- [ ] **Step 3: Implement** proto messages, `draw.rs`, `certificate::render`; ticket uses `draw.rs`.
- [ ] **Step 4: Run** `pnpm rust:test && pnpm rust:lint && pnpm proto:lint` — Expected: pass.
- [ ] **Step 5: Commit** `feat(documents): certificate PDF`

### Task 2: Attendance sheet in Rust

**Files:**
- Modify: `proto/.../documents.proto`
- Create: `services/documents/src/sheet.rs`

**Interfaces:**
- Produces (proto): `rpc RenderAttendanceSheet(RenderAttendanceSheetRequest) returns (RenderAttendanceSheetResponse)`; `RenderAttendanceSheetRequest { string document_title = 1; string title = 2; string event_title = 3; string date_text = 4; string no_label = 5; string name_label = 6; string email_label = 7; string signature_label = 8; string page_label_template = 9; repeated Person people = 10; }`, `message Person { string name = 1; string email = 2; }`; `RenderAttendanceSheetResponse { bytes pdf = 1; }`.
- Produces (Rust): `sheet::page_rows(total: usize, first: usize, per_page: usize) -> Vec<usize>`; `sheet::page_label(template: &str, page: usize, pages: usize) -> String` (replaces `{page}` and `{pages}`); `sheet::render(req, fonts) -> Vec<u8>`.

- [ ] **Step 1: Write failing tests**: `page_rows_split` (`page_rows(60,20,25) == [20,25,15]`, `page_rows(0,20,25) == [0]`, `page_rows(24,24,27) == [24]`, `page_rows(25,24,27) == [24,1]`); `page_label_fills_placeholders` (`"Strona {page} z {pages}"`, 2, 3 → `"Strona 2 z 3"`); `empty_sheet_has_one_page` (0 people → 1 page, MediaBox `[0 0 595 842]`); `long_sheet_pages` (45 people → 2 pages; 2 000 people → `page_rows(2000,24,27).len()` pages).
- [ ] **Step 2: Run** `pnpm rust:test` — Expected: FAIL.
- [ ] **Step 3: Implement** (port of `attendance-sheet-pdf.ts`: page 1 title 18 bold, event title bold [13,11] ≤ 2 lines at −18 each, −16 date 10 grey, −28; header row 9 bold grey at the column x's; −8 rule 1 pt grey; rows: number 10, name [10,9,8] width 172, e-mail [9,8] grey width 172, rule 0.5 in the row-line colour every 28; footer 8 grey at x 40, y 20).
- [ ] **Step 4: Run** `pnpm rust:test && pnpm rust:lint && pnpm proto:lint` — Expected: pass.
- [ ] **Step 5: Commit** `feat(documents): attendance sheet PDF`

### Task 3: Serve the new RPCs

**Files:**
- Modify: `services/documents/src/service.rs`, `src/limits.rs`, `tests/server.rs`

**Interfaces:**
- Produces: `limits::check_certificate(&RenderCertificateRequest)`, `limits::check_sheet(&RenderAttendanceSheetRequest)` (every string, including each person's `name`/`email` as `people[i].name`, ≤ 2 000 chars); metrics methods `RenderCertificate`, `RenderAttendanceSheet`.

- [ ] **Step 1: Write failing server tests**: `renders_certificate`, `renders_sheet` (valid token → `%PDF`), `oversize_person_is_invalid_argument` (message contains `people[1].email`), `certificate_requires_token`.
- [ ] **Step 2: Run** `pnpm rust:test` — Expected: FAIL (`Unimplemented`/compile).
- [ ] **Step 3: Implement** both handlers through the same check → admission → `run` → `record` path as the ticket.
- [ ] **Step 4: Run** `pnpm rust:test && pnpm rust:lint` — Expected: pass.
- [ ] **Step 5: Commit** `feat(documents): serve certificates and attendance sheets`

### Task 4: Switch certificates

**Files:**
- Create: `packages/api/src/certificates/document.ts`
- Modify: `packages/api/src/certificates/response.ts`
- Move: `packages/api/test/certificate-pdf.test.ts` → `certificate-document.test.ts`
- Delete: `packages/api/src/certificates/pdf.ts`

**Interfaces:**
- Produces: `CertificateInput` (moved unchanged), `certificateDocumentRequest(input: CertificateInput): RenderCertificateRequest` init shape (Paraglide `certificate_*`, date line `${certificate_date}: ${formatLongDate}`, footer `certificate_footer({ reference })`, document title `${certificate_title} — ${eventTitle}`; empty issuer/note/signer → omitted).

- [ ] **Step 1: Rewrite the four existing certificate tests** to render via `documentsClient().renderCertificate(certificateDocumentRequest(...))` with the same assertions.
- [ ] **Step 2: Run** `pnpm --filter @repo/api test -- certificate-document` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement**; `certificateResponse` keeps its session/query/404 and returns `pdfResponse(..., "zaswiadczenie" | "certificate", certificate.locale)`. Rebuild the service (`docker compose up -d --build documents`).
- [ ] **Step 4: Run** `pnpm --filter @repo/api test && pnpm typecheck` — Expected: pass.
- [ ] **Step 5: Commit** `feat(certificates): render certificates in the documents service`

### Task 5: Switch attendance sheets

**Files:**
- Create: `packages/api/src/admin/attendance-sheet-document.ts`
- Modify: `packages/api/src/admin/attendance-sheet.ts`
- Modify: `packages/api/test/attendance-sheet.test.ts`
- Delete: `packages/api/src/admin/attendance-sheet-pdf.ts`

**Interfaces:**
- Produces: `AttendanceSheetInput` (moved unchanged), `attendanceSheetRequest(input: AttendanceSheetInput): RenderAttendanceSheetRequest` init shape; `page_label_template` = `sheet_page({ page: "{page}", pages: "{pages}" }, { locale })`.

- [ ] **Step 1: Rewrite the tests** to render through the service: drop the `pageRows` case (now `sheet::page_rows_split` in Rust); keep "lists people… on as many pages as needed" (adds `expect(text).toContain("Strona 2 z 2")`) and the layout test unchanged; add `renders 2 000 people within the deadline` (resolves, `totalPages` = 75).
- [ ] **Step 2: Run** `pnpm --filter @repo/api test -- attendance-sheet` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement**; `attendanceSheetResponse` keeps 401/403/404 and sorting, returns `pdfResponse(..., "lista-obecnosci" | "attendance", locale)`.
- [ ] **Step 4: Run** `pnpm --filter @repo/api test && pnpm typecheck` — Expected: pass.
- [ ] **Step 5: Commit** `feat(admin): render attendance sheets in the documents service`

### Task 6: Remove pdf-lib; HTTP health for Railway

**Files:**
- Create: `packages/api/src/documents/dates.ts` (`formatLongDate`, `formatLongDateTime` moved from `pdf/document.ts`, unchanged)
- Delete: `packages/api/src/pdf/` (document.ts, layout.ts, assets), `packages/api/src/types/inline-assets.d.ts` if only fonts used it, `packages/api/test/certificate-layout.test.ts` (covered by Rust `layout` tests)
- Modify: `packages/api/package.json` (remove `pdf-lib`, `@pdf-lib/fontkit`, and `qrcode`/`@types/qrcode` if no longer imported in the package), importers of the moved date helpers
- Modify: `services/documents/src/metrics.rs` (`GET /healthz`), `src/lib.rs`/`main.rs` (readiness flag), `services/documents/railway.toml` (`healthcheckPath = "/healthz"`), `.env.example` (documents: `PORT=9464` so Railway probes the HTTP port)

**Interfaces:**
- Produces: `/healthz` on the metrics port, no token: 200 `ok` while serving, 503 after shutdown begins (`Readiness` = `Arc<AtomicBool>` set by `serve` once listening and cleared when the shutdown future resolves).

- [ ] **Step 1: Write failing tests**: Rust `healthz_without_token` (200 while serving, 404 not returned even when `METRICS_TOKEN` unset), `healthz_unavailable_after_shutdown` (503 after the shutdown signal); TS: `grep -rE "pdf-lib|fontkit" packages apps --include=package.json` exits 1 (run as a step check).
- [ ] **Step 2: Run** `pnpm rust:test` — Expected: FAIL.
- [ ] **Step 3: Implement** `/healthz`; move date helpers; delete pdf-lib code and dependencies; `pnpm install`.
- [ ] **Step 4: Run** `pnpm rust:test && pnpm rust:lint && pnpm --filter @repo/api test && pnpm typecheck && pnpm lint && pnpm build` — Expected: pass; the grep finds nothing.
- [ ] **Step 5: Commit** `refactor: remove pdf-lib; feat(documents): HTTP health check`

### Task 7: Prometheus and Grafana

**Files:**
- Modify: `observability/prometheus.yml` (job `documents`, `metrics_path: /metrics`, target `documents:9464`, same credentials file), `observability/grafana/dashboards/harmonogram.json` (row "Usługa dokumentów (Rust)" with panels: RPC na sekundę według metody i kodu `sum by (method, code) (rate(documents_rpc_requests_total[1m]))`; p95 czasu renderowania `histogram_quantile(0.95, sum by (le, method) (rate(documents_rpc_duration_seconds_bucket[1m])))`; kolejka `documents_render_queue_depth`), `docker-compose.yml` (prometheus depends on documents)

- [ ] **Step 1: Verify the gap**: with `pnpm e2e:up && pnpm observability:up`, `curl -s 'localhost:19090/api/v1/query?query=documents_render_queue_depth'` — Expected: empty result.
- [ ] **Step 2: Implement** scrape job and dashboard row.
- [ ] **Step 3: Run** `pnpm observability:up`, download a ticket (or `pnpm load:documents`), then the query — Expected: one series; `up{job="documents"} == 1`; the dashboard JSON parses (`python3 -m json.tool`).
- [ ] **Step 4: Commit** `feat(observability): documents service metrics and dashboard row`

### Task 8: Docs, final checks, summary

**Files:**
- Modify: `docs/architecture.md` (all PDFs in the service; pdf-lib gone; `/healthz`), `docs/development.md`, `docs/README.md` (plan 8 entry), `e2e/load/README.md` if needed, this plan (verification summary)

- [ ] **Step 1: Run** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm rust:lint && pnpm rust:test && pnpm proto:lint && pnpm e2e:up && pnpm e2e && pnpm load:documents` — Expected: all exit 0; e2e all passed (F11 ticket, F12 certificate, F7/F19 attendance sheet downloads included); load comparison still passes.
- [ ] **Step 2: Write** the verification summary (commands, results, open items: Railway still not verified by a deploy).
- [ ] **Step 3: Commit** `docs: plan 8 verification summary`; push to `next`.
