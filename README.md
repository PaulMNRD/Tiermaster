# TierMaster

Collaborative, real-time tierlist editor ("Google Docs for tierlists"): create tierlists, rank cards by drag and drop on
desktop or phone, share them with per-tierlist roles, and see everyone's changes live.

- **Roles**: owner, moderator, editor, viewer, plus a per-tierlist default role (private, public read-only, public editable).
- **Real time**: optimistic drag and drop, live updates, live revocation, reconnection with full resynchronization.
- **Sharing**: invitations by pseudonym (accept / decline) or by link (24 h), member management with moderator rules.
- **Images**: resized in the browser, validated and re-encoded by the API, stored in a private Garage bucket.
- Community page, search and sort, light and dark themes, English and French.

Stack: Node 24, pnpm, TypeScript, zod · Angular + Tailwind · NestJS + Socket.IO · Prisma + PostgreSQL · Garage (S3) · Vitest ·
Docker + Caddy. See [docs/archi/architecture.md](docs/archi/architecture.md) for the architecture and
[PROGRESS.md](PROGRESS.md) for decisions and status.

## Repository layout

```
services/shared   @tiermaster/shared: zod schemas (front/back contract) and pure domain logic (permissions, ordering)
services/api      NestJS API: src/modules/<name>, src/ports, src/adapters, prisma/ (schema, migrations)
services/front    Angular SPA: core/, ui/, features/
infra/            Garage config, production Compose file, Caddyfile, Dockerfiles
docs/             architecture (C1, C2, architecture.md), features, ADRs, data model, conformity
```

## Running locally

Two ways, each in one command: with Nix/devenv, or with Docker Compose only.
Both start the SPA on <http://localhost:4226> (it proxies `/api` and `/ws` to the API on port 3226). Development uses
uncommon ports to avoid clashes with other local projects: SPA 4226, API 3226, PostgreSQL 5426, Garage S3 3926 (devenv
also uses 3927 for Garage RPC and 3928 for its admin API).

### Option A: NixOS / devenv

