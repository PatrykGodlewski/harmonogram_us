# Handoff: finishing the open plans (26.11.2026)

For an orchestrator that starts one agent session per plan. Each session also follows [AGENTS.md](../AGENTS.md) and [workflow](workflow.md); this file only says **what is left, in which order, and how parallel sessions stay out of each other's way**. Verify every claim here against the code before acting on it: it is a snapshot.

## State of `main`

- One long-lived branch: `main` (protected: PR, required checks `checks`, `unit`, `e2e`, `rust`, `analyze (javascript-typescript|rust|actions)`, linear history, squash). `next` is gone; Dependabot and CI target `main` only.
- Layout (since PR #42): `apps/` (web, admin, worker, documents = Rust PDF service), `packages/` (api, db, ui, rpc, env, i18n, jobs, router-utils, config, proto = gRPC contract), `tooling/` (e2e, scripts), `infra/` (Terraform). **Plans written before 25.11 use the old paths** `e2e/`, `scripts/`, `proto/`, `services/documents`: read them as `tooling/e2e/`, `tooling/scripts/`, `packages/proto/`, `apps/documents/`.
- Latest landed features: auto-generated event cover images (PR #50, 26.11), programme item detail page with image (F18/F19), showcase seed (10 events + three-day festival programme), agenda items past midnight.
- Event cover images (PR #50) landed on 26.11 after review fixes. The verification summary in `superpowers/plans/2026-11-24-event-images.md` lists what stays open: the real Anthropic, fal and Cloudflare services have never been called (`pnpm sample:event-images` with keys is the check), and a worker that dies mid-job leaves an event `pending` with "regenerate" disabled.
- Git hooks are run by lefthook since PR #53 (26.11): `lefthook.yml`, installed by `pnpm install`. The hook scripts live in `.git/hooks` and are shared by all worktrees of a clone, so run `pnpm install` once in every checkout after pulling. A branch that does not have `lefthook.yml` yet commits without the pre-commit check until it merges `main`.
- In flight (26.11): `fix/poprawki` (step 2, worktree `../harmonogram_us-poprawki`) and `feat/wyglad-dokonczenie` (step R, worktree `../harmonogram_us-wyglad`).

## Rules for parallel sessions

These come from incidents on 24–25.11, when two sessions shared one checkout and committed each other's staged files.

1. **One session = one plan = one git worktree = one branch.** `git worktree add ../harmonogram_us-<slug> -b <type>/<slug> origin/main`, then `pnpm install` and copy the local `.env` into the worktree (never commit it). Never work in another session's worktree; never `git add -A` outside your own worktree.
2. **Land through a PR into `main`.** Rebase on `origin/main` right before opening it; squash-merge only when all required checks are green. No direct pushes to `main`, no admin merges.
3. **Migrations collide.** Two branches that each add a migration get the same number. The second to land rebases, deletes its generated migration and snapshot, and reruns `pnpm db:generate` (hand-written trigger SQL appended to a migration must be re-appended).
4. **There is one local e2e stack** (compose project `harmonogram-e2e`, fixed ports in `tooling/e2e/ports.env`). Only one session may run it at a time: wrap every call as `flock /tmp/harmonogram-e2e.lock tooling/scripts/e2e.sh run <spec> --project=<p>`. Run single specs locally; the full suite runs in CI on the PR.
5. Shared hot files: `packages/i18n/messages/{pl,en}.json`, `routeTree.gen.ts`, root `package.json`, `pnpm-lock.yaml`, `packages/db/src/migrations/meta/*`. Expect rebase conflicts there; resolve by keeping both sides, then regenerate (`pnpm messages:compile`, `pnpm install`, `pnpm db:generate`).
6. A plan that moves code across many packages (step 2 below) runs **alone**: no other branch open while it is in flight.
7. **Run the affected e2e specs before opening a pull request.** Unit tests, typecheck and a build do not show a page that fails to render: PR #50 was opened with all three green while the panel's event page crashed in the browser.
8. **A module that a component imports a server function from exports only server functions and query options.** Anything else it exports keeps its server-only imports in the browser bundle. See `packages/api/AGENTS.md`.

## Work queue

Steps on the same line can run in parallel. A step starts only after the steps it depends on are merged.

| Step | Plan | Depends on | Notes |
| --- | --- | --- | --- |
| 1 | Land PR #50 (event cover images) | — | Done 26.11 (`10e868f`). |
| 2 | [Deferred review findings](superpowers/plans/2026-11-22-poprawki.md) | 1 | In progress on `fix/poprawki`. Reconciled with current code on 26.11: the plan's "Reconciliation (26.11)" section holds the rulings and the current paths. 6 tasks, none started (`addEventMaterialLink`, `eventViewAccess`, `STORED_FILE_GRACE_MS` do not exist yet). Since the plan was written, `packages/api/src/files/` gained item images (`item-image.ts`, `download.ts` exports `visitorCanSee`/`managerCanSee`): reconcile Task 1–3 with that code. Last task says "push to `next`": open a PR into `main` instead. |
| R | Redesign follow-up: `superpowers/plans/2026-11-26-nowy-wyglad-dokonczenie.md` (on its branch until merged) | 1 | In progress on `feat/wyglad-dokonczenie`. Looks only. Shares `materials-card.tsx`, `survey-summary-card.tsx`, `widget.tsx` and the message catalogues with step 2: whichever lands second merges `main` and keeps both. |
| 3 | [Domain boundaries in Biome](superpowers/plans/2026-11-23-granice-domenowe-biome.md) | 2, R | Start only after step 2 and step R have merged. Runs alone (rule 6). Not started. Its `scripts/domain-map.json` and generator go to `tooling/scripts/`. Re-derive the classification from current code: modules were added since the spec (event images, item images, agenda languages, seeds). |
| 4 | [Description helper (F34)](superpowers/plans/2026-11-23-pomocnik-opisow.md) | 3 | Not started. **Reconcile first:** PR #50 already calls Anthropic from `packages/api/src/event-images/prompt.ts` with `ANTHROPIC_API_KEY`; F34 planned a separate OpenAI-compatible client in `packages/api/src/llm/`. Build one LLM client and config in `packages/api/src/llm/`, move the event-image prompt call onto it, and keep one set of env variables. Record the decision in the plan before Task 2. Since PR #50 the prompt call sends `thinking: {type: "disabled"}` and reads the reply's text block by type; keep both when moving the call. |
| 5a | [Bilingual event content (F35)](superpowers/plans/2026-11-23-tresc-dwujezyczna.md) | 4 | Not started. Adds a migration (rule 3). |
| 5b | [Event recommendations (F36)](superpowers/plans/2026-11-23-rekomendacje-wydarzen.md) | 4 | Not started. Adds a migration and a worker cron (rule 3). |
| 5c | F22 remainder: organiser uploads their own cover image and alt text, replacing the generated one | 1 | Needs a new plan. Replaces the paused [obraz-wydarzenia](superpowers/plans/2026-11-24-obraz-wydarzenia.md) plan (its placeholder idea is covered by #50): mark that plan superseded. Reuse the item-image upload code (`packages/api/src/files/item-image.ts`, `image-rules.ts`). F22 "custom subpages" stays out of scope. |
| 5d | Item-detail follow-ups from the 24.11 review (`superpowers/plans/2026-11-24-szczegoly-punktu.md`, "Review follow-up") | 1 | Needs a new plan. (a) Event page polls the whole programme every 15 s: poll seat counts separately from content; (b) versioned, cacheable image URL instead of a fresh signed link per view; (c) one upload helper for event files and images. (d) Splitting the item dialog with TanStack Form `withForm` is a shared form pattern: **ask the user first**. |

Per plan, each session finishes with the repo's final checks (lint, typecheck, unit, build, e2e on CI), a verification summary in the plan, a fresh-context review, regenerated `docs/status.json` (`node tooling/scripts/generate-status.mjs`), and a merged PR.

## Not to start without the user

- **F21** payments, **F25** USOS integration: spec status "brak", no plan, need external decisions (payment gateway, USOS access).
- **F16** Indico integration: rejected (22.11).
- Plans from 18–21.11 with unchecked boxes (`2026-11-18-*`, `2026-11-19-*`, `2026-11-21-rust-dokumenty-*`) are historical: their verification summaries close them. Do not re-execute them.
- Event covers that stay `pending` after a worker job died: allow "regenerate" while pending, add a pending timeout, or add a dead-letter handler. The choice is a product decision (event images plan, open finding 2).

## Known issues

- `[F8] ekrany organizatora spełniają WCAG AA` audits 15 screens in one test and is marked `test.slow()`. If it times out again, look for a slower dialog, not a bigger timeout.
- One unexplained `@repo/api` unit failure on 25.11 that did not reproduce in two full reruns. If it recurs, capture the test name.
- Railway: if a `documents` service exists, its config path must be `/apps/documents/railway.toml`.
