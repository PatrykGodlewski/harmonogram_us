# Development and validation

Use pnpm 10 + Turbo and Node ≥22.12 (`package.json#engines`). Respect package task boundaries; start with checks for the package being changed. Root scripts in `package.json` are the command source of truth.

Read [workflow](workflow.md) for planning/resuming/completion and Superpowers usage, [testing](testing.md) for test selection and execution gates, and [reporting](reporting.md) for evidence and review findings. This page owns commands and coding standards, not a separate progress tracker.

## Setup and local services

```bash
pnpm install                 # prepare hook compiles Paraglide messages, generates @repo/rpc
cp .env.example .env         # shared root env; fill required values
docker compose up -d         # Postgres (wal_level=logical), Mailpit, Electric, documents (Rust PDFs)
pnpm db:migrate
pnpm db:seed                 # idempotent sample events, waitlist, group, accounts
pnpm dev                     # web :3000, admin :3001, pg-boss worker
```

Seed accounts use `SEED_ACCOUNT_PASSWORD` from `.env`; seeding refuses `NODE_ENV=production`. Local Mailpit inbox (including magic links): http://localhost:8025.

```bash
pnpm db:account --email a@b.pl --role admin
```

Creates/updates an account and prints a generated password unless `--password` or `--link-only` is used.

University sign-in is OpenID Connect, configured only through `UNIVERSITY_SSO_*` in `.env` (see `.env.example`; redirect URI `<BETTER_AUTH_URL>/api/auth/callback/university`). The public site's login and signup show the button only when it is configured; the admin panel keeps e-mail and password (the callback lands on the public site's origin). A university sign-in joins the account with the same e-mail and counts the address as verified. The e2e stack runs a stand-in server (`e2e/oidc-mock`, compose profile `e2e`) reachable as `oidc.localhost:18080` from both the browser and the containers.

Events from the university's Indico (F16) are configured through `INDICO_URL`, `INDICO_CATEGORY_IDS` and optionally `INDICO_API_TOKEN` (see `.env.example`). Indico exports whatever the token's user may see, so leave the token empty for public categories, or use an account that sees only public events. The worker copies the events; the e2e stack runs a stand-in export API (`e2e/indico-mock`, compose profile `e2e`, `indico.localhost:18081`), and `[F16]` asks the worker for a sync through pg-boss.

### Rust documents service

PDFs (tickets, certificates, attendance sheets) are rendered by `services/documents`, a Rust gRPC service; the contract is `proto/` and the generated TypeScript client is `@repo/rpc`. You need only Docker: `docker compose up -d` builds and starts it, and the apps and `@repo/api`/`@repo/rpc` tests reach it at `DOCUMENTS_URL` with `DOCUMENTS_TOKEN` (both in `.env.example`). After changing the renderer or `proto/`, run `docker compose up -d --build documents`.

```bash
pnpm rust:test               # cargo test (local cargo, else the pinned rust image in Docker)
pnpm rust:lint               # cargo fmt --check + clippy -D warnings
pnpm proto:lint              # buf lint proto/
pnpm --filter @repo/rpc generate   # after editing proto/
```

Contract changes must stay backwards compatible (CI runs `buf breaking` against `main`); a breaking change needs a new package version (`v2`).

## Common commands

```bash
pnpm --filter web dev
pnpm build
pnpm lint                    # Biome checks per package via Turbo
pnpm format                  # Biome check --write
pnpm typecheck               # tsc --noEmit; Vite builds do NOT type-check
pnpm test                    # Vitest; DB tests require running Postgres
pnpm --filter @repo/ui lint
pnpm --filter @repo/db test
pnpm --filter @repo/db exec vitest run test/registrations.test.ts
pnpm --filter worker test
pnpm db:generate             # generate migration after schema changes
pnpm db:migrate              # apply migrations

pnpm messages:compile        # after editing i18n message JSON
```

