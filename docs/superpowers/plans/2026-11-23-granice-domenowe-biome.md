# Domain boundaries in Biome — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; repo workflow: one ledger, inline execution, final fresh-context review). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every module in the monorepo is classified as shared or as a feature domain, and Biome fails the build when a domain module is imported from outside its domain (shared stays importable from anywhere).

**Architecture:** A machine-readable classification (`scripts/domain-map.json`) plus a small Node generator that writes the Biome `overrides` config (`biome.boundaries.json`, extended by the root `biome.json`) using `style/noRestrictedImports` pattern groups. Existing cross-domain edges are fixed (one function move) or resolved by classification; a CI check keeps the generated file in sync with the map.

**Tech Stack:** Biome 2.6.8 (base config, no plugin), Node `node:test` for the generator test, existing pnpm scripts.

**Spec:** `docs/superpowers/specs/2026-11-23-granice-domenowe-biome-design.md` — the classification table and fix list live there; this plan implements them.

## Global Constraints

- Biome 2.6.8 as pinned in root `package.json`; no version change, no plugin (JavaScript plugins are a developer preview, GritQL cannot express file-path-dependent allow-lists).
- The root `biome.json` stays the entry point; it only gains `"extends": ["./biome.boundaries.json"]`.
- No new dependencies: the generator is plain Node; its test uses built-in `node:test`.
- `biome.boundaries.json` is generated and checked in; `boundaries:check` runs inside `pnpm lint`, so hand edits fail CI.
- No runtime behaviour change: the only code change is moving `requestGuestRegistration` into the `@repo/db` data kernel (import path change, identical logic). All existing tests must stay green.
- No barrel files; `@repo/*` imports go through `package.json#exports` (both `db` and `api` already use `"./*"` wildcard exports).
- Conventional Commits, concise imperative description, no scope.
- DB tests truncate only `harmonogram_us_test`.
- Final verification includes lint, typecheck, test, build and e2e (repo testing rules), even though no feature behaviour changes.

## Review Focus

1. **A new source file matches no classification** (a fresh feature dir added to `packages/api/src` or an app): `boundaries:check` fails loudly with the unclaimed file listed — the file is not silently unrestricted. → Task 1 (generator test) + Task 4 (red check).
2. **A shared-kernel module imports a domain module** (the guest-plugin class of bug): the shared override forbids every domain group; pinned by red check B in Task 4.
3. **A relative cross-domain import inside `packages/api`** (`../groups/…` from an events file) is invisible to specifier patterns — accepted, documented limitation; the working rule (cross-area imports use `@repo/api/<area>/*` specifiers) goes into the docs in Task 5. No mechanical enforcement in this plan.
4. **Hand-editing the generated `biome.boundaries.json`**: `boundaries:check` (regenerate + compare) fails; pinned by the generator test's check mode and Task 4.
5. **Test and e2e files importing domain modules**: excluded from the rule, no false positives — pinned by red check C in Task 4 (a `*.test.ts` with a cross-domain import must pass lint).

## File Structure

