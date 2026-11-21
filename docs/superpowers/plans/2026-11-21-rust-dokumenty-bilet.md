# Rust documents service, part 1: the pattern and the ticket — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Rust `documents` service behind gRPC renders the ticket PDF; web calls it through a generated Connect-ES client, after a measured before/after load comparison.

**Architecture:** `proto/` holds the contract (checked by `buf`). `services/documents` is a stateless tonic server: bearer-token auth, input limits, a bounded render pool, gRPC health, Prometheus metrics on a second port, JSON logs. `@repo/rpc` holds the generated TypeScript and one client factory; `packages/api/src/tickets/response.ts` keeps its permission check and query and calls the service instead of pdf-lib.

**Tech Stack:** Rust 1.100 (pinned), tonic + tonic-prost-build + protox, tokio, krilla (PDF), ttf-parser (text measuring), qrcode, axum (metrics port), prometheus-client, tracing; `@bufbuild/buf`, `@bufbuild/protoc-gen-es`, `@bufbuild/protobuf`, `@connectrpc/connect`, `@connectrpc/connect-node`; k6.

**Spec:** [2026-11-21-rust-grpc-uslugi-design.md](../specs/2026-11-21-rust-grpc-uslugi-design.md) (approved 21 November 2026; the owner delegated remaining calls to Claude as technical architect).

## Global Constraints

- One renderer per document at any moment; no fallback to pdf-lib once the ticket switches.
- Translations and date formatting stay in TypeScript (Paraglide, `Intl`); Rust receives display-ready text.
- Limits: each text field ≤ 2 000 characters; messages ≤ 64 MiB both ways; client deadline 5 s; one automatic retry on `UNAVAILABLE` only.
- Errors at the HTTP edge: `UNAVAILABLE`, `DEADLINE_EXCEEDED`, `RESOURCE_EXHAUSTED` → 503 + `Retry-After: 5` + localized text; anything else → 500, logged.
- Auth: `authorization: Bearer <DOCUMENTS_TOKEN>`, constant-time compare; the service always refuses to start with a token shorter than 32 bytes.
- Never log request contents (names, e-mails); metric labels never carry IDs or names.
- `#![forbid(unsafe_code)]`, `cargo clippy -- -D warnings`, `cargo fmt --check`.
- No system `protoc` needed (protox); no remote buf plugins or Buf Schema Registry.
- Contributors without Rust use Docker: Rust checks run via `scripts/cargo.sh` (local cargo if present, otherwise the pinned `rust` image); they are not part of `pnpm lint/test/build`.
- Ports: gRPC 50051, metrics 9464. Dev host port `${DOCUMENTS_PORT:-50051}`; e2e `DOCUMENTS_PORT=15051`.
- AGENTS.md rules: `@repo/env` only, no barrels, explicit exports, Biome, i18n in both `pl.json`/`en.json` + `pnpm messages:compile`, review and simplify after major changes with Context7.

## Review Focus

1. Polish letters and very long words in names/titles on the ticket: drawn inside the card, never panic (Task 2 proptest; Task 3 render test with "Zażółć Gęślą" and a 300-character word).
2. Service restarted or down while someone downloads a ticket: a friendly 503 with `Retry-After`, not a 500 or a hang (Task 8 test against a closed port).
3. A burst of downloads beyond capacity: `RESOURCE_EXHAUSTED` → 503, memory bounded (Task 4 admission tests).
4. Wrong or missing token, including a token that differs only in its last byte: `UNAUTHENTICATED` (Task 4).
5. The QR on the PDF still opens the door: the scanner prefix (`harmonogram-ticket:`) stays in TypeScript and the decoded QR equals it exactly (Task 3 QR test; Task 8 jsQR test).

---

### Task 1: Contract and Rust workspace

