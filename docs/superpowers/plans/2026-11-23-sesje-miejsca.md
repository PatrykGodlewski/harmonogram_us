# Programme narrowed to one place (F33 follow-up) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A participant can see only the part of an event's programme that happens in one place (e.g. Sosnowiec) with one tap.

**Architecture:** Pure helpers in `@repo/ui/agenda` derive the programme's places and filter items and sessions by place; the public event page shows place chips above the programme (list and calendar) when there are two or more places; the choice lives in the URL (`?place=<locationId>`).

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md` F33. User (23.11): "User should have easy preview of selected session for example someone is interested only in content that is happening in sosnowiec"; chose "By place" (chips „Wszystkie miejsca · Katowice · Sosnowiec”, shareable in the URL).

## Decisions

- An item's place is its own location, else its session's. A session shows when it has a matching item or its own location matches.
- Items without any place (e.g. a lunch break with no location) are hidden while a place is chosen.
- Chips only when the programme has two or more places; order by first appearance in time; an unknown `place` shows everything.
- Calendar view and its session legend follow the filter.

## Tasks

### Task 1: Helpers
- [x] Tests in `packages/ui/test/agenda.test.ts`: `programmePlaces(items, sessions)` lists distinct places (id, label) in time order, items inheriting the session's place; `filterByPlace(items, sessions, placeId)` keeps items whose place matches and sessions with a match or their own place; null keeps everything. Fail, implement, pass.

### Task 2: Chips on the event page
- [x] e2e first: `[F33] uczestnik zawęża program do jednego miejsca @uczestnik` (choosing Sosnowiec shows only its session and items; link keeps `?place=`; „Wszystkie miejsca” restores). Fail, implement (`apps/web/src/components/event-details/agenda-place-filter.tsx`, route search `place`), pass; messages pl/en; full checks, review, push.

## Verification summary (23.11)

- Task 1: place helpers in `packages/ui/test/agenda.test.ts` RED→GREEN.
- Task 2: `[F33] uczestnik zawęża program do jednego miejsca` RED (no „Miejsce” group) → GREEN on desktop and phone.
- Checks: `pnpm test` db 274, api 168, worker 24, ui 37, rpc 3; web typecheck and lint clean; `pnpm e2e` on a freshly built stack: 206 passed, 1 skipped.

