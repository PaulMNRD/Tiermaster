Source of truth for the database. The Prisma schema (`services/api/prisma/schema.prisma`) implements it.

```mermaid
erDiagram
    USER ||--o{ OAUTH_ACCOUNT : "signs in with"
    USER ||--o{ TIERLIST : owns
    USER ||--o{ MEMBERSHIP : has
    TIERLIST ||--o{ MEMBERSHIP : grants
    TIERLIST ||--o{ CATEGORY : contains
    TIERLIST ||--o{ CARD : contains
    CATEGORY |o--o{ CARD : ranks
    TIERLIST ||--o{ TIERLIST_OP : logs
    TIERLIST ||--o{ INVITATION : issues
    USER |o--o{ INVITATION : "is invited by pseudonym"

    USER {
        uuid id PK
        string email "nullable (Steam gives none), never searchable"
        string name "pseudonym, unique, null until chosen"
        string nameKey "lower-cased pseudonym, unique"
        string avatarUrl "provider avatar"
        string avatarKey "uploaded avatar (object storage)"
        datetime createdAt
    }
    OAUTH_ACCOUNT {
        uuid id PK
        uuid userId FK
        string provider "google, discord, steam (fake in dev/tests)"
        string providerUserId "unique with provider"
    }
    TIERLIST {
        uuid id PK
        uuid ownerId FK
        string title
        string defaultRole "EDITOR, VIEWER or null"
        int rev "operation counter"
        datetime createdAt
        datetime updatedAt
    }
    MEMBERSHIP {
        uuid userId PK, FK
        uuid tierlistId PK, FK
        string role "MODERATOR, EDITOR or VIEWER"
        datetime createdAt
    }
    CATEGORY {
        uuid id PK
        uuid tierlistId FK
        string name
        string color
        string position "fractional index"
    }
    CARD {
        uuid id PK
        uuid tierlistId FK
        uuid categoryId FK "null means unsorted pool"
        string title
        string imageKey
        string position "fractional index"
    }
    TIERLIST_OP {
        uuid tierlistId PK, FK
        int rev PK
        string type
        json payload
        uuid authorId FK "null once the author is deleted"
        string clientOpId "unique per tierlist, idempotent retries"
        datetime createdAt
    }
    INVITATION {
        uuid id PK
        uuid tierlistId FK
        string role "MODERATOR, EDITOR or VIEWER"
        string tokenHash "SHA-256, unique; link invitations only"
        uuid inviteeId FK "pseudonym invitations only"
        uuid createdById FK
        datetime expiresAt
        datetime revokedAt
        datetime createdAt
    }
```

## Notes

- All keys are uuid; foreign keys use the same type as the key they reference.
- Deleting a user cascades to their oauth accounts, owned tierlists, memberships and invitations; their ops keep a `null` author.
- Deleting a tierlist cascades to its categories, cards, memberships, ops and invitations.
- Deleting a category moves its cards to the unsorted pool (`categoryId = null`); the service gives them fresh positions.
- Positions are compared in code-unit order (sorting happens in TypeScript, see `shared/src/domain/fractional-index.ts`).
- An invitation is either a link (`tokenHash` set, generic, reusable until expiry or revocation) or personal
  (`inviteeId` set, accepted or declined once). At most one pending personal invitation per (tierlist, invitee).