**Files:**
- Create: `proto/buf.yaml`, `proto/buf.gen.yaml`, `proto/harmonogram/documents/v1/documents.proto`
- Create: `Cargo.toml` (workspace, `members = ["services/*"]`, `resolver = "3"`), `rust-toolchain.toml` (`channel = "1.100.0"`, components `rustfmt`, `clippy`), `scripts/cargo.sh`
- Create: `services/documents/Cargo.toml`, `build.rs`, `src/main.rs`, `src/config.rs`
- Modify: root `package.json` (scripts `proto:lint`, `rust:lint`, `rust:test`, `rust:build`; devDependency `@bufbuild/buf`), `.gitignore` (`/target`)

**Interfaces:**
- Produces: proto package `harmonogram.documents.v1`, service `DocumentService`, RPC `RenderTicket(RenderTicketRequest) returns (Document)`.
- Produces (Rust): `config::Config { token: String, grpc_addr: SocketAddr, metrics_addr: SocketAddr, metrics_token: Option<String> }`, `Config::from_env(get: impl Fn(&str) -> Option<String>) -> Result<Config, ConfigError>`.

```proto
message RenderTicketRequest {
  string document_title = 1;   // PDF metadata: "Bilet — Koncert"
  string heading = 2;          // "Bilet"
  string event_title = 3;
  string date_text = 4;        // "1 grudnia 2026, 18:00"
  optional string place = 5;
  string qr_text = 6;          // full payload, prefix included
  string show_at_entry = 7;
  string holder_label = 8;
  string holder_name = 9;
}
message Document { bytes pdf = 1; }
```

`buf.yaml`: `version: v2`, lint `STANDARD`, breaking `FILE`. `buf.gen.yaml`: `version: v2`, one plugin `local: protoc-gen-es`, `out: ../packages/rpc/src/gen`, `opt: target=ts`. `scripts/cargo.sh "$@"`: runs `cargo "$@"` if `cargo` is on PATH, else `docker run --rm -u $(id -u):$(id -g) -v "$PWD":/w -w /w -v harmonogram-cargo:/usr/local/cargo/registry rust:1.100-slim-bookworm cargo "$@"`. Root scripts: `rust:lint` = `scripts/cargo.sh fmt --check && scripts/cargo.sh clippy --all-targets -- -D warnings`; `rust:test` = `scripts/cargo.sh test`; `rust:build` = `scripts/cargo.sh build --release`; `proto:lint` = `buf lint proto`.

- [ ] **Step 1: Write the failing config tests** in `services/documents/src/config.rs`: `refuses_short_token` (31-byte `DOCUMENTS_TOKEN` → `Err(ConfigError::TokenTooShort)`), `refuses_missing_token`, `defaults_ports` (`grpc_addr` = `0.0.0.0:50051`, `metrics_addr` = `0.0.0.0:9464` when `DOCUMENTS_GRPC_ADDR`/`DOCUMENTS_METRICS_ADDR` unset), `reads_metrics_token` (`METRICS_TOKEN`, empty → `None`).
- [ ] **Step 2: Run** `pnpm rust:test` — Expected: compile error / FAIL (`Config` not defined).
- [ ] **Step 3: Implement** `Config::from_env`; `build.rs` compiles `../../proto/harmonogram/documents/v1/documents.proto` with `protox::compile` → `tonic_prost_build::configure().compile_fds(...)`, `cargo:rerun-if-changed` on the proto dir; `main.rs` declares the modules and `#![forbid(unsafe_code)]`.
- [ ] **Step 4: Run** `pnpm rust:test && pnpm rust:lint && pnpm proto:lint` — Expected: 4 passed; no lint output.
- [ ] **Step 5: Commit** `feat(documents): proto contract and Rust workspace`

### Task 2: Text layout port

**Files:**
- Create: `services/documents/src/layout.rs`, `services/documents/src/fonts.rs`, `services/documents/assets/fonts/` (move `NotoSans-Regular.ttf`, `NotoSans-Bold.ttf`, `OFL.txt` by **copy**; TS still uses them until plan 2)