Schema changes must use migrations (`pnpm db:generate`, inspect generated SQL, then `pnpm db:migrate`). `db:push` is not part of the approved workflow; verification must exercise the schema reproduced by migrations.

DB integration tests auto-create/migrate `harmonogram_us_test` and truncate its tables. **Never point destructive test setup at the development database.** Start Postgres with `docker compose up -d db` if only DB tests are needed.

CI (`.github/workflows/ci.yml`) runs lint, `buf` lint and breaking checks, typecheck, build, Vitest (with Postgres and the documents service), the Rust checks (fmt, clippy, test, cargo-deny) and Playwright. Its configuration and package scripts are the executable sources of truth; report which checks actually ran.

## Playwright and load testing

Follow the [testing policy](testing.md) for acceptance coverage, test-first execution and completion checks. The [workflow](workflow.md) defines when to check off a task or update the product spec.

```bash
pnpm e2e:up                  # build production images, start stack, migrate
pnpm e2e
pnpm e2e:down                # stop e2e stack AND delete its data
pnpm load                   # k6 spike/steady tests + DB invariant checks
pnpm load:stress             # informational stepped ramp
pnpm observability:up        # Prometheus + Grafana for e2e
```

The e2e Compose project is `harmonogram-e2e`. Ports come from `e2e/ports.env`: web 3100, admin 3101, Mailpit 18025. **Run `pnpm e2e:up` again after code changes**; the stack uses built images, not live source.

Playwright projects: `komputer` (1280 px) and `telefon` (360 px). The phone project selects `@uczestnik` and `@organizator`; tag organiser tests accordingly. Wait for the app's hydration marker before interactions. See `e2e/playwright.config.ts` and existing fixtures/tests for current patterns.

Load tests: spike 500 users competing for 50 places and a two-minute steady run; stress ramps to 400 users, stopping at p95 >2 s or errors >5%. Details: [load testing](../e2e/load/README.md). Prometheus: http://localhost:19090; Grafana: http://localhost:13002. `pnpm load` streams metrics there when observability is up.

## Adding UI and maintaining code

Reuse `packages/ui/src/components`, `packages/ui/src/composed`, and existing workspace dependencies first. Add shadcn components from **inside `packages/ui`**:

```bash
pnpm dlx shadcn@latest add <component>
```

Match nearby naming, file structure and imports. Keep modules focused, use explicit public API types, early returns, immutable updates and `handle*` event handlers. Explain only non-obvious intent in comments. Avoid broad style refactors.

TanStack Form schema input types must match actual form values. Avoid `z.coerce` or `.optional()` when the form always holds a number/string; transform output in `onSubmit`. Use `z.email()`, not `z.string().email()`.

### Review and simplify after major work

Applies to every agent and subagent: after a major feature or substantial change passes tests, review the changed code and simplify it before moving on. Aim for the smallest complete, readable solution—not the fewest lines. Remove dead or redundant code introduced by the change. Reuse existing patterns; avoid speculative abstractions, pass-through wrappers, unnecessary configuration and premature generalisation. Extract helpers or split files only when doing so improves clarity, reuse or responsibility boundaries; do not trade readability for terse code.

Verify relevant library and framework usage against current Context7 docs (`npx ctx7@latest library …`, then `docs …`), particularly TanStack Start/Router/Query/DB, Electric, Drizzle, Better Auth, pg-boss, Zod and shadcn. Check for focused modules with clear responsibilities, clear names, explicit public API types, duplication, N+1 queries and unbounded reads. Address demonstrated scalability needs without speculative infrastructure.

Keep refactoring scoped and behavior-preserving. Do not remove validation, authorization, error handling or meaningful test coverage to reduce code size. Rerun relevant tests after refactoring and report the results; if blocked, state what remains unverified.

## Commit messages

Use `<type>[optional scope]: <imperative description>`; keep it concise. Standard types include `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`. Add a body/footer only for useful context; mark breaking changes with `!` or a `BREAKING CHANGE:` footer.
