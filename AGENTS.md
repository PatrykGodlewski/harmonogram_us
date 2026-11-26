# Agent instructions

Applies to all agents and subagents. Keep this file short; put task-specific detail in `docs/`. Read only the relevant docs below, not the whole directory. `CLAUDE.md` imports this file; do not duplicate rules in tool-specific files.

## Project

Mobile-first campus events: `apps/web` (public), `apps/admin` (management), `apps/worker` (jobs), `apps/documents` (Rust PDF service). Shared libraries and the gRPC contract (`packages/proto`) live in `packages/`; dev-only workspaces (`tooling/e2e`, `tooling/scripts`) in `tooling/`; Terraform in `infra/`. UI: Polish and English; GitHub issues: Polish. Indico inspires management scope, not product parity.

pnpm 10 + Turbo, Node ≥22.12. TanStack Start/Router/Query, Drizzle/Postgres, Better Auth, Paraglide, shadcn/Tailwind, Biome; React Compiler enabled.

Directory guides: `tooling/e2e/AGENTS.md`, `packages/api/AGENTS.md`, `packages/db/AGENTS.md`, `apps/web/AGENTS.md`, `apps/admin/AGENTS.md`. Read the one that matches where you work.

## Working rules

- Scope comes from the [product spec](docs/superpowers/specs/2026-11-19-produkt-design.md) and approved decisions/plan. Follow [workflow](docs/workflow.md) for feature work: reconcile spec, plan, code/tests and existing ledger before starting/resuming; start a new feature with `pnpm scaffold <slug>`. One active plan (~10 tasks), one ledger, inline execution, final fresh-context review. No temporary solutions or speculative code.
- Features require a passing Playwright test named `[Fn] …`. Write it first and observe failure. Design admin screens for phones first (360 px).
- After each major feature or substantial change passes tests, review and simplify before continuing. Aim for the smallest complete, readable solution—not the fewest lines. Remove unnecessary code; avoid speculative abstractions, redundant wrappers and premature generalisation. Verify relevant framework usage with current Context7 docs (`npx ctx7@latest library …`, then `docs …`). Keep modules focused; avoid duplication, N+1 queries and unbounded reads. Preserve behavior, safeguards and test coverage; rerun relevant tests after refactoring.
- Keep changes minimal; inspect nearby patterns first. Ask before large unrequested refactors.
- Reuse `@repo/*` packages and existing shadcn components. No barrel/re-export index files: import direct subpaths and maintain `package.json#exports`.
- Read env via `@repo/env` (browser: `@repo/env/client`, `VITE_*`), not `process.env`. Never expose server secrets.
- Biome: tabs, double quotes, organized imports. Explicit public API types; `handle*` event handlers. Small functions/components, early returns, immutable updates; comments only for non-obvious intent.
- Use `z.email()`. TanStack Form schema inputs must match form values; transform in `onSubmit`, not with mismatched coercion/optional fields.
- UI text belongs in both `packages/i18n/messages/{pl,en}.json`; run `pnpm messages:compile`. Never edit generated `routeTree.gen.ts` or `src/paraglide/`.
- Use pnpm/Turbo package task boundaries.
- A pre-commit hook (installed by `pnpm install`) runs Biome and typecheck on staged changes; bypass only with `git commit --no-verify` and the reason in the commit body.
- Commit messages: Conventional Commits, concise imperative description; body only when useful.

## Validation

Follow [testing](docs/testing.md): targeted package checks first; `pnpm validate` is the final feature-plan check (all gates with a summary table, `--only` for a subset). Vite builds do not type-check. DB tests truncate only `harmonogram_us_test`, never the dev DB. E2E uses built images: `tooling/scripts/e2e.sh ensure` after code changes, then a single spec via `tooling/scripts/e2e.sh run` while iterating and the full suite (the `e2e` gate of `pnpm validate`) to close. `pnpm env:doctor` first after a clone or any environment failure.

Check off deliverables/update feature status only with acceptance evidence for the current implementation. Blocked/skipped checks are not passes; reopen affected criteria on regressions. Follow [reporting](docs/reporting.md): report commands/results and unresolved findings; preserve a verification summary in the tracked plan before plugin cleanup. No “bug-free” claims.

## Read before touching

- Package boundaries, server functions, auth, routing, i18n, config, deployment or metrics: [architecture](docs/architecture.md).
- Registrations, capacity, waitlists, groups, page refresh or queued jobs: [data-flow invariants](docs/data-flows.md). Never write seat-count tables directly; queue jobs inside the data transaction.
- Setup, commands, coding/review standards or adding UI components: [development](docs/development.md).
- Feature status, plan order and known issues: [docs index](docs/README.md). Verify current code/tests; historical plans are not live status.