**Interfaces:**
- Produces: `layout::fit_lines(text: &str, measure: impl Fn(&str, f32) -> f32, max_width: f32, sizes: &[f32], max_lines: usize) -> Fitted { size: f32, lines: Vec<String> }` — same behaviour as `packages/api/src/pdf/layout.ts` `fitLines` (wrap on whitespace, break over-long words by character, shrink through `sizes`, last line cut with "…").
- Produces: `fonts::Fonts::load() -> Fonts { regular: FontFace, bold: FontFace }`, `FontFace::bytes() -> &'static [u8]`, `FontFace::width(text: &str, size: f32) -> f32` (sum of `ttf-parser` horizontal advances × size / units-per-em; fonts via `include_bytes!`).

- [ ] **Step 1: Write the failing tests** in `layout.rs` with a fixed-width measure (`|t, s| t.chars().count() as f32 * s * 0.5`): `keeps_largest_size_that_fits`, `wraps_to_max_lines`, `breaks_overlong_word`, `ellipsis_when_nothing_fits` (result's last line ends with "…" and fits), plus proptest `never_wider_than_box` (any `\PC{0,400}` string incl. Polish letters, sizes `[16.0, 14.0, 12.0]`, max 2 lines → every line's measured width ≤ max_width, `lines.len() ≤ 2`, no panic). In `fonts.rs`: `polish_letters_have_width` (`width("Zażółć", 12.0) > width("Za", 12.0)`).
- [ ] **Step 2: Run** `pnpm rust:test` — Expected: FAIL (functions not defined).
- [ ] **Step 3: Implement** `fit_lines` and `Fonts`.
- [ ] **Step 4: Run** `pnpm rust:test` — Expected: all pass.
- [ ] **Step 5: Commit** `feat(documents): text layout and fonts`

### Task 3: Ticket renderer

**Files:**
- Create: `services/documents/src/ticket.rs`, `services/documents/src/qr.rs`

**Interfaces:**
- Consumes: `fit_lines`, `Fonts` (Task 2); generated `RenderTicketRequest` (Task 1).
- Produces: `qr::png(text: &str) -> Vec<u8>` (EC level M, quiet zone 1 module, ≥ 600 px); `ticket::render(req: &RenderTicketRequest, fonts: &Fonts) -> Vec<u8>`.

Layout is a port of `packages/api/src/tickets/pdf.ts`: A6 page 298 × 420 pt, text width 258, QR 150 pt; heading 11 grey; title bold sizes [16,14,12] ≤ 2 lines; date 10; place sizes [10,9] 1 line; QR; "show at entry" 9 grey; holder label 9 grey; holder bold [12,10] 1 line. Colours NAVY (0.06,0.16,0.34), GREY (0.35,0.38,0.42). Fonts embedded with subsetting (krilla default). Metadata title = `document_title`.

- [ ] **Step 1: Write the failing tests**: `qr::tests::decodes_back` (decode `png("harmonogram-ticket:" + "c"*64)` with `rqrr` dev-dependency → identical string); `ticket::tests::one_a6_page` (parse output with `lopdf` dev-dependency: 1 page, MediaBox `[0 0 298 420]`, title metadata equals `document_title`); `ticket::tests::renders_extreme_text` (holder "Zażółć Gęślą", a 300-char single-word title, no place → valid PDF, no panic).
- [ ] **Step 2: Run** `pnpm rust:test` — Expected: FAIL.
- [ ] **Step 3: Implement** `qr::png` and `ticket::render` with krilla (check the current krilla API with Context7 first).
- [ ] **Step 4: Run** `pnpm rust:test` — Expected: all pass.
- [ ] **Step 5: Commit** `feat(documents): ticket PDF`

### Task 4: gRPC server: auth, limits, admission, health

**Files:**
- Create: `services/documents/src/service.rs`, `src/auth.rs`, `src/limits.rs`, `src/admission.rs`, `services/documents/tests/server.rs`
- Modify: `services/documents/src/main.rs` (expose a library target `lib.rs` so tests can start the server)

