# ADR 0006: Reverse proxy

- Status: Accepted
- Date: 2026-10-18

## Context
One entry point must terminate TLS, serve the Angular static files, and route `/api` and `/ws` to the API, with WebSocket
support, on a single VPS. The front end and the API should share one origin (no CORS).

## Quality attributes at stake
- Favoured: Deployability, Security.

## Decision (proposed)
Use Caddy: automatic HTTPS with Let's Encrypt, a few lines of configuration, WebSocket proxying without special setup, and static
file serving.

## Alternatives considered
- Traefik: worthwhile with many containers and dynamic discovery, which is not the case here.
- nginx: very common, but needs more configuration for TLS renewal and WebSocket upgrade headers.

## Evolution
Revisit when: several routable services or dynamic routing appear.
