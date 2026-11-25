# Programme item details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Each programme item has its own page with everything a visitor needs to decide on it, as on the Śląski Festiwal Nauki programme: what it is, who leads it, where and when, how many seats are left, a full description, the speakers with their bios, and an image.

**Spec:** F18 (programme), F19 (speakers and their materials). User (24.11): "details of a agenda specific entry should be more detailed", with the example from slaskifestiwalnauki.pl/program, "also there is posibility to add image".

## Decisions

- **Page** `/events/$eventId/program/$itemId` (web): shareable, with Open Graph tags; it reads the event page's query (no new endpoint) and 404s for an unknown item. Rows in the programme list and blocks in the calendar link to it; the list row stays short (time, place, title, speakers' names, seats, action; the description is clamped to two lines).
- **Layout** (mobile first): back link to the event; the category as an eyebrow; title; image (or a pixel checkerboard band without one); **Informacje podstawowe** (category, field, languages, faculty, audience; rows only for what is filled); **Gdzie i kiedy** (long date and time, place and session, seats as `wolne / limit` with „Brak wolnych miejsc”, and „aktualizacja HH:MM” from the query's last refresh); the register action; **Szczegóły** (description, line breaks kept); **Prowadzący** (each speaker: monogram, name, institution, unit, bio collapsed after four lines with „Więcej”); materials.
- **New item fields** (all optional):
  - `type_id` → `event_types` (category: „Wykład”, „Warsztaty”…; the same list as events);
  - `faculty_id` → `event_faculties` (organising unit);
  - `topic` ≤ 100 („Obszar wiedzy”), `audience` ≤ 100 („Grupa wiekowa”), free text in the organiser's words;
  - `languages` text[] of codes from a fixed list (pl, en, de, uk, fr, es), shown with `Intl.DisplayNames` in the visitor's language.
- **Speakers** (jsonb) gain `unit` ≤ 200 and `bio` ≤ 3000. Speaker photos are not part of this plan (a monogram stands in).
- **Image:** `image_key` and `image_alt` (≤ 200, required with an image). PNG, JPEG or WebP up to 5 MB, uploaded from the item dialog once the item exists; replacing or removing it, or deleting the item or event, records the old key in `stored_file_deletions` (trigger, as for event files). `/api/agenda-items/$id/image` answers 302 to a short signed link with `inline` disposition: on the web for whoever may open the event, in the panel for its managers; 404 otherwise.
- Duplicating an event or copying a session copies the new fields but not the image.

## Tasks

### Task 1: Item details in data and server

Requirements: F18/F19 fields above.
Acceptance: create/update store and return the new fields; invalid language codes, over-long text and unknown types/faculties are refused; duplicate/copy keep them; the image key goes to `stored_file_deletions` when replaced, cleared or deleted with its item.
Files/interfaces: `packages/db/src/schema/agenda.ts`, migration 0040 (+ trigger), `packages/db/src/queries/agenda-items.ts`, `event-duplicate.ts`, `agenda-sessions.ts`; `packages/api/src/events/schemas.ts`, `packages/api/src/admin/agenda-item-image.ts`, `packages/api/src/files/image.ts`; routes `apps/{web,admin}/src/routes/api/agenda-items/$itemId.image.ts`.
Tests: `packages/db/test/agenda-item-details.test.ts`, `packages/api/test/agenda-item-image.test.ts`.

- [x] Tests first, observe failure.
- [x] Implement; `pnpm --filter @repo/db test`, `pnpm --filter @repo/api test` pass.

### Task 2: Organiser fills in the details

Requirements: the item dialog edits every new field; speakers have unit and bio; an existing item takes an image with alt text and can drop it.
Tests: `[F18] organizator opisuje punkt programu jak w programie festiwalu @organizator` in `e2e/tests/f18-szczegoly-punktu.spec.ts`.

- [x] e2e first (RED), implement, GREEN on komputer and telefon.

### Task 3: Visitor opens the item page

Requirements: the page layout above, linked from the list and the calendar.
Tests: `[F18] punkt programu ma własną stronę ze szczegółami @uczestnik` (fields, seats, speaker bio, image alt, register from the page, unknown item → not found); the F8 audit covers the page.

- [x] e2e first (RED), implement, GREEN; pl/en messages; a11y audit.
- [x] Full checks (lint, typecheck, unit, build, e2e), review and simplify, verification summary here, push.

## Verification summary (24.11)

- Unit: `@repo/db` 47 files / 284 tests (5 new, `agenda-item-details.test.ts`), `@repo/api` 31 files / 175 tests (4 new image tests, inline presign), `@repo/ui` language names. RED before the code in each case.
- e2e: both `[F18]` tests in `f18-szczegoly-punktu.spec.ts` RED (missing controls, missing link) → GREEN on komputer and telefon; the F8 public audit includes the item page.
- Found on the way: the signed-out header overflowed by 11 px at 320 px (my earlier `shrink-0` on the header actions). The actions now take the remaining width and wrap only when they must; labels are `text-xs` below `sm`. One row at 360 px and up.
- `pnpm lint` and `pnpm typecheck` 15/15, `pnpm test` green; full `pnpm e2e` on a fresh build: 240 passed, 1 skipped, 2 failed: only `f37-tmp-scaffold-check.spec.ts`, an intentional TODO scaffold from a parallel session, not part of this plan.
- Not in this plan: speaker photos (a monogram stands in).

## Review follow-up (24.11)

Fresh-context maintainability review of fad43ab. Fixed:
- an item without its own limit showed as full when the event was full (regression test `[F18] punkt bez własnego limitu…`, RED → GREEN); one `itemSeatCount`/`isItemFull` for row, calendar, timeline and page;
- languages in one dependency-free module (`@repo/db/agenda-languages`); `AGENDA_ITEM_LIMITS` shared by form and server;
- image server functions in `admin/agenda-item-image.ts`, covered with `materials.ts` by the access-check guard test;
- shared Open Graph head, item route error page, one empty-options default, `toPayload` out of the dialog, signing time back as a named option.

Open, proposed to the user: lighter polling (seat counts apart from the programme's text), a cacheable image URL, splitting the item dialog with TanStack Form `withForm` (a shared form pattern), one upload helper for files and images.

Checks: lint/typecheck 15/15, unit green, full e2e 242 passed, 1 skipped.
