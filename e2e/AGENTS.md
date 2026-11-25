# e2e

Playwright against production images. Details: `e2e/README.md`; gates: `docs/testing.md`.

## Stack

- Compose project `harmonogram-e2e`; host ports in `e2e/ports.env` (web 3100, admin 3101, Postgres 15432).
- Drive it with `scripts/e2e.sh`:
  - `ensure [--force]` reuses a healthy stack and rebuilds only when code changed. Use `--force` after changing `VITE_*` build args in `.env`.
  - `run [args…]` runs `ensure`, then `playwright test` with the args.
  - `logs [service] [--tail N]` prints container logs.
- The DB is disposable. Its drizzle journal lives in the `drizzle` schema (`drizzle.__drizzle_migrations`). `ensure` drops and recreates a seeded DB that has no journal, then migrates it.

## Iterating

- Run one spec at a time: `scripts/e2e.sh run tests/f5-zapisy.spec.ts --project=telefon`. Never run the full suite to iterate on one spec.
- Projects (`e2e/playwright.config.ts`): `komputer` (1280 px, everything except `@skaner`), `telefon` (360 px, tags `@uczestnik`, `@organizator`), `skaner` (`@skaner`, fake camera showing a QR ticket).
- Name feature tests `[Fn] …` and write them first. Watch them fail before you implement.

## Writing tests

- Wait for the hydration marker (`html[data-hydrated=true]`, `e2e/fixtures/navigation.ts`) before interacting. Clicks before hydration are lost.
- Reuse `e2e/fixtures/`. Tests create their own data and must not import app code.
- Mocks: `oidc-mock` (university SSO, `UNIVERSITY_SSO_*`), `teams-mock` (Microsoft Graph, `TEAMS_*`), Mailpit at http://localhost:18025.
