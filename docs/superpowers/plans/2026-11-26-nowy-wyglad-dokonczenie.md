# Redesign follow-up: finish the pixel grid brand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the redesign of 24.11 ([plan](2026-11-24-nowy-wyglad.md)): deliver the three items its summary left for later, repair two motion defects, and bring the screens that still carry the old look onto the brand.

**Spec:** F8 (accessibility) stays binding. The requirement is the "Decisions" section of the 24.11 plan; this plan adds no new design. User (26.11): "finish design refactor that is currently unfinished".

**Tech Stack:** as the redesign: Tailwind tokens in `packages/ui/tailwind.css`, brand components in `packages/ui/src/composed/brand/`, TanStack Router, Playwright, Vitest.

## What the 26.11 inventory found (main at 10e868f)

- **Left for later on 24.11:** number ticker for seat counts, animated folding of sessions, restyle of individual admin screens. None exists. Task 3 of the old plan ticks "ticker" and "programme blocks (accordion)"; the code has neither.
- **Defects:**
  - The view transition from a list card to the event page never starts. The names are set (`home-event-card.tsx`, `event-summary.tsx`), but no link asks for a transition and the router has no default.
  - With reduced motion, dialogs, alert dialogs, sheets, dropdown menus, selects and tooltips still zoom and slide: the guard in `tailwind.css` covers only the brand classes, not the `tailwindcss-animate` ones.
- **Missing from "Decisions":** card stagger; stepped reveal of checkerboards; facts in grid cells on the event page; filters as grid cells; events in a ruled grid; a navy admin top bar with the mark (inside the panel the bar is cream, and on a phone no mark shows until the menu opens); admin cards with a header strip (only the event summary card has one).
- **Old look still visible:** soft shadows (bulk actions bar, dropdown, select, sheet, materials card, session filter, human check); pills and rounded corners (`rounded-full`, plain `rounded`, `rounded-xs`); Tailwind palette colours instead of tokens (publish checklist, registrants list, ticket scanner, agenda row, alert, "now" marker, admin error page); `dark:` classes although there is no dark theme; dead `rounded-sm/md/lg/xl` classes (the theme maps them to 0).
- **Never restyled:** ticket, group, join, registration choice and widget screens; admin list pages, scanner and session page.
- **Untested:** two colour pairs in use are not in the palette test (manela on slate, and the sidebar accent pair).

## Rulings (architect, 26.11)

1. **Admin top bar:** navy at every width, as "Decisions" says. It shows the mark whenever the sidebar is off-canvas or collapsed (always on phones).
2. **Reduced motion, press and hover:** an instant state change is allowed (the button still sits lower when pressed, the card still shows its shadow on hover); nothing may move over time. Exception: the spinner of a loading toast keeps turning, because it is the only sign of progress. The skeleton pulse stops.
3. **Number ticker:** every seat count on the public site (event page, event cards, programme rows, calendar blocks, programme item page) and the numbers on the admin event summary and statistics cards. It animates only when the value changes after the first paint, never on load. Assistive technology gets only final values. No new polling: admin numbers change when the page already refreshes them.
4. **Animated folding:** programme session blocks on the public site, which is what folds today. The speaker bio "more/less", the archive on "My events" and the phone filter panel stand. Admin sessions do not fold and stay that way.
5. **A finished admin screen:** navy top bar, page title in the pixel face with the stepped reveal, every section a card with a header strip, tables outlined with 1 px navy lines and a mono header row, no leftover shapes or colours. Nothing bolder: "Decisions" asks for a calmer panel.
6. **Session colours** (six hues chosen by the organiser, stored in the database) stand: they carry meaning and are never the only cue.
7. **Dots and bars** (session bars, "now" marker, progress bars, legend dots) are square: radius 0 everywhere.
8. **`bg-white`** stands: White is in the palette, and navy on white is a tested pair.
9. **Event page strip** stands as built: type on the left, attendance mode on the right, the same as the list card the title transitions from. The copied classes move to the `Eyebrow` component.
10. **Facts grid:** three cells under the cover. Date: date and time. Place: location and room; "Online" when the event has no place; both for a hybrid event. Seats: the count with the ticker, under the same conditions as the count shown today; when the page shows no count today, the cell shows the state the page already words (closed, ended, cancelled). The seat count leaves the action box, so the page has one live region for it. The faculty stays a badge under the title.
11. **Stagger:** the first six cards on first paint, in short steps with ease-out. A refetch, a filter change or "show more" does not replay it. Later cards keep the scroll reveal.
12. **Ruled grid and hover:** cells share 1 px navy lines with no gaps. A hovered or focused card lifts above its neighbours with the hard shadow.
13. **Form labels** use Space Mono: "Decisions" lists labels with eyebrows and buttons. The 320 px reflow audits decide whether a label needs to wrap.
14. **`dark:` classes** are removed.
15. **View transition:** the title, between the list card and the event page, requested on the card's link. Not a router default.
16. **`PixelMark`** is the existing `LogoMark`; no second mark is built.

