# Testing policy

Choose tests from changed behavior and risk, not a blanket coverage target. Commands and environment setup live in [development.md](development.md); task/completion gates in [workflow.md](workflow.md). Inspect package scripts, nearby tests and fixtures before adding new patterns.

## Which tests to write

| Change/risk                                                 | Required evidence                                                                                                                               |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure calculations, parsing, validation, formatting          | Focused Vitest unit tests for relevant inputs and boundaries                                                                                    |
| Queries, constraints, permissions, transactions, migrations | Integration tests against real test Postgres; include relevant failure/rollback behavior and schema/data compatibility                          |
| Capacity, waitlists, group places, locking                  | Concurrent DB integration tests asserting capacity and promotion invariants, not timing assumptions                                             |
| Server functions/API                                        | Input validation, direct unauthorized/forbidden calls, domain errors and resulting state; UI hiding is not authorization coverage               |
| Jobs/email                                                  | Handler tests and relevant enqueue atomicity, recipient/content, retry/idempotency behavior; user-visible email acceptance through Mailpit      |
| User-facing feature                                         | Playwright acceptance test named `[Fn] …` proving an observable effect, plus lower-level tests for exhaustive rules                             |
| Mobile UI/interactions                                      | Relevant desktop and 360 px Playwright flows; use `@uczestnik` or `@organizator` so the phone project actually selects them                     |
| Bug fix                                                     | Regression test reproducing the reported defect before the fix at the lowest useful layer; browser coverage when the integration/UI is material |
| Behavior-preserving refactor                                | Existing relevant regression tests; add coverage for discovered gaps without changing requirements                                              |
| Documentation/tooling/config only                           | Relevant links/schema/script/build checks; application tests only when runtime behavior is affected                                             |

Each feature implementation task needs relevant passing `[Fn]` e2e evidence before completion, not only the plan as a whole. Existing tests may supply it when they assert that deliverable; the table identifies additional lower-level coverage, not a substitute for this gate. Documentation-only work and behavior-preserving refactors retain their stated exceptions.

Select applicable cases: success, malformed input, permissions/ownership, empty/boundary state, rollback and concurrency. Do not duplicate every permutation in Playwright. Use [data-flow invariants](data-flows.md) for registration/sync/job changes. Load tests are appropriate for performance/capacity claims, not mandatory for unrelated work.

## How tests should behave

- Test public contracts and observable outcomes, not private helpers, incidental markup or implementation call sequences.
- Use existing isolated fixtures, deterministic inputs and reliable cleanup. Tests must tolerate parallel execution where the suite enables it; avoid shared mutable accounts/data unless deliberately serialized.
- Assert the meaningful result: persisted state, visible UI, downloaded content, email delivery or an invariant. “Did not throw” and screenshots alone rarely prove acceptance.
- Use semantic locators and Playwright's condition/assertion waiting; wait for the hydration marker where existing fixtures require it. Avoid arbitrary sleeps and selectors tied to styling.
- Observe the intended red failure, not missing infrastructure or syntax errors; then observe green after implementation. Do not invent red–green history for pre-existing code.
- Do not add `.only`, skip/quarantine required acceptance coverage, weaken assertions, raise timeouts or add retries merely to hide failures. Investigate flaky behavior; a retry pass does not erase the failure.
- Mock external service boundaries when appropriate, not the database/permission/transaction behavior the test claims to verify. Never use production secrets or send test mail to real users.

## When to run checks

| Stage                                                  | Run                                                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline/reconciliation                                | Affected existing checks when validating an unknown baseline or stale completion evidence; record existing failures                              |
| During a task                                          | New/changed test first, then relevant test files and affected package lint/typecheck; inspect actual results                                     |
| After simplification or a review fix                   | Regression test(s) and affected suites/checks again                                                                                              |
| Shared-package or cross-cutting change                 | Checks for affected consumers, not just the producing package                                                                                    |
| Closing a feature implementation plan / before merge   | `pnpm validate` (lint + `buf`, typecheck, test, build, Rust, e2e on a current stack); tie local or CI evidence to the final implementation       |
| Documentation-only or narrowly scoped non-runtime task | Appropriate document/config checks; explain omitted application checks                                                                           |

Use pnpm/Turbo package boundaries (`pnpm --filter <package> …`) before broad checks. Do not run the entire monorepo after every small edit. A filtered run proves only its selected scope: inspect test/project counts; zero selected tests is not a pass. A build does not replace typechecking.

Evidence may come from observed local execution or inspected CI for the same code/dependencies/configuration. Record which it was. Relevant later changes invalidate earlier passing evidence and require rerunning affected checks; unrelated prose edits do not invalidate runtime tests. Do not claim merge-ready while required CI remains pending or failing.

## Database and e2e safeguards

DB integration tests auto-create/migrate and truncate **only `harmonogram_us_test`**. Inspect configuration before destructive setup; never use the dev or production DB. Do not run destructive suites concurrently against the same database unless their isolation explicitly supports it.

Playwright uses the separate `harmonogram-e2e` Compose stack and its disposable application database; do not confuse it with the Vitest DB or the development stack. Root scripts/`e2e/ports.env` own its connection settings. Run `pnpm e2e:up` after implementation changes, then `pnpm e2e`; source edits are not hot-reloaded into built images. Iterate on a single spec with `scripts/e2e.sh run <spec> [--project=…]`, which rebuilds only when code changed, and never with the full suite. Preserve failure artifacts before rebuilding or tearing down.

`e2e/playwright.config.ts` defines `komputer` (1280 px) and `telefon` (360 px). Ensure required tagged tests were selected in both applicable projects. Use existing Mailpit and navigation fixtures. Never treat a passing desktop-only filter as mobile acceptance evidence.

If Docker, Postgres, browsers, credentials or time limits prevent a required check, record the command, failure/blocker and missing coverage. Do not mark required verification passed or completed. Follow [reporting.md](reporting.md#responding-to-findings) rather than changing unrelated code or suppressing failures.
