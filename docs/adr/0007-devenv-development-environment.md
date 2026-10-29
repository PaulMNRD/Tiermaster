# ADR 0007: Reproducible development environment with devenv

- Status: Accepted
- Date: 2026-10-18

## Context
Developing on Nixos. The project requires a lot of dependencies setup for: Node, pnpm, PostgreSQL and an
S3-compatible store locally.
## Decision
Development environment will be setup using Devenv, a nix based tool.

## Quality attributes at stake
- Favoured: Developer Experience.

## Consequences
- Positive: one command gives the whole toolchain and services; the same environment everywhere; fast and reproducible development environment;
- Negative: Nix is required; pnpm and Node versions depend on the pinned nixpkgs revision; native tools (Prisma) need extra setup.

## Evolution
Revisit when: the team grows with developers who don't use Nix (add a Docker-based alternative).
Done: `docker-compose.dev.yml` runs the whole development stack with Docker only (README, option B); devenv stays the
reference environment (CI).
