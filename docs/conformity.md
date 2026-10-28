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
