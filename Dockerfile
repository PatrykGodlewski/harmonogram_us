# syntax=docker/dockerfile:1

FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache libc6-compat \
	&& corepack enable \
	&& corepack prepare pnpm@10.33.2 --activate

FROM base AS pruner

# Which app to build: web, admin or worker. Docker Compose passes it as a build arg; on
# Railway it is a service variable (Railway hands service variables to ARGs).
ARG APP

RUN case "${APP}" in web|admin|worker) ;; *) echo "Set APP to web, admin or worker (got '${APP}')" >&2; exit 1 ;; esac

WORKDIR /app

COPY . .

RUN pnpm dlx turbo@2.9.6 prune "${APP}" --docker

FROM base AS builder

ARG APP
ARG VITE_TURNSTILE_SITE_KEY=""
ARG VITE_APP_TIME_ZONE="Europe/Warsaw"

WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY --from=pruner /app/out/full/ .
# The gRPC contract is not a workspace package, so turbo prune leaves it out; @repo/rpc generates from it.
COPY packages/proto ./packages/proto

ENV VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}
ENV VITE_APP_TIME_ZONE=${VITE_APP_TIME_ZONE}

RUN pnpm turbo run build --filter="${APP}"

# Web/admin build to .output (Nitro); the worker bundles to dist/. Collect whichever exists.
RUN mkdir -p /app/out \
	&& if [ -d "apps/${APP}/.output" ]; then cp -r "apps/${APP}/.output" /app/out/.output; fi \
	&& if [ -d "apps/${APP}/dist" ]; then cp -r "apps/${APP}/dist" /app/out/dist; fi

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=builder /app/out/ ./
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/turbo.json ./turbo.json
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/env ./packages/env
COPY --from=builder /app/packages/config ./packages/config
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