Requirements: [Nix](https://nixos.org) and [devenv](https://devenv.sh).

```sh
devenv up            # PostgreSQL, Garage (bucket + key), API (migrations applied), front dev server
```

In another terminal, load the demo data once:

```sh
devenv shell
pnpm --filter api seed
```

Every other command (`pnpm build`, `pnpm test`, ...) runs inside `devenv shell`.

### Option B: Docker Compose

Requirements: Docker with Compose (v2.20+). Nothing else on the host.

```sh
docker compose -f docker-compose.dev.yml up --build
```

This starts PostgreSQL 18 and Garage, initializes Garage (layout, key, bucket), installs the dependencies, builds `shared`
and the API, applies the migrations, loads the demo data (idempotent) and runs the API in watch mode and the SPA dev server.
Sources are bind-mounted, so edits reload live; `node_modules` live in Docker volumes (Linux binaries, separate from the
host's). Ports: SPA 4226, API 3226, PostgreSQL 5426, Garage S3 3926 (all on 127.0.0.1). Credentials are the development
defaults of `devenv.nix`.

```sh
docker compose -f docker-compose.dev.yml down        # stop (add -v to also drop the database, images and node_modules)
docker compose -f docker-compose.dev.yml run --rm deps   # after changing dependencies (re-runs pnpm install and builds)
docker compose -f docker-compose.dev.yml run --rm --no-deps api pnpm exec prisma migrate dev --name <change>
```

To run the API and the front on the host instead (Node 24 and pnpm 11 required), start only the infrastructure:

```sh
docker compose -f docker-compose.dev.yml up -d postgres garage-init   # PostgreSQL 18 and an initialized Garage

# Same development defaults as devenv.nix
export DATABASE_URL=postgresql://tiermaster:tiermaster@localhost:5426/tiermaster
export S3_ENDPOINT=http://127.0.0.1:3926 S3_REGION=us-east-1 S3_FORCE_PATH_STYLE=true S3_BUCKET=tiermaster-images
export S3_ACCESS_KEY=GK1a2b3c4d5e6f1a2b3c4d5e6f
export S3_SECRET_KEY=a1b2c3d4e5f60718a1b2c3d4e5f60718a1b2c3d4e5f60718a1b2c3d4e5f60718
export AUTH_FAKE_ENABLED=true PUBLIC_URL=http://localhost:4226

pnpm install && pnpm build
pnpm --filter api exec prisma migrate deploy
pnpm --filter api seed                      # demo data (idempotent)
pnpm --filter api start:dev                 # API on :3226 (terminal 1)
pnpm --filter front start                   # SPA on :4226 (terminal 2)
```

Without Garage, set `STORAGE_DRIVER=memory` (images are then lost on restart).

### Signing in locally

With `AUTH_FAKE_ENABLED=true`, the login page shows a **development sign-in** form: type any id. The seed creates
`alice`, `bob` and `carol` with demo tierlists (public, public editable, private, shared). Real providers appear on the login
page as soon as their credentials are configured (see below).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm build` | Builds `shared`, then the API (Prisma client generation + Nest build) and the front |
| `pnpm test` | All tests: shared unit tests, API integration tests (start a PostgreSQL container with Testcontainers, so Docker must be running), front component tests |
| `pnpm --filter api seed` | Demo data (idempotent) |
| `pnpm --filter api exec prisma migrate dev --name <change>` | New migration after editing `prisma/schema.prisma` (keep `docs/mcd.md` in sync) |
| `node scripts/set-version.mjs x.y.z` | Sets the same version on every package |

## Configuration (API environment)

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `PUBLIC_URL` | `http://localhost:4226` | Public origin; used for OAuth callbacks, redirects and invitation links |
| `SESSION_SECRET` | dev value | ≥ 32 characters, **required in production** |
| `COOKIE_SECURE` | `false` | `true` behind HTTPS |
| `AUTH_FAKE_ENABLED` | `false` | Development sign-in; refused in production |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Enables Google; callback `{PUBLIC_URL}/api/auth/google/callback` |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | — | Enables Discord; callback `{PUBLIC_URL}/api/auth/discord/callback` |
| `STEAM_API_KEY` | — | Enables Steam (OpenID 2.0) |
| `STORAGE_DRIVER` | `s3` if `S3_ENDPOINT` is set, else `memory` | `memory` is refused in production |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE` | — / `us-east-1` / — / — / `tiermaster-images` / `false` | Garage or any S3 API |
| `RATE_LIMIT_WRITES_PER_MINUTE` / `_UPLOADS_` / `_SEARCHES_` | 120 / 20 / 60 | Per user (per IP when anonymous) |
| `PORT` | `3226` | The production image sets 3000 |

Health check: `GET /api/health` (checks the database, 503 when it is down).

## Deployment

Production runs on one VPS with Docker Compose behind Caddy (ADR 0005, ADR 0006): `infra/docker-compose.prod.yml` runs Caddy
(TLS, SPA files, `/api` and `/ws` proxy), the API, PostgreSQL and Garage. GitHub Actions (`.github/workflows/ci.yml`) builds and
tests every push and pull request inside the devenv shell; on `main` it publishes the images to GHCR and deploys over SSH.
See [infra/README.md](infra/README.md) for the VPS setup and the secrets to configure.

## Documentation

- [docs/archi](docs/archi): C1, C2 and the architecture as built
- [docs/features](docs/features): detailed behaviour (authentication, permissions, real time, sharing, images)
- [docs/adr](docs/adr): architecture decisions
- [docs/mcd.md](docs/mcd.md): data model (source of truth for the database)
- [docs/conformity.md](docs/conformity.md): requirement-to-slice tracking

## Summary: architecture, documentation and way of working

**Architecture.** A modular monolith (ADR 0001): an Angular SPA and a NestJS API on one origin behind Caddy (ADR 0006), with
PostgreSQL through Prisma and images in Garage through the plain S3 API (ADR 0008). `@tiermaster/shared` is the contract: zod
schemas validate every REST and Socket.IO message on both sides, and pure domain functions (`effectiveRole`, `can`,
`canGrant`, fractional indexing, the event reducer) hold the business rules (ADR 0004). API modules follow
`controller -> service -> repository` and only talk through exported services or events. Ports and adapters are used where a
swap is real: `AuthProvider` (Google, Discord, Steam, fake; ADR 0002), `ObjectStorage` (S3, in memory) and
`RealtimeBroadcaster`. Every write locks its tierlist, bumps a revision and logs an op in one transaction, then broadcasts it
to the tierlist's Socket.IO room; the SPA applies optimistic updates, replays missed ops by revision and re-checks access on
every reconnection. Permissions are always enforced server-side; the front only adapts the UI.

**Documentation.**
- [AGENTS.md](AGENTS.md): stack, layout, architecture rules and definition of done.
- [docs/archi](docs/archi): C1 context, C2 containers and the architecture as built.
- [docs/features](docs/features): behaviour per feature (UML and notes).
- [docs/adr](docs/adr): one record per structural decision (context, options, consequences, when to revisit).
- [docs/mcd.md](docs/mcd.md): the data model, source of truth for the Prisma schema.
- [docs/conformity.md](docs/conformity.md): each requirement mapped to its slice, status and evidence.
- [PROGRESS.md](PROGRESS.md): slice log, decisions, added dependencies and open questions.

**Way of working.** The project is built in vertical slices (permissions core, data model, auth, CRUD, real time, sharing,
images, polish, docs, CI/CD), each delivered as a small, reviewable commit. Features are specified in `docs/features` and
decisions recorded as ADRs before structural changes. A slice is done when `pnpm build` and `pnpm test` pass, every acceptance
criterion has a test (unit tests for the domain, integration tests on a real PostgreSQL with multi-client WebSocket scenarios,
component tests for the front; no automated E2E), the conformity table and data model are updated, and all packages are bumped
to the same version. Development runs in a reproducible environment (devenv, or Docker Compose), and CI builds and tests every
push in that same environment before publishing images and deploying to the VPS (ADR 0005).
