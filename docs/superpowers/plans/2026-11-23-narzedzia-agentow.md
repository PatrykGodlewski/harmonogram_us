# Agent Tooling Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Execution method (user instruction, 23.11): each task is delegated to Claude Code in order Task 1→7; the parent verifies each task's acceptance before delegating the next.

**Goal:** Close the seven agent-tooling gaps from the 23.11 SDLC review: pre-commit hook, e2e stack script, directory-scoped AGENTS.md guides, generated `docs/status.json`, environment doctor, one-shot `pnpm validate`, and feature scaffolding.

**Architecture:** Every deliverable is a plain shell/Node script under `scripts/` (Node stdlib only — no new dependencies) plus documentation updates and one CI step in the existing `checks` job. No application code changes. Tasks are independently shippable; order 1→7 recommended (Task 6 consumes Task 2's `e2e.sh`).

**Tech Stack:** Node ≥22.12 (stdlib), POSIX sh, pnpm 10 + Turbo, Biome 2.6.8, Docker Compose, Playwright, GitHub Actions.

**Spec:** The gap report of the 23.11 "Review SDLC" session (gaps 1–7, inlined below). Tooling scope: the `docs/testing.md` "Documentation/tooling/config only" exception applies to all tasks.

## Findings (23.11 SDLC review — gaps as reported)

1. **No git hooks at all.** Add a pre-commit hook running Biome check on staged files plus typecheck on affected packages. Tool-agnostic (covers every agent session).
2. **E2E is the most expensive gate (12–15 min) and the least ergonomic.** `pnpm e2e:up` always rebuilds (`--build --wait`); a single spec is run by hand; container logs are copied ad hoc. Add `scripts/e2e.sh` with three verbs: `ensure` (reuse a healthy stack, rebuild only when code changed), `run <spec>` (single spec, optional `--project`), `logs`. Document in `docs/testing.md`.
3. **No directory-layered agent files.** Gotchas live in long docs or nowhere. Candidates: `e2e/AGENTS.md`, `packages/api/AGENTS.md`, `packages/db/AGENTS.md`, `apps/web|admin/AGENTS.md`; root file stays the index.
4. **No machine-readable feature/plan status.** A generated `docs/status.json` (F# → spec status, plans, open checkboxes, e2e files, last-touched revision) built from the F-numbering in specs/plans/e2e, with a CI check that it's current.
5. **No environment doctor.** `pnpm doctor` checking node/pnpm/docker versions, stack health, DB reachability, ports, `.env` — each check pass/fail plus a fix hint.
6. **No single "is the tree green?" command.** A thin `pnpm validate` over the existing gates (lint, typecheck, test, build, e2e, rust) printing a per-gate pass/fail + duration table.
7. **No feature scaffolding.** `pnpm scaffold` generating a spec stub, plan stub in the `docs/workflow.md` structure, an e2e file named `[F<n>] …`, and i18n placeholders.

Live state verified at writing (23.11, tip `9e5d51d`):

- CORRECTION (23.11, Task 2 executor + parent verification): the local e2e DB (host port 15432) **does** have the drizzle journal — it lives in the `drizzle` schema (`drizzle.__drizzle_migrations`, 40 rows, one per migration file), not `public`. The earlier "seeded without journal / migrate fails with exit 1" finding was a measurement error (queried `public`) plus a terminal credential-scrubber artifact (unquoted `://user:pass@` literals typed into commands get rewritten to `***` before the shell runs → phantom SCRAM auth failures; pass credentials via variables or quoted strings).
- `e2e/README.md` is referenced by a `docker-compose.yml` comment but does not exist.
- An untracked local `docker-compose.override.yml` (stale `electric` service, no image/build) breaks plain `docker compose` on this machine; scripts pin `COMPOSE_FILE=docker-compose.yml`.
- Max feature number in use: **F33** (e2e, spec and plans all agree).
- Workspace names: `web`, `admin`, `worker`, `@repo/{api,config,db,env,i18n,jobs,router-utils,rpc,ui}`, `e2e`; root devDeps include `turbo` and `@biomejs/biome`.

## Global Constraints

- Not product code: acceptance is command/script evidence per `docs/testing.md` ("Documentation/tooling/config only"); no `[Fn]` feature-e2e gate per task. Task 6 deliberately runs the full existing suites — that is its purpose.
- No new dependencies: scripts use Node stdlib + existing root devDeps. Git hooks via committed `.git-hooks/` + `core.hooksPath` (no husky/simple-git-hooks).
- Conventional Commits, concise imperative; one commit per task; **path-scoped `git add` only** (parallel sessions share this branch and may commit mid-task).
- Biome owns formatting (tabs, double quotes): new `.ts`/`.mjs`/`.json` files must pass `pnpm lint`; the scaffolded e2e spec must pass `pnpm --filter e2e typecheck`.
- Never print environment values (doctor reports key names only); never read or commit `.env` contents.
- The e2e stack is disposable: `ensure` may reset the e2e DB in the no-journal case (Task 2 documents this; it wipes `harmonogram-e2e` data only).
- Do not touch untracked `e2e/tests/f5-moje-wydarzenia.spec.ts` (parallel session work) or any other session's uncommitted changes.
- CI: the status check joins the existing `checks` job; no new jobs, no required-checks change.

## Review Focus

1. Pre-commit hook with staged files outside Biome's scope (markdown, `.sh`, Dockerfile, generated TS like `routeTree.gen.ts`) — expect the hook to filter them out and exit 0 without "file not found" errors; a docs-only commit is fast and clean. (Task 1, step 5)
2. E2E stamp with uncommitted/untracked changes (e.g. a new untracked e2e spec) — expect `ensure` to rebuild; after the change reverts and one more rebuild, a no-op `ensure` finishes in seconds with no docker build output. (Task 2, step 4)
3. E2e DB no-journal reset path — the journal lives in the `drizzle` schema; the first `ensure` on a journal-less DB resets + migrates, afterwards `db:migrate` is a no-op, and a second `ensure` never resets. Verified 23.11: the executor reproduced the no-journal state once (`DROP SCHEMA drizzle CASCADE`), `ensure` reset and migrated (40 rows after), subsequent `ensure` was a no-op. (Task 2, step 4)
4. `docs/status.json` drift (a checkbox toggled, a new e2e file) — expect the CI check to fail with a diff; the local generator re-run is idempotent (zero diff). (Task 4, step 5)
5. Scaffold with a taken F number or an existing target file — expect a hard error with zero files written. (Task 7, step 4)

---

### Task 1: Pre-commit hook (Biome + typecheck)

> **26.11 note:** the hook is now run by lefthook (`lefthook.yml`, installed by `tooling/scripts/install-hooks.mjs`); `.git-hooks/` and `core.hooksPath` are no longer used. The steps below are the history of the first version.

**Files:**
- Create: `.git-hooks/pre-commit` (POSIX sh, executable)
- Create: `scripts/install-hooks.mjs`
- Modify: `package.json` (prepare script), `docs/development.md` (setup section)

**Interfaces:**
- Produces: every `pnpm install` leaves `core.hooksPath = .git-hooks`. Hook contract: exit 0 = clean, exit 1 = violations (Biome and/or typecheck) with an escape-hatch message (`git commit --no-verify`, reason in the commit body).

- [x] **Step 1: Verify the gap (red)**

Run: `git config core.hooksPath; ls .git-hooks 2>&1`
Expected: empty output / "No such file or directory".

- [x] **Step 2: Implement `scripts/install-hooks.mjs`** (23.11, Claude Code; verified by parent)

Exit 0 if not a git checkout (`git rev-parse --git-dir` fails). Else set `git config core.hooksPath .git-hooks` **only when currently unset** — never overwrite an existing local value.

- [x] **Step 3: Implement `.git-hooks/pre-commit`** (sh, `set -eu`) — 23.11, Claude Code; verified by parent (red/green reproduced). Note: Biome scope also includes `project.inlang/*` (per `biome.json` `includes`), with the same generated-path exclusions.

1. `staged=$(git diff --cached --name-only --diff-filter=ACMR)`; empty → print "nothing to check" and exit 0. Guard: no `node_modules` → error "run pnpm install (or --no-verify)" and exit 1.
2. Biome list = staged files under `src/`, or matching `messages/*.json`, `e2e/**/*.ts`, `vite.config.ts`, `index.html` — minus generated paths: `routeTree.gen.ts`, any `paraglide/`, `packages/rpc/src/gen/`, `packages/db/src/migrations/`, `styles.css`, `app.css`, `project.inlang/.meta.json`, `project.inlang/cache`. Non-empty → `pnpm exec biome check --no-errors-on-unmatched -- <files>`.
3. Affected packages = deduped mapping of each staged path's top workspace dir to its `package.json` name: `apps/web`→web, `apps/admin`→admin, `apps/worker`→worker, `packages/<p>`→`@repo/<p>` (verify each against its `package.json`), `e2e/`→e2e. For each: `pnpm exec turbo typecheck --filter=<name>` (dependency builds + Turbo cache, same as CI).
4. On any failure: print the failing tool's output plus the escape-hatch line; exit 1. On success print a one-line summary (N files, biome ✓, typecheck per package).

- [x] **Step 4: Wire `prepare` in `package.json`**

`"prepare": "pnpm run messages:compile && pnpm --filter @repo/rpc generate && node scripts/install-hooks.mjs"`

- [x] **Step 5: Verify red→green** — 23.11, run by Claude Code and re-run by the parent (staged bad file → `biome ✗, typecheck @repo/ui ✗`, exit 1; clean stage → exit 0; non-destructive guard holds; `pnpm run prepare` idempotent).

- Run: `node scripts/install-hooks.mjs && git config core.hooksPath` → `.git-hooks`.
- Guard: `git config core.hooksPath /tmp/dummy-hooks; node scripts/install-hooks.mjs; git config core.hooksPath` → still `/tmp/dummy-hooks`; then `git config --unset core.hooksPath`.
- Write `packages/ui/src/tmp-hook-check.ts` with a formatting and a type error, `git add` it, run `sh .git-hooks/pre-commit` → exit 1, Biome errors listed. Delete the file, unstage.
- Stage a docs-only change (any `.md`) → `sh .git-hooks/pre-commit` → exit 0.
- Clean staging area → `sh .git-hooks/pre-commit` → exit 0.

- [x] **Step 6: Document in `docs/development.md`**

Setup section: the hook is installed by `pnpm install` (non-destructive; existing `core.hooksPath` wins); escape hatch `git commit --no-verify` with the reason in the commit body.

- [x] **Step 7: Commit** (this commit itself fires the hook — expect it to run and pass) — done: `d925003`.

```bash
git add .git-hooks/pre-commit scripts/install-hooks.mjs package.json docs/development.md
git commit -m "chore: pre-commit hook for Biome and typecheck"
```

---

### Task 2: `scripts/e2e.sh` — ensure / run / logs

**Files:**
- Create: `scripts/e2e.sh` (POSIX sh, executable)
- Create: `e2e/README.md` (referenced by `docker-compose.yml` but missing)
- Modify: `.gitignore` (add `.e2e/`), `docs/development.md`, `docs/testing.md`

**Interfaces:**
- Produces (Task 6 consumes): `scripts/e2e.sh ensure [--force]` (exit 0 = healthy and up to date), `scripts/e2e.sh run [playwright args…]` (ensure, then `pnpm --filter e2e exec playwright test "$@"` — no args = full suite), `scripts/e2e.sh logs [service] [--tail N]` (default: all services, tail 100).
- Consumes: `e2e/ports.env` (`DB_PORT`), `pnpm --filter @repo/db db:migrate`.

- [x] **Step 1: Verify the gap (red)**

Run: `sh scripts/e2e.sh 2>&1` → "No such file or directory".

- [x] **Step 2: Implement `ensure`** — 23.11, Claude Code; verified by parent (no-op `ensure` reproduced; script read in full, matches contract).

1. `export COMPOSE_FILE=docker-compose.yml` (ignore any local override — the committed file is the source of truth; document why). `COMPOSE` = `docker compose -p harmonogram-e2e --env-file .env --env-file e2e/ports.env --profile app --profile e2e`.
2. Healthy = `COMPOSE ps` shows all nine services (`db mailpit storage documents teams-mock oidc-mock web admin worker`) running, `db`/`mailpit`/`storage`/`documents` healthy, and `curl -fsS -o /dev/null` succeeds on `http://localhost:3100/` and `http://localhost:3101/`.
3. Stamp = sha256 of `git rev-parse HEAD` + `git status --porcelain=v1 -- apps packages proto services Dockerfile pnpm-lock.yaml Cargo.toml Cargo.lock`, stored at `.e2e/stack-stamp`. Implemented addition (required): the stamp also hashes `git diff HEAD --binary` over the stamped paths plus blob hashes of untracked files, so a second edit to an already-modified file still changes the stamp.
4. `--force`, unhealthy, or stamp mismatch → `COMPOSE up -d --build --wait --remove-orphans`, then the DB step, then write the stamp. Otherwise print "e2e stack up to date" and exit 0.
5. DB step: read `DB_PORT` from `e2e/ports.env` via `sed` (it is a compose env file, not shell — an unquoted value with a space breaks `source`); `DB_URL=postgresql://postgres:***@localhost:${DB_PORT}/harmonogram_us`. Journal check: `COMPOSE exec -T db psql -U postgres -d harmonogram_us -tAc "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL"` — the journal is in the `drizzle` schema, not `public`.
   - `t` → `DATABASE_URL=$DB_URL pnpm --filter @repo/db db:migrate` (must exit 0).
   - `f` → print that the e2e DB was seeded without a journal and is being reset (disposable), then `COMPOSE exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS harmonogram_us WITH (FORCE)" -c "CREATE DATABASE harmonogram_us"` and migrate (`WITH (FORCE)` required — the running app containers hold connections).

- [x] **Step 3: Implement `run` and `logs`** — 23.11, Claude Code; verified by parent (single spec via `run`: 2 passed, exit 0; `logs worker` prints container lines).

`run` = `ensure` (respecting `--force`) then `pnpm --filter e2e exec playwright test "$@"`. `logs` = `COMPOSE logs --no-color --tail "${TAIL:-100}" ${SERVICE:-}`.

- [x] **Step 4: Verify (live stack)** — 23.11, run by Claude Code; the parent independently reproduced: `ensure` no-op ("e2e stack up to date", exit 0), single spec 2 passed (3.5s), logs verb, `sh -n` clean.

- First `ensure`: rebuilds (no stamp yet). The reset path was exercised by reproducing the no-journal state once (`DROP SCHEMA drizzle CASCADE` on the e2e DB only) — evidence: build completes, `drizzle.__drizzle_migrations` count = 40 after, and a follow-up `db:migrate` (password via variable, not a typed literal) exits 0 with nothing applied.
- Second `ensure`: "up to date", no docker build output, completes in seconds.
- Change detection: append a blank line to an existing `apps/web/src` file → `ensure` rebuilds; restore the file → `ensure` rebuilds again; final state up to date.
- Untracked detection: create `apps/web/src/tmp-e2e-stamp.ts` (untracked) → `ensure` rebuilds; delete it → `ensure` rebuilds.
- Single spec: `scripts/e2e.sh run tests/f6-powiadomienia.spec.ts --project=telefon` → passes.
- `scripts/e2e.sh logs web --tail 5` → prints web container lines.

- [x] **Step 5: Write `e2e/README.md`** — 23.11, Claude Code (47 lines; covers all listed points plus the stamp's blind spot: `VITE_*` build args in `.env` are untracked → use `--force` after changing them).

Compose project `harmonogram-e2e`; ports from `e2e/ports.env`; the three `scripts/e2e.sh` verbs; DB is disposable and the no-journal reset behavior; single-spec runs with project tags — projects `komputer` / `telefon` (selects `@uczestnik`, `@organizator`) / `skaner` (`@skaner`, fake camera); mocks: `oidc-mock` (`UNIVERSITY_SSO_*`), `teams-mock` (`TEAMS_*`), Mailpit 18025; hydration-marker waiting; why `COMPOSE_FILE` is pinned.

- [x] **Step 6: Update docs** — 23.11, Claude Code (development.md Playwright section leads with the verbs; testing.md single-spec line added).

`docs/development.md` Playwright section: `scripts/e2e.sh` verbs replace the "run `pnpm e2e:up` again after code changes" advice (keep `e2e:up`/`e2e:down` as the manual alternatives). `docs/testing.md`: one line — single-spec iteration goes through `scripts/e2e.sh run`, never the full suite.

- [x] **Step 7: Commit** — done: `e16b1ad` (5 files, signed, hook passed).

```bash
git add scripts/e2e.sh e2e/README.md .gitignore docs/development.md docs/testing.md
git commit -m "chore: scripts/e2e.sh ensure/run/logs with rebuild-on-change"
```

---

### Task 3: Directory-scoped AGENTS.md guides

**Files:**
- Create: `e2e/AGENTS.md`, `packages/api/AGENTS.md`, `packages/db/AGENTS.md`, `apps/web/AGENTS.md`, `apps/admin/AGENTS.md`
- Modify: `AGENTS.md` (root — one index line)

**Interfaces:**
- Produces: each file ≤ 40 lines, imperative rules + pointers to the authoritative doc; no duplicated long prose. Content contracts:

- [x] **Step 1: Verify the gap (red)**

Run: `ls e2e/AGENTS.md packages/api/AGENTS.md packages/db/AGENTS.md apps/web/AGENTS.md apps/admin/AGENTS.md 2>&1` → all missing.

- [x] **Step 2: Write `e2e/AGENTS.md`** — 23.11, Claude Code; verified by parent (24 lines, drizzle-schema wording correct).

Stack = compose project `harmonogram-e2e`, ports in `e2e/ports.env`, driven by `scripts/e2e.sh ensure|run|logs` (rebuilds only when code changed); DB disposable, a no-journal seeded DB is reset by `ensure`; single spec = `scripts/e2e.sh run tests/f5-zapisy.spec.ts --project=telefon`; projects `komputer` / `telefon` (tags `@uczestnik`, `@organizator`) / `skaner` (`@skaner`, fake camera); mocks: `oidc-mock` (`UNIVERSITY_SSO_*`), `teams-mock` (`TEAMS_*`), Mailpit 18025; wait for the hydration marker; never run the full suite to iterate one spec; details in `e2e/README.md`.

- [x] **Step 3: Write `packages/api/AGENTS.md`** — 23.11, Claude Code; verified by parent (17 lines; kernel list uses the spec's full 18-entry version, which supersedes the plan's shorter list).

Domain-boundary working rule (from `docs/superpowers/specs/2026-11-23-granice-domenowe-biome-design.md` — **policy until that plan lands; not yet lint-enforced**): cross-area imports only via `@repo/api/<area>/*` specifiers, never relatively across areas; shared kernel = `auth/`, `security/`, `notifications/`, `documents/`, `storage/`+`files/`, `observability/`, `teams/`, `events/schemas.ts`, `events/access.ts`, `admin/schemas.ts`, top-level `errors.ts`/`procedures.ts`/`site.ts`/`types/`. Enqueue jobs inside the same Drizzle transaction as the data — pointer to `docs/data-flows.md`.

- [x] **Step 4: Write `packages/db/AGENTS.md`** — 23.11, Claude Code (18 lines).

Schema changes only via `pnpm db:generate` → inspect generated SQL → `pnpm db:migrate`; `db:push` is not part of the approved workflow. Tests auto-create/migrate `harmonogram_us_test` and truncate only that database — **never the dev DB**. Never write `event_seat_counts` / `agenda_item_seat_counts` directly (Postgres-trigger maintained), including from seeds. Lock order and waitlist-promotion invariants → `docs/data-flows.md`.

- [x] **Step 5: Write `apps/web/AGENTS.md` and `apps/admin/AGENTS.md`** — 23.11, Claude Code. Deviation (corrected): there is no `src/paraglide/` in either app — the generated output lives in `packages/i18n/src/paraglide/`, and both guides point there (`src/routeTree.gen.ts` does exist in both apps).

Both: never edit `src/routeTree.gen.ts` or `src/paraglide/` (generated); UI text only in `packages/i18n/messages/{pl,en}.json`, then `pnpm messages:compile`.
`web`: registration UI actions go through `useRegistrationActions` (pointer to `docs/data-flows.md` "Fresh data on open pages"); dev server port 3000.
`admin`: panel has two audiences — organisers see only their own events, administrators everything plus lookups; design screens for phones first (360 px), phone coverage via the `@organizator` tag.

- [x] **Step 6: Index line in root `AGENTS.md`** — 23.11, Claude Code (one line + blank after the Project section).

After the Project section, one line: directory guides live at `e2e/AGENTS.md`, `packages/api/AGENTS.md`, `packages/db/AGENTS.md`, `apps/web/AGENTS.md`, `apps/admin/AGENTS.md` — read the one matching where you work.

- [x] **Step 7: Verify** — 23.11, Claude Code; verified by parent (line counts 24/17/18/11/12, all paths resolve, lint 15/15).

All five files exist and are ≤ 40 lines; every backticked path referenced in them resolves on disk; `pnpm lint` still passes.

- [x] **Step 8: Commit** — done: `de14cb7` (6 files, signed).

```bash
git add e2e/AGENTS.md packages/api/AGENTS.md packages/db/AGENTS.md apps/web/AGENTS.md apps/admin/AGENTS.md AGENTS.md
git commit -m "docs: directory-scoped AGENTS.md guides"
```

---

### Task 4: Generated `docs/status.json` + CI currency check

**Files:**
- Create: `scripts/generate-status.mjs`, `docs/status.json` (generated, committed)
- Modify: `.github/workflows/ci.yml` (`checks` job), `docs/README.md`

**Interfaces:**
- Produces: `node scripts/generate-status.mjs` (Node stdlib only, deterministic: sorted keys, 2-space indent, trailing newline). Schema:

```json
{
	"revision": "<short HEAD sha, null off-repo>",
	"features": {
		"F5": {
			"status": "<last table cell of the F row in the product spec, null if no row>",
			"spec": "docs/superpowers/specs/2026-11-19-produkt-design.md (null if no row)",
			"plans": ["docs/superpowers/plans/<file>.md"],
			"openTasks": 0,
			"totalTasks": 12,
			"e2e": ["e2e/tests/f5-*.spec.ts"],
			"lastTouched": "<git log -1 --format=%h over plans+e2e, null if none>"
		}
	}
}
```

- F# universe = union of: product-spec table rows matching `| F<N> |` (status = last cell), plan files whose **first line** matches `# … (F<N>) …`, and `e2e/tests/f<N>-*.spec.ts` (lists come from `git ls-files --cached`, so other sessions' untracked work never lands in `status.json`). `openTasks`/`totalTasks` = counts of `- [ ]` / `- [x]` across the feature's plans.
- `revision` = the short HEAD sha **at generation time** (informational; the commit that lands the file has a different sha). `--check` therefore compares everything **except** `revision` and `lastTouched` — `lastTouched` is git-history-derived and fails in CI the same way (shallow clone: `git log -1` returns HEAD for every file; landing commit: a commit touching a plan changes that feature's `lastTouched` to its own, not-yet-existing sha).

- [x] **Step 1: Verify the gap (red)**

Run: `node scripts/generate-status.mjs 2>&1` → "Cannot find module".

- [x] **Step 2: Implement `scripts/generate-status.mjs`** per the contract above — 23.11, Claude Code (181 lines, Node stdlib only); verified by parent.

- [x] **Step 3: Run it and spot-check the output** — 23.11, Claude Code; verified by parent (36 features; all pins matched the spec table: F33 `gotowe (22.11):…` + sesje plan/e2e, F16 `odrzucone…`, F21/F25 `brak`, F5 three e2e files, no plans).

- F33 → `plans` = [`2026-11-22-sesje.md`], `e2e` = [`f33-sesje.spec.ts`], `status` starts "gotowe".
- F16 → `status` starts "odrzucone"; F21 and F25 → `status` = "brak".
- F5 → `openTasks`/`totalTasks` agree with `grep -c '^-\s\[\[ x\]\]'`/`grep -c '^-\s\[\[ \]\]'` across its plan file(s).

- [x] **Step 4: CI currency check** — 23.11, Claude Code. Deviation (approved, supersedes the plan's strict-diff yaml, which would have failed on its own landing commit): a single `--check` step.

In `ci.yml` `checks` job, after `pnpm install --frozen-lockfile`:

```yaml
      - name: docs/status.json is current
        run: node scripts/generate-status.mjs --check
```

- [x] **Step 5: Drift test (review focus 4)** — 23.11, run by Claude Code and independently re-run by the parent (flipped F33 `[x]`→`[ ]`: `--check` exit 1 with F33 `openTasks` 0→1; reverted: clean tree, `--check` exit 0).

Flip one `- [x]` to `- [ ]` in the F33 plan → run generator → `git diff docs/status.json` shows the changed `openTasks`; revert the plan, re-run → zero diff (idempotent).

- [x] **Step 6: Note in `docs/README.md`** — 23.11, Claude Code (paragraph under "Product and plan context").

"Product and plan context": machine-readable feature status is the generated `docs/status.json` (regenerated by `scripts/generate-status.mjs`, checked in CI).

- [x] **Step 7: Commit** — done: `cce2783` (4 files, signed).

```bash
git add scripts/generate-status.mjs docs/status.json .github/workflows/ci.yml docs/README.md
git commit -m "chore: generated docs/status.json with CI currency check"
```

---

### Task 5: `pnpm doctor`

**Files:**
- Create: `scripts/doctor.mjs`
- Modify: `package.json` (`"env:doctor": "node scripts/doctor.mjs"`), `docs/development.md`

**Interfaces:**
- Produces: `pnpm env:doctor` — one line per check (`✓` pass / `✗` fail / `⚠` warn / `–` skip) with a fix hint on fail/skip; summary line; exit 0 iff no `✗`. (Named `env:doctor`, not `doctor`: newer pnpm releases have a built-in `pnpm doctor` command that shadows a same-named script.) Checks (Node stdlib only; compose invocations pin `COMPOSE_FILE=docker-compose.yml`):
  1. node ≥ 22.12.0 (parse `engines.node` from `package.json`).
  2. pnpm major matches `packageManager` major (10).
  3. Docker CLI present and daemon reachable.
  4. `.env` exists (hint `cp .env.example .env`); every uncommented top-level `KEY=` in `.env.example` present in `.env` — **names only, never values**.
  5. Dev stack (skip with hint `docker compose up -d` if project `harmonogram_us` not running): `db`/`documents`/`storage`/`mailpit` healthy; HTTP 3000/3001 when app services are up (profile `app`).
  6. E2e stack (skip if `harmonogram-e2e` not running): HTTP 3100/3101, `db` healthy; journal check via `COMPOSE exec -T db psql …` against `drizzle.__drizzle_migrations` (the journal lives in the `drizzle` schema, not `public`) — missing journal → `⚠` "seeded without the drizzle journal; `scripts/e2e.sh ensure` will reset it (or `pnpm e2e:down` for a clean stack)".
  7. Port sanity for 5432, 3000, 3001, 15432: in use but not owned by the matching compose project **and not by a process whose cwd is inside this repo** → `✗` (a stray process owns the port). Deviation from the strict "published by compose" wording (23.11, approved): dev web/admin run under `pnpm dev`, not compose, so in-repo-owned 3000/3001 count as ✓. Owner lookup uses `ss` + `/proc` (Linux only; elsewhere falls back to `✗`).

- [x] **Step 1: Verify the gap (red)** — 23.11: the expected red never appeared on this machine — global pnpm 12.15.0 has a built-in `doctor` that ran instead (exit 0). Superseded by the `env:doctor` naming above.

- [x] **Step 2: Implement `scripts/doctor.mjs`** per the contract — 23.11, Claude Code (348 lines vs the ~150-250 target; mostly Biome line splits).

- [x] **Step 3: Green run on this machine** — 23.11, verified by parent: node/pnpm/docker ✓; dev stack healthy ✓; e2e up, journal 41 rows in the `drizzle` schema, no warning ✓; ports OK ✓. Exit 1 from one real finding: the local `.env` is missing 6 keys present in `.env.example` (`VITE_APP_TIME_ZONE`, `REGISTRATION_RETENTION_DAYS`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) — user decision (values/secrets), not touched. Exit 0 expected once they are added.

- [x] **Step 4: Negative path** — 23.11: `mv .env .env.bak` → `✗ .env: missing → cp .env.example .env`, exit 1 (the running `pnpm dev` servers also returned HTTP 500 without `.env` — the port hint now points at the pnpm dev output / compose logs); after restore, re-run → exit 1 from the same 6 missing keys, everything else green. Consistent.

- [x] **Step 5: Document in `docs/development.md`** — 23.11: Setup section, documented as `pnpm env:doctor`.

- [x] **Step 6: Commit** — done: `3837d25` (script + package.json + docs) and `4e80322` (rename to `env:doctor`), both signed.

```bash
git add scripts/doctor.mjs package.json docs/development.md
git commit -m "chore: pnpm doctor environment checks"
```

---

### Task 6: `pnpm validate`

**Files:**
- Create: `scripts/validate.sh` (POSIX sh)
- Modify: `package.json` (`"validate": "sh scripts/validate.sh"`), `docs/development.md`, `docs/testing.md`

**Interfaces:**
- Consumes: `scripts/e2e.sh ensure` (Task 2).
- Produces: `pnpm validate [--only gate[,gate…]]`. Gates, in order, **all run even after a failure** (full picture): `lint` = `pnpm lint && pnpm proto:lint`; `typecheck` = `pnpm typecheck`; `test` = `pnpm test`; `build` = `pnpm build`; `rust` = `pnpm rust:lint && pnpm rust:test`; `e2e` = `scripts/e2e.sh ensure && pnpm e2e`. Output: per-gate stream during the run, then a summary table (gate, PASS/FAIL, duration) and exit 1 iff any FAIL.

- [x] **Step 1: Verify the gap (red)** — 23.11: `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "validate" not found` (exit 254).

- [x] **Step 2: Implement `scripts/validate.sh`** per the contract (plain sh; per-gate start/stop via `date +%s`; no dependencies) — 23.11, Claude Code (73 lines; gates run in contract order, all run after a failure; exit 0 all-pass / 1 any-fail / 2 usage).

- [x] **Step 3: Verify the FAIL path (cheap)** — 23.11: tmp file with a formatting error → `lint FAIL 1s`, exit 1; deleted → `lint PASS 7s`, exit 0, zero trace; `--only bogus` → usage + exit 2. Parent re-run minutes later FAILed again on `packages/ui/src/composed/header.tsx` — a **concurrent session's uncommitted WIP** (44 dirty files in the tree); the tool caught a real error correctly, tree was green at commit time.

- [x] **Step 4: Full green run** — 23.11, verified from the run output: all six gates PASS, exit 0, ~6.6 min total (lint 1s, typecheck 7s, test 292s, build 10s, rust 21s, e2e 66s). Tests: db 279, api 175, ui 73, worker 24, rpc 3; rust 26+18; e2e 240 passed + 1 intentional skip (`f15-statystyki.spec.ts:66`, `komputer` project only). Turbo cache reused 3/15 lint, 6/15 typecheck, 2/6 build tasks. The `.env` 6-key gap caused no gate failure.

- [x] **Step 5: Update docs** — 23.11: `docs/development.md` Common commands + `docs/testing.md` completion row, both `pnpm validate`.

- [x] **Step 6: Commit** — done: `4e0bf77` (4 files, SSH-signed).

```bash
git add scripts/validate.sh package.json docs/development.md docs/testing.md
git commit -m "chore: pnpm validate runs all gates with a summary"
```

---

### Task 7: `pnpm scaffold`

**Files:**
- Create: `scripts/scaffold.mjs`
- Modify: `package.json` (`"scaffold": "node scripts/scaffold.mjs"`), `docs/development.md`

**Interfaces:**
- Produces: `pnpm scaffold <slug> [F<n>]` (Node stdlib only). slug must match `^[a-z0-9]+(-[a-z0-9]+)*$`; F number = the argument, else 1 + the max seen in `e2e/tests/f*.spec.ts`, product-spec rows and plan first lines (the scan reads the filesystem, so untracked work from other sessions counts — 23.11: max was F36 in plan titles → next F37). **Pre-validate before writing anything**: taken F number or any existing target path → exit 1 with the conflict named, zero files written.

- [x] **Step 1: Verify the gap (red)** — 23.11: `Command "scaffold" not found` (exit 254).

- [x] **Step 2: Implement `scripts/scaffold.mjs`** — writes, with local date `YYYY-MM-DD`:

1. `docs/superpowers/specs/<date>-<slug>-design.md`: `# <slug> — design`, `Date: <date>. Status: draft.`, sections `## Intent and why` / `## Acceptance` (placeholder line "Gotowe, gdy test e2e pokazuje, że…") / `## Out of scope` / `## Decisions`.
2. `docs/superpowers/plans/<date>-<slug>.md`: full plan header (agentic-worker line, Goal / Architecture / Tech Stack / Spec → the spec stub, Global Constraints, Review Focus) plus a `### Task 1:` skeleton in the `docs/workflow.md` structure.
3. `e2e/tests/f<N>-<slug>.spec.ts`: import `test`, `expect` from `@playwright/test`; one test `"[F<N] TODO: acceptance test @uczestnik"` that fails with the message "implement the [F<N>] acceptance test" — red by design per `docs/testing.md`. Deviation (23.11, approved): the plan's `expect.unreachable(...)` is a Vitest API and does not typecheck under Playwright (TS2339); the stub uses `expect(false, "implement the [F<N>] acceptance test").toBe(true)` (same visible message; `test.fail()` was rejected because it marks the failure as expected and would pass).
4. i18n placeholders: key `scaffold_f<N>_placeholder` added to **both** `packages/i18n/messages/pl.json` ("TODO: tekst po polsku") and `en.json` ("TODO: English text"); then `pnpm messages:compile` must exit 0.

Then print next steps: approve the spec, fill the plan, implement; if the feature belongs in the consolidated product spec, add its `F<N>` row there.

- [x] **Step 3: Verify green** — 23.11, verified by parent from the run: `pnpm scaffold tmp-scaffold-check` assigned **F37** (max in use: F33 in e2e files and product spec, F36 in plan titles — the plan's "currently 33" pin predates other sessions' F34–F36 plans); all four artifacts landed with the right names (`2026-11-24-tmp-scaffold-check-design.md`, `2026-11-24-tmp-scaffold-check.md`, `f37-tmp-scaffold-check.spec.ts`, `scaffold_f37_placeholder` in both message files); `pnpm messages:compile` and `pnpm --filter e2e typecheck` exit 0.

- [x] **Step 4: Verify the collision path (review focus 5)** — 23.11: `pnpm scaffold tmp-scaffold-check F37` → exit 1, names all six conflicts (taken number + 3 existing paths + 2 existing keys), zero files written; with a free number (`F99`) it still exits 1 on the 2 existing paths and writes no `f99` file.

- [x] **Step 5: Verify red-by-design** — 23.11: `scripts/e2e.sh run tests/f37-tmp-scaffold-check.spec.ts` → the single test FAILs in both `@uczestnik` projects (`[komputer]` / `[telefon]`) with `Error: implement the [F37] acceptance test` — the mandated first red.

- [x] **Step 6: Clean up the test artifacts** — 23.11: files deleted, both i18n keys removed (message files byte-identical to the pre-scaffold snapshot, `sha256sum -c`), messages recompiled; no residue.

- [x] **Step 7: Document in `docs/development.md`** — 23.11: "Starting a feature" note, as above.

- [x] **Step 8: Commit** — done with a caveat: a concurrent session's `git commit` ran with my three files still staged and swept them into `fad43ab` (47 files, "feat: programme item page…"). Content verified in that commit (scaffold.mjs 182 lines, the package.json line, the docs note); the tree was clean afterwards. No history rewrite — splitting would require rewriting a commit on a branch other sessions keep committing to. Lesson for future executors: in this shared checkout, prefer pathspec-limited commits (`git commit <paths> -m …`) or commit immediately after staging.

```bash
git add scripts/scaffold.mjs package.json docs/development.md
git commit -m "chore: pnpm scaffold for new features"
```

---

## Sequencing and notes for the executor

- Tasks are independent except Task 6 → Task 2 (`e2e.sh ensure`). Execute 1→7.
- Every task commits its own path-scoped set; CI runs on each push (the `checks` job's new status step starts failing only once Task 4 lands — until then `docs/status.json` simply doesn't exist and the step isn't there either).
- After Task 4, any later task that touches specs/plans/e2e files must keep `docs/status.json` current (re-run `node scripts/generate-status.mjs`); Task 7's cleanup restores consistency.
- Task 2's `ensure` already reset the local e2e DB once (no-journal state reproduced by the executor); the journal now exists (41 rows) and subsequent `ensure` calls are no-ops.
- 23.11 post-mortem (concurrent sessions in one checkout): (a) a path-scoped `git add` followed by a plain `git commit` is still racy — a parallel session committed the shared index including the staged files (Task 7's three files landed in `fad43ab`); use `git commit <paths> -m …` (pathspec-limited) to commit exactly your files. (b) The other session committed a new e2e spec without regenerating `docs/status.json`, so CI's status check would have failed — the parent regenerated and committed `f01e2d1`. Any session that lands spec/plan/e2e files must re-run `node scripts/generate-status.mjs` in its own commit. (c) Recurrence of (a) on 24.11: the final-review commit `e3de451` (plain `git commit` after a path-scoped add) swept in a staged deletion of `packages/db/src/seed/generated.ts` belonging to the other session's in-flight seed rework, leaving a transiently red tip (imports without the file). No history was rewritten: the other session's rework commit `462b327` landed on top and removed the imports, and the tip typechecks clean (`pnpm --filter @repo/db typecheck` exit 0). All commits from this point on are pathspec-limited.

## Final review (fresh context, 24.11)

Independent fresh-context subagent reviewed all seven areas against this plan's contracts (read-only; ran the tools). **Verdict: plan executed and verified — all 7 areas PASS, no real defects.**

- e2e.sh, status.json/CI, env:doctor, validate, scaffold, docs, and git hygiene all pass; every documented deviation (env:doctor naming, `expect(false, …).toBe(true)` stub, `--check` ignoring revision/lastTouched, port-ownership check, Task 7 in `fad43ab`) confirmed as implemented and recorded.
- Verified task commits: Task 2 `e16b1ad`, Task 3 `de14cb7`, Task 4 `cce2783`, Task 5 `3837d25` + `4e80322`, Task 6 `4e0bf77`, Task 7 in `fad43ab` (the two SHAs `8a7ab20`/`6b5196c` circulating in the execution ledger were wrong; the ones above are the real ones).
- Notes (not defects): gitignored Playwright runtime artifacts from the F37 red run remain under `e2e/test-results/` and `e2e/playwright-report/`; the only standing red is the accepted local `.env` 6-key gap (user decision), which `pnpm env:doctor` reports.
- Verification summary preserved here per `docs/reporting.md` before plugin cleanup.

Follow-up (24.11, found on parent re-audit after user feedback): the root `AGENTS.md` — the entry point every agent session reads — was never in any task's file list (Task 3 touched it for the index line only) and still described the pre-tooling workflow: Validation said "final feature-plan checks include lint, typecheck, test, build and e2e … run `pnpm e2e:up` after code changes, then `pnpm e2e`" and did not mention `pnpm validate`, `pnpm env:doctor`, `pnpm scaffold` or the pre-commit hook. **Applied 25.11** after user go-ahead (commit `d33b6b9`; e2e script paths use the current `tooling/scripts/` layout):

1. Working rules, feature-work bullet: append "start a new feature with `pnpm scaffold <slug>`" after "before starting/resuming".
2. Working rules, new bullet after "Use pnpm/Turbo package task boundaries.": "A pre-commit hook (installed by `pnpm install`) runs Biome and typecheck on staged changes; bypass only with `git commit --no-verify` and the reason in the commit body."
3. Validation first paragraph, replace: "Follow [testing](docs/testing.md): targeted package checks first; `pnpm validate` is the final feature-plan check (all gates with a summary table, `--only` for a subset). Vite builds do not type-check. DB tests truncate only `harmonogram_us_test`, never the dev DB. E2E uses built images: `scripts/e2e.sh ensure` after code changes, then a single spec via `scripts/e2e.sh run` while iterating and the full suite (the `e2e` gate of `pnpm validate`) to close. `pnpm env:doctor` first after a clone or any environment failure."
