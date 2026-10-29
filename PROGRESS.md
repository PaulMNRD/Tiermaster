# TierMaster — progress log

Autonomous build, slice by slice. Status values: `todo`, `in progress`, `done`, `skipped`.

## Slices

### 1. Permissions core (`shared/domain`) — done
- `effectiveRole` resolves OWNER > explicit membership > `defaultRole` > none, anonymous capped at VIEWER.
- An explicit membership wins over `defaultRole` even when it grants less.
- `can(role, action)` matches every cell of the permission matrix (roles-and-permissions.md).
- `canGrant(actor, targetCurrent, next)` follows the member-management flowchart (owner, moderator, others).
- Exhaustive, hand-written, table-driven test matrix.
- Fractional indexing helper (`keyBetween`) with ordering tests.

### 2. Prisma schema, migrations, seed — done
- Schema follows `docs/mcd.md` (with the corrections logged below), uuid keys everywhere.
- Initial SQL migration committed; applied by tests and by `prisma migrate deploy`.
- Seed script creates demo users and tierlists (public, private, shared).
- Integration test harness: real PostgreSQL through Testcontainers, one database per test file.

### 3. Authentication and app shell — done
- `AuthProvider` port; fake provider for tests and dev; Google, Discord, Steam adapters enabled by env.
- OAuth state verified; invalid state rejected.
- Signed, httpOnly session cookie; `GET /api/me`; logout.
- Pseudonym required on first login (unique, validated by zod).
- Short-lived socket token endpoint for the Socket.IO handshake.
- Front: app shell, login page, pseudonym page, route guards (auth, pseudonym).

### 4. Tierlists CRUD, home and community pages — done
- Create a tierlist (owner = creator, default categories S/A/B/C/D).
- Home lists owned and shared tierlists with the effective role, search and sort.
- Community lists public tierlists (defaultRole not null), search, sort, pagination.
- Rename (EDITOR+), change defaultRole and delete (OWNER only); 401/403/404 semantics. (Leave moved to slice 7: it is a membership operation.)
- Rejected tests for every permission-gated endpoint.

### 5. Categories and cards (REST), read-only tierlist page — done
- Snapshot `GET /api/tierlists/:id` with categories, cards (ordered), `rev`, `effectiveRole`.
- Create / edit / delete categories and cards, reorder categories, move cards (fractional positions).
- Every write: one transaction, permission check, `rev + 1`, op logged, idempotent `clientOpId`.
- `GET /api/tierlists/:id/ops?since=` with 410 when the gap is too large.
- Front: tierlist page rendering categories, cards and an "unsorted" pool.

### 6. Real-time — done
- Socket.IO gateway on `/ws`; optional handshake token, invalid token disconnects.
- `join` validated by zod, access via `AccessService`, `not_found` without role, ack `{effectiveRole, rev}`.
- Events broadcast after commit to room `tierlist:{id}`, carrying `rev` and `clientOpId`.
- Front: drag and drop (CDK, touch), optimistic UI with pending ops, rollback on 4xx, gap detection and resync.
- Multi-client tests: broadcast, rejected join, anonymous capped.

### 7. Sharing — done
- Members list; change role / remove with `canGrant` (moderator rules), checked in a transaction.
- Invitations by pseudonym (accept / decline) and by link (24h, hashed token, revocable).
- Accepting never lowers a role; pending invitations notified on the home page.
- Live revocation and role downgrade on connected sockets (member removed, role changed, defaultRole changed, tierlist deleted).

### 8. Images — done
- Upload `POST /api/tierlists/:id/media`: EDITOR+, magic bytes check, size limit, re-encoded with sharp.
- Stored through the `ObjectStorage` port (S3 adapter for Garage, in-memory adapter for tests).
- `GET /api/media/*` checks read access, private cache headers; revoked users get 404.
- Front: client-side resize before upload; card images displayed.

