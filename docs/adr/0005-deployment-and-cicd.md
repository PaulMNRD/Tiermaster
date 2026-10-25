# ADR 0005: Single-VPS Docker Compose deployment and CI/CD

- Status: Accepted
- Date: 2026-10-18

## Context
The project has a low hosting budget. Zero-downtime deployment is not a goal; automatic restart after a
crash is cheap and wanted early. Every merge to `main` should be tested and deployed without manual steps.

## Quality attributes at stake
- Favoured: Deployability, Testability.
- Sacrificed: Availability: short restarts during deployments; no redundancy.

## Decision
- Production runs on one small VPS with Docker Compose: reverse proxy (ADR 0007), API, front-end static files, PostgreSQL and the
  object storage (ADR 0009). Services use `restart: unless-stopped`.
- GitHub Actions: on every push and pull request, install, build and test (inside the devenv shell, ADR 0008); on merge to
  `main`, build the images and deploy to the VPS.
- Production secrets (database, OAuth, storage) are provided to the VPS and never committed; development defaults live in
  `devenv.nix` only.
- Backups of PostgreSQL and of the object storage are the operator's responsibility (a single node has no redundancy).

## Alternatives considered
- Managed platforms (PaaS): easier operations but costlier.
- Kubernetes: disproportionate for current needs.
- Manual deployments: error-prone and contrary to the CI/CD goal.

## Consequences
- Positive: cheap, reproducible, portable to any machine with Docker; the same path for every deployment.
- Negative: short downtime on deploys; the VPS is a single point of failure; no backup and monitoring for now.

## Evolution
Revisit when: availability requirements rise.
