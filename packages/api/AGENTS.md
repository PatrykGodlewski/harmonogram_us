# @repo/api

Server functions and domain logic. Read `docs/architecture.md` before you change auth, server functions or panel access.

## Domain boundaries

These rules come from `docs/superpowers/specs/2026-11-23-granice-domenowe-biome-design.md`. They are policy until that plan lands; lint does not enforce them yet.

- Import across area directories (`src/<area>/`) through the `@repo/api/<area>/*` specifier, never with a relative path. Relative imports are fine within one area or into the shared kernel.
- The shared kernel (anything may import it; paths relative to `src/`): `auth/`, `security/`, `notifications/`, `documents/`, `storage/` + `files/`, `observability/`, `teams/`, `events/schemas.ts`, `events/access.ts`, `admin/schemas.ts`, `admin/optional-id-schema.ts`, top-level `errors.ts`, `procedures.ts`, `site.ts`, `error-status-middleware.ts`, `request-size-middleware.ts`, `types/`.
- The kernel must not import a domain (events, groups, surveys, tickets, certificates, calendar, public, …). Check the spec's classification table for the area that owns a file.

## Panel and data rules

- Every panel server function (`panelQueryFn`/`panelActionFn`) calls an `assert…` check from `src/auth/event-access.ts` in its handler. Add new `admin/*.ts` files to `test/event-access.test.ts`.
- Enqueue jobs inside the same Drizzle transaction as the data they describe (`@repo/jobs/client`). Never write seat-count tables. Lock order, capacity and waitlist invariants are in `docs/data-flows.md`.
- New subpaths must resolve through `package.json#exports`. Do not add barrel files.
- A module that an app component imports a server function from exports only server functions and query options. Anything else it exports keeps its server-only imports (`@repo/env`, the database driver) in the browser bundle; on 26.11 that crashed the panel's event page with "process is not defined". Plain server-side functions go into a separate module: `admin/event-image.ts` holds the server function, `event-images/regenerate.ts` the logic.
