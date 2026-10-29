Users sign in with Google, Discord or Steam (production V1 offers Google only, see `docs/production-setup.md`). The API handles the OAuth 2.0 authorization code flow, then issues its own session so the rest of the system never depends on the provider.
The same token or cookie is used to authenticate the Socket.io handshake (see [section 7](#7-real-time-collaboration)).

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant API as AuthController
    participant P as OAuth provider
    participant DB as PostgreSQL
 
    U->>API: GET /api/auth/google
    API-->>U: 302 redirect to provider (state)
    U->>P: Consent screen
    P-->>U: 302 redirect to /api/auth/google/callback?code&state
    U->>API: GET /api/auth/google/callback?code&state
    API->>API: Verify state
    API->>P: Exchange code for tokens
    P-->>API: Profile (id, email, name, avatar)
    API->>DB: Upsert user and oauth_account
    API-->>U: Set session cookie, 302 redirect to the SPA
    U->>API: GET /api/me
    API-->>U: Current user
```
