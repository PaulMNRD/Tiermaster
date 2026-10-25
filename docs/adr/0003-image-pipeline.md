# ADR 0003: Image pipeline: client resize, server validation, served through the API

- Status: Accepted
- Date: 2026-10-18

## Context
Cards carry images uploaded by users. Uploads are a security concern (file type, size, malicious payloads), and
images of private tierlists must respect access rights.

## Quality attributes at stake
- Favoured: Security.
- Sacrificed: Performance: some API CPU and bandwidth, since images stream through the API.

## Decision
1. The client resizes and compresses before upload (saves bandwidth, faster uploads).
2. The server never trusts the client: it checks the real file type (magic bytes), enforces a size limit, and
   re-encodes the image with a library such as `sharp`, which also strips metadata and malicious payloads.
3. Images are stored in a private bucket.
4. Images are served through the API, which checks the user's rights before streaming from storage.

## Alternatives considered
- Server-side optimization only: wastes bandwidth and slows uploads.
- Client-side only: unsafe, because the client can be bypassed.
- Public bucket or signed URLs: simpler and lighter for the API, but revocation is delayed until a URL expires. Short-lived signed
  URLs remain a possible later optimization.

## Consequences
- Positive: rights apply to images exactly like to other data; revocation is immediate.
- Negative: extra load on the API; caching must be private; the re-encoding step needs tests with hostile files.

## Evolution
Revisit when: image traffic becomes significant.
