# Participant flow: My events and account settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A signed-in person finds what they signed up for in one tap; rarely changed settings stay out of the way.

**Spec:** F1 (accounts), F5 (registrations), F11 (tickets), F12 (certificates). User (23.11): "refactor account details, rethink … how really user should use this app and apply best flow"; chose the split „Moje wydarzenia” + „Konto”.

## Decisions

- `/my-events` („Moje wydarzenia”): upcoming registrations as ticket cards (date stub, state, items, Wydarzenie / Bilet / Wypisz się), archive of past events (certificates), the teacher's groups, the personal calendar feed. Signing in without a destination lands here; the header links to it; a registration toast has a „Moje wydarzenia” action; certificate and rejection e-mails link here.
- `/account` („Konto”): tabs in the URL (`?tab=security|privacy`, profile by default): profile (name, language), security (password), privacy (export, delete). The internal user ID is no longer shown.
- Header (signed in): „Moje wydarzenia”, account icon, sign-out icon — one row at 360 px.
- Not done: a count of upcoming events next to the header link (the registrations query has no dates; a count could mislead).

## Tasks

- [x] e2e first: `[F5] po zalogowaniu „Moje wydarzenia” pokazują zapisy z biletem`, `[F1] konto ma zakładki ustawień zamiast jednej długiej strony` — RED on the previous build.
- [x] Routes, tabs component (`@repo/ui/components/tabs`, Radix), password form and groups split out of the account route, header, sign-in landing, toast action, worker link; existing tests moved to the page that now holds their content.

## Verification summary (23.11)

- Both new tests RED → GREEN on desktop and phone; worker 24 tests (e-mail link expectation updated).
- `pnpm e2e` on a freshly built stack: 230 passed, 1 skipped, 4 failed → `[F1] logowanie kontem uczelni…` moved to `/my-events` (14/14 with the new tests); the remaining failure is `[F19] wystąpienie z prelegentem…`, an existing bug unrelated to this plan: the agenda item dialog has one date with start and end times, so an item crossing midnight cannot be saved ("end before start"); it shows when the suite runs after 23:00.
