# Domain boundaries in Biome — design

Date: 2026-11-23. Status: approved for planning (user routed straight to writing-plans; the A/B choice below is the assistant's recommendation, flagged for review).

## Intent and why

This monorepo has two kinds of modules: shared infrastructure that anything may use, and feature-domain modules that should only be used by their own domain. Today that split exists only as an unwritten agreement; cross-feature imports accumulate silently (e.g. the groups feature reading events internals). The goal: make the split enforceable at lint time, after a one-time review that classifies every module into a domain or into shared.

## Decision: what a "domain" is (assistant's call — option A)

- **Chosen: feature domains as vertical slices across packages.** A domain is a feature area (events, groups, surveys, …) whose modules live in `packages/api/src/<area>`, `packages/db`, and the matching routes/components/lib dirs in the apps. Shared = the infra packages plus the cross-feature kernel modules.
- **Rejected: package-level classification.** `api`, `db` and all three apps each contain many domains and are used by everything; classifying by package would end with "everything is shared, nothing restricted" unless the monorepo were re-split into domain packages — a far bigger job.
- **Mechanism: Biome base config, no plugin.** No off-the-shelf Biome plugin for import boundaries exists; Biome 2.6's JavaScript plugins are a developer preview and GritQL cannot express "what you may import depends on which directory the importing file lives in". Base config does it exactly: `style/noRestrictedImports` (gitignore-style `patterns[].group` with `!`-negation and per-group messages) plus per-group `overrides`.

## Constraints

- Biome 2.6.8 (pinned in root `package.json`); no version change.
- Single root `biome.json` stays the entry point; the generated boundary config is a separate checked-in file it extends.
- No new runtime dependencies; the generator is plain Node (no framework).
- Generated files, migrations, `paraglide`, `routeTree.gen.ts` and the Rust service stay outside the rule (already excluded from Biome or not TS).
- The rule changes nothing at runtime; e2e runs at the end as regression proof, not because the feature needs one.

## Mechanism

1. `scripts/domain-map.json` — the single source of truth: per domain, the file globs that belong to it and the import-specifier group that is "this domain" (with `!`-negations for files the domain does not own — kernel or another domain's); the shared file globs; the excluded globs (tests, e2e, scripts).
2. `scripts/generate-biome-boundaries.mjs` — Node script: validates the map (no file claimed twice; every lintable TS file under `packages/*/src` and `apps/*/src` is claimed — unclaimed files fail the build), then writes `biome.boundaries.json`:
   - one `overrides` entry for **shared**: imports of every domain's specifier group are forbidden;
   - one `overrides` entry **per domain**: imports of every other domain's specifier group are forbidden (own group + all shared allowed);
   - each pattern group carries a message naming the domain.
3. Root `biome.json` gains `"extends": ["./biome.boundaries.json"]`; `pnpm boundaries:check` runs the generator and requires zero diff (hand edits to the generated file fail CI).
4. **Working rule** (goes into `docs/architecture.md`): inside `packages/api`, import across area directories via the `@repo/api/<area>/*` specifier, never relatively — the patterns match specifiers, and a relative cross-domain import is invisible to them. Relative stays fine within one area or toward the kernel. (Existing code already complies after the fixes below: every remaining cross-area relative import targets a kernel module.)

## The classification (the review)

### Shared — packages

`@repo/env`, `@repo/i18n`, `@repo/ui`, `@repo/jobs`, `@repo/router-utils`, `@repo/config`, `@repo/rpc`, and **all of `@repo/db`** (the data kernel — every feature reads and writes through it; feature logic lives above it).

### Shared — the `@repo/api` kernel

`auth/**`, `security/**`, `notifications/**` (e-mail kernel), `documents/**` (PDF kernel), `storage/**` + `files/**` (file-storage kernel), `observability/**`, `teams/**` (Teams kernel — the feature has no surface of its own, only a button in the event form), `events/schemas.ts` (event data contracts), `events/access.ts` (event access rules, used by groups, calendar, files), `admin/schemas.ts`, `admin/optional-id-schema.ts`, top-level `errors.ts`, `procedures.ts`, `site.ts`, `error-status-middleware.ts`, `request-size-middleware.ts`, `types/**`.

### Domains

| Domain | `packages/api/src` | `apps/web/src` | `apps/admin/src` | `apps/worker/src` |
| --- | --- | --- | --- | --- |
| **events** (incl. registration flow, guests, check-in, attendance) | `events/**` (excl. `schemas.ts`, `access.ts`), `registrations/**`, `admin/**` (excl. `schemas.ts`, `optional-id-schema.ts`, `users.ts`, `invitations.ts`, `invitation-limits.ts`) | `routes/index.tsx`, `routes/guest.confirm.tsx`, `routes/registrations.$registrationId.withdraw.tsx`, `routes/events/**` (excl. `$eventId_.groups.new.tsx`), `components/event-details/**` (excl. `unregister-event-dialog.tsx`), `lib/event-details/**`, `lib/events/**`, `components/home-event-*.tsx`, `components/event-registration-button.tsx` | `routes/_authenticated/events.*.tsx`, `routes/_authenticated/index.tsx`, `components/admin-event-detail/**`, `components/check-in/**`, `components/event-form-dialog.tsx`, `components/admin-events-page.tsx`, `components/admin-activity.tsx`, `components/teams-meeting-button.tsx` | — |
| **groups** | `groups/**`, `admin/invitations.ts`, `admin/invitation-limits.ts` | `routes/groups/**`, `routes/invite/**`, `routes/join/**`, `routes/events/$eventId_.groups.new.tsx`, `components/groups/**`, `lib/groups/**` | — (group-invitation UI, if any, lives in `admin-event-detail/**` — see Known edges) | `handlers/close-expired.ts`, `handlers/send-invitation.ts` |
| **surveys** | `surveys/**`, `admin/survey-summary.ts` | `routes/surveys.$registrationId.tsx` | — | — |
| **tickets** | `tickets/**` | `routes/tickets/**`, `components/tickets/**` | — | — |
| **certificates** | `certificates/**` | — | — | — |
| **calendar** (iCal feeds) | `calendar/**` | `routes/api/calendar/**` | — | — |
| **public-api** (F24 + widget) | `public/**` | `routes/widget.tsx`, `routes/api/**` (excl. `calendar/**`) | — | — |
| **lookups** (faculties, rooms, types) | — | — | `routes/_authenticated/event-faculties.tsx`, `event-locations.tsx`, `event-types.tsx`, `components/admin-lookup-page.tsx` | — |
| **auth** (sign-in, account, roles) | `admin/users.ts` | `routes/login.tsx`, `signup.tsx`, `logout.tsx`, `account.tsx`, `components/auth/**`, `components/account/**` | `routes/_authenticated/users.tsx`, `components/admin-users-page.tsx` | — |

### Shared — app-level

- web: `lib/registration/**`, `lib/event-registration/**` (registration state/actions, imported by list, event page, account, withdraw), `lib/auth-client.ts`, `components/client-only.tsx`, `components/event-details/unregister-event-dialog.tsx` (registration-lifecycle UI used by both the event page and the account page), `routes/__root.tsx`, `privacy.tsx`, `accessibility.tsx`.
- admin: `lib/**`, `routes/api/**`, `routes/_authenticated.tsx` (panel shell), `routes/login.tsx`, `routes/logout.tsx`.
- worker: `index.ts`, `work-options.ts` (process bootstrap).

### Excluded from the rule

`e2e/**` (verified: it imports no app code), `**/*.test.ts`, `packages/api/test/**`, `scripts/**`, generated dirs. Excluded files may import anything.

## Existing violations and their fixes (from the import scan)

1. `api/auth/guest-registration-plugin.ts` (shared kernel) imports `requestGuestRegistration` from `registrations/guest-registration.ts` (events domain) — kernel must not import a domain. **Fix: move `requestGuestRegistration`'s logic into `@repo/db/queries/guest-requests`** (the shared data kernel already owns guest-request rows); the plugin then imports only db.
2. `api/groups/schemas.ts` → `../events/schemas` and `api/groups/mutations.ts`, `calendar/feeds.ts`, `files/download.ts` → `../events/access` — **resolved by classification**: `events/schemas.ts` and `events/access.ts` are kernel (see above). No code change.
3. `api/events/schemas.ts` → `../admin/optional-id-schema` — resolved (kernel).
4. web `components/account/my-registrations.tsx` (auth domain) imports `components/event-details/unregister-event-dialog.tsx` (events domain) — **resolved by classification**: the dialog is shared registration-lifecycle UI.
5. web `routes/events/$eventId_.groups.new.tsx` (events route dir) is groups feature — **resolved by file-level classification** into the groups domain.
6. web `routes/account.tsx` (auth) renders the calendar-feed widget — **resolved by classification**: `components/account/my-calendar.tsx` stays in the auth domain (it is an account-page widget; the calendar domain is the feed itself).

**Known open edge:** `admin-event-detail/**` may contain group-invitation UI (F32) that imports groups server functions — the first `pnpm lint` after the config lands will surface it. Resolution rule, in order: reclassify the file to the groups domain → move the file into a groups-owned location → route through the kernel. Never add a blanket allow-list.

## Non-goals

- No runtime behaviour change; no new feature.
- Not re-splitting packages into domain packages; not enforcing db-queries-level boundaries (db is the shared data kernel).
- Not a GritQL/JS plugin (preview); not per-symbol restrictions.

## Left to the builder

- Exact generator CLI shape (flag: write / check), exact `biome.boundaries.json` layout — fixed by the plan.
- Per-case resolution of any violations the first lint pass surfaces beyond the list above, following the resolution rule.
