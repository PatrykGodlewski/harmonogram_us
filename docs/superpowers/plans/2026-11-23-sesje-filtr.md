# Programme narrowed to one session (F33 follow-up) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A participant can show only one session (e.g. „Strefa Nauk Ścisłych”) of an event's programme, together with the place filter.

**Spec:** F33. User (23.11): "I should be able to filter by session/group".

## Decisions

- A native select „Sesja” („Wszystkie sesje” + each distinct session title in time order): sessions sharing a title (the same zone on several days, a copy kept under its name) are one option. Combines with the place filter (both must match). URL `?session=<title>`; an unknown title shows everything. Items outside sessions are hidden while a session is chosen. Shown when the programme has two or more distinct session titles; list and calendar follow it.

## Tasks

### Task 1: Helpers
- [x] Tests (`packages/ui/test/agenda.test.ts`): `programmeSessionTitles(sessions)` distinct titles in time order; `filterBySession(items, sessions, title)` keeps sessions with that title and their items; null keeps everything. Fail, implement, pass.

### Task 2: Select on the event page
- [x] e2e first: `[F33] uczestnik pokazuje tylko jedną sesję @uczestnik` (choose „Ćwiczenia”: only its region and items; URL keeps it; together with a place that has none of it → empty message; „Wszystkie sesje” restores). Fail, implement, pass; pl/en; full checks; push.

## Verification summary (23.11)

- Task 1: `programmeSessionTitles`/`filterBySession` tests RED→GREEN.
- Task 2: `[F33] uczestnik pokazuje tylko jedną sesję` RED (no „Sesja” control) → GREEN on desktop and phone.
- Checks: `pnpm test` db 274, api 168, worker 24, ui 39, rpc 3; web typecheck and lint clean; `pnpm e2e` on a freshly built stack: 208 passed, 1 skipped.

