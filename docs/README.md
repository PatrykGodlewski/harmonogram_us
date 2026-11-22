# Documentation map

Shared agent rules live in [AGENTS.md](../AGENTS.md). Claude imports that file through `CLAUDE.md`; Cursor uses the root `AGENTS.md` directly. Keep tool-specific files free of duplicated rules. Read only the documents needed for the task, not this entire tree.

| Task                                                                       | Read                                                                                            |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Product scope and acceptance criteria                                      | [Product spec](superpowers/specs/2026-11-19-produkt-design.md), then the relevant approved plan |
| Package boundaries, API/auth, routing, i18n, config, metrics, deployment   | [Architecture](architecture.md)                                                                 |
| Capacity, registration, groups, waitlists, Electric or queued jobs         | [Data-flow invariants](data-flows.md)                                                           |
| Security process, licence, dependency and CI controls                      | [Security](security.md)                                                                         |
| Plan creation/reconciliation, execution, resuming, completion, Superpowers | [Workflow](workflow.md)                                                                         |
| Test selection, test-writing standards and when to run checks              | [Testing](testing.md)                                                                           |
| Evidence, review findings, blockers and completion reports                 | [Reporting](reporting.md)                                                                       |
| Setup, commands, UI components and code simplification                     | [Development](development.md)                                                                   |
| Load-test details                                                          | [Load-test guide](../e2e/load/README.md)                                                        |
| Where we stand against Indico (snapshot with sources)                     | [Indico comparison](indico-comparison.md)                                                       |

## Product and plan context

The product spec defines F1–F27, priorities, acceptance criteria, conflicts and deferred monetisation. Indico is inspiration, not a parity target. GitHub issues are in Polish; inspect current issues with `gh issue list` when relevant.

Before starting/resuming a plan, reconcile it with approved decisions, current code/tests and its existing ledger using the [workflow](workflow.md). Plan checkboxes and spec statuses require evidence; adding these policies does not audit or certify existing features. Keep one execution ledger per plan, with a durable verification summary in the tracked plan at closure.

Planning references (not a live completion tracker):

1. [Foundation and waitlist](superpowers/plans/2026-11-19-fundament-i-lista-rezerwowa.md): e2e foundation, simplifications, waitlist and registration email.
2. [Organiser management](superpowers/plans/2026-11-20-organizator-jak-w-indico.md) (completed 20 November; see its verification summary): roles/co-organisers, publish/cancel/duplicate, cancellation email, participant management and QR attendance. Its 20 November decision puts organisers in **`apps/admin`**, superseding the earlier `/manage` proposal for `apps/web`.
3. [GDPR, reminders, calendar, registrants](superpowers/plans/2026-11-20-rodo-przypomnienia-kalendarz-zapisani.md) (completed 20 November).
4. [Approval, invite-only events, certificates, recurring copies, speakers](superpowers/plans/2026-11-20-akceptacja-zaproszenia-zaswiadczenia.md) (plan 4; see its verification summary).
5. [Yellow areas: profile, questions, PDFs, accessibility](superpowers/plans/2026-11-21-ulepszenia-zoltych-obszarow.md) (plan 5; see its verification summary).
6. [University sign-in and full WCAG AA audit](superpowers/plans/2026-11-21-logowanie-uczelni-wcag.md) (plan 6; see its verification summary).
7. [Rust documents service, part 1: pattern and ticket](superpowers/plans/2026-11-21-rust-dokumenty-bilet.md) (plan 7; see its verification summary).
8. [Rust documents service, part 2: certificates, attendance sheets, pdf-lib removal](superpowers/plans/2026-11-21-rust-dokumenty-zaswiadczenia-listy.md) (plan 8; see its verification summary).
9. [Statistics (F15)](superpowers/plans/2026-11-21-statystyki.md) (plan 9; see its verification summary).
10. [Guests without an account (F17)](superpowers/plans/2026-11-21-goscie.md) (plan 10; see its verification summary).
11. Later priority-one work: profile language, campus calendar/ICS/Open Graph, accessibility and GDPR; consult the spec before planning.

Historical implementation context moved out of `CLAUDE.md`: F5 capacity/waitlist/promotion and account registrations; F6 registration email with ticket links; F11 ticket QR (`ticket_code`, scanning handled by organiser plan); F18 list/calendar agenda with parallel sessions (`layoutAgenda` in `@repo/ui/agenda`); F26 teacher-led group registration; F27 agenda-item registration. Related account/ticket/agenda work: [plan](superpowers/plans/2026-11-19-moje-zapisy-bilety-agenda.md). These are inherited implementation notes, **not a claim that tests were rerun during the documentation refactor**. Verify current code and tests before deciding what remains.

Previously recorded issue: group-invitation email links default to `/en/` because server functions lack a locale prefix; profile-language work was intended to address this. Verify whether it is still present. See [auth/localisation](architecture.md#auth-and-localisation) before changing locale handling.

## Historical documents

`superpowers/briefs/`, `audits/`, `parity/`, dated specs and plans retain decision history. Old statuses, paths and instructions to update sections of `CLAUDE.md` may be stale: update the corresponding focused document here instead. Do not load historical material unless the task needs it. The 18 November feature specs predate the consolidated product spec.
