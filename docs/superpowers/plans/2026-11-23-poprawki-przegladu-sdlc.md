# Secure SDLC Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the repository's secure-SDLC posture to the approved design: green CI on `next`, CodeQL in `main`'s required checks, all base images digest-pinned, the ten open code-scanning alerts triaged, and the two hygiene loose ends closed.

**Architecture:** No new application code. One Biome formatting fix, one dependency bump through the existing Dependabot PR, digest pins in two build files, one `docs/security.md` line, and GitHub state changes (required checks, alert dismissals, stale ruleset). Verification is command and API evidence plus the existing CI/e2e suites, per the documentation/tooling exception in `docs/testing.md`.

**Tech Stack:** GitHub REST API via `gh`, Docker registry manifest API, Biome, pnpm/Turbo, cargo (via CI).

**Spec:** `docs/superpowers/specs/2026-11-21-bezpieczny-proces-design.md` (the approved process design; this plan closes the parts of it the 23.11 review found unmet). The review's findings and evidence are inlined below (review run 2026-11-23, revision `0c2c834`).

## Findings (23.11 SDLC review, revision `0c2c834`)

1. CI on the tip of `next` is red: run `45063112680`, `checks` job — Biome formatting, `packages/ui/src/agenda.ts:205` (introduced by `e9d4e9e`). Blocks merging to `main`.
2. Required checks on `main`: `checks`, `unit`, `e2e`, `rust` (strict). The approved design also requires the CodeQL analyses — missing.
3. `node:22-alpine` unpinned in `Dockerfile:3` (web/admin/worker images) and `docker-compose.yml:158,177` (`teams-mock`, `oidc-mock` e2e services) — contradicts the "base images pinned by digest" row in `docs/security.md`; Scorecard alerts 3–6.
4. Ten open code-scanning alerts: 1 (CodeQL `insufficient-password-hash`, false positive), 2 (Scorecard Fuzzing), 3–6 (Scorecard PinnedDependencies), 7 (Scorecard SAST), 8 (Scorecard Vulnerabilities/OSV), 9 (Scorecard CodeReview), 10 (Scorecard CIIBestPractices).
5. OSV inside alert 8: `lru 0.16.4` via `rqrr 0.10.1` — RUSTSEC-2026-0253 (use-after-free), fixed in lru 0.18.2. Open Dependabot PR #35 (rqrr 0.11.0, which requires `lru ^0.18`) fixes it; its CI was green on 23.11. Remaining OSV entries: esbuild 0.18.20 (dev-only, via `tsx → @esbuild-kit/core-utils`, no runtime path, no upstream fix) and unmaintained flags for chrono/rustybuzz (via krilla) and ttf-parser (already documented in `deny.toml`).
6. Stale disabled ruleset "Main block" (id 17333180, created 2026-06-05, no rules).
7. Secret-scanning push protection is documented as on in the design but was not API-verifiable with the current token scope (`security-and-analysis` → 404).

## Decisions

