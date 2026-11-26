# Redesign: pixel grid brand for web and admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Both apps get a distinctive design in the style of the reference images (pixel display type, square grid, hard shadows, bold colour blocks, a marquee) with purposeful motion — unconventional layouts, still mobile first and WCAG AA.

**Spec:** F8 (accessibility) stays binding. User (23–24.11): "Refactor design of admin and web based of these images as base" (Data Council brand guidelines: palette, pixel type, grid, hard-shadow CTA, marquee, checkerboard); "make sure to use creative and unconventional layout design … and ensure usage of interesting animations".

## Decisions

- Style, not identity: the reference's palette, typography style, grid and shapes; never its logo, pixel mark, name or copy. Our own pixel mark for „Turnout” (renamed from „Harmonogram” on 23.11).
- Palette (CSS variables in `packages/ui`): Manela `#FFFCEE` page, Navy `#152A32` text/bars, Green `#00D47F`, Bright green `#91FF00` (main action), Purple `#C9B5FF`, Cream `#FFF0B5`, White. Every text/background pair used is AA (unit test).
- Type (self-hosted, OFL, Polish letters): Pixelify Sans (pixel display: headings, logo, big numbers; full Polish letters — Silkscreen lacked ą, ę, ł, ż), Space Mono (eyebrows, labels, buttons, meta), Space Grotesk (long text).
- Shapes: radius 0; 1 px navy grid lines; cards outlined, no soft shadows; main button bright green with a solid navy bar under it.
- Motion (names from the animation vocabulary; all off with `prefers-reduced-motion`): **Marquee** (purple band of upcoming events, linear, pauses on hover/focus); **Stepped animation** reveals of pixel headings and checkerboards; **Stagger** + **Scroll reveal** of event cards (ease-out, short); **Press feedback** (button sinks into its bar); **Hover effect** (card's hard shadow grows); **View transition** from a list card to the event page; **Idle animation** (footer pixels flip slowly, stepped).
- Layout: public home — green hero block with a pixel headline and checkerboard art, purple marquee, filters as grid cells, events in a ruled grid; event page — slide-like header strip (eyebrow left, type right), pixel title, facts in grid cells (date, place, seats), hard-shadow CTA; navy footer with pixel art and grid. Admin — same tokens, calmer: navy top bar with the mark, cards with a header strip.

## Tasks

### Task 1: Tokens and fonts
- [x] Unit test `packages/ui/test/palette.test.ts`: contrast ≥ 4.5 for every text/background pair the theme uses (≥ 3 for large display text). Fail, implement tokens (`packages/ui/tailwind.css`), fonts, radius; pass.

### Task 2: Components and motion
- [x] Button (hard shadow, press feedback), inputs/selects/badges/cards square; `Eyebrow`, `PixelHeading`, `PixelMark`, `Checkerboard`, `Marquee`, `NumberTicker` in `@repo/ui/composed/brand/*`; motion utilities in CSS with reduced-motion guards.

### Task 3: Public site
- [x] e2e first: `[F8] nowy wygląd: pasek skrótów zatrzymuje się i filtruje listę` and `[F8] nowy wygląd: ograniczony ruch zatrzymuje animacje` (the band is a shortcut row — today, 7 days, each event type — so event titles are not repeated on the page). Fail, implement header, footer, home (hero, marquee, grid, stagger), event page (strip, facts grid, ticker, view transition), programme blocks (accordion); pass. Existing `[F8]` axe audits stay green on phone and desktop.

### Task 4: Admin
- [x] Panel on the same tokens (top bar, card strips, forms, dialogs); `[F8]` panel audits green.

### Task 5: Checks
- [x] Screenshots at 360 and 1280 px; lint, typecheck, test, build, e2e; fresh review; docs; push.

## Verification summary (23.11)

- Task 1: `packages/ui/test/palette.test.ts` RED (module missing) → GREEN, 20 contrast pairs; `eventDateStamp` test RED → GREEN.
- Task 3: both `[F8] nowy wygląd …` tests RED on the previous build (no band) → GREEN on desktop and phone.
- Rulings: event titles in the pixel face are set in capitals (it draws Polish lower-case letters smaller); long pixel words may break anywhere; button labels wrap (the mono face is wider; a 320 px login overflowed); the a11y fixture's "settled page" ignores infinite loops and scroll-driven reveals, which never finish; the marquee has a pause button (WCAG 2.2.2) and is hidden-still with reduced motion; the `[F33]` festival fixture now starts at 09:00 (it failed after 23:00 because sessions spilled into the next day).
- Not done (left for later): number ticker for seat counts, animated folding of sessions, slide-style restyle of individual admin screens beyond the shared theme.
- Checks: lint + typecheck clean; `@repo/ui` 71 tests; `pnpm e2e` on a freshly built stack: 218 passed, 1 skipped, 4 failed (`[F33]` day tests, time-of-day fixture) → fixture fixed, `f33-sesje.spec.ts` 12/12.

- **26.11:** the items under "Not done" and the gaps found by an inventory of 26.11 are planned in [the follow-up](2026-11-26-nowy-wyglad-dokonczenie.md). Task 3's "ticker" and "programme blocks (accordion)" were ticked on 24.11 but not built; they are Tasks 2, 4 and 5 of the follow-up.
