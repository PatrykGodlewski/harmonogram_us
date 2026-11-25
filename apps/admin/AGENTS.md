# admin (management panel)

The dev server runs on port 3001. Roles, panel access and server functions: `docs/architecture.md`.

## Rules

- Never edit generated files: `src/routeTree.gen.ts` and the Paraglide output in `packages/i18n/src/paraglide/`.
- Put UI text only in `packages/i18n/messages/pl.json` and `packages/i18n/messages/en.json` (both), then run `pnpm messages:compile`.
- The panel has two audiences. Organisers see only the events they organise. Administrators see everything, plus lookups and roles.
- The `_authenticated` layout only hides the panel. Servers decide access through the `assert…` checks in `packages/api/src/auth/event-access.ts`.
- Design screens for phones first (360 px). Phone coverage uses the `@organizator` tag (`telefon` project, `tooling/e2e/AGENTS.md`).
- Reuse existing shadcn components from `@repo/ui` (`docs/development.md`).