- Pin `node:22-alpine` by digest and keep Node 22. The 22 → 26 bumps (Dependabot PRs #32/#39) stay a separate owner decision; Dependabot rewrites the digest when it bumps a pinned image.
- Take rqrr 0.11.0 by merging Dependabot PR #35 (CI green, lock-file diff), not a manual lock edit.
- Dismiss all ten alerts with documented reasons (exact text in Task 5), after the lru fix lands so alert 8's comment matches the lock file.
- Delete the stale disabled ruleset; verify secret-scanning push protection in the GitHub UI and record what is actually seen — never claim it on without evidence.
- This plan changes no code on `main`; `main` receives only the branch-protection API change.

## Global Constraints

- Not product code: configuration/tooling/external-state work — the `[Fn]` e2e test gate does not apply (`docs/testing.md`, "Documentation/tooling/config only"); acceptance is command + API evidence, and the existing CI/e2e suites still gate Task 7.
- Conventional Commits, concise imperative, no scope (house style: `fix: …`, `build: …`, `docs: …`).
- Git operations (commits, pushes to `next`, merging PR #35, deleting the ruleset) are authorized by approving this plan. One commit and one push per code task so CI attribution stays clean.
- Node ≥22.12, pnpm 10; Biome owns formatting (apply its fix, never hand-reformat).
- No secrets or tokens in the ledger or dismissal comments; record evidence per `docs/reporting.md`.
- Keep Dependabot PRs #32/#39 (node 22 → 26) open and untouched.

## Review Focus

- A typo in a required-check context string (`CodeQL / analyze (…)` naming) makes PRs to `main` unmergeable forever. Expect the before/after API diff to show only the three added contexts and a follow-up PR to report all three CodeQL checks.
- A stale or moved `node:22-alpine` digest fails `docker build`/`docker compose pull`. Expect both to succeed with the pinned digest and the e2e build (Task 7) to consume it.
- Dismissing alert 8 before the lru fix lands hides a real UAF (RUSTSEC-2026-0253). Expect Task 4's lock-file evidence (lru ≥ 0.18.2) to precede the dismissal and its comment to cite the lock state.
- Merging rqrr 0.10.1 → 0.11.0 changes QR decoding (crate API bump) and could regress the ticket/QR flow. Expect the existing QR e2e tests to pass in Task 7's full `pnpm e2e`.
- The branch-protection PATCH replaces the whole contexts list (not an append) and must keep `strict: true`; omitting an existing setting silently relaxes `main`. Expect the diff to show only the three additions, `strict` still true, push/deletion rules unchanged.

---

### Task 1: Green CI on `next` (Biome formatting)

**Files:** `packages/ui/src/agenda.ts:205`
**Acceptance:** `pnpm --filter @repo/ui lint` clean; the CI run on the new `next` tip is green for all four jobs (`checks`, `unit`, `e2e`, `rust`).

- [x] Run `pnpm --filter @repo/ui lint`. (Adjusted 23.11: the formatting error was already fixed by parallel F33 work `4cffe13` on `next` before this plan executed; lint passes clean.)
- [x] Run `pnpm --filter @repo/ui exec biome check --write src/agenda.ts`. (N/A — applied by `4cffe13`.)
- [x] Run `pnpm --filter @repo/ui lint` (expect: `Checked 55 files … 0 errors`) and `pnpm lint` (expect: pass). (Lint clean at tip; the full `pnpm lint` gate runs in Task 7.)
- [x] Commit `fix: format agenda.ts to Biome standard`, push `next`, and verify the CI run on that commit finishes green for all four jobs. (CI gate for the tip is satisfied via Task 7 — this commit landed inside the parallel F33 work.)

### Task 2: Pin the node base images by digest

**Files:** `Dockerfile:3`, `docker-compose.yml:158` (`teams-mock`), `docker-compose.yml:177` (`oidc-mock`).
**Produces:** all three `node:22-alpine` references become `node:22-alpine@sha256:<digest>`; the "base images pinned by digest" row in `docs/security.md` becomes true for every image reference in the repo.

- [x] Resolve the current digest:
  `TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/node:pull" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])") && curl -sI -H "Authorization: Bearer ***" -H "Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json" "https://registry-1.docker.io/v2/library/node/manifests/22-alpine" | grep -i docker-content-digest`
  Expect one `sha256:` value. (23.11 value: `sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a`; re-resolve — the tag moves with point releases.)
- [x] Update the three references to `node:22-alpine@sha256:<digest>`. `git diff` shows exactly three lines.
- [x] Verify the digest resolves: `docker build --target runner --build-arg APP=web -t harmonogram-digest-check .` (expect: build succeeds — the build requires `--build-arg APP=`; the first attempt without it fails at the `case` guard) and `COMPOSE_FILE=docker-compose.yml docker compose pull teams-mock oidc-mock` (expect: pull succeeds — a local-only untracked `docker-compose.override.yml` with a stale `electric` service breaks plain `docker compose` validation, so pin `COMPOSE_FILE` to the committed file).
- [x] Commit `build: pin node base images by digest` and push `next` (CI may run against the pinned images; a green or still-running `checks` is fine here — the full gate is Task 7). Record the commit SHA; Task 5's dismissal comment for alerts 3–6 cites it. (Commit `58fddc9`; build image `8a73b3af8ec5`.)

### Task 3: CodeQL as a required check on `main`, documented

**Files:** GitHub branch protection (API), `docs/security.md:18`.
**Consumes:** `.github/workflows/codeql.yml` runs on `pull_request` (all PRs), so PRs can satisfy the new checks.

- [x] Baseline: `gh api repos/PatrykGodlewski/harmonogram_us/branches/main/protection` → contexts `checks`, `e2e`, `rust`, `unit`; `strict: true`. Save the full response for the diff. (Done 23.11: contexts `checks, unit, e2e, rust`, strict true.)
- [x] PATCH the same endpoint with the full contexts list (replace, not append) keeping `strict`:

  ```bash
  gh api -X PATCH repos/PatrykGodlewski/harmonogram_us/branches/main/protection --input - <<'EOF'
  {"required_status_checks":{"strict":true,"contexts":["checks","unit","e2e","rust","CodeQL / analyze (javascript-typescript)","CodeQL / analyze (rust)","CodeQL / analyze (actions)"]}}
  EOF
  ```
  (Executed 23.11 via the sub-resource form `-X PATCH …/protection/required_status_checks -F required=true -F strict=true` with the same seven-context body; same effect.)
- [x] Re-GET and diff against the baseline: exactly the three `CodeQL / analyze (…)` contexts added, `strict` still true, push/deletion/linear-history rules unchanged. (Re-GET: seven contexts, strict true.)
- [x] Edit the Review row in `docs/security.md`: the CI list becomes `checks`, `unit`, `e2e`, `rust` and the three CodeQL analyses. Commit `docs: CodeQL analyses are required on main` and push `next`. (Commit `5b00da8`.)

### Task 4: Merge the rqrr 0.11.0 Dependabot PR (fixes the lru UAF)

**Files:** `services/documents/Cargo.toml`, `Cargo.lock` (via PR #35).
**Acceptance:** `Cargo.lock` on `next` shows `lru ≥ 0.18.2`; the CI `rust` job (cargo-deny) is green on the merge commit.
**Produces:** the lru entry of OSV finding 5 is resolved; Task 5's alert-8 dismissal relies on this.

- [x] Verify PR #35 (`build(deps): Bump rqrr from 0.10.1 to 0.11.0`): state open, CI green (`gh pr view 35 --json statusCheckRollup` — 23.11: checks, rust, unit, e2e and the three CodeQL analyses all SUCCESS), diff limited to the rqrr version and lock file. (Verified 23.11 08:05: all ten checks pass, merge state CLEAN.)
- [x] Merge: `gh pr merge 35 --squash --delete-branch` (authorized by plan approval). (Merged 23.11 as `bbed56d`.)
- [x] Verify on the `next` tip: `Cargo.lock` contains `lru 0.18.` (rqrr 0.11.0 requires `lru ^0.18`; the advisory is fixed in 0.18.2) and the CI run on the merge commit is green, in particular the `rust` job. (Lock: `lru 0.18.5`, `rqrr 0.11.0`; CI gate covered by Task 7 on the tip.)

### Task 5: Triage the ten open code-scanning alerts

**Files:** none (GitHub state only).
**Prerequisites:** Task 2 (digest-pinning SHA) and Task 4 (lru fix) are on `next`.
**Method:** for each alert, `gh api -X PATCH repos/PatrykGodlewski/harmonogram_us/code-scanning/alerts/<n> --input -` with `{"state":"dismissed","dismissed_reason":"<r>","dismissed_comment":"<text>"}` (23.11 live API: the single-alert update is a `PATCH` on the alert resource; the `POST …/dismissals` sub-path 404s; `dismissed_reason` values: `false positive`, `won't fix`, `used in tests`, `mitigated`; **comments are capped at 280 characters**). Record every response in the ledger; if an alert is already closed (404/422), note it and move on.

- [x] Dismiss alert 1 (CodeQL `js/insufficient-password-hash`, `better-auth.ts:134`) — `false_positive`: "SHA-1 here is the HIBP breached-password k-anonymity query; only the 5-character prefix leaves the machine and the full password never does. Account password hashing is done by better-auth. No code change."
- [x] Dismiss alert 2 (Scorecard Fuzzing) — `won't_fix`: "Rust coverage is unit, property and server tests (docs/testing.md); the Scorecard Fuzzing check only detects Go/JS fuzz harnesses. No change planned."
- [x] Dismiss alerts 3–6 (Scorecard PinnedDependencies) — `fixed`: "node:22-alpine pinned by digest in Dockerfile and docker-compose.yml in 58fddc9; the next Scorecard run confirms no finding." (API reason: `mitigated`.)
- [x] Dismiss alert 7 (Scorecard SAST) — `won't_fix`: "Transient: main has a single squashed commit; the check improves as PR history accumulates."
- [x] Dismiss alert 8 (Scorecard Vulnerabilities/OSV) — `won't_fix`: full rationale in the ledger; the alert comment is the 280-char-capped form: "lru 0.16.4 (RUSTSEC-2026-0253 UAF) fixed via rqrr 0.11.0 (PR #35; lru 0.18.5 in Cargo.lock). Accepted: esbuild 0.18.20 is dev-only (tsx toolchain, no runtime path); chrono/rustybuzz via krilla pass cargo-deny; ttf-parser documented in deny.toml."
- [x] Dismiss alert 9 (Scorecard CodeReview) — `won't_fix`: "Single-maintainer repository; CODEOWNERS review requests plus required conversation resolution are the current controls; revisit when a second maintainer joins."
- [x] Dismiss alert 10 (Scorecard CIIBestPractices) — `won't_fix`: "CII badge is not part of the approved process design (2026-11-21); CodeQL, Dependabot, Scorecard and dependency review are in place. Optional maturity item."
- [x] Verify: `gh api "repos/PatrykGodlewski/harmonogram_us/code-scanning/alerts?state=open"` → empty list. (23.11: 0 open.)

### Task 6: Repository hygiene

**Files:** GitHub state (stale ruleset), `docs/security.md` (verification only).

- [x] Re-verify the stale ruleset: `gh api repos/PatrykGodlewski/harmonogram_us/rulesets/17333180` → name "Main block", enforcement `disabled`, no rules. Delete: `gh api -X DELETE repos/PatrykGodlewski/harmonogram_us/rulesets/17333180`; re-GET → 404. (Deleted 23.11; rulesets list now empty.)
- [x] Verify secret-scanning push protection: try `gh api repos/PatrykGodlewski/harmonogram_us/security-and-analysis` (23.11: 404 — token scope). On 404, check the GitHub UI (Settings → Code security and analysis → Secret scanning → push protection), record the observed state in the ledger, and report it — do not claim it is on without evidence. (Verified ON via the repo object instead: `gh api repos/PatrykGodlewski/harmonogram_us --jq .security_and_analysis` → `secret_scanning.status: "enabled"`, `secret_scanning_push_protection.status: "enabled"`. The dedicated `secret-scanning/push-protection` REST route 404s on personal repos — the repo object is the authoritative source.)
- [x] Confirm the "Not done yet" list in `docs/security.md` is still accurate (expected: no change; signed releases/SBOM/image signing remain deferred until the first release). (Still accurate: 0 releases/tags; other entries unchanged.)

### Task 7: Final verification and closure

- [ ] CI on the `next` tip: green for all jobs (`checks`, `unit`, `e2e`, `rust` and the three CodeQL analyses).
- [ ] Open code-scanning alerts: 0 (`gh api …/code-scanning/alerts?state=open` → empty).
- [ ] Required checks on `main`: seven contexts, `strict: true` (API re-GET).
- [ ] Final checks per `docs/testing.md`: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, then `pnpm e2e:up` (builds the pinned images, including the e2e mocks) and `pnpm e2e`.
- [ ] Fresh-context whole-range review (`superpowers:requesting-code-review`) over the baseline `next` revision → final commit; resolve findings per `docs/reporting.md`.
- [ ] Fill in the Verification summary below and sync the checkboxes.

---

## Verification summary

(to be filled in at closure)
