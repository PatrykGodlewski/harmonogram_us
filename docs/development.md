# Development and validation

Use pnpm 10 + Turbo and Node ≥22.12 (`package.json#engines`). Respect package task boundaries; start with checks for the package being changed. Root scripts in `package.json` are the command source of truth.

Read [workflow](workflow.md) for planning/resuming/completion and Superpowers usage, [testing](testing.md) for test selection and execution gates, and [reporting](reporting.md) for evidence and review findings. This page owns commands and coding standards, not a separate progress tracker.

## Setup and local services

```bash
pnpm install                 # prepare hook compiles Paraglide messages, generates @repo/rpc, installs git hooks
cp .env.example .env         # shared root env; fill required values
docker compose up -d         # Postgres, Mailpit, storage (SeaweedFS), documents (Rust PDFs)
pnpm db:migrate
pnpm db:seed                 # idempotent sample events, waitlist, group, accounts
pnpm dev                     # web :3000, admin :3001, pg-boss worker
```

The dev servers run on http://localhost:3000 (web) and http://localhost:3001 (admin).

Run `pnpm env:doctor` first after a clone and after any environment failure. It checks Node/pnpm versions, Docker, git hooks, `.env` key names against `.env.example` (values are never printed), dev and e2e stack health, the e2e drizzle journal, and ports 5432/3000/3001/15432. Each line shows ✓/✗/⚠/– with a fix hint, and it exits 1 on any ✗. (Named `env:doctor` because newer pnpm releases have a built-in `pnpm doctor` command.)

`pnpm install` installs the git hooks with lefthook from `lefthook.yml`. The hook scripts live in `.git/hooks` and are shared by all worktrees of a clone; each worktree runs the `lefthook.yml` of its own checkout. The old `core.hooksPath=.git-hooks` is removed automatically; any other custom `core.hooksPath` wins and the hooks are then not installed. The pre-commit hook runs Biome on staged files in Biome's scope and `turbo typecheck` for each workspace package with staged changes. Bypass only with `git commit --no-verify` and give the reason in the commit body.

Public demo from this computer: `tooling/scripts/tunnel.sh` builds and starts the production web, admin and worker against the local database and publishes them through two Cloudflare quick tunnels (random `https://….trycloudflare.com` addresses, printed at the end; new ones after each restart of the tunnels). `tooling/scripts/tunnel.sh stop` stops it. E-mails still go to Mailpit and file links point at the local storage container, so outside visitors can't open those; set real SMTP and R2 in `.env` for that.

Seed accounts use `SEED_ACCOUNT_PASSWORD` from `.env`; seeding refuses `NODE_ENV=production`. Local Mailpit inbox (including magic links): http://localhost:8025.

```bash
pnpm db:account --email a@b.pl --role admin
```

Creates/updates an account and prints a generated password unless `--password` or `--link-only` is used.

University sign-in is OpenID Connect, configured only through `UNIVERSITY_SSO_*` in `.env` (see `.env.example`; redirect URI `<BETTER_AUTH_URL>/api/auth/callback/university`). The public site's login and signup show the button only when it is configured; the admin panel keeps e-mail and password (the callback lands on the public site's origin). A university sign-in joins the account with the same e-mail and counts the address as verified. The e2e stack runs a stand-in server (`tooling/e2e/oidc-mock`, compose profile `e2e`) reachable as `oidc.localhost:18080` from both the browser and the containers.

File storage (F14, F19) is an S3-compatible bucket set by `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (`S3_REGION`, default `auto`); with any of the four unset, uploads are hidden and file links answer 404. `docker compose up -d` starts `storage` (SeaweedFS `weed mini`, pinned by digest) on port 8333 with the bucket and keys from `.env.example`, data in the `storage_data` volume. App containers and the browser both reach it as `storage.localhost:{STORAGE_PORT}` (e2e: 18083), so presigned links work from both. Production: Cloudflare R2 — create a bucket with EU jurisdiction, an R2 API token with Object Read & Write on that bucket only, and set `S3_ENDPOINT=https://<account-id>.eu.r2.cloudflarestorage.com` plus the token's keys on web, admin and worker. The bucket stays private (no public access, no CORS).