**Interfaces:**
- Produces: `documents::serve(listener: tokio::net::TcpListener, state: AppState, shutdown: impl Future<Output = ()>) -> Result<(), Error>`; `AppState::new(config: &Config, admission: Admission)`; `Admission::new(workers: usize, queue: usize)`, `Admission::try_enter() -> Option<Ticket>` (an RAII guard); `limits::check_ticket(&RenderTicketRequest) -> Result<(), Status>` (each string ≤ 2 000 chars → else `INVALID_ARGUMENT` naming the field); `auth::check(metadata, token) -> Result<(), Status>` (constant-time via `subtle`).
- Server: tonic with `max_decoding_message_size` and `max_encoding_message_size` = 64 MiB; `tonic-health` reporter set to `SERVING` for `harmonogram.documents.v1.DocumentService`; render via `spawn_blocking` while holding an admission ticket; default `Admission::new(available_parallelism, available_parallelism * 8)`.

- [ ] **Step 1: Write the failing server tests** in `tests/server.rs` (real server on `127.0.0.1:0`, generated tonic client): `health_is_serving`; `missing_token_is_unauthenticated`; `token_off_by_last_byte_is_unauthenticated`; `oversize_field_is_invalid_argument` (holder_name of 2 001 chars); `full_queue_is_resource_exhausted` (`Admission::new(1, 0)`); `renders_ticket` (valid token → `Document.pdf` starts with `%PDF`). Unit test in `admission.rs`: `rejects_beyond_capacity` (`new(1,1)`: two tickets granted, third `None`, dropping one frees a slot).
- [ ] **Step 2: Run** `pnpm rust:test` — Expected: FAIL.
- [ ] **Step 3: Implement** the modules and `serve`.
- [ ] **Step 4: Run** `pnpm rust:test && pnpm rust:lint` — Expected: all pass, no warnings.
- [ ] **Step 5: Commit** `feat(documents): gRPC server with auth, limits and health`

### Task 5: Metrics, logs, shutdown, health probe

**Files:**
- Create: `services/documents/src/metrics.rs`, `src/telemetry.rs`
- Modify: `src/main.rs`, `src/service.rs`, `tests/server.rs`

**Interfaces:**
- Produces: metrics HTTP server on `metrics_addr`: `GET /metrics` → 404 when `metrics_token` is `None`; 401 without `Authorization: Bearer <METRICS_TOKEN>`; else OpenMetrics text with `documents_rpc_requests_total{method,code}`, `documents_rpc_duration_seconds{method}` (histogram), `documents_render_queue_depth` (gauge).
- Produces: `documents healthcheck` subcommand: calls the local gRPC health service at `127.0.0.1:<grpc port>`, exits 0 when `SERVING`, 1 otherwise (used by the Compose/Docker healthcheck; the runtime image has no shell tools).
- Logs: `tracing-subscriber` JSON, one event per RPC with `method`, `code`, `duration_ms`; no request fields.
- Shutdown: SIGTERM/SIGINT → `serve` stops accepting; in-flight calls drain (tonic `serve_with_incoming_shutdown`), process exits within 10 s.

- [ ] **Step 1: Write the failing tests** in `tests/server.rs`: `metrics_hidden_without_token` (404), `metrics_need_bearer` (401), `metrics_count_rpcs` (after one `RenderTicket`, body contains `documents_rpc_requests_total{method="RenderTicket",code="ok"} 1`), `shutdown_stops_serving` (resolve the shutdown future → `serve` returns `Ok` within 10 s and new connections fail).
- [ ] **Step 2: Run** `pnpm rust:test` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm rust:test && pnpm rust:lint` — Expected: all pass.
- [ ] **Step 5: Commit** `feat(documents): metrics, logs, graceful shutdown`

### Task 6: Image and Compose

**Files:**
- Create: `services/documents/Dockerfile`, `.dockerignore` entries for `target/`
- Modify: `docker-compose.yml` (service `documents`, no profile: built from `services/documents/Dockerfile` with context `.`, `env_file: .env`, `ports: "${DOCUMENTS_PORT:-50051}:50051"`, healthcheck `["CMD", "/usr/local/bin/documents", "healthcheck"]`; `x-app-env` gains `DOCUMENTS_URL: http://documents:50051`; web and admin `depends_on: documents: { condition: service_healthy }`), header comment, `.env.example` (`DOCUMENTS_URL=http://localhost:50051`, `DOCUMENTS_TOKEN='dev-documents-token-change-me-0123456789'`, plus Railway notes), `e2e/ports.env` (`DOCUMENTS_PORT=15051`)