## Global constraints

- F8: WCAG AA. Every `[F8]` audit in `tooling/e2e/tests/f8-dostepnosc.spec.ts` stays green on both projects. With `prefers-reduced-motion` nothing moves over time (ruling 2).
- Looks only: no new product behaviour, no new polling, no data or server changes, no new dependencies. Heading levels, region names and control names stay as they are, so existing tests keep finding them.
- Tokens only: colours from the theme, the three faces, radius 0, hard shadows.
- Phones first: design at 360 px; nothing overflows at 320 px.
- Tests first, seen failing for the right reason. New Playwright tests go into `tooling/e2e/tests/f8-wyglad.spec.ts`, named `[F8] nowy wygląd: …`, tagged `@uczestnik` (public site) or `@organizator` (panel) so the phone project runs them.
- UI text in both `packages/i18n/messages/{pl,en}.json`, then `pnpm messages:compile`. Reuse an existing message before adding one.
- One local e2e stack: every call is `flock /tmp/harmonogram-e2e.lock tooling/scripts/e2e.sh run …`.
- Each task saves screenshots of the screens it changed, at 360 px and 1280 px, to `/home/godlew/.hermes/cache/scratch/design-shots/task-N/` (never committed), taken from the local e2e stack with a temporary spec that is deleted afterwards.
- One commit per task with the message given; `node tooling/scripts/generate-status.mjs --check` passes (regenerate `docs/status.json` in the same commit if it drifts).

## Review focus

- Reduced motion: no enter or exit animation in any dialog, sheet, menu, select or tooltip; no ticker roll, fold, stagger or view transition.
- The ticker never announces intermediate values, and a 15 s refetch with an unchanged value causes no motion.
- Every text and background pair in use is in the palette test.
- Ruled grid: no double lines, no gap, and the lifted card is not clipped by its neighbours.
- No overflow at 320 px after the label face change and the facts grid.
- Region and heading names in the panel are unchanged.

---

### Task 1: No dialog or menu motion with reduced motion; shared components on brand tokens

Requirements: "Decisions": motion (all off with reduced motion), shapes, palette AA. Rulings 2, 7, 13, 14.
Acceptance: with reduced motion, opening and closing a dialog, alert dialog, sheet, dropdown menu, select and tooltip starts no animation, and the skeleton does not pulse. In `packages/ui/src/components` there is no soft shadow, no visible radius, no `dark:` class and no Tailwind palette colour; dead `rounded-sm/md/lg/xl` classes are gone from the files touched. Form labels are Space Mono. The palette test covers every pair in use, including manela on slate and the sidebar accent pair; theme colours outside the palette (`--sidebar-accent`, `--sidebar-border`) are either palette colours or added to `palette.ts` with their pairs tested.
Files/interfaces: `packages/ui/tailwind.css`; `packages/ui/src/components/{dialog,alert-dialog,sheet,dropdown-menu,select,tooltip,alert,badge,input,textarea,skeleton,label}.tsx`; `packages/ui/src/palette.ts`; `packages/ui/test/palette.test.ts`; `tooling/e2e/tests/f8-wyglad.spec.ts`.
Tests: `[F8] nowy wygląd: ograniczony ruch wyłącza animacje okien i menu` (reduced motion; open one dialog and one menu or select through an existing fixture path; no element has a running, finite animation). The existing reduced-motion test also checks `.scroll-reveal`. Palette unit test.
Verification: `pnpm --filter @repo/ui test`; `pnpm --filter @repo/ui typecheck`; `pnpm --filter @repo/ui lint`; `pnpm --filter web build && pnpm --filter admin build`; e2e `tests/f8-wyglad.spec.ts tests/f8-dostepnosc.spec.ts` on both projects.

- [ ] Write the tests and see them fail.
- [ ] Implement; checks pass; screenshots saved.
- [ ] Commit `fix(ui): no dialog or menu motion with reduced motion; shared components on brand tokens`.

### Task 2: Building blocks: number ticker, fold, section card, pixel heading

