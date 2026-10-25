# ADR 0008: Object storage: Garage instead of MinIO

- Status: Accepted
- Date: 2026-10-18

## Context
Card images need a self-hosted, S3-compatible object store. MinIO was the initial choice, but its community edition entered
maintenance mode: no new features, security fixes handled case by case, and distribution as source only. For a component that
stores user files, the lack of guaranteed security patches is a risk. Only the API accesses the storage, which is not exposed
publicly.

## Quality attributes at stake
- Favoured: Security.
- Sacrificed: advanced S3 features (versioning, per-object ACLs, server-side encryption).

## Decision
- Use Garage as a S3-compatible store.

## Alternatives considered
- Stay on MinIO community edition: no guaranteed security maintenance. Community forks lack durable governance.
- SeaweedFS: solid and permissively licensed (Apache 2.0), but several components (master, volume servers, S3 gateway), more
  than a single node needs.
## Evolution
Revisit when: S3 features such as versioning are needed (SeaweedFS), or a managed S3 service becomes affordable.
