# ADR 0002: OAuth-first authentication behind an AuthProvider port

- Status: Accepted
- Date: 2026-10-18

## Context
Users need an identity to own and share tierlists. The only personal data collected is an email and a pseudonym.

## Quality attributes at stake
- Favoured: Security, Modifiability.
- Sacrificed: Usability: users without a Google, Discord or Steam account are excluded until email/password is added.

## Decision
- MVP login through OAuth only.
- Authentication sits behind the `AuthProvider` port. Adapters: Google, Discord, Steam, and a fake provider for tests.
- A pseudonym is requested on first login.
- Email/password is a later adapter; it must not require changes outside `auth`.

## Alternatives considered
- Email/password first: needs hashing, reset and verification flows and brute-force protection, with no benefit for the MVP.
- Both from the start: doubles the surface to build and secure before the core is validated.

## Consequences
- Positive: no password storage; smaller attack surface; fast to build; the fake provider enables integration tests.
- Negative: dependency on external providers' availability and terms; GDPR basics still apply to the stored email and pseudonym.

## Evolution
Revisit when: standard email/password login or another provider is needed.
