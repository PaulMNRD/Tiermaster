# ADR 0004: Permissions as a central pure function

- Status: Accepted
- Date: 2026-10-18

## Context
Each tierlist has levels of access: none, read, edit (move cards, add, modify, delete cards and categories) and moderate
(manage access rights). Authorization is the highest-risk logic of the application and must be identical across REST, Socket.IO and image delivery.

## Quality attributes at stake
- Favoured: Security, Testability, Modifiability.

## Decision
- All rules live in pure functions in `services/shared/src/domain`: `effectiveRole`, `can(role, action)`, `canGrant(actor, current,
  next)`. REST controllers, the Socket.IO gateway and the media module all call them; ad hoc role checks are forbidden.
- Tests are an exhaustive table-driven matrix (every role against every action, every actor against target and new role).

## Alternatives considered
- Checks scattered in controllers and guards: duplicated rules drift apart and cannot be tested as a whole.

## Consequences
- Positive: a single source of truth; exhaustive tests; the front end can reuse `can()` to hide unauthorized controls (the server
  stays authoritative); easy for coding agents to follow as a rule.
- Negative: every new action must be added to the capability table.
