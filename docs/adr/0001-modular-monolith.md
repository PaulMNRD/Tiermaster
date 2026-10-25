# ADR 0001: Modular monolith with selective ports and adapters

- Status: Accepted
- Date: 2026-10-18

## Context
TierMaster is a project meant to keep growing.
Currently running on a single small VPS. The stack is Angular and NestJS with Prisma and PostgreSQL. The project must
start small and leave room to grow, with a clear Interface / Logic / Data separation, but without the ceremony of a strict
hexagonal architecture.

## Quality attributes at stake
- Favoured: Modifiability, Testability, Deployability.
- Sacrificed: Availability : a single instance is a single failure domain.

## Decision
- One deployable NestJS API, split into modules: `auth`, `users`, `tierlists`, `sharing`, `realtime`, `media`.
- Interface / Logic / Data separation inside each module, expressed through file suffixes (`*.controller.ts` or `*.gateway.ts`,
  `*.service.ts`, `*.repository.ts`). Dependency direction: controller, then service, then repository; never upwards.
- Ports (interfaces) only where change is expected: `AuthProvider` (OAuth now, email/password later), `ObjectStorage`
  (Garage now, cloud S3 later), `RealtimeBroadcaster` (in-memory now, Redis for multiple instances).
- Prisma is used directly by repositories; it is already an abstraction and might not change, so no extra port.
- Modules interact through exported services or internal events, never through each other's repositories.

## Alternatives considered
- Microservices: operational cost with no benefit for current needs. Module boundaries keep extraction possible.
- Full hexagonal architecture: too much boilerplate for the parts that rarely change (e.g. Prisma).

## Consequences
- Positive: one build and one deployment; simple local development; cross-module refactors are cheap; pure logic is easy to test;
  the three ports are the only abstractions to maintain.
- Negative: single failure domain; the whole process scales together (real-time cannot scale apart from CRUD);

## Evolution
Revisit when: more than one instance is needed, real-time load diverges from CRUD load, or the team grows.