### 9. Polish — done
- Settings page (rename, default role, delete, leave), profile page (pseudonym, avatar, delete account).
- Empty / loading / error states; 401, 403, 404 and "not found or private" screens.
- Connection status indicator with reconnection and full resync.
- Rate limiting on writes and uploads; `GET /api/health`.
- Light / dark theme, i18n (fr, en), mobile pass.

### 10. Documentation — done
- `docs/conformity.md`, `docs/archi/architecture.md`, README (devenv and standard setup).

### 11. CI/CD — done
- GitHub Actions: build and test on push / PR inside the devenv shell; on `main`, build images (GHCR) and deploy to the VPS with
  Docker Compose and Caddy.
- Dockerfiles for the API and the web (Caddy + SPA) images; production Compose file; VPS deploy script; infra README.

## Document conflicts (most recent document applied)
1. **Role names.** The initial scaffold (`shared/src/types`) used `READ/POSITION/EDIT/MODERATE` and C1 mentions "Positioner/Reader",
   while `roles-and-permissions.md` and `mcd.md` use `OWNER/MODERATOR/EDITOR/VIEWER`. Applied the feature doc; scaffold replaced.
2. **MCD key types.** `mcd.md` declares uuid primary keys but `int` foreign keys (`OAUTH_ACCOUNT.userId`, `TIERLIST_OP.tierlistId`,
   `INVITATION.tierlistId`, ...). Used uuid everywhere and fixed `mcd.md`.
3. **Direct add vs invitation.** `sharing-and-invitations.md` adds an existing user immediately without confirmation; the request
   (newer) asks for "invite by pseudonym, accept or decline, notification of pending invitations". Applied the request: inviting
   by pseudonym creates a pending personal invitation, the link path is unchanged.
4. **OAuth providers.** `sharing-and-invitations.md` mentions "Google or GitHub", `authentication.md` and ADR 0002 say Google,
   Discord, Steam. Applied Google, Discord, Steam.
5. **Writes over Socket.IO.** The request's slice 6 lists "moveCard and the other operations" under real-time; the real-time doc
   says "REST writes, WebSocket broadcasts" and the gateway accepts no modification. Kept REST writes (the request does not
   contradict it explicitly).
6. **ADR cross-references.** ADR 0005 refers to the reverse proxy as ADR 0007, storage as ADR 0009 and devenv as ADR 0008; the
   actual numbers are 0006, 0008 and 0007. Noted only.

## Decisions
- **Actions vocabulary** for `can()`: `tierlist.read`, `card.write`, `category.write`, `media.upload`, `tierlist.rename`,
  `member.invite`, `member.manage`, `moderator.manage`, `tierlist.changeDefaultRole`, `tierlist.delete`, `tierlist.leave`.
  `tierlist.leave` is allowed for VIEWER/EDITOR/MODERATOR (owner cannot leave); the service also requires an explicit membership.
- **`canGrant(actor, target, next)`**: `target = null` is a user without role (new invitee or link invitation), `next = null` is a
  removal. Exhaustive actor × target × next matrix (125 cases).
- **Fractional indexing** written in-house (base-62 midpoint, keys never end in '0'), compared in code-unit order (sorting
  is done in TypeScript, not by PostgreSQL collation). No dependency needed.
- **Prisma 7 client** generated to `api/src/generated/prisma` (git-ignored), regenerated by the `build` and `test` scripts.
- **Test databases**: one Testcontainers PostgreSQL per run; migrations are applied once to a template database and each test
  file gets its own copy (`CREATE DATABASE ... TEMPLATE`), so files run in parallel without truncation.
- **API tests import `@tiermaster/shared` from source** (vitest alias), so they never run against a stale `dist`.
- **MCD additions**: `user.nameKey` (case-insensitive unique pseudonym), `user.avatarKey`, timestamps, `tierlist_op.clientOpId`,
  invitation `id/inviteeId/createdById/revokedAt` (needed by revocation, management and pseudonym invitations).
- **Seed** is compiled with the API (`dist/seed/main.js`, `pnpm --filter api seed`) and is idempotent; demo users Alice, Bob,
  Carol log in with the fake provider.
