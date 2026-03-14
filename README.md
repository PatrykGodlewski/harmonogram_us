# Harmonogram US

pnpm monorepo (Turbo) with React 19, TanStack Router/Query/Start, Drizzle ORM, and Tailwind.

## Prerequisites

- **Node** ≥ 20  
- **pnpm** 10.x (`corepack enable && corepack prepare pnpm@10.32.1 --activate`)

## Setup

```bash
pnpm install
cp .env.example .env   # then fill in SESSION_SECRET, ENCRYPTION_KEY
docker compose up -d
pnpm db:push
```

Put `.env` at the project root. Required vars: `SESSION_SECRET` (min 32 chars), `ENCRYPTION_KEY` (base64, 16 bytes). Use Postgres at `postgresql://postgres:postgres@localhost:5432/harmonogram_us`, or set `DATABASE_URL`.

## Scripts

| Command       | Description                          |
|---------------|--------------------------------------|
| `pnpm dev`    | Run `web` + `admin` dev servers      |
| `pnpm build`  | Build all packages/apps              |
| `pnpm lint`   | Lint                                 |
| `pnpm db:push`| Push schema to DB                    |
| `pnpm clean`  | Clean build artifacts + node_modules |

## Structure

```
apps/       web, admin
packages/   api, db, ui, config
```
