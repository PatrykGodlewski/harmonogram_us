# web (public app)

Mobile-first public site. The dev server runs on port 3000. Routing, server functions and i18n: `docs/architecture.md`.

## Rules

- Never edit generated files: `src/routeTree.gen.ts` and the Paraglide output in `packages/i18n/src/paraglide/`.
- Put UI text only in `packages/i18n/messages/pl.json` and `packages/i18n/messages/en.json` (both), then run `pnpm messages:compile`.
- Send registration UI actions through `useRegistrationActions` (`src/lib/registration/`). It invalidates the user's registrations, the event page and the lists. See "Fresh data on open pages" in `docs/data-flows.md`.
- Open pages refetch their own queries. Do not add a separate sync channel.
- Cover features with `[Fn] …` e2e specs (`tooling/e2e/AGENTS.md`). Participant phone coverage uses the `@uczestnik` tag.