- **Health endpoint** (`GET /api/health`, DB ping, 503 when down) added in slice 2 since it only needed Prisma.
- **Sessions** are stateless HMAC-signed tokens (no session table, no dependency): `tm_session` cookie (httpOnly, SameSite=Lax,
  30 days), the OAuth state cookie and the 5-minute Socket.IO token share the format with distinct kinds. The user is re-read
  from the database on every request, so a deleted account loses access immediately. Logout clears the cookie (no server-side
  revocation list; acceptable for the MVP).
- **OAuth without passport**: Google and Discord use a small authorization-code helper over `fetch`; Steam uses OpenID 2.0
  (`check_authentication`). Each adapter is enabled only when its credentials are set; the fake provider only when
  `AUTH_FAKE_ENABLED=true`, which the config refuses in production.
- **Pseudonym gate**: `@RequireUser()` returns 403 `pseudonym_required` until a pseudonym is chosen; `/api/me` stays usable.
- **Error body** is always `{ statusCode, code, message }` (`ApiErrorSchema`); the front maps `code` to i18n messages.
- **Front i18n** is a runtime dictionary service (`t` pipe), not `@angular/localize`: one build, instant switch; French must
  define every English key (type-checked and tested).
- **Front imports `@tiermaster/shared` from source** (tsconfig path), so it never uses a stale build.
- **Access**: `AccessService` (own module and repository) resolves the role and maps refusals to 401 (anonymous), 404
  (signed in, no role, or unknown id, including malformed uuids) and 403 (role too low). An anonymous visitor attempting a write
  gets 401 (prompt to sign in), even on a public tierlist.
- **Write pipeline** (`TierlistWriter`): `SELECT ... FOR UPDATE` on the tierlist row, permission check, change, `rev + 1`, op
  insert, commit, then publish through the `RealtimeBroadcaster` port. A retried `clientOpId` from the same author returns the
  original rev; from another author, 409. Deleting a tierlist is not logged (the ops go with it) but is broadcast.
- **Title sort** uses `lower(title) COLLATE "C"` in SQL and the same comparison in TypeScript, so results do not depend on the
  database locale (Alpine images have no ICU collation by default).
- **Front data loading** uses Angular `resource()`; tests drive it with `settle()` (`whenStable()` would wait on open requests).
- **Client-generated ids** (optional uuid) on card and category creation, so the optimistic UI can reference a new item
  before the server answers; a taken id gives 409 `id_taken`.
- **Positions are computed by the server** from `afterCardId` / `afterId` with the shared `positionAfter`; the client uses the
  same function for its optimistic guess. An anchor that is not in the target list gives 409 `stale_position`.
- **Limits**: 500 cards and 30 categories per tierlist (409 `limit_reached`); `/ops` serves at most 500 ops, beyond that 410.
- **Deleting a category** moves its cards to the end of the pool with fresh positions, carried in the `category.deleted` event.
- **Socket messages**: `event` (a TierlistEvent), `access.revoked` {reason: revoked | deleted}, `role.changed` {effectiveRole},
  `notification`, `auth_error`. The doc's "member.updated (new effective role)" push is named `role.changed` to avoid a clash
  with the `member.updated` op type.
- **Gateway authentication** runs in `handleConnection`; `join` awaits it, so a join sent right after connecting is safe.
  Authenticated sockets also join `user:{id}` for personal notifications.
- **Re-evaluation** (`access.changed`) resolves the role of each connected socket (optionally only some users) instead of
  evicting blindly, as in roles-and-permissions.md.
- **Client store**: confirmed state + pending ops replayed on top (`applyEvent`); an op is confirmed by its own event or by its
  HTTP rev once the confirmed state reaches it (with a 1.5 s catch-up fallback); network errors retry 3 times with the same
  `clientOpId`; 404/409 trigger a resync. Category reordering uses up/down buttons (accessible on phones) rather than drag.
- **Sharing writes go through `TierlistWriter`**: the tierlist row lock serializes them with every other write, so the target's
  current role read inside the transaction cannot change concurrently (stronger than locking only the membership row).
  Member changes are ops (`member.added/updated/removed`); invitation creation and revocation are not (no shared state change).
