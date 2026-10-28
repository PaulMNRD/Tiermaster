# Conformity: requirement-to-slice tracking

Updated at the end of every slice. Status: ✅ done, 🟡 partial, ⏳ todo, ⛔ needs external input.

| Requirement | Source | Slice | Status | Evidence (tests / code) |
| --- | --- | --- | --- | --- |
| Effective role resolution (owner, membership wins, defaultRole, anonymous capped) | roles-and-permissions.md, ADR 0004 | 1 | ✅ | `shared/src/domain/permissions.spec.ts` (`effectiveRole`) |
| Permission matrix enforced by a single pure function | roles-and-permissions.md, ADR 0004 | 1 | ✅ | `permissions.spec.ts` (`can`, every role × action) |
| Member-management rules (owner / moderator, no owner target, no OWNER grant) | roles-and-permissions.md | 1 | ✅ | `permissions.spec.ts` (`canGrant`, actor × target × next) |
| Accepting never lowers a role | sharing-and-invitations.md | 1 | ✅ | `permissions.spec.ts` (`grantsMoreAccess`) |
| Fractional ordering of cards and categories | real-time-collaboration.md | 1 | ✅ | `shared/src/domain/fractional-index.spec.ts` |
| Data model implemented as specified (uuid keys, cascades, unique clientOpId and pseudonym) | mcd.md | 2 | ✅ | `api/test/database/schema.spec.ts` |
| Migrations versioned and applied on a real PostgreSQL | AGENTS.md (testing) | 2 | ✅ | `api/prisma/migrations`, `api/test/global-setup.ts` (Testcontainers) |
| Seed script with demo data (idempotent) | request | 2 | ✅ | `api/src/seed/seed.ts`, `schema.spec.ts` |
| Health endpoint | request | 2 | ✅ | `api/test/health/health.spec.ts` |
| OAuth sign-in through the `AuthProvider` port (Google, Discord, Steam adapters; fake provider) | authentication.md, ADR 0002 | 3 | 🟡 | `api/src/adapters/auth/*`; fake flow tested in `api/test/auth/auth.spec.ts`. Real providers need credentials (⛔) |
| OAuth state verified, no open redirect | authentication.md | 3 | ✅ | `auth.spec.ts` (`rejected` block) |
| API-issued session (httpOnly cookie), `GET /api/me`, logout | authentication.md | 3 | ✅ | `auth.spec.ts`, `api/src/modules/auth/session.service.spec.ts` |
| Pseudonym on first login, unique, required before use | ADR 0002, request | 3 | ✅ | `auth.spec.ts`; front `welcome.page.ts`, `auth.guards.spec.ts` |
| Fresh short-lived token for the Socket.IO handshake | real-time-collaboration.md | 3 | ✅ | `GET /api/auth/socket-token` in `auth.spec.ts` |
| App shell, route guards, light/dark theme, i18n (en, fr) | request | 3 | ✅ | `front/src/app/app.spec.ts`, `auth.guards.spec.ts`, `i18n.service.spec.ts` |
| Create a tierlist (creator is owner, default categories) | request | 4 | ✅ | `api/test/tierlists/tierlists.spec.ts`; front `home.page.spec.ts` |
| Home: owned and shared tierlists with role, search, sort | request | 4 | ✅ | `tierlists.spec.ts` (create and list); front `home.page.spec.ts` |
| Community: public tierlists (defaultRole not null), search, sort, pagination, anonymous access | request | 4 | ✅ | `tierlists.spec.ts` (community); front `community.page.spec.ts` |
| Rename (EDITOR+), default role and delete (OWNER only), 401/403/404 semantics | roles-and-permissions.md | 4 | ✅ | `tierlists.spec.ts` (`rejected` blocks) |
| Single-transaction writes: lock, check, rev + 1, op log, idempotent clientOpId | real-time-collaboration.md | 4 | ✅ | `tierlists.spec.ts` (ops and idempotency tests), `TierlistWriter` |
| Empty, loading and error states (home, community) | request | 4 | ✅ | `home.page.spec.ts` |
| Snapshot with ordered categories, cards, rev and effective role | real-time-collaboration.md | 5 | ✅ | `api/test/tierlists/content.spec.ts` (snapshot) |
| Categories: create, rename, reorder, delete (cards to the pool), EDITOR+ | roles-and-permissions.md | 5 | ✅ | `content.spec.ts` (categories) |
| Cards: create, edit, move (fractional position), delete, EDITOR+; cross-tierlist ids rejected | roles-and-permissions.md, real-time-collaboration.md | 5 | ✅ | `content.spec.ts` (cards) |
| `GET /ops?since=` with read check, 410 on large gap | real-time-collaboration.md | 5 | ✅ | `content.spec.ts` (ops since) |
| Revoked / demoted mid-session (REST) | roles-and-permissions.md | 5 | ✅ | `content.spec.ts` (`revoked mid-session`, `demoted mid-session`) |
| Shared reducer (`applyEvent`) and ordering helpers | real-time-collaboration.md | 5 | ✅ | `shared/src/domain/tierlist-state.spec.ts` |
| Tierlist page: categories, cards, unsorted pool; 401 and "not found or private" screens | request | 5 | ✅ | front `tierlist.page.spec.ts` |
| Socket.IO gateway on `/ws`, optional token, invalid token disconnects | real-time-collaboration.md | 6 | ✅ | `api/test/realtime/realtime.spec.ts` |
| `join` validated, access via `AccessService`, `not_found` without role, ack `{effectiveRole, rev}`, anonymous capped | real-time-collaboration.md | 6 | ✅ | `realtime.spec.ts` (`rejected`, anonymous tests) |
| Events broadcast after commit with `rev` and `clientOpId`, only to the room | real-time-collaboration.md | 6 | ✅ | `realtime.spec.ts` (broadcast, outsider) |
| Live re-evaluation: defaultRole change evicts or downgrades, deletion evicts | roles-and-permissions.md | 6 | ✅ | `realtime.spec.ts` (`revoked mid-session`) |
| Optimistic UI: pending ops, confirmation by HTTP or event, rollback on 4xx, retry with same clientOpId | real-time-collaboration.md | 6 | ✅ | front `tierlist.store.spec.ts` |
| Gap detection, `/ops` replay, 410 snapshot reload, rejoin and resync after reconnection | real-time-collaboration.md | 6 | ✅ | `tierlist.store.spec.ts` |
| Drag and drop (mobile-first: touch delay, mixed orientation), card/category editing UI | request | 6 | 🟡 | `tierlist.page.ts` (CDK); rendering tested in `tierlist.page.spec.ts`, gestures not automated (no E2E) |
| Connection status indicator with manual retry | request | 6 | ✅ | `ui/connection-indicator.ts`, `RealtimeService` |
| Members list; change role and remove with `canGrant`, checked inside the write transaction | roles-and-permissions.md | 7 | ✅ | `api/test/sharing/members.spec.ts` |
| Moderator rules (no moderator grant, no moderator/owner target), owner-only moderator management | roles-and-permissions.md | 7 | ✅ | `members.spec.ts` (`rejected`) |
| Leave a tierlist (members only, owner cannot) | roles-and-permissions.md | 7 | ✅ | `members.spec.ts` (`leave`) |
| Live revocation and downgrade (removal, demotion, leave, fallback to defaultRole) | roles-and-permissions.md | 7 | ✅ | `members.spec.ts` (`revoked mid-session (live)`) |
| Invitation links: 24h, hashed token shown once, revocable, reusable, never lower a role | sharing-and-invitations.md | 7 | ✅ | `api/test/sharing/invitations.spec.ts` (links) |
| Invitations by pseudonym with accept / decline, live notification, listed on the home page | request | 7 | ✅ | `invitations.spec.ts` (by pseudonym); front `home.page.spec.ts` |
| Invitation management visibility (owner all, moderator own or assignable); creator demoted -> invitations revoked | sharing-and-invitations.md | 7 | ✅ | `invitations.spec.ts` (management), `members.spec.ts` |
| User search by pseudonym only, capped, `excludeMembersOf` restricted | sharing-and-invitations.md | 7 | ✅ | `api/test/sharing/user-search.spec.ts` |
| Settings page (rename, visibility, members, invitations, leave, delete) by role; join page | request | 7 | ✅ | front `settings.page.spec.ts`, `join.page.spec.ts` |
| Upload: EDITOR+, real type by magic bytes, 5 MB limit, decompression-bomb limit, re-encoded to WebP (metadata stripped) | image-handling.md, ADR 0003 | 8 | ✅ | `api/test/media/media.spec.ts`, `api/src/modules/media/image-processing.spec.ts` |
| Private bucket through the `ObjectStorage` port (S3 adapter for Garage, in-memory for tests) | ADR 0008, AGENTS.md rule 6 | 8 | 🟡 | `adapters/storage/*`; in-memory adapter tested, S3 adapter checked against Garage in slice 10 |
| Images served through the API with the tierlist read check, private cache, revocation immediate | image-handling.md, ADR 0003 | 8 | ✅ | `media.spec.ts` (`rejected`, revoked mid-session) |
| Storage cleanup: replaced or deleted card images, deleted tierlists | ADR 0003 | 8 | ✅ | `media.spec.ts` |
| Client-side resize before upload; card image UI; avatars | image-handling.md, request | 8 | ✅ | front `image-resize.spec.ts`, `card-editor.ts`; avatar API in `media.spec.ts` |
| Uniform error body for framework errors (413, 404 routes, 500) | — | 8 | ✅ | `common/api-exception.filter.ts` (exercised by `media.spec.ts`) |
| Profile: pseudonym, avatar, delete account (owned tierlists deleted and evicted live, session invalid) | request | 9 | ✅ | `api/test/users/account.spec.ts`; front `profile.page.spec.ts` |
| Rate limiting on writes, uploads and search (429 + Retry-After, per user or IP) | request | 9 | ✅ | `api/test/common/rate-limit.spec.ts` |
| Session expiry detected on any 401 (UI switches to anonymous) | real-time-collaboration.md (edge cases) | 9 | ✅ | `core/auth/session.interceptor.ts` |
| Empty / loading / error states; 401, 403, 404 and "not found or private" screens | request | 4-9 | ✅ | `ui/states.ts`; `home.page.spec.ts`, `tierlist.page.spec.ts`, `join.page.spec.ts` |
| Light and dark themes, French and English, mobile-first layout | request | 3, 9 | ✅ | `ThemeService`, `I18nService` (`i18n.service.spec.ts` checks key parity); responsive Tailwind classes (manual check) |
| README with run instructions (devenv and standard setup), configuration, commands | request | 10 | ✅ | `README.md`; both paths run end to end (devenv up, Docker Compose + init script) |
| Architecture as built | request | 10 | ✅ | `docs/archi/architecture.md`; C1 role names updated |
| App starts with `devenv up` (PostgreSQL, Garage, API with migrations, front) | request | 10 | ✅ | Verified: health, fake login, upload to Garage and socket join through the dev proxy |
