# TierMaster web image: Caddy serving the SPA and proxying /api and /ws to the API (ADR 0006). Build context: repository root.
FROM node:24-bookworm-slim AS build
RUN npm install -g pnpm@11.25.0
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY services/shared/package.json services/shared/
COPY services/front/package.json services/front/
RUN pnpm install --frozen-lockfile --filter front... --filter @tiermaster/shared
COPY services/shared services/shared
COPY services/front services/front
RUN pnpm --filter front build

FROM caddy:2.10-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/services/front/dist/front/browser /srv
