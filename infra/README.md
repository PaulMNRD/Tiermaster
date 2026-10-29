# Deployment

One VPS running Docker Compose (ADR 0005): Caddy (`web` image: TLS, SPA, `/api` and `/ws` proxy), the API, PostgreSQL 18 and
Garage. Every push to `main` that passes the tests is deployed by `.github/workflows/ci.yml`.

| File | Role |
| --- | --- |
| `api.Dockerfile` | API image: Nest build + production dependencies; applies Prisma migrations at start-up |
| `web.Dockerfile` | Caddy image with the built SPA and `Caddyfile` |
| `Caddyfile` | Automatic HTTPS for `$DOMAIN`, security headers, SPA fallback, immutable caching of hashed assets |
| `docker-compose.prod.yml` | Production stack (`restart: unless-stopped`, named volumes) |
| `garage/garage.toml`, `garage/init.sh` | Single-node Garage; idempotent layout, key and private bucket setup |
| `dev.Dockerfile`, `dev-entrypoint.sh` | Development toolchain image used by `docker-compose.dev.yml` (not deployed) |
| `deploy.sh` | Runs on the VPS: pull images of a tag, `up -d`, Garage init, prune |

## One-time VPS setup

1. Install Docker Engine with the Compose plugin; create a deploy user in the `docker` group.
2. Point the domain's DNS A/AAAA records to the VPS; open ports 80 and 443 (TCP) and 443 (UDP).
3. Create the deployment folder (default `/opt/tiermaster`, owned by the deploy user) with a `.env` file:

   ```sh
   IMAGE_PREFIX=ghcr.io/<github owner, lower case>
   DOMAIN=tiermaster.example.com
   POSTGRES_PASSWORD=<random>
   SESSION_SECRET=<random, at least 32 characters>
   # Garage access key: id "GK" + 24 hex characters, secret 64 hex characters
   S3_ACCESS_KEY=GK<24 hex>
   S3_SECRET_KEY=<64 hex>
   GARAGE_RPC_SECRET=<64 hex>          # openssl rand -hex 32
   GARAGE_ADMIN_TOKEN=<random>
   # Sign-in providers (at least one is needed in production)
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   DISCORD_CLIENT_ID=
   DISCORD_CLIENT_SECRET=
   STEAM_API_KEY=
   ```

4. If the GHCR packages stay private, log the VPS in once: `docker login ghcr.io -u <user>` with a token that has `read:packages`.

## GitHub configuration

Repository secrets (environment `production`):

| Secret | Value |
| --- | --- |
| `VPS_HOST` | VPS hostname or IP |
| `VPS_USER` | Deploy user |
| `VPS_SSH_KEY` | Private key of the deploy user (its public key in `~/.ssh/authorized_keys` on the VPS) |
| `VPS_KNOWN_HOSTS` | Output of `ssh-keyscan <VPS_HOST>` |

Optional repository variable: `DEPLOY_PATH` (default `/opt/tiermaster`).

## Operations

- Logs: `docker compose -f docker-compose.prod.yml logs -f api`
- Manual deploy or rollback: `./deploy.sh <git sha>` in the deployment folder.
- Health: `https://$DOMAIN/api/health`.
- Backups are the operator's responsibility (ADR 0005): dump PostgreSQL (`docker compose exec postgres pg_dump -U tiermaster tiermaster`)
  and back up the `garage-data` volume.