Requirements: "Decisions": type, shapes, stepped animation; old plan Task 2 component list. Rulings 3, 4, 5, 16.
Acceptance:
- `NumberTicker` (`packages/ui/src/composed/brand/number-ticker.tsx`): shows a number in tabular digits; when the value changes after the first paint, it steps to the new value in a short stepped animation; the moving digits are hidden from assistive technology and a visually hidden text carries the current value; with reduced motion the value switches at once; the server-rendered markup equals the first client render.
- `Fold` (`packages/ui/src/composed/brand/fold.tsx`): opens and closes its content with a short ease-out height animation; closed content is out of the tab order and the accessibility tree; the caller owns the state and the button; instant with reduced motion.
- `SectionCard` (extend `packages/ui/src/components/card.tsx`, which nothing imports today, or a composed component next to the brand ones): outlined box, header strip with a navy bottom line, the section heading inside the strip (a real heading, mono, uppercase), a slot for one action on the right, strip colour variants from the tokens. Carries `data-slot="card"` and `data-slot="card-header"`.
- `PixelHeading`: a heading in the pixel face with the stepped reveal; `PageHeader` and the four hand-written copies use it.
- `Checkerboard` reveals in steps once when it mounts (off with reduced motion), then keeps its idle flip.
- First use: the seat count on the public event page is a `NumberTicker`.
Files/interfaces: the four components above; `packages/ui/src/composed/brand/checkerboard.tsx`; `packages/ui/src/composed/page-header.tsx`; `packages/ui/tailwind.css`; `packages/ui/package.json#exports` if a new path needs it; `apps/web/src/components/event-details/event-summary.tsx` (count only); `packages/ui/test/*`; `tooling/e2e/tests/f8-wyglad.spec.ts`.
Tests: unit tests for `NumberTicker` (accessible text holds the final value; no animation class with reduced motion; first render static) and `Fold` (closed content is inert; open content is reachable). E2E `[F8] nowy wygląd: licznik miejsc pokazuje nową liczbę po zapisie` (a signed-in participant registers; the element `[data-slot=number-ticker]` on the event page shows one seat fewer).
Verification: `pnpm --filter @repo/ui test`; typecheck and lint of `@repo/ui` and `web`; `pnpm --filter web build`; e2e `tests/f8-wyglad.spec.ts tests/f5-zapisy.spec.ts tests/f8-dostepnosc.spec.ts`.

- [ ] Write the tests and see them fail.
- [ ] Implement; checks pass; screenshots saved.
- [ ] Commit `feat(ui): number ticker, fold, section card and pixel heading`.

### Task 3: Public home: ruled grid, filter cells, stagger, view transition

