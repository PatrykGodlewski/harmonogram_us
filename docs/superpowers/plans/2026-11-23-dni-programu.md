# Programme days on phones (F18/F33 follow-up) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A multi-day programme (a 3-day festival with 10 sessions and 55 items) is easy to read on a 360 px phone: days are named, a day can be chosen, long sessions start folded, and the calendar legend names each session once.

**Spec:** F18 (programme as list and calendar, several days), F33 (sessions). Source: the 360 px check of the festival example (23.11): no dates anywhere, a ~9300 px list, repeated legend names; user chose "Programme days".

## Decisions

- Days in the event time zone (`EVENT_TIME_ZONE`), key `YYYY-MM-DD`. A session belongs to the day it starts on, with all its items (also past midnight); an item outside sessions to the day it starts on.
- Public page, programme spanning two or more days:
  - day chips „Wszystkie dni · pt., 11.12 · sob., 12.12 · …” next to the place and session filters (URL `?day=YYYY-MM-DD`, unknown day = all);
  - the list shows a heading per day („piątek, 11 grudnia”, h3; session headings become h4);
  - the calendar follows the day filter (with all days it keeps one grid per day, as today).
- Long programmes fold: when the shown programme has more than 10 items, each session starts folded to its header with a button „Pokaż punkty programu (N)” / „Ukryj punkty programu” (`aria-expanded`); short programmes and a chosen session stay open.
- Calendar legend: one entry per session title and colour.
- Panel, multi-day events: day headings in the programme list and the date on each session card.

## Tasks

### Task 1: Helpers
- [x] Tests in `packages/ui/test/agenda.test.ts`: `programmeDays(items, sessions, timeZone)` (distinct days in order, by start); `filterByDay(items, sessions, day, timeZone)`; `entriesByDay(entries, timeZone)` (groups `programmeEntries` by day, keeps order); `sessionLegend(sessions)` (one per title+colour, time order). Test in `time.test.ts` for `formatEventDay` (short) and `formatEventDayLong`. Fail, implement, pass.

### Task 2: Public page
- [x] e2e first: `[F33] uczestnik wybiera dzień festiwalu @uczestnik` (3 days via db: day headings; „sob., …” chip shows only Saturday; URL keeps `day`; a session with many items starts folded and opens on its button; legend lists a repeated session once). Fail, implement, pass; pl/en.

### Task 3: Panel
- [x] e2e first: `[F33] organizator widzi dni programu i daty sesji @organizator` (day headings; session card shows its date). Fail, implement, pass; docs; full checks; review; push.

## Verification summary (23.11)

- Task 1: helper tests (`packages/ui/test/agenda.test.ts`, `time.test.ts`) RED → GREEN.
- Task 2: `[F33] uczestnik wybiera dzień festiwalu` RED (no day headings) → GREEN.
- Task 3: `[F33] organizator widzi dni programu i daty sesji` RED → GREEN.
- Final review (fresh, opus): Critical fixed — a folded session lost its button after a filter made the programme short, leaving its items unreachable (the block now restarts with the new fold rule; the day test asserts Saturday's items are visible, RED→GREEN). Important fixed — the trailing „now” line sat outside any list (`[F18] trwający ostatni punkt programu nie psuje listy`, axe `listitem`, RED→GREEN); the day filter split sessions running past midnight (days now follow the session's start day; unit test RED→GREEN), which also stops a session's own panel page from getting day headings.
- Deferred minors: the day-naming map is duplicated in the public page and the panel (could come from `programmeDays`); `entries.indexOf` inside the loop is quadratic (negligible at festival size).
- Checks: `pnpm test` db 274, api 170, worker 24, ui 50, rpc 3; lint and typecheck clean; `pnpm e2e` on a freshly built stack: 218 passed, 1 skipped. At 360 px the 3-day festival example went from ~9 300 px to ~3 000 px.

