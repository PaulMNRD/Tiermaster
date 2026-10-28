# Conformity: requirement-to-slice tracking

Updated at the end of every slice. Status: ✅ done, 🟡 partial, ⏳ todo, ⛔ needs external input.

| Requirement | Source | Slice | Status | Evidence (tests / code) |
| --- | --- | --- | --- | --- |
| Effective role resolution (owner, membership wins, defaultRole, anonymous capped) | roles-and-permissions.md, ADR 0004 | 1 | ✅ | `shared/src/domain/permissions.spec.ts` (`effectiveRole`) |
| Permission matrix enforced by a single pure function | roles-and-permissions.md, ADR 0004 | 1 | ✅ | `permissions.spec.ts` (`can`, every role × action) |
| Member-management rules (owner / moderator, no owner target, no OWNER grant) | roles-and-permissions.md | 1 | ✅ | `permissions.spec.ts` (`canGrant`, actor × target × next) |
| Accepting never lowers a role | sharing-and-invitations.md | 1 | ✅ | `permissions.spec.ts` (`grantsMoreAccess`) |
| Fractional ordering of cards and categories | real-time-collaboration.md | 1 | ✅ | `shared/src/domain/fractional-index.spec.ts` |
