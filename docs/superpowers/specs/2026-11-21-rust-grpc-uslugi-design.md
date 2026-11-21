# Rust services over gRPC: design

Status: draft for approval (21 November 2026). Secure-SDLC work for the whole repository is a separate design; this one covers only what the new service itself needs.

## Intent

The owner wants the application to be fast and robust, with heavy work done by Rust, and with a clean way for our own services to call each other ("gRPC is for services calling each other, if for example we create some Rust microservices"). Every feature must be well tested.

This design does two things:

1. It sets up **the pattern**: how any internal service is defined, generated, called, secured, observed, tested and deployed. Later Rust services copy it.
2. It ships **the first service**, `documents`: a stateless Rust service that renders the app's PDFs (tickets, certificates, attendance sheets) over gRPC.

### Why PDFs first, and an honest note on gains

PDFs are the only CPU-bound work the server does in the request path today: `packages/api/src/{tickets,certificates}/pdf.ts` and `admin/attendance-sheet-pdf.ts` (pdf-lib + fontkit, about 430 lines including the shared `pdf/` helpers). Each render currently blocks the Node event loop of the web or admin process. A burst (for example, everyone opening their ticket after the confirmation e-mail, or a 2 000-person attendance sheet) slows every other request on that instance.

Single renders are already fast; **we have no measurement showing PDFs are a bottleneck today**. The value is (a) taking CPU work off the Node event loop, and (b) a proven, small first service that sets the pattern for later, heavier work (imports). The plan must measure before and after (see Testing, "Load"), and the result is reported as measured, whatever it is.

CSV/XLSX registrant exports are **not** moved: they are built in the browser (`apps/admin/.../registrant-exports.tsx`, `@repo/ui/registrants-csv`) and put no load on the server.

## Goals

- One internal contract language: Protocol Buffers in `proto/`, checked by `buf` (lint + breaking-change check against `main`).
- A Rust `documents` service (tonic) that produces the three PDFs with the same content the current tests check: Polish letters, QR the door scanner accepts, A6 ticket, A4 certificate, paged attendance sheet.
- A TypeScript client generated with Connect-ES, wrapped once in a new `@repo/rpc` package, used by the existing server-only response modules.
- The TypeScript PDF code and its dependencies (`pdf-lib`, `@pdf-lib/fontkit`) are removed once the service is in use. There is one implementation.
- Health checks, deadlines, metrics, structured logs and service-to-service authentication from the first commit.
- Runs everywhere the app runs: `pnpm dev`, the Docker Compose dev/e2e stack, CI, Railway.

## Non-goals

- No database access from Rust in this design. The service receives everything it draws; TypeScript keeps permission checks and queries.
- No moving registration, seat counting, e-mail jobs or any transactional logic. Postgres stays the seat arbiter; jobs stay queued inside the data transaction (`docs/data-flows.md`).
- No public gRPC API, no browser-to-gRPC traffic, no gRPC-Web.
- No new user-facing features (no "download all certificates as ZIP", no imports). Those need their own spec; this design only makes them cheap to add.
- No service mesh, no message broker, no Kubernetes.

## Anti-goals (would be a failure even if it works)

- Two PDF implementations kept "for fallback".
- Translations or date formatting duplicated in Rust. Paraglide and `Intl` in TypeScript stay the only source of text.
- A contributor without Rust can no longer run or test the web apps' non-PDF features.
- The service reachable from the internet, or callable without credentials.
- A slower ticket download than today at the same load, shipped without being reported.

## Constraints

- AGENTS.md rules apply to the TypeScript side: `@repo/env` for configuration (server-only values, never `VITE_*`), no barrel files, explicit `package.json#exports`, Biome, `[Fn]` Playwright tests for features, review and simplify after each major change, Context7 for library usage.
- Packages are consumed as TypeScript source with no build step. Generated TypeScript must therefore exist before typecheck/test/build run.
- Open-source contributors: the Rust toolchain version is pinned (`rust-toolchain.toml`); everything builds offline from crates.io/npm (no remote buf plugins, no Buf Schema Registry).
- Railway: one service per deployable (`*/railway.toml`), private networking between services.
- Fonts are Noto Sans Regular/Bold under OFL (`packages/api/src/pdf/assets/`); they move with the renderer, with `OFL.txt`.

## Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | **One stateless Rust service per bounded job, starting with `documents`, behind gRPC; TypeScript keeps data and permissions** | Smallest new surface; pattern proven on low-risk work; one more deployable to run | **Chosen** |
| B | Several microservices from day one (documents, exports, notifications, registration) | Much more to operate and test; splitting registration from its e-mail jobs breaks the one-transaction guarantee | Rejected |
| C | Rewrite the registration core in Rust | The limit there is Postgres locking, not CPU; duplicates rules already tested in TypeScript | Rejected |

Within A, transport: plain gRPC (HTTP/2) from Node using Connect-ES's gRPC transport, chosen over the Connect protocol over HTTP/1.1 because the user asked for gRPC and tonic speaks it natively with health/reflection ecosystems. Connect-ES gives idiomatic, typed TypeScript clients from the same `.proto`.

## Design

### Repository layout

```
proto/
  buf.yaml                      # lint (STANDARD), breaking (FILE)
  buf.gen.yaml                  # local protoc-gen-es only
  harmonogram/documents/v1/documents.proto
services/
  documents/                    # Rust crate (cargo workspace member)
    Cargo.toml, src/, tests/, assets/fonts/, Dockerfile, railway.toml
Cargo.toml                      # cargo workspace: members = ["services/*"]
rust-toolchain.toml
packages/rpc/                   # @repo/rpc: generated TS + one client factory per service
```

