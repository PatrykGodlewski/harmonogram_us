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
pnpm db:generate
pnpm db:migrate
```

Put `.env` at the project root. Required vars: `SESSION_SECRET` (min 32 chars), `ENCRYPTION_KEY` (base64, 16 bytes). Use Postgres at `postgresql://postgres:postgres@localhost:5432/harmonogram_us`, or set `DATABASE_URL`.

## Database (Docker)

This project uses PostgreSQL via Docker Compose.

```bash
# start database in background
docker compose up -d

# stop database
docker compose stop

# view database logs
docker compose logs -f
```

Recommended DB workflow:

```bash
# after schema changes: generate migration files
pnpm db:generate

# apply generated migrations
pnpm db:migrate
```

Quick local alternative (skip migration files and sync schema directly):

```bash
pnpm db:push
```

## Email testing (Docker Mailpit)

Local email testing uses [Mailpit](https://github.com/axllent/mailpit) (SMTP sink + web UI), started by the same Docker Compose file.

```bash
# start services (db + mailpit)
docker compose up -d

# open Mailpit inbox UI
# http://localhost:8025
```

Default local SMTP settings are already in `.env.example`:

- `SMTP_HOST=localhost`
- `SMTP_PORT=1025`
- `SMTP_FROM="Harmonogram <noreply@harmonogram.local>"`

When these are set, Nodemailer sends to Mailpit, and you can inspect messages in the local UI.

To reset the local database container and data completely:

```bash
docker compose down -v
docker compose up -d
pnpm db:migrate
```

## Scripts

| Command       | Description                          |
|---------------|--------------------------------------|
| `pnpm dev`    | Run `web` + `admin` dev servers      |
| `pnpm build`  | Build all packages/apps              |
| `pnpm lint`   | Lint                                 |
| `pnpm db:generate` | Generate Drizzle SQL migrations |
| `pnpm db:migrate`  | Run generated migrations         |
| `pnpm db:push`     | Push schema directly to DB       |
| `pnpm clean`  | Clean build artifacts + node_modules |

## Structure

```
apps/       web, admin
packages/   api, db, ui, config
```
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/PatrykGodlewski/harmonogram_us?utm_source=oss&utm_medium=github&utm_campaign=PatrykGodlewski%2Fharmonogram_us&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)