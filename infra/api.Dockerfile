# TierMaster API image. Build context: repository root.
FROM node:24-bookworm-slim AS build
RUN npm install -g pnpm@11.25.0
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY services/shared/package.json services/shared/
COPY services/api/package.json services/api/
RUN pnpm install --frozen-lockfile --filter api... --filter @tiermaster/shared
COPY services/shared services/shared
COPY services/api services/api
RUN pnpm --filter @tiermaster/shared build && pnpm --filter api build
# Self-contained production folder: dist, prisma files, production node_modules (shared injected).
RUN pnpm --filter api deploy --prod --legacy /out

FROM node:24-bookworm-slim
# OpenSSL is needed by Prisma's schema engine (migrations at start-up).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