Teams meetings (F23) are configured only through `TEAMS_*` (see `.env.example`). University IT creates an app registration with the Microsoft Graph application permission `OnlineMeetings.ReadWrite.All` and grants an application access policy to the account in `TEAMS_ORGANIZER_ID`; the meetings belong to that account. The panel then offers "Utwórz spotkanie w Teams" where an online or hybrid event's link is entered (publish checklist, edit form). The e2e stack runs a stand-in Graph (`tooling/e2e/teams-mock`, compose profile `e2e`, `teams.localhost:18082`; `TEAMS_LOGIN_URL`/`TEAMS_GRAPH_URL` point at it) that lists created meetings at `/__meetings`.

### Rust documents service

PDFs (tickets, certificates, attendance sheets) are rendered by `apps/documents`, a Rust gRPC service; the contract is `packages/proto/` and the generated TypeScript client is `@repo/rpc`. You need only Docker: `docker compose up -d` builds and starts it, and the apps and `@repo/api`/`@repo/rpc` tests reach it at `DOCUMENTS_URL` with `DOCUMENTS_TOKEN` (both in `.env.example`). After changing the renderer or `packages/proto/`, run `docker compose up -d --build documents`.

```bash
pnpm rust:test               # cargo test (local cargo, else the pinned rust image in Docker)
pnpm rust:lint               # cargo fmt --check + clippy -D warnings
pnpm proto:lint              # buf lint packages/proto/
pnpm --filter @repo/rpc generate   # after editing packages/proto/
```

Contract changes must stay backwards compatible (CI runs `buf breaking` against `main`); a breaking change needs a new package version (`v2`).

## Starting a feature

`pnpm scaffold <slug> [F<n>]` creates the spec stub (`docs/superpowers/specs/<date>-<slug>-design.md`), the plan stub in the [workflow](workflow.md) task structure, a red-by-design `[F<n>]` e2e file (`tooling/e2e/tests/f<n>-<slug>.spec.ts`) and `scaffold_f<n>_placeholder` i18n keys in both message files, with the next free F number (from e2e files, product-spec rows and plan titles, including untracked work). It checks everything first: a taken number or an existing file exits 1 and writes nothing.

## Common commands

```bash
pnpm --filter web dev
pnpm build
pnpm lint                    # Biome checks per package via Turbo
pnpm format                  # Biome check --write
pnpm typecheck               # tsc --noEmit; Vite builds do NOT type-check
pnpm test                    # Vitest; DB tests require running Postgres
pnpm validate                # all gates (lint, typecheck, test, build, rust, e2e) + summary table
pnpm validate --only lint,test  # selected gates only; exit 1 on any FAIL, 2 on usage error
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
tooling/scripts/e2e.sh ensure        # reuse a healthy stack, rebuild + migrate only when code changed
tooling/scripts/e2e.sh run tests/f5-zapisy.spec.ts --project=telefon   # ensure, then one spec
tooling/scripts/e2e.sh logs web --tail 50                              # container logs
pnpm e2e:up                  # manual: always rebuild production images, start stack, migrate
pnpm e2e
pnpm e2e:down                # stop e2e stack AND delete its data
pnpm load                   # k6 spike/steady tests + DB invariant checks
pnpm load:stress             # informational stepped ramp
pnpm observability:up        # Prometheus + Grafana for e2e
```

The e2e Compose project is `harmonogram-e2e`. Ports come from `tooling/e2e/ports.env`: web 3100, admin 3101, Mailpit 18025. The stack uses built images, not live source: **go through `tooling/scripts/e2e.sh ensure` or `run`**, which rebuild only when code changed. `pnpm e2e:up` and `pnpm e2e:down` remain the manual alternatives. Details: [e2e stack](../e2e/README.md).

Playwright projects: `komputer` (1280 px) and `telefon` (360 px). The phone project selects `@uczestnik` and `@organizator`; tag organiser tests accordingly. Wait for the app's hydration marker before interactions. See `tooling/e2e/playwright.config.ts` and existing fixtures/tests for current patterns.

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

Verify relevant library and framework usage against current Context7 docs (`npx ctx7@latest library …`, then `docs …`), particularly TanStack Start/Router/Query, Drizzle, Better Auth, pg-boss, Zod and shadcn. Check for focused modules with clear responsibilities, clear names, explicit public API types, duplication, N+1 queries and unbounded reads. Address demonstrated scalability needs without speculative infrastructure.

Keep refactoring scoped and behavior-preserving. Do not remove validation, authorization, error handling or meaningful test coverage to reduce code size. Rerun relevant tests after refactoring and report the results; if blocked, state what remains unverified.

## Commit messages

Use `<type>[optional scope]: <imperative description>`; keep it concise. Standard types include `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`. Add a body/footer only for useful context; mark breaking changes with `!` or a `BREAKING CHANGE:` footer.
