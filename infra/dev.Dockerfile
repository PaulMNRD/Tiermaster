# Development toolchain image for docker-compose.dev.yml: Node 24 + pnpm, sources bind-mounted at /repo.
# node_modules live in named volumes (Linux binaries, never mixed with the host's).
FROM node:24-bookworm-slim
# OpenSSL is needed by Prisma's engines.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.25.0
# The pnpm store sits in the root node_modules volume: same filesystem, so packages are hard-linked.
ENV HOME=/home/dev pnpm_config_store_dir=/repo/node_modules/.pnpm-store
RUN mkdir -p /repo/node_modules /repo/services/shared/node_modules /repo/services/api/node_modules \
      /repo/services/front/node_modules "$HOME"
COPY --chmod=755 infra/dev-entrypoint.sh /usr/local/bin/dev-entrypoint
WORKDIR /repo
ENTRYPOINT ["dev-entrypoint"]
