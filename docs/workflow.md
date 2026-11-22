# Development workflow and Superpowers

Read when planning, implementing, resuming or closing a feature, bug fix or substantial refactor. Use the [testing policy](testing.md) for checks and [reporting policy](reporting.md) for evidence and findings. Documentation-only work uses relevant document checks, not a fabricated application-test cycle.

## Sources of truth

| Artifact                                                                                       | Owns                                                                                              |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Product spec](superpowers/specs/2026-11-19-produkt-design.md) and explicit approved decisions | Required behavior and acceptance criteria; feature-level status in the spec                       |
| Relevant approved plan in `docs/superpowers/plans/`                                            | Task boundaries, dependencies, files/interfaces, expected outcomes and checkboxes                 |
| One Superpowers progress ledger per plan                                                       | Execution history, verification results, rulings and blockers; session todos are only a live view |
| Verification summary in the tracked plan                                                       | Durable evidence and unresolved gaps after temporary execution artifacts are removed              |

Code and tests establish implementation state, not permission to change requirements. Never weaken the spec or acceptance criteria to fit existing code. Apply an explicit superseding product decision to the affected spec/plan with a dated note and source; do not wait until plan closure to reconcile a known conflict. Ask when authority or scope is unclear.

## 1. Start or resume: reconcile before coding

1. Read `AGENTS.md`, relevant docs, approved requirements and the plan. Inspect nearby code/tests, current worktree changes and relevant Git history; preserve unrelated work.
2. Locate the plan's existing ledger using the installed Superpowers skill. Read its identity, completed tasks and rulings. Do not create another ledger or redo completed work merely because session memory was lost.
3. Compare remaining tasks, existing checkboxes and recorded completions with the current implementation. Classify discrepancies as missing, partial, implemented-but-unverified, verified, blocked or superseded. Run affected checks when implementation/evidence is missing or later changes may invalidate it; do not rerun unrelated completed tasks mechanically.
4. Check task dependencies and shared interfaces. Correct stale paths, commands and implementation details within approved scope; record material deviations as rulings. Resolve requirement conflicts before executing dependent tasks.
5. Record the baseline revision and existing relevant failures. Resume from the first unfinished deliverable, not automatically Task 1. Existing code without red–green evidence needs honest current verification, not an invented historical TDD claim.

A checked box is a claim to inspect, not proof. A later regression reopens the affected current task/criterion with an explanation; an infrastructure outage marks verification blocked, not evidence that the implementation disappeared. Preserve historical results as historical.

## 2. Plan testable deliverables

Keep one active plan of roughly ten coherent tasks. Each feature implementation task is a feature or coherent slice with relevant `[Fn]` e2e coverage; an existing test can qualify if it proves that deliverable and is run. Do not defer all browser evidence to a later task. Each task names affected files, interfaces, acceptance criteria, tests, exact executable verification commands and expected results. Plans describe decisions, not large pasted implementations. Fold setup and documentation into the deliverable that needs them.

Use this compact structure when creating or repairing a task (replace descriptive fields with actual paths/commands):

```md
### Task N: User-visible deliverable

Requirements: feature ID and specific acceptance criteria.
Acceptance: observable success, relevant rejection/boundary cases and invariants.
Files/interfaces: affected paths and contract changes.
Tests: relevant [Fn] e2e path/name/projects plus required lower-level tests.
Verification: exact commands, expected outcomes and prerequisites.

- [ ] Write the acceptance/regression test and observe the expected failure.
- [ ] Implement the smallest complete solution.
- [ ] Run checks, review/simplify, rerun affected checks.
- [ ] Verify the deliverable and update plan/spec evidence.
```

A setup failure is not the expected red test. A test already passing before new implementation is a reason to inspect existing behavior or test quality. Documentation-only tasks and behavior-preserving refactors use appropriate checks/existing regression coverage rather than artificial failing feature tests.

## 3. Execute with Superpowers

