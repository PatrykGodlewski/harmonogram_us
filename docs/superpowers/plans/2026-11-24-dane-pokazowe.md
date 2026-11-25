# Showcase seed data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A local database that shows what the app can do in a few minutes of clicking, instead of ~95 events nobody reads.

**Source:** User (24.11): "reduce amount of event seeders, create few events that show case most of possible combinations of data, and make agenda complicated similar to program of Śląski Festiwal".

## Decisions

- About ten hand-written events, each carrying several states: the festival (sessions, parallel items, item details, full items, per-item registration, a teacher's group); a hybrid lecture on right now; a full masterclass with a long waitlist; a workshop with one seat left; a school open day with teacher groups (one closed, one with a join link); a signed-in-only seminar with approval (two pending, one declined); an invite-only meeting; a past workshop with certificates and an attendance record; an online training without a programme; a cancelled lecture; a draft (panel only).
- The festival programme (`seed/festival.ts`): three days, four stages a day as programme sessions (20-minute talks every 25 minutes, 45-minute lectures, 90-minute workshops with small limits and age groups, open shows without registration), about 60 items with category, field, languages, unit, audience, speakers with institution, unit and bio.
- No random generator for events: the bulk generator goes; participants stay (60, e-mail-link sign-in) for waitlists and full items.
- Re-seeding removes seeded events no longer in the set (`evt-…`, `gen-…` ids); user-created events (UUID ids) are never touched. Seeding still refuses production.

## Tasks

- [x] `packages/db/test/seed.test.ts` first: at most 12 events; the festival has ≥ 50 items in ≥ 10 sessions, parallel items, items with details and bios, a full item; cancelled and draft events exist; old generated events are removed; existing showcase checks kept. RED, implement, GREEN; `pnpm --filter @repo/db test`.
- [x] Docs (`docs/development.md` seed line, run message), lint/typecheck, run `pnpm db:seed` on the dev DB and look at the festival page.

## Verification summary (24.11)

- `packages/db/test/seed.test.ts` rewritten first (RED: missing showcase modules, then a stale programme item kept on re-seed), now 11/11: ≤ 12 events, the festival has 3 days, ≥ 50 items in 12 sessions, parallel items, every item with category/field/languages/audience, bios, open shows, items inside their sessions, a full item; cancelled and draft events; old `gen-…` events and stale programme parts removed on re-seed; earlier showcase checks (last seat, waitlist 15 + 12, on now, attendance, groups, certificate, approvals, invite link) kept.
- Dev DB: `pnpm db:migrate`, `pnpm db:seed` → 10 events; festival calendar and item page checked at 390 px.
- Not removed: participant accounts 61–150 from older seeds stay in existing local databases (deleting users is not worth the risk for a dev seed).
