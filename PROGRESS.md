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

### 2. Prisma schema, migrations, seed — todo
- Schema follows `docs/mcd.md` (with the corrections logged below), uuid keys everywhere.
- Initial SQL migration committed; applied by tests and by `prisma migrate deploy`.
- Seed script creates demo users and tierlists (public, private, shared).
- Integration test harness: real PostgreSQL through Testcontainers, one database per test file.

### 3. Authentication and app shell — todo
- `AuthProvider` port; fake provider for tests and dev; Google, Discord, Steam adapters enabled by env.
- OAuth state verified; invalid state rejected.
- Signed, httpOnly session cookie; `GET /api/me`; logout.
- Pseudonym required on first login (unique, validated by zod).
- Short-lived socket token endpoint for the Socket.IO handshake.
- Front: app shell, login page, pseudonym page, route guards (auth, pseudonym).

### 4. Tierlists CRUD, home and community pages — todo
- Create a tierlist (owner = creator, default categories S/A/B/C/D).
- Home lists owned and shared tierlists with the effective role, search and sort.
- Community lists public tierlists (defaultRole not null), search, sort, pagination.
- Rename (EDITOR+), change defaultRole and delete (OWNER only), leave (members); 401/403/404 semantics.
- Rejected tests for every permission-gated endpoint.

### 5. Categories and cards (REST), read-only tierlist page — todo
- Snapshot `GET /api/tierlists/:id` with categories, cards (ordered), `rev`, `effectiveRole`.
- Create / edit / delete categories and cards, reorder categories, move cards (fractional positions).
- Every write: one transaction, permission check, `rev + 1`, op logged, idempotent `clientOpId`.
- `GET /api/tierlists/:id/ops?since=` with 410 when the gap is too large.
- Front: tierlist page rendering categories, cards and an "unsorted" pool.

### 6. Real-time — todo
- Socket.IO gateway on `/ws`; optional handshake token, invalid token disconnects.
- `join` validated by zod, access via `AccessService`, `not_found` without role, ack `{effectiveRole, rev}`.
- Events broadcast after commit to room `tierlist:{id}`, carrying `rev` and `clientOpId`.
- Front: drag and drop (CDK, touch), optimistic UI with pending ops, rollback on 4xx, gap detection and resync.
- Multi-client tests: broadcast, rejected join, anonymous capped.

### 7. Sharing — todo
- Members list; change role / remove with `canGrant` (moderator rules), checked in a transaction.
- Invitations by pseudonym (accept / decline) and by link (24h, hashed token, revocable).
- Accepting never lowers a role; pending invitations notified on the home page.
- Live revocation and role downgrade on connected sockets (member removed, role changed, defaultRole changed, tierlist deleted).

### 8. Images — todo
- Upload `POST /api/tierlists/:id/media`: EDITOR+, magic bytes check, size limit, re-encoded with sharp.
- Stored through the `ObjectStorage` port (S3 adapter for Garage, in-memory adapter for tests).
- `GET /api/media/*` checks read access, private cache headers; revoked users get 404.
- Front: client-side resize before upload; card images displayed.

### 9. Polish — todo
- Settings page (rename, default role, delete, leave), profile page (pseudonym, avatar, delete account).
- Empty / loading / error states; 401, 403, 404 and "not found or private" screens.
- Connection status indicator with reconnection and full resync.
- Rate limiting on writes and uploads; `GET /api/health`.
- Light / dark theme, i18n (fr, en), mobile pass.

### 10. Documentation — todo
- `docs/conformity.md`, `docs/archi/architecture.md`, README (devenv and standard setup).

### 11. CI/CD — todo
- GitHub Actions: build and test on push / PR; on `main`, build images and deploy to the VPS with Docker Compose and Caddy.

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
- **Versions**: all packages share one version, bumped by `scripts/set-version.mjs` (minor per slice: slice N -> 0.N.0).

## Added dependencies
_None yet._

## Open questions / needs your input
_None yet._