Load the actual installed skills; do not guess script paths, plugin versions or slash commands. Skills may differ by version. Project safeguards and user authorization still apply: a skill or old plan does not authorize destructive actions, commits, branch/worktree creation, merges, pushes or publishing. Obtain explicit authorization where needed.

| Situation                            | Skill                                        |
| ------------------------------------ | -------------------------------------------- |
| New or changed product requirements  | `superpowers:brainstorming`, then approval   |
| New plan or substantial replanning   | `superpowers:writing-plans`                  |
| Default execution                    | `superpowers:executing-plans` (inline)       |
| Test-first implementation/fixes      | `superpowers:test-driven-development`        |
| Unexpected failure or unclear defect | `superpowers:systematic-debugging`           |
| Any completion/passing claim         | `superpowers:verification-before-completion` |
| Final fresh-context review           | `superpowers:requesting-code-review`         |

Use `superpowers:subagent-driven-development` only when that execution mode is deliberately chosen for sufficiently complex work. Keep the same plan/ledger when changing executors. If required skills or a reviewer tool are unavailable, state the limitation; do not pretend invocation or independent review occurred. A self-review fallback must be labelled and cannot silently satisfy an independent-review requirement.

For each task: read its current brief and relevant rulings, write/run the failing test, implement, run the planned checks, review/simplify and rerun affected checks. Record results as work happens, not from memory at the end. Use installed task/ledger helpers when available, but a helper's success does not replace checking acceptance criteria.

Continue within approved scope without asking after every task. Record justified implementation corrections; ask before product-scope changes, unsafe/unauthorised side effects or when no evidence-backed path remains.

## 4. Completion contract

Check off a step only after its stated result is observed; writing a test and observing its failure does not complete the feature. Complete a deliverable only when:

- Every acceptance criterion maps to implementation and an appropriate assertion. Each feature implementation deliverable has relevant passing `[Fn]` Playwright evidence exercising its user-visible effect, alongside needed lower-level tests; the non-feature exceptions above still apply.
- Named checks ran and their output/exit status was inspected. Required checks are passing, not skipped, filtered out, pending or blocked.
- Simplification preserved safeguards and relevant checks passed after the last implementation change.
- Deviations, blockers and evidence are recorded in the ledger; tracked plan checkboxes reflect actual progress.

Task verification is not whole-plan verification. Update feature-level status only for acceptance criteria actually covered: completing duplication alone does not complete F3. Keep partially implemented features partial and identify gaps. Never claim “bug-free”; state what was verified and at which revision.

## 5. Final review and closure

1. Review the full change range against every applicable requirement, not only the last commit. Include relevant uncommitted changes and identify them, without claiming another contributor's work as your own.
2. Request one fresh-context whole-plan review with spec/plan paths, change range, acceptance/test mapping, the plan's review-focus risks, verification results and rulings. Per-task self-review remains part of implementation; a separate reviewer per task is not the inline default.
3. Resolve findings using [reporting.md](reporting.md#responding-to-findings). Fix confirmed blockers with regression coverage and rerun affected checks. Document contested/deferred findings; do not claim closure while required checks or blocking findings remain unresolved.
4. Run final applicable checks from [testing.md](testing.md#when-to-run-checks) against the final code. Review requirement-by-requirement; a green suite does not establish untested requirements.
5. Synchronize plan checkboxes, remaining work and spec feature statuses. Before any plugin cleanup, preserve the [verification summary](reporting.md#durable-plan-verification-summary) in the tracked plan. This is evidence, not a second progress ledger.
6. Report results and limitations to the user. Clean up only this plan's temporary artifacts when authorized and evidence is preserved. Git operations still require authorization; do not automatically commit, merge or delete unrelated work.

## Adoption for existing plans

Apply this workflow on the next start/resume. Add only missing acceptance/verification detail and correct demonstrated drift; do not rewrite historical plans wholesale. Do not mass-check tasks, upgrade feature statuses or claim a retrospective audit merely because this policy was added.