Requirements: "Decisions": layout of the public home; stagger and scroll reveal; view transition. Rulings 11, 12, 15.
Acceptance: the event list is a ruled grid at one and two columns: neighbouring cards share one 1 px navy line, with no gap and no double line, and a hovered or focused card lifts above its neighbours with the hard shadow. The filter controls sit in cells divided by 1 px navy lines, on a desktop and in the opened phone panel. The first six cards stagger in on first paint; a refetch does not replay it. Clicking a card's title runs a view transition to the event page. With reduced motion there is no stagger and no transition, and the page still navigates.
Files/interfaces: `apps/web/src/routes/index.tsx`; `apps/web/src/components/home-event-card.tsx` and the list components next to it; `packages/ui/src/composed/events/event-filters.tsx`; `packages/ui/tailwind.css` (stagger utility, reduced-motion guard); `tooling/e2e/tests/f8-wyglad.spec.ts`.
Tests: `[F8] nowy wygląd: karta przechodzi płynnie w stronę wydarzenia` (wrap `document.startViewTransition` in an init script; clicking a card title calls it; with reduced motion the page navigates and no view-transition animation runs). `[F8] nowy wygląd: lista wydarzeń to siatka ze wspólnymi liniami` (two neighbouring cards' boxes touch: the distance between them is at most 1 px).
Verification: typecheck and lint of `web` and `@repo/ui`; `pnpm --filter web build`; e2e `tests/f8-wyglad.spec.ts tests/f8-dostepnosc.spec.ts tests/f4-lista-wydarzen.spec.ts`.

- [ ] Write the tests and see them fail.
- [ ] Implement; checks pass; screenshots saved.
- [ ] Commit `feat(web): ruled event grid, filter cells, card stagger and view transition`.

### Task 4: Event page: facts grid; tickers on every public seat count

Requirements: "Decisions": event page layout. Rulings 3, 9, 10.
Acceptance: under the cover the event page has a description list of three cells divided by 1 px navy lines: date, place, seats (ruling 10). The header strip uses `Eyebrow`, the title uses `PixelHeading`. The action box keeps the hard shadow and the action; the count is in the seats cell and is the page's only live region for it. Event cards, programme rows, calendar blocks and the programme item page show their seat counts with `NumberTicker`. The programme item page's panels are section cards.
Files/interfaces: `apps/web/src/components/event-details/event-summary.tsx`; `apps/web/src/components/home-event-card.tsx`; `apps/web/src/components/event-details/{agenda-item-row,agenda-calendar,agenda-item-page}.tsx`; `packages/i18n/messages/{pl,en}.json` for the three cell labels (reuse existing messages where they fit); `tooling/e2e/tests/f8-wyglad.spec.ts`.
Tests: `[F8] nowy wygląd: fakty wydarzenia w trzech komórkach` (the event page has a description list with the three terms and their values for an on-site event, and "Online" as the place for an online one).
Verification: `pnpm messages:compile`; typecheck and lint of `web` and `@repo/ui`; `pnpm --filter web build`; e2e `tests/f8-wyglad.spec.ts tests/f8-dostepnosc.spec.ts tests/f5-zapisy.spec.ts tests/f18-program.spec.ts tests/f18-szczegoly-punktu.spec.ts tests/f3-odwolanie.spec.ts`.

- [ ] Write the test and see it fail.
- [ ] Implement; checks pass; screenshots saved.
- [ ] Commit `feat(web): event facts grid and seat tickers`.

### Task 5: Programme: animated session folding; old-look leftovers

Requirements: old plan summary, "animated folding of sessions". Rulings 4, 6, 7.
Acceptance: a folded session block on the public programme opens and closes through `Fold`; its button keeps `aria-expanded` and `aria-controls`; instant with reduced motion. In the programme components: the "now" marker, legend dots and session bars are square; the waiting-list hint and the "now" marker use token colours; the session filter is styled like the brand select.
Files/interfaces: `apps/web/src/components/event-details/{agenda-session-block,agenda-timeline,agenda-calendar,agenda-item-row,agenda-session-filter}.tsx`; `packages/ui/src/composed/{agenda-now,agenda-calendar-grid}.tsx`; `tooling/e2e/tests/f8-wyglad.spec.ts`.
Tests: `[F8] nowy wygląd: sesja rozwija się z animacją, a przy ograniczonym ruchu od razu` (an event whose session folds: clicking the button flips `aria-expanded`, an animation runs on the block with full motion and none with reduced motion).
Verification: typecheck and lint of `web` and `@repo/ui`; `pnpm --filter @repo/ui test`; `pnpm --filter web build`; e2e `tests/f8-wyglad.spec.ts tests/f8-dostepnosc.spec.ts tests/f33-sesje.spec.ts tests/f18-program.spec.ts tests/f4-kalendarz.spec.ts`.

- [ ] Write the test and see it fail.
- [ ] Implement; checks pass; screenshots saved.
- [ ] Commit `feat(web): animated session folding; programme on brand tokens`.

### Task 6: Panel shell and list screens

Requirements: "Decisions": admin layout. Rulings 1, 5, 7.
Acceptance: the panel's top bar is navy at every width and shows the mark whenever the sidebar is off-canvas or collapsed; at 360 px the mark and the menu button are both visible. The events list, the three lookup pages and the users page have a pixel page title with the stepped reveal and an outlined table with 1 px navy lines and a mono header row. The scanner page and the session page have the same title treatment; the scanner's result states and the panel's error page use token colours; the activity bar and the session colour bar are square.
Files/interfaces: `packages/ui/src/composed/admin/admin-layout.tsx`, `packages/ui/src/composed/admin-header.tsx`, `packages/ui/src/composed/admin/admin-entity-table.tsx`; `apps/admin/src/components/admin-users-page.tsx`, `admin-activity.tsx`, `check-in/ticket-scanner.tsx`; `apps/admin/src/routes/__root.tsx`, `_authenticated.tsx`, `events.$eventId_.scan.tsx`, `events.$eventId_.sessions.$sessionId.tsx` (header only); `tooling/e2e/tests/f8-wyglad.spec.ts`.
Tests: `[F8] nowy wygląd: panel ma granatowy pasek ze znakiem na telefonie` (at 360 px on the events list the banner's background is the navy token and it contains the mark; the session page passes the axe audit).
Verification: typecheck and lint of `admin`, `web` and `@repo/ui` (the layout components are shared); `pnpm --filter admin build`; e2e `tests/f8-wyglad.spec.ts tests/f8-dostepnosc.spec.ts tests/f11-skaner.spec.ts tests/f33-sesje.spec.ts tests/f7-panel-od-razu.spec.ts`.

- [ ] Write the test and see it fail.
- [ ] Implement; checks pass; screenshots saved.
- [ ] Commit `feat(admin): navy top bar with the mark; list screens on the brand`.

### Task 7: Panel event page: sections as cards

Requirements: "Decisions": admin cards with a header strip. Rulings 3, 5, 7. Merge `origin/main` first if the deferred review findings plan (`2026-11-22-poprawki.md`) has landed: it changes the behaviour of the materials and survey cards.
Acceptance: every section of the panel's event page and of the session page is a section card whose strip holds the section heading (same level, same name) and its main action when it has one: statistics, programme, materials, registrants, groups, both question cards, survey summary, organisers, publish checklist, invite link. The bulk actions bar has a hard shadow. Checklist marks, the registrant highlight, session swatches and progress bars are square and use token colours. The numbers on the summary and statistics cards are `NumberTicker`s.
Files/interfaces: `apps/admin/src/components/admin-event-detail/*` (the cards named above, `bulk-actions-bar.tsx`, `session-card.tsx`, `session-dialog.tsx`, `event-summary-card.tsx`, `event-stats-card.tsx`); `apps/admin/src/routes/events.$eventId.tsx` and the session route only where a wrapper moves; `tooling/e2e/tests/f8-wyglad.spec.ts`.
Tests: `[F8] nowy wygląd: sekcje wydarzenia w panelu mają paski nagłówków` (each named region contains a `[data-slot=card-header]` with its heading; the bulk actions bar's box shadow has no blur).
Verification: typecheck and lint of `admin` and `@repo/ui`; `pnpm --filter admin build`; e2e `tests/f8-wyglad.spec.ts tests/f8-dostepnosc.spec.ts tests/f3-strona-wydarzenia-panel.spec.ts tests/f7-zapisani.spec.ts tests/f14-materialy.spec.ts tests/f20-ankiety.spec.ts tests/f28-akcje-grupowe.spec.ts`.

- [ ] Write the test and see it fail.
- [ ] Implement; checks pass; screenshots saved.
- [ ] Commit `feat(admin): event page sections as cards with header strips`.

### Task 8: Remaining public screens

Requirements: "Decisions" applied to the screens the redesign never reached. Merge `origin/main` first if the deferred review findings plan has landed: it changes `widget.tsx`.
Acceptance: the ticket page, the group pages (group, new group, join link, member items), the join page, the registration choice and the widget use section cards, mono labels and token colours, with no leftover shape or colour and no dead radius class. The human check dialog has a hard shadow.
Files/interfaces: `apps/web/src/components/tickets/ticket-card.tsx`; `apps/web/src/components/groups/*`; `apps/web/src/routes/groups/$groupId.tsx`, `join/$code.tsx`, `events/$eventId_.groups.new.tsx`, `widget.tsx`; `apps/web/src/components/auth/event-registration-choice.tsx`; `packages/ui/src/composed/auth/human-check.tsx`; `tooling/e2e/tests/f8-wyglad.spec.ts`.
Tests: `[F8] nowy wygląd: bilet i grupa mają paski nagłówków` (the ticket page and a group page each show a card with a header strip).
Verification: typecheck and lint of `web` and `@repo/ui`; `pnpm --filter web build`; e2e `tests/f8-wyglad.spec.ts tests/f8-dostepnosc.spec.ts tests/f24-api-widzet.spec.ts tests/f11-bilety.spec.ts tests/f26-rejestracja-grupowa.spec.ts`.

- [ ] Write the test and see it fail.
- [ ] Implement; checks pass; screenshots saved.
- [ ] Commit `feat(web): ticket, group, join and widget screens on the brand`.

### Task 9: Checks, review, landing

- [ ] `pnpm validate --only lint,typecheck,test,build`; e2e `tests/f8-wyglad.spec.ts tests/f8-dostepnosc.spec.ts` on both projects at the final commit; screenshots of every changed screen at 360 and 1280 px looked at.
- [ ] Fresh-context review of the whole range against "Decisions", the rulings and the review focus; findings resolved.
- [ ] Verification summary below; a dated note in the 24.11 plan; pull request into `main`, squash-merged when the required checks are green.

## Findings

- **Baseline (26.11):** `main` at 10e868f; its CI run is green (`checks`, `unit`, `e2e`, `rust`). No local baseline run.