Dockerfile: builder `rust:1.100-slim-bookworm@sha256:<digest>` with BuildKit cache mounts for the registry and `target`, `cargo build --release -p documents`; runtime `debian:bookworm-slim@sha256:<digest>`, non-root user `documents` (uid 10001), `EXPOSE 50051 9464`, `ENTRYPOINT ["/usr/local/bin/documents"]`. Pin both digests at implementation time.

- [ ] **Step 1: Verify the gap**: `docker compose up -d --wait documents` — Expected: FAIL (`no such service: documents`).
- [ ] **Step 2: Implement** the Dockerfile and Compose changes.
- [ ] **Step 3: Run** `docker compose up -d --build --wait documents && docker compose ps documents` — Expected: `healthy`. Record image size (`docker image ls`) and start-to-healthy time in the ledger.
- [ ] **Step 4: Run** `docker compose stop -t 10 documents; docker compose ps -a documents` — Expected: exited with code 0 (graceful shutdown) well within 10 s.
- [ ] **Step 5: Commit** `build(documents): image and Compose service`

### Task 7: `@repo/rpc` and the documents client

**Files:**
- Create: `packages/rpc/package.json` (`name: @repo/rpc`; scripts `generate` = `buf generate ../../proto --template ../../proto/buf.gen.yaml`, `build` = `pnpm run generate`, `lint`, `typecheck`, `test`; exports `./documents` → `./src/documents.ts`, `./gen/*` → `./src/gen/*.ts`), `tsconfig.json`, `biome.json` ignore of `src/gen`, `.gitignore` (`src/gen/`), `src/documents.ts`, `test/documents.test.ts`, `vitest.config.ts`
- Modify: `packages/env/src/index.ts` (server: `DOCUMENTS_URL: z.url().optional()`, `DOCUMENTS_TOKEN: z.string().min(32).optional()`), root `package.json` `prepare` (`pnpm run messages:compile && pnpm --filter @repo/rpc generate`), `packages/api/package.json` (dependency `@repo/rpc`)

**Interfaces:**
- Consumes: `proto/` (Task 1); running service from Compose (Task 6).
- Produces: `documentsClient(): Client<typeof DocumentService>` in `@repo/rpc/documents` — transport created once per process with `createGrpcTransport({ baseUrl: env.DOCUMENTS_URL, interceptors: [bearer, retryUnavailableOnce], defaultTimeoutMs: 5000, readMaxBytes: 64 MiB, writeMaxBytes: 64 MiB })`; throws `Error("DOCUMENTS_URL and DOCUMENTS_TOKEN must be set")` on first use when either is missing.
- Produces: `isDocumentsBusy(error: unknown): boolean` — true for `ConnectError` with `Code.Unavailable`, `DeadlineExceeded` or `ResourceExhausted`.

- [ ] **Step 1: Write the failing tests** in `packages/rpc/test/documents.test.ts` (service from `docker compose up -d documents`): `renders a ticket` (`renderTicket` with Polish text → `pdf` extracted with `unpdf` contains "Zażółć Gęślą", "Koncert jesienny", "1 grudnia 2026, 18:00"); `retries once when the service is unreachable then reports busy` (client against a closed port → rejects, `isDocumentsBusy` true, within 6 s); `isDocumentsBusy is false for invalid argument` (2 001-char field).
- [ ] **Step 2: Run** `pnpm --filter @repo/rpc test` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** (check Connect-ES v2 `createGrpcTransport` options and `protoc-gen-es` v2 output with Context7 first).
- [ ] **Step 4: Run** `pnpm --filter @repo/rpc test && pnpm --filter @repo/rpc typecheck && pnpm --filter @repo/rpc lint` — Expected: 3 passed, no errors.
- [ ] **Step 5: Commit** `feat(rpc): generated documents client`

### Task 8: Load baseline (TypeScript renderer still in use)

