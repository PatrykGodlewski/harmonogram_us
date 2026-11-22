# Evidence, review findings and reports

Evidence before claims. Use the [workflow](workflow.md) to decide completion and [testing policy](testing.md) to choose checks. Do not claim “bug-free”, “all tests pass” or “requirements met” beyond what was actually verified.

## Record evidence without another tracker

Keep one execution ledger per plan using the installed Superpowers format/location. Record task identity, commands/results, material deviations and blockers as they occur. Session todos and plan checkboxes reflect that work; they do not replace evidence. Do not store full logs in the default agent context or invent results from an earlier session.

For each check, record:

- Exact command and local/CI source, time, revision and any relevant uncommitted code/configuration.
- Result: passed, failed, blocked or not run; exit status and selected test/project counts where applicable.
- Acceptance criterion/test mapping and observed outcome; expected red failures must be labelled separately from final results.
- Relevant failure excerpt or artifact reference, and limitations (filters, missing browser project, unverified environment).

Keep secrets, invitation/ticket tokens, personal information and sensitive environment values out of reports/log excerpts. Use existing CI/Playwright artifacts for large output, with retention-aware links. Preserve the concise outcome even when artifacts will expire.

## Responding to findings

A review finding should contain location, observed problem, consequence, evidence/reproduction and a proposed correction. Distinguish a confirmed defect from a suspected risk or optional improvement. Grade by user/data impact, not whether the spec happened to mention the input.

| Finding/result | Action |
| --- | --- |
| Regression introduced by this work | Reproduce, fix the cause, add/update regression coverage and rerun affected checks |
| Confirmed security, authorization, data-loss or integrity defect | Blocking; stop unsafe actions, resolve before closure, and escalate if remediation needs approval |
| Other critical/important acceptance or reliability defect | Blocking; fix and verify before plan closure |
| Reviewer appears incorrect | Inspect the code/requirement, record technical evidence and rationale; unresolved material disagreement stays visible for user decision |
| Suspected risk without reproduction | Investigate and label uncertainty; do not dismiss or present it as a proven bug |
| Minor optional improvement | Defer explicitly with impact/follow-up; do not expand scope to polish everything |
| Existing unrelated failure | Record baseline evidence and impact; do not silently fix unrelated code or claim a clean suite |
| Infrastructure failure, timeout or pending CI | Mark required verification blocked/pending and state missing evidence; ask when resources/authorization are needed |
| Flaky test / retry-only success | Preserve the initial failure, investigate isolation/timing, report instability; do not silently accept as reliable green |

Use `superpowers:systematic-debugging` for unclear failures. Fixes need an observed regression failure followed by passing results, then affected suite checks. Never remove safeguards or weaken assertions to satisfy the report. An agent/reviewer saying “done” is not evidence: inspect the change and verification results.

Document decisions as rulings with the finding, chosen action, reason and cost if wrong, using the installed ledger format. A ruling cannot silently waive a required check or product criterion. If a blocker cannot be resolved within scope, report the task/plan as incomplete or blocked. Optional follow-ups need not become a second issue tracker; use existing GitHub issues (in Polish) when appropriate and authorized.

## Durable plan verification summary

Before temporary Superpowers workspace cleanup, append/update a short summary in the tracked plan. This is the final evidence snapshot, not another progress ledger. Do not copy every log or create mandatory per-task report files.

```md
## Verification summary

- Verified: date/time, revision/change range, relevant uncommitted changes.
- Scope: implemented acceptance criteria; partial or unverified criteria.
- Evidence: criterion → test path/name → exact command → observed result.
- Final checks: lint/typecheck/unit/integration/build/e2e results and CI/artifact links.
- Review: independent reviewer or explicitly labelled self-review; scope and outcome.
- Decisions: material deviations/rulings, including reason and risk.
- Open findings: blockers, deferred minors and follow-up references.
- Status: complete / partial / blocked; next action if not complete.
```

Keep historical verification dated. If later behavior changes, update current status and affected evidence without rewriting old results as if they never happened. A feature-level status in the spec must cover the whole applicable acceptance criteria, not merely one successful subtask.

## User-facing completion or handoff

Routine work needs a concise final message, not a new report file:

1. **Changed:** deliverables, affected paths and behavior impact.
2. **Verified:** commands and actual results; clearly distinguish local/CI and targeted/full coverage.
3. **Open:** failures, unverified criteria, material rulings, deferred findings and required next steps.

For plan completion, link its durable summary and include all material rulings and deferred review findings; do not leave them only in temporary plugin files. State when independent review or required infrastructure was unavailable. Persist a separate report only when requested or when a substantial review needs detail beyond the plan summary.
