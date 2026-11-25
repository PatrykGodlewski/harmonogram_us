# E2E stack

Playwright runs against production images of web, admin and worker plus their services, as a separate Compose project `harmonogram-e2e` beside the dev stack. Host ports come from `e2e/ports.env`: web 3100, admin 3101, Postgres 15432, Mailpit 18025, OIDC mock 18080, Teams mock 18082, storage 18083.

## `scripts/e2e.sh`

```bash
scripts/e2e.sh ensure [--force]            # reuse a healthy stack; rebuild only when code changed
scripts/e2e.sh run [--force] [args...]     # ensure, then `playwright test` with the args (none = full suite)
scripts/e2e.sh logs [service] [--tail N]   # container logs (default: all services, last 100 lines)
```

`ensure` counts the stack as current when all nine services (`db mailpit storage documents teams-mock oidc-mock web admin worker`) are running, the healthchecked ones are healthy, web and admin answer HTTP, and the stamp in `.e2e/stack-stamp` matches. The stamp hashes `HEAD` plus every uncommitted change (including untracked files) under `apps`, `packages`, `proto`, `services`, `Dockerfile`, `pnpm-lock.yaml` and `Cargo.*`. Changes under `e2e/` never trigger a rebuild: tests run on the host and the mocks are bind-mounted. Use `--force` for anything the stamp cannot see, such as `VITE_*` build args in `.env`. A rebuild runs `up -d --build --wait --remove-orphans`, then migrates the database.

The manual alternatives remain: `pnpm e2e:up` (always rebuilds), `pnpm e2e`, and `pnpm e2e:down` (also deletes the data).

## Database

The e2e database is disposable. Before migrating, `ensure` looks for drizzle-kit's journal (`drizzle.__drizzle_migrations`). If it is missing, the database was seeded some other way (for example with `db:push`) and `drizzle-kit migrate` would fail on existing tables, so `ensure` drops and recreates `harmonogram_us` in the e2e stack only, then migrates from scratch. Tests create their own data.

## Single specs and projects

Iterate on one spec, never on the full suite:

```bash
scripts/e2e.sh run tests/f6-powiadomienia.spec.ts --project=telefon
```

Projects (`e2e/playwright.config.ts`):

- `komputer`: 1280 px, every test except `@skaner`.
- `telefon`: 360 px phone, selects `@uczestnik` and `@organizator`.
- `skaner`: 360 px phone with Chromium's fake camera showing a QR ticket, selects `@skaner`.

## Mocks

- `oidc-mock` (`e2e/oidc-mock`): university sign-in, reached as `oidc.localhost:18080` from both the browser and the containers; configured by `UNIVERSITY_SSO_*` in `e2e/ports.env`.
- `teams-mock` (`e2e/teams-mock`): a stand-in Microsoft Graph at `teams.localhost:18082`, configured by `TEAMS_*`; lists created meetings at `/__meetings`.
- Mailpit: UI and API at http://localhost:18025.

## Writing tests

Wait for the hydration marker (`html[data-hydrated=true]`, see `fixtures/navigation.ts`) before interacting; clicks before hydration are lost. Reuse the fixtures in `fixtures/`.

## Why `COMPOSE_FILE` is pinned

Plain `docker compose` also loads a local `docker-compose.override.yml` if one exists. `scripts/e2e.sh` sets `COMPOSE_FILE=docker-compose.yml`, so the e2e stack always matches the committed file.