**Files:**
- Create: `e2e/load/k6/documents.js`
- Modify: `e2e/load/config.ts` (`documentsUsers: 200`, `documentsBrowseUsers: 50`), `e2e/load/setup.ts` (each documents user registered to one event; their registration ids), `e2e/load/run.ts` (`--documents` and `--documents --baseline`), `e2e/package.json` + root `package.json` (`load:documents`), `e2e/load/README.md`

Scenario: `burst` — every documents user GETs `/api/tickets/<id>/pdf` once within ~10 s (`tags.name = "ticket-pdf"`); `browse` — browse users load the event list and an event page throughout (`tags.name = "browse"`), starting 5 s before the burst and ending 5 s after. Thresholds: `http_req_failed{name:ticket-pdf}` `rate==0`, `checks{check:pdf}` `rate==1` (status 200, `%PDF` prefix). `--baseline` copies the summary to `.run/documents-baseline.json`; without it `run.ts` compares: fail when browse p95 > baseline browse p95 × 1.10, print both p95s and ticket p95.

- [ ] **Step 1: Run** `pnpm load:documents` before writing the scenario — Expected: FAIL (unknown option / missing script).
- [ ] **Step 2: Implement** the scenario, setup and comparison.
- [ ] **Step 3: Run** `pnpm e2e:up && pnpm load:documents --baseline` — Expected: thresholds pass; ledger records ticket p95 and browse p95 (TypeScript renderer).
- [ ] **Step 4: Commit** `test(load): ticket download burst scenario`

### Task 9: Switch the ticket to the service

**Files:**
- Modify: `packages/api/src/tickets/response.ts`, `packages/i18n/messages/{pl,en}.json` (`documents_unavailable`: pl "Nie udało się teraz przygotować pliku. Spróbuj ponownie za chwilę.", en "We couldn't prepare the file right now. Please try again in a moment.")
- Create: `packages/api/src/tickets/document.ts`, `packages/api/src/documents/http.ts`
- Move: `packages/api/test/ticket-pdf.test.ts` → `packages/api/test/ticket-document.test.ts`
- Delete: `packages/api/src/tickets/pdf.ts`