- Create: `scripts/domain-map.json` — the classification: `sharedPackages`, `sharedFiles`, `domains` (per domain: `files` globs, `exceptions` = kernel files inside a domain dir, `specifiers` = import groups), `excluded` globs. Content fixed by the design doc's table.
- Create: `scripts/generate-biome-boundaries.mjs` — generator (write mode) and `--check` mode; validates the map (no double-claimed file, every lintable TS file claimed).
- Create: `scripts/test/generate-biome-boundaries.test.mjs` — `node:test` suite.
- Create: `biome.boundaries.json` — generated, checked in.
- Modify: `biome.json` — add `"extends": ["./biome.boundaries.json"]`.
- Modify: root `package.json` — `boundaries:generate`, `boundaries:check` scripts; prepend `pnpm boundaries:check &&` to the existing `lint` script.
- Modify: `packages/db/src/queries/guest-requests.ts` — gains `requestGuestRegistration` (moved, Task 2).
- Modify: `packages/api/src/registrations/guest-registration.ts`, `packages/api/src/auth/guest-registration-plugin.ts` — import from db instead (Task 2).
- Modify: `docs/architecture.md` — "Domain boundaries" section (Task 6).
- Modify: `AGENTS.md` — one working-rule line (Task 6).
- Possibly modify (Task 3, only if lint surfaces it): files inside `apps/admin/src/components/admin-event-detail/**` that belong to the groups domain (reclassify or move per the design doc's resolution rule).

---

### Task 1: Domain map, generator, generated config

**Files:**
- Create: `scripts/generate-biome-boundaries.mjs`
- Create: `scripts/test/generate-biome-boundaries.test.mjs`
- Create: `scripts/domain-map.json`
- Create: `biome.boundaries.json` (generated)
- Modify: `biome.json`, root `package.json`

**Interfaces:**
- Consumes: the design doc's classification table (copy it verbatim into the map — do not re-derive).
- Produces (consumed by Tasks 2–6):
  - `scripts/domain-map.json` shape: `{ sharedPackages: string[], sharedFiles: string[], excluded: string[], domains: { [name]: { files: string[], exceptions: string[], specifiers: string[] } } }`. `exceptions` = paths inside this domain's `files` globs that it does NOT own (kernel files or another domain's files). They are negated in this domain's specifier group, and their classification comes from a positive claim elsewhere: kernel files are listed in `sharedFiles`, foreign files in the owning domain's `files` (e.g. groups' `files` include `packages/api/src/admin/invitations.ts` and `admin/invitation-limits.ts`; auth's include `admin/users.ts`; the kernel files `events/schemas.ts`, `events/access.ts`, `admin/schemas.ts`, `admin/optional-id-schema.ts` are listed in `sharedFiles`). The generator rejects a file claimed by two places and an exception not claimed exactly once somewhere.
  - Generator CLI: no args = write `biome.boundaries.json`; `--check` = write to a temp file, compare, exit 1 with a diff summary on mismatch; any map error (file claimed twice, unclaimed source file) = exit 1 with the offending paths.
  - Generated shape: `{ "linter": { "overrides": [ … ] } }` — first override `include: sharedPackages (as "<pkg>/**") + sharedFiles`, rule `style/noRestrictedImports` level `on` with one pattern group per domain (`group` = that domain's specifiers, each exception negated as `!<specifier of the exception file>`, `message` = "`<name>` is the <domain> domain — import it only from the <domain> domain or shared modules."); one override per domain with `include` = its effective files, forbidding every *other* domain's group.
  - `pnpm boundaries:generate`, `pnpm boundaries:check`; `pnpm lint` = `pnpm boundaries:check && <previous lint command>`.

- [ ] **Step 1: Write the failing generator tests**

`scripts/test/generate-biome-boundaries.test.mjs` (`node:test` + `assert`), using a fixture map with two domains (`alpha` with one exception, `beta`) and one shared file:
- generated output: the shared override forbids both domains' groups and contains the exception negation `!@x/alpha/contract`; the alpha override forbids only beta; the beta override forbids only alpha; every group has a message naming its domain.
- a file listed in two domains → generator exits non-zero naming the file.
- an unclaimed source file (fixture tree with a file matching no glob, not excluded) → exits non-zero naming the file.
- an excluded file (matching `excluded`) → not required to be claimed.
- `--check` on an up-to-date generated file → exit 0; after tampering the file → exit 1.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/test/`
Expected: FAIL — `scripts/generate-biome-boundaries.mjs` does not exist.

- [ ] **Step 3: Implement the generator**

Read the map, compute effective files per domain, validate (double-claim, completeness: walk `packages/*/src` and `apps/*/src` for `*.ts`/`*.tsx`, skip `excluded` globs and the generated dirs already excluded from Biome), emit stable (key-sorted) JSON. Glob matching: keep it simple — implement the needed gitignore-style semantics (trailing `/**`, `*` segments, leading `!` for the completeness scan only) or reuse a dependency-free approach; if a matching edge case gets fiddly, prefer `picomatch` only if it is already in the lockfile — otherwise implement, do not add a dependency.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/test/`
Expected: PASS (5 tests).

- [ ] **Step 5: Create the real `scripts/domain-map.json`**

Transcribe the design doc's classification table (Shared packages, Shared api kernel, the 9-domain table, Shared app-level, Excluded) into the map shape above. Per-domain `exceptions` (files in the domain's dirs it does not own): events → `events/schemas.ts`, `events/access.ts`, `admin/schemas.ts`, `admin/optional-id-schema.ts`, `admin/users.ts`, `admin/invitations.ts`, `admin/invitation-limits.ts`. `sharedFiles` lists the kernel files explicitly (the `auth/**`, `security/**`, … dirs plus the four events/admin kernel files above). Specifiers per domain = the `@repo/api/<area>/*` groups of its api dirs, plus exact-file specifiers for foreign-dir files (groups: `@repo/api/groups/**`, `@repo/api/admin/invitations`, `@repo/api/admin/invitation-limits`; auth: `@repo/api/admin/users`; events: `@repo/api/events/**`, `@repo/api/registrations/**`, `@repo/api/admin/**`).

- [ ] **Step 6: Generate, wire the config, observe the red lint**

Run: `pnpm boundaries:generate` (creates `biome.boundaries.json`), add `"extends": ["./biome.boundaries.json"]` to `biome.json`, add the two scripts to root `package.json` and prepend the check to `lint`.
Run: `pnpm lint`
Expected: FAIL — exactly the guest-plugin violation from the design doc's fix list (#1: `packages/api/src/auth/guest-registration-plugin.ts` importing the events domain), plus any further edges the scan missed. Record the full list of reported files in the ledger below Task 3 for the next task.

- [ ] **Step 7: Commit**

```bash
git add scripts/domain-map.json scripts/generate-biome-boundaries.mjs scripts/test/generate-biome-boundaries.test.mjs biome.boundaries.json biome.json package.json
git commit -m "feat: domain boundary map and Biome boundary generator"
```

---

### Task 2: Move `requestGuestRegistration` into the data kernel

**Files:**
- Modify: `packages/db/src/queries/guest-requests.ts`
- Modify: `packages/api/src/registrations/guest-registration.ts`
- Modify: `packages/api/src/auth/guest-registration-plugin.ts`

**Interfaces:**
- Consumes: the guest-plugin violation from Task 1 Step 6.
- Produces: `requestGuestRegistration` exported from `@repo/db/queries/guest-requests` with the same signature and behaviour it has in `packages/api/src/registrations/guest-registration.ts` (read that file first; move the function and any types it needs as-is). Both api files then import it from db.

- [ ] **Step 1: Read the current function and its usages**

Run: `grep -rn "requestGuestRegistration" packages/ apps/`
Expected: the definition in `registrations/guest-registration.ts` and the import in `guest-registration-plugin.ts` (plus any tests — note them).

- [ ] **Step 2: Move and rewire**

Move the function (and needed types) into `packages/db/src/queries/guest-requests.ts`; update both importers to `@repo/db/queries/guest-requests`. If `registrations/guest-registration.ts` becomes empty of its own logic, delete it and point any remaining importers at db.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm --filter @repo/api test && pnpm --filter @repo/db test`
Expected: all pass, no test left pointing at the old path.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/queries/guest-requests.ts packages/api/src/
git commit -m "refactor: guest registration request lives in the data kernel"
```

---

### Task 3: Resolve remaining boundary violations, reach green lint

**Files:**
- Modify: only what `pnpm lint` names — expected candidates: group-invitation UI inside `apps/admin/src/components/admin-event-detail/**` (design doc "Known open edge"), or nothing.

**Interfaces:**
- Consumes: the red lint output recorded in Task 1 Step 6.
- Produces: a lint-clean tree under the boundary rule.

- [ ] **Step 1: Run the lint and list the violations**

Run: `pnpm lint`
Expected: the guest-plugin error is gone; any remaining errors are recorded here (file + offending import) as this task's work list.

- [ ] **Step 2: Resolve each violation, in order**

For each offending file: (1) reclassify the file to the importing domain's opposite — i.e. add it to the correct domain's `files` in `scripts/domain-map.json` and regenerate; (2) if reclassification is wrong for the file's real purpose, move the file into that domain's directory; (3) if the import itself is the smell, route it through the shared kernel. Never add a blanket allow-list to the map.

- [ ] **Step 3: Verify green**

Run: `pnpm lint`
Expected: exit 0 (boundaries check + Biome).

- [ ] **Step 4: Commit**

```bash
git add <touched files including scripts/domain-map.json and biome.boundaries.json if changed>
git commit -m "fix: resolve remaining domain boundary violations"
```

(If Step 1 found nothing beyond the guest-plugin error, record "no further violations" in the ledger and skip the commit.)

---

### Task 4: Red checks and CI guard

**Files:**
- No permanent files — the checks use temporary files that are deleted before the commit.

**Interfaces:**
- Consumes: the boundary config from Tasks 1–3.
- Produces: proof the rule has teeth in all three directions.

- [ ] **Step 1: Red check A — domain to domain**

Create `packages/api/src/calendar/red-check.ts` with `import { fetchFilterOptionsServer } from "@repo/api/groups/queries";`.
Run: `pnpm exec biome lint packages/api/src/calendar/red-check.ts`
Expected: FAIL, message naming the `groups` domain. Delete the file.

- [ ] **Step 2: Red check B — shared to domain**

Create `packages/api/src/security/red-check.ts` importing from `@repo/api/surveys/link`.
Run: `pnpm exec biome lint packages/api/src/security/red-check.ts`
Expected: FAIL, message naming the `surveys` domain. Delete the file.

- [ ] **Step 3: Red check C — excluded test files stay free**

Create `packages/api/src/calendar/red-check.test.ts` importing from `@repo/api/surveys/link`.
Run: `pnpm exec biome lint packages/api/src/calendar/red-check.test.ts`
Expected: PASS (no boundary violation; `*.test.ts` is excluded). Delete the file.

- [ ] **Step 4: Red check D — unclaimed file and hand-edit**

Create `packages/api/src/red-area/red.ts` (any trivial export).
Run: `pnpm boundaries:check`
Expected: FAIL listing `packages/api/src/red-area/red.ts` as unclaimed. Delete the file. Then tamper with `biome.boundaries.json` (change one message string), run `pnpm boundaries:check` → FAIL; restore the file (regenerate) → exit 0.

- [ ] **Step 5: Verify the whole tree is still green**

Run: `pnpm lint`
Expected: exit 0. Then `git status --short` — expected: no changes left from the temp-file churn. If anything unexpected shows up, do not commit it; record it in the ledger. If truly nothing changed, no commit is needed for this task — record the four red-check outputs in the ledger instead.

---

### Task 5: Documentation

**Files:**
- Modify: `docs/architecture.md`
- Modify: `AGENTS.md` (Working rules section)

**Interfaces:**
- Consumes: the design doc (the source of truth for the rule).
- Produces: the working rule developers and agents actually see.

- [ ] **Step 1: Add "Domain boundaries" to `docs/architecture.md`**

Short section: the rule (a domain module may only be imported from its own domain and shared modules; shared from anywhere); where the classification lives (`scripts/domain-map.json`, enforced by `biome.boundaries.json` via `pnpm lint`); how to add a new domain or module (edit the map, run `pnpm boundaries:generate`); the working rule for `packages/api`: cross-area imports use `@repo/api/<area>/*` specifiers, never relative (relative stays fine within one area or toward the kernel); the accepted limitation (a relative cross-domain import is not caught mechanically).

- [ ] **Step 2: Add one line to `AGENTS.md` working rules**

"Domain modules are imported only within their own domain; the map in `scripts/domain-map.json` is enforced by Biome (see architecture, Domain boundaries). Inside `packages/api`, import across areas via `@repo/api/<area>/*`."

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md AGENTS.md
git commit -m "docs: domain boundary rule and map maintenance"
```

---

### Task 6: Full verification and ledger

**Files:**
- Modify: this plan file (check off tasks, add the verification summary)

- [ ] **Step 1: Run the package checks**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all exit 0.

- [ ] **Step 2: Run the full e2e suite**

Run: `pnpm e2e:up && pnpm e2e`
Expected: all specs pass (the guest-function move is the only runtime-touching change; e2e proves nothing regressed).

- [ ] **Step 3: Update the ledger**

Check off Tasks 1–6 in this file, fill in the Task 1 Step 6 / Task 3 Step 1 violation lists as observed, and append a verification summary (commands, results, findings).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-11-23-granice-domenowe-biome.md
git commit -m "docs: verification summary for Biome domain boundaries"
```