**Contributors without Rust** (Claude's call). Docker is already required (Postgres, Electric and Mailpit run from Compose), so Docker is the substitute for the toolchain:
- `documents` joins the default Compose services, built from its Dockerfile. `docker compose up -d` gives every contributor a running service, the same way it gives them Postgres. `pnpm dev` does not run cargo.
- Rust tasks live in their own root scripts (`pnpm rust:lint`, `pnpm rust:test`, `pnpm rust:build`, all calling cargo on the workspace) and in a separate `rust` CI job. They are not part of `pnpm lint/test/build`, so no task is skipped silently. `services/documents` is not a pnpm workspace package.
- TypeScript integration tests reach the service from Compose, exactly as DB tests reach Postgres.
- Contributors working on the renderer run `cargo run` and point `DOCUMENTS_URL` at it.

### Contract

Package `harmonogram.documents.v1`. Unary RPCs (documents are small, a few hundred KB at most):

```proto
service DocumentService {
  rpc RenderTicket(RenderTicketRequest) returns (Document);
  rpc RenderCertificate(RenderCertificateRequest) returns (Document);
  rpc RenderAttendanceSheet(RenderAttendanceSheetRequest) returns (Document);
}
message Document { bytes pdf = 1; }
```

Requests carry **display-ready text**: every label, the holder name, the formatted date ("1 grudnia 2026, 18:00"), the event title, plus raw values that are drawn rather than read (ticket code for the QR). TypeScript formats with Paraglide and `Intl` exactly as today. Rust does layout only, so translations and time zones stay single-source.

- The PDF metadata title ("Bilet — {title}") is its own field, composed in TypeScript, not built in Rust.
- Labels that contain numbers Rust decides are sent as **templates**. For example, the attendance sheet's "Strona X z Y" is sent as `page_label_template`, produced by calling Paraglide with placeholders: `sheet_page({ page: "{page}", pages: "{pages}" })`. Rust fills them in after paginating. Pagination (`FIRST_PAGE_ROWS`, `PAGE_ROWS`) therefore lives only in Rust, and its test moves there.

Rules:
- `buf lint` (STANDARD) and `buf breaking --against main` run in CI; a breaking change needs a new package version (`v2`), never an edit in place.
- Limits exist to stop abuse, not to cap real events; real data must never hit them. The server enforces them with `INVALID_ARGUMENT`:
  - each text field ≤ 2 000 characters (the app caps titles at 500; composed titles stay well under)
  - no cap on the number of people on a sheet
  - messages ≤ 64 MiB in both directions, configured on server and client (a 10 000-person sheet is a few MiB)

### Rust service

- tonic + prost, tokio. Protos compiled in `build.rs` without a system `protoc` (e.g. `protox`), so a contributor needs only the pinned toolchain.
- Rendering runs on a bounded blocking pool (`spawn_blocking` behind a semaphore sized to CPU count), so a burst queues instead of exhausting memory. When the queue is full: `RESOURCE_EXHAUSTED`.
- Fonts embedded with `include_bytes!`, subset per document. QR via a maintained Rust crate, same error-correction level and payload (`ticketQrText`) as today.
- The layout helpers in `packages/api/src/pdf/layout.ts` (`fitLines`: shrink through font sizes, then wrap to N lines) are ported as pure functions with the same behaviour.
- `#![forbid(unsafe_code)]` in the crate; `clippy -D warnings`; `rustfmt`.
- Standard gRPC health service (`grpc.health.v1`). Graceful shutdown on SIGTERM: stop accepting, finish in-flight renders up to 10 s.
- A second plain-HTTP port serves `/metrics` (Prometheus) behind the same `METRICS_TOKEN` rule as the apps (unset → 404). Metrics: per-RPC count, status code and duration histogram, blocking-pool queue depth. No IDs or names in labels.
- Logs: JSON via `tracing`, one line per request (method, status, duration). Never log request contents (names, e-mails).

### Authentication between services

- The service listens only on the private network (Compose network; Railway private networking, `*.railway.internal`). It has no public domain.
- Every call carries `authorization: Bearer <DOCUMENTS_TOKEN>`; the server compares in constant time and returns `UNAUTHENTICATED` otherwise. Each service has its own token, named after the service (`DOCUMENTS_TOKEN`; a later `imports` service gets `IMPORTS_TOKEN`), so a leaked token opens one service only.
- There is no "production mode": the service always refuses to start without a token of at least 32 bytes. The Compose dev/e2e stacks set a fixed dev token in `e2e/ports.env` and `.env.example`, which is enough for an internal network.
- mTLS is not used: Railway's private network has no certificate authority we control, and a shared token plus network isolation is proportionate for a stateless renderer that holds no data. Revisit when a service holds data.

### TypeScript side

- `@repo/rpc` exports generated code from `@repo/rpc/gen/...` subpaths and one factory, `documentsClient()`, in `@repo/rpc/documents`: Connect-ES `createClient` over `createGrpcTransport` (`@connectrpc/connect-node`), base URL `DOCUMENTS_URL`, the bearer token added by an interceptor, a default deadline of 5 s per call. The transport is created once per process.
- `@repo/env` gains server-only `DOCUMENTS_URL` (URL) and `DOCUMENTS_TOKEN` (string, min 32), required by the apps that call the service (web, admin).
- `tickets/response.ts`, `certificates/response.ts` and `admin/attendance-sheet.ts` keep their permission checks and queries, build the request (formatting text as today) and call the client. The `*pdf.ts` render modules, `pdf/document.ts`, `pdf/layout.ts`, fonts and `pdf-lib`/`@pdf-lib/fontkit` are deleted.
- Generated TS is produced by `buf generate` with the npm-installed `protoc-gen-es`, run by a `generate` task that Turbo orders before `typecheck`, `test`, `build` and `dev` (the same idea as `messages:compile`). Generated files are gitignored, like Paraglide output.
- Failure handling: `UNAVAILABLE`, `DEADLINE_EXCEEDED` and `RESOURCE_EXHAUSTED` become HTTP 503 with `Retry-After: 5` and a short localized message; `INVALID_ARGUMENT` is a bug and returns 500 with the error logged. One automatic retry for `UNAVAILABLE` only (rendering is idempotent).

### Running it

- **Dev:** `docker compose up -d` starts `documents` with the other default services (a host port in dev; none in e2e). See "Contributors without Rust".
- **Image:** multi-stage `services/documents/Dockerfile`: build with the official Rust image pinned by digest, run as a non-root user on a minimal base (distroless or `scratch` with a static musl binary). Image size and start time are recorded in the plan.
- **Railway:** `services/documents/railway.toml`, private networking only, health check on the gRPC health service. Web, admin (and later the worker) get `DOCUMENTS_URL=http://documents.railway.internal:<port>` and `DOCUMENTS_TOKEN`. Documented in `.env.example` and `docs/architecture.md`.
- **Observability:** Prometheus scrapes the service's `/metrics`; the Harmonogram Grafana dashboard gets a "documents" row (RPC rate, errors by code, p95 duration, queue depth).

## Testing

Every layer is tested where it is cheapest, and the existing user-level tests prove nothing visible changed.

1. **Rust unit tests:** `fitLines` port (same cases as the TS tests), field-limit validation, auth check, error mapping.
2. **Rust property tests (proptest):** random Unicode text including Polish letters and very long words never draws outside the text box and never panics; any valid request renders a parseable PDF.
3. **Rust render tests:** render each document from fixed inputs, then parse the PDF in the test (text extraction + page count + page size) and decode the QR from the embedded image: the same assertions as today's `ticket-pdf.test.ts`, `certificate-pdf.test.ts` and `attendance-sheet.test.ts` (holder, title, date, place, Polish letters, QR decodes to the ticket code, sheet pages split as `pageRows` does).
4. **Rust server tests:** start the real tonic server on a random port in-process and call it with a generated client: health `SERVING`, missing/wrong token → `UNAUTHENTICATED`, oversize input → `INVALID_ARGUMENT`, full queue → `RESOURCE_EXHAUSTED`, graceful shutdown finishes an in-flight render.
5. **Contract:** `buf lint` and `buf breaking --against main` in CI; generated TS and Rust both compile from the same files.
6. **TypeScript integration (Vitest):** `packages/api` tests call the real service (started like Postgres is today: Compose locally, a service container in CI) through `@repo/rpc`. The current PDF tests move here, keeping their `unpdf`/`jsqr` assertions, so parity is checked by the TypeScript tests we already trust. Plus: service down → 503 with `Retry-After`; deadline enforced.
7. **E2E (Playwright, built images):** the existing `[F…]` tests that download a ticket, a certificate and an attendance sheet must pass unchanged against the stack with `documents`. No new `[Fn]` feature test, because no feature changes; the plan names which existing tests cover each document.
8. **Load (k6):** a new `documents` scenario: N signed-in users download their ticket PDF in a burst, alongside the steady browse mix. Run it **before** the switch (baseline, TS renderer) and after. Pass: no failed requests; browse p95 during the burst not worse than baseline; ticket p95 reported. Numbers are written into the plan's verification summary as measured. It runs with `pnpm load` against the local e2e stack, as the existing scenarios do; no new CI job.

   **A failed comparison blocks the switch.** The TypeScript renderer is deleted only after the "after" run passes. If it fails, the plan stops, the TypeScript renderer stays in use, and the numbers go to the owner to decide; open-ended tuning is out of scope.

CI: a `rust` job (fmt, clippy, test, `cargo deny check` for advisories and licences of this crate), the `buf` checks in `checks`, and the `documents` image built in the e2e job. Repository-wide security tooling (Dependabot/Renovate, CodeQL, SBOM, pinned actions, Scorecard) belongs to the separate Secure-SDLC design; this design adds only what the new crate and image need.

### Rollout and plans

Two plans, each about ten tasks (`docs/workflow.md`: one active plan at a time):

1. **Pattern + ticket:** proto/buf, `@repo/rpc`, env, the Rust service skeleton (auth, health, limits, pool, metrics, shutdown, logs), Compose, CI, the ticket document, the k6 baseline and comparison, then removing the TypeScript ticket renderer.
2. **Certificate + attendance sheet:** both documents, removal of the remaining TypeScript PDF code and `pdf-lib`/`@pdf-lib/fontkit`, Railway config, Grafana row, docs.

Until plan 2 ends, TypeScript still renders certificates and sheets. Each document has exactly one renderer at any moment.

### What counts as verified

Everything is verified locally on the Compose e2e stack: health, auth, metrics scrape by the local Prometheus, e2e downloads, k6. The Railway files (`railway.toml`, private-network URL, variables) are delivered as configuration and recorded as **not verified on Railway**. Verifying them needs a deploy by the owner, listed as an open item in the plan's summary, not ticked off.

## Decided in this conversation

- gRPC is for internal service-to-service calls only (user).
- Approach A: stateless Rust services behind gRPC, TypeScript keeps data and transactions (Claude's call, accepted by the user's "plan best approach").
- First service is `documents` (PDFs); exports stay in the browser (Claude's call: they cost the server nothing).

## Claude's calls (check while reading)

- Display-ready text in requests; Rust does layout only.
- Bearer token plus private network, no mTLS for now.
- No fallback to the TypeScript renderer; outage → 503 with retry. A failed load comparison blocks the switch.
- Generated TS not committed, generated by a Turbo task.
- Limits: 2 000 characters per text field, no cap on people, 64 MiB messages, 5 s deadline.
- Templates with placeholders for labels whose numbers Rust decides (page X of Y).
- One token per service (`DOCUMENTS_TOKEN`), always required, no production mode.
- Docker instead of the Rust toolchain for contributors; Rust checks in separate scripts and a CI job.
- Two plans: pattern + ticket, then certificate + sheet.
- Railway configured but verified only after an owner deploy.

## Left to the builder

- The Rust PDF crate (must support TrueType embedding with subsetting, images, and deterministic output for tests; a short spike comparing two candidates is fine).
- The QR crate, the minimal runtime image, exact ports.
- How CI provides the service to Vitest (service container vs. building in the job).
- Whether the 5 s deadline is raised for very large sheets (measure first).
- Exact k6 burst size, chosen to show a difference on CI-sized hardware.