**Interfaces:**
- Consumes: `documentsClient`, `isDocumentsBusy` (Task 7).
- Produces: `ticketDocumentRequest(ticket: TicketPdfInput): RenderTicketRequest` in `tickets/document.ts` (`TicketPdfInput` moves here unchanged; uses `tickets_title`, `tickets_show_at_entry`, `tickets_holder`, `formatLongDateTime`, `ticketQrText`; `document_title` = `${tickets_title} — ${title}`); `pdfResponse(render: () => Promise<Uint8Array>, filename: string, locale: "pl" | "en"): Promise<Response>` in `documents/http.ts` (200 with today's headers; busy → 503 `Retry-After: 5`, `text/plain; charset=utf-8`, `documents_unavailable`; other errors rethrown).

- [ ] **Step 1: Write the failing tests** in `ticket-document.test.ts`: the two existing cases rewritten to render through `documentsClient().renderTicket(ticketDocumentRequest(...))` (same assertions: "Bilet", "Zażółć Gęślą", "Koncert jesienny", "Aula · B105", "1 grudnia 2026"; QR decoded with jsQR → `ticketCodeFromQr` = code); new `pdfResponse answers 503 when the service is busy` (render rejects with `ConnectError("", Code.Unavailable)` → status 503, `retry-after` "5", body is the pl message); `pdfResponse rethrows other errors`.
- [ ] **Step 2: Run** `pnpm --filter @repo/api test -- ticket-document` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement**; `ticketPdfResponse` keeps `getCurrentSession`/`getMyTicket`/404 and calls `pdfResponse`. Delete `tickets/pdf.ts`.
- [ ] **Step 4: Run** `pnpm --filter @repo/api test && pnpm typecheck && pnpm lint` — Expected: all pass.
- [ ] **Step 5: Run** `pnpm e2e:up && pnpm e2e -- f11` — Expected: `[F11] bilet PDF do pobrania` and the other F11 tests pass.
- [ ] **Step 6: Commit** `feat(tickets): render the ticket PDF in the documents service`

### Task 10: Comparison, CI, deployment config, docs

**Files:**
- Modify: `.github/workflows/ci.yml`, `docs/architecture.md`, `docs/development.md`, `docs/README.md` (plan 7 entry), `.env.example` (Railway section: web/admin `DOCUMENTS_URL=http://documents.railway.internal:50051`, `DOCUMENTS_TOKEN`), this plan (verification summary)
- Create: `services/documents/railway.toml` (Dockerfile build, `watchPatterns` `services/documents/**`, `proto/**`, `Cargo.*`), `deny.toml`

CI: `checks` gains `pnpm proto:lint` and `buf breaking proto --against '.git#branch=origin/main,subdir=proto'` (skip with a printed note while `main` has no `proto/` — ruling allowed only for that bootstrap case); new `rust` job: `rust-toolchain.toml` toolchain, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, `cargo deny check` (advisories, licences: allow MIT, Apache-2.0, BSD-2/3, ISC, Unicode-3.0, OFL-1.1 for fonts, Zlib); `unit` starts `docker compose up -d --wait db documents`.

- [ ] **Step 1: Run** `pnpm e2e:up && pnpm load:documents` — Expected: thresholds pass and browse p95 ≤ baseline × 1.10. **If it fails: stop. Revert Task 9's switch commit, keep the rest, and report the numbers to the owner** (spec: a failed comparison blocks the switch).
- [ ] **Step 2: Implement** CI, `deny.toml`, `railway.toml`, docs.
- [ ] **Step 3: Run** the final checks: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm rust:lint && pnpm rust:test && pnpm proto:lint && pnpm e2e:up && pnpm e2e` — Expected: all exit 0; e2e all passed.
- [ ] **Step 4: Write** the verification summary in this plan: commands and results, baseline vs. after numbers, image size, start time, and open items: Railway deploy **not verified** (needs an owner deploy), Grafana row and certificate/sheet in plan 8.
- [ ] **Step 5: Commit** `ci: Rust, proto and documents service checks` and `docs: plan 7 verification summary`; push to `next`.

---

## Verification summary (21 November 2026)

Executed inline on `next`; ledger rulings are listed in the final report and below.

| Check | Result |
| --- | --- |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | exit 0 (16/16, 16/16, 6/6 Turbo tasks) |
| `pnpm test` (dev Postgres + documents service running) | db 222, api 115, worker 19, ui 27, collections 8, rpc 3 — all passed |
| `pnpm rust:lint`, `pnpm rust:test` | fmt and clippy `-D warnings` clean; 17 unit + 11 server tests passed |
| `pnpm proto:lint` | clean |
| `cargo deny check licenses bans sources` (Docker) | ok; advisories not run locally (no git in the slim image) — CI job runs them |
| `pnpm e2e:up && pnpm e2e` | 156/156 passed (includes `[F11] bilet PDF do pobrania`) |
| Image | 131 MB; build+start to healthy 28 s with a warm cache; `docker compose stop -t 10` → exit 0 in 0.3 s |

**Load comparison** (`pnpm load:documents`, local e2e stack, 200 ticket downloads within ~10 s while 50 people browse):

| Run | Ticket PDF p95 | Browse p95 during the burst |
| --- | --- | --- |
| Baseline 1 (pdf-lib in web) | 6 220 ms | 7 434 ms |
| Baseline 2 (pdf-lib in web, saved) | 5 858 ms | 8 184 ms |
| After 1 (documents service) | 220 ms | 333 ms |
| After 2 (documents service) | 186 ms | 279 ms |

Measured on one developer machine, not CI hardware; every download returned a PDF in all runs.

**Open items**
- Railway: `services/documents/railway.toml` and the variables in `.env.example` are configuration only, **not verified on Railway** (needs an owner deploy). Railway health checks are HTTP-only, so the service has none there; it restarts on failure.
- CI jobs (`rust`, `buf breaking`, documents in `unit`) were written but have not run yet; the first push to `next` is their first run.
- Plan 8: certificates and attendance sheets, removal of pdf-lib, Grafana "documents" row.
