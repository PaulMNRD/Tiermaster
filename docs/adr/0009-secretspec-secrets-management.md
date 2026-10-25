# ADR 0009: Secrets management: SecretSpec instead of dotenv

- Status: Accepted
- Date: 2026-10-25
## Context
The application needs secrets: database credentials, object storage keys, OAuth client secrets for Google and GitHub, and a token
signing key. The usual answer, a `.env` file, keeps them in plaintext next to the code. It is easy to commit by accident, gets
copied by hand between machines, does not declare which secrets exist, and does not fail early when one is missing. The project
is also developed with a coding agent (OpenCode) working inside the repository, which can read any file of the working tree:
plaintext secrets there are an unnecessary exposure. Secrets also differ from configuration: they grant authority and need
restricted access and independent rotation.

## Quality attributes at stake
- Favoured: Security, Deployability.
- Sacrificed: the simplicity of a single plain file; reliance on a young tool.

## Decision
- Use SecretSpec. A committed `secretspec.toml` declares every secret the project needs (see secretspec docs) and never contains a value.
- Values are stored by SecretSpec's `sops` provider in SOPS-encrypted files committed under `secrets/{project}/{profile}.enc.yaml`, encrypted with age keys. `.sops.yaml` lists the recipients.
- Private age keys never enter the repository.
- Secrets reach the development shell through devenv's SecretSpec integration; elsewhere `secretspec run -- <command>` is used.
- No `.env` file in the repository.

## Alternatives considered
- dotenv (`.env` + `.env.example`): simplest and universal, but plaintext on disk, risk of accidental commit, drift between the
  example and reality, no validation, and readable by coding agents.