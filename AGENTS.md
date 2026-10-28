TierMaster is a collaborative real-time tierlist editor ("Google Docs for tierlists"): users browse, create, share and edit tierlists with per-tierlist access rights, and changes sync live between connected users.
## Stack
**Global**: Node 24 with pnpm, TypeScript and Zod.
**Dev environment**: devenv; run every command inside `devenv shell`.
**Front**: Angular + Tailwind.
**Back**: NestJS + Socket.IO.
**CI/CD**: Docker containers with production setup containers and images. Caddy.
**Persistence**: Prisma + PostgreSQL, Garage as S3-compatible storage.
**Tests**: Vitest everywhere.
## Layout
- `services/shared` (`@tiermaster/shared`): `src/types/` (zod schemas, the front/back contract) and `src/domain/`
  (pure logic: roles, permissions, ordering; no I/O, no framework imports; may import from `types/`, never the reverse).
- `services/api`: `src/modules/<name>/`, `src/ports/`, `src/adapters/`.
- `services/front`: `core/`, `ui/`, `features/`.
## Architecture rules
1. Dependency direction: `controller -> service -> repository`. No layer imports upwards.
2. Every permission decision goes through `can()` / `canGrant()` from `shared/domain`; never an ad hoc `if (role === ...)`.
3. Every incoming message (REST and Socket.IO) is validated with the zod schemas from `@tiermaster/shared`.
4. Modules talk through exported services or internal events, never through each other's repositories.
5. Permissions are enforced server-side on every REST call and Socket.IO message. The front only updates UI depending on permissions.
6. Only the API accesses PostgreSQL and the object storage, through the plain S3 API (`@aws-sdk/client-s3`).
## Documentation map
- `docs/archi/`: C1 and C2 diagrams.
- `docs/features/`: detailed behaviour (UML and notes). Read the files about the feature at hand.
- `docs/mcd.md`: data model, the source of truth for the database, keep it updated when changes are required.
- `docs/adr/`: past decisions. Check them before changing a structural choice. Read the files about the feature at hand.
- `docs/conformity.md`: requirement-to-slice tracking, updated at the end of every slice.
## Testing strategy
- **Unit:** exhaustive permission matrix (`effectiveRole`, `can`, `canGrant`), business rules: e.g. tierlist operations, fractional indexing.
- **Integration:** API + real PostgreSQL (Testcontainers), fake `AuthProvider`, WebSocket scenarios with several clients (permission rejection, revocation, broadcast).
- **No automated E2E**.
## Git and safety
- always write a commit after each feature
## Definition of done
`pnpm build` and `pnpm test` pass; tests exist for each acceptance criterion; no rule above is broken; `docs/conformity.md` is updated; `docs/mcd.md` is updated;
Software versions are coherently updated after each feature.
## Conventions
Code, comments and docs in English. Small, reviewable diffs. Keep changes within the slice's scope.