- **Accepting an invitation that does not raise the role** commits nothing (the writer now accepts a no-op change: no rev, no event).
- **Personal invitations** expire after 7 days; one pending per (tierlist, invitee), re-inviting replaces it. Accept or decline
  deletes it. Links are reusable until expiry or revocation.
- **Leave** is `POST /api/tierlists/:id/leave` (action `tierlist.leave` + explicit membership required).
- **User search requires a signed-in user** (the doc calls it public; requiring a session limits scraping) and at least 2
  characters; max 10 results.
- **Members list** is readable by anyone who can read the tierlist (pseudonyms are public; emails are never returned).
- **Images**: magic-byte sniffing written in-house (JPEG, PNG, GIF, WebP; SVG refused), sharp re-encoding to WebP (cards
  512 px, avatars 256 px, first frame only, 40 MP input limit), keys `tierlists/{id}/{uuid}.webp` and `avatars/{userId}/{uuid}.webp`.
  Card images are served with `private, max-age=300`; avatars are public (`?v=` versioned URL, 1 day). Objects are deleted
  best effort after the commit (replaced/deleted card image, deleted tierlist prefix, replaced avatar). Uploads never attached
  to a card stay as orphans (a periodic sweep could be added later).
- **Storage driver**: `STORAGE_DRIVER=s3|memory`, defaulting to s3 when `S3_ENDPOINT` is set; production refuses memory.
- **Global exception filter** turns every error (including Multer's 413 and unknown routes) into `{ statusCode, code, message }`.
- **Rate limiting** written in-house (no `@nestjs/throttler`): fixed one-minute windows in memory, per user (per IP when
  anonymous); every mutating request counts as a write (120/min), uploads 20/min, user search 60/min, all configurable. It is a
  global guard registered right after the session guard in `AuthModule` (global guards run in registration order).
  In-memory state matches the single-instance deployment (ADR 0001); a Redis store would be needed with several instances.
- **Account deletion** (`DELETE /api/me`) relies on database cascades, then evicts the rooms of owned tierlists, re-evaluates
  the rooms where the user was a member, deletes images and the avatar, and clears the cookie. A later login with the same
  provider identity creates a brand-new account.
- **Front bundle budget** raised to 850 kB raw (about 166 kB transferred): Angular + zod + shared contract; pages are lazy.
- **Connection indicator** was pulled forward from slice 9 into slice 6 (it belongs with the reconnection logic).
- **Images and deployment**: the API image is built with `pnpm deploy --prod` (`files` fields added to `api` and `shared`);
  `prisma` moved to runtime dependencies so the container applies migrations at start-up (`prisma migrate deploy`, then
  `node dist/main.js`). The web image is Caddy with the SPA baked in; it terminates TLS and proxies `/api` and `/ws`. Garage is
  initialized idempotently by `infra/garage/init.sh` on every deploy. Images are tagged with the commit SHA and `latest`.
- **Standard (non-Nix) dev setup**: `docker compose -f docker-compose.dev.yml up --build` runs the whole stack with the same
  credentials as devenv.nix: PostgreSQL, Garage, a one-shot `garage-init` (`infra/garage/init.sh` with `GARAGE_CLI`, in
  the node's network namespace since the Garage image has no shell), a one-shot `deps` (install, shared and API builds),
  the API (migrations, seed, watch) and the SPA. Sources are bind-mounted, `node_modules` (and the pnpm store) are named
  volumes. `infra/dev-entrypoint.sh` runs commands as the owner of the repository (root under rootless Docker, the host
  UID otherwise) so generated files stay owned by the host user. The dev proxy target is `API_PROXY_TARGET`
  (`proxy.conf.mjs`). The project is named `tiermaster-dev` so it never collides with the local production stack.
- **Development ports**: SPA 4226, API 3226, PostgreSQL 5426, Garage 3926 (S3), 3927 (RPC), 3928 (admin), in devenv and
  Docker Compose, so the stack can run next to other local projects. Inside the Compose network PostgreSQL and Garage keep
  their standard ports (`garage.toml` is shared with production). The API defaults to 3226; the production image sets
  `PORT=3000` (Caddy target), so production is unchanged. `PORT` is not exported in the dev shell because `ng serve` reads it too.
- **Versions**: all packages share one version, bumped by `scripts/set-version.mjs` (minor per slice: slice N -> 0.N.0).

## Added dependencies
| Package | Where | Slice | Reason |
| --- | --- | --- | --- |
| `prisma`, `@prisma/client` 7.10.1 | api | 2 | ORM and migrations (stack). Pinned to 7.10 to match `prisma-engines_7` 7.10.0 in devenv |
| `@prisma/adapter-pg`, `pg`, `@types/pg` | api | 2 | Prisma 7 needs a driver adapter; `pg` is also used by the test harness to clone databases |
| `testcontainers`, `@testcontainers/postgresql` | api (dev) | 2 | Integration tests on a real PostgreSQL (AGENTS.md) |
| removed `vite-tsconfig-paths` | api (dev) | 2 | Vite now resolves tsconfig paths natively |
| `tailwindcss`, `@tailwindcss/postcss`, `postcss` | front (dev) | 3 | Design system (stack) |
| `zod` | front | 3 | Validates API responses with the shared schemas (needed since the front compiles shared from source) |
| `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` | api | 6 | Real-time gateway (stack) |
| `socket.io-client` | api (dev), front | 6 | Multi-client gateway tests; SPA real-time link |
| `@angular/cdk` | front | 6 | Touch-friendly drag and drop |
| `sharp` | api | 8 | Server-side re-encoding of uploads (ADR 0003) |
| `@aws-sdk/client-s3` | api | 8 | Plain S3 API to Garage (AGENTS.md rule 6) |
| moved `prisma` to dependencies | api | 11 | The production image runs `prisma migrate deploy` at start-up |
| bumped `@nestjs/common`, `core`, `platform-express`, `testing` to 12.3 | api | 6 | Must match `@nestjs/websockets` 12.3 |

## Open questions / needs your input
- **Production deployment inputs**: a VPS with Docker, a domain, the `.env` secrets and the GitHub secrets listed in
  `infra/README.md` (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`). The workflow has not run on GitHub yet.
- OAuth client credentials for Google (production). V1 ships with Google only: Discord and Steam are not passed to the API by
  `infra/docker-compose.prod.yml` (adapters kept). Callback URL to register: `{PUBLIC_URL}/api/auth/google/callback`.
  Step-by-step production setup: `docs/production-setup.md`.

## Final report

**Works (verified by tests and by running it):**
- `pnpm build` and `pnpm test` pass: 226 shared unit tests (permission matrix, ordering, reducer), 135 API integration tests on a
  real PostgreSQL (Testcontainers) including multi-client Socket.IO scenarios, hostile uploads, rejected and revoked-mid-session
  cases, and 45 front tests (store, pages per role, guards, i18n parity).
- `devenv up` starts PostgreSQL, Garage, the API (migrations applied) and the SPA; checked fake login, image upload to Garage
  and room joins through the dev proxy. The Docker-based standard setup was checked the same way.
- The production images build and the production Compose stack runs locally (HTTPS via Caddy, SPA deep links, API, WebSocket,
  migrations at start-up, fake login refused).

**Not verified / limitations:**
- The UI was not exercised in a real browser (no E2E by design): drag-and-drop gestures, phone layout and dark mode were
  checked through component tests and builds only. A manual pass on a phone is recommended.
- The Google, Discord and Steam adapters follow the documented provider flows but are untested without credentials.
- The GitHub Actions workflow is syntactically valid but has not run on GitHub.
- Rate limiting and the real-time broadcaster are in memory (single API instance, as in ADR 0001).
- Uploaded images that are never attached to a card are not swept.
- Ownership transfer is not implemented (out of scope in roles-and-permissions.md).
