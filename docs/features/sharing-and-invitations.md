Adding someone to a tier list has two paths, both available in the member management part of the tierlist.

|Path|When|Result|
|---|---|---|
|**Direct add**|The person already has an account|A `MEMBERSHIP` is created immediately|
|**Invitation link**|The person has no account (or cannot be found)|A generic link lets them sign up, then creates their `MEMBERSHIP`|

Both paths are restricted to **OWNER** and **MODERATOR**, and follow the assignable-role rules of [[Roles and permissions#Permission matrix]]: a moderator can only grant `EDITOR` or `VIEWER`, while the owner can also grant `MODERATOR`.

## User flow

```mermaid
flowchart TD
    A["Click 'Add a user'"] --> B["Search the user directory"]
    B --> C{"User found?"}
    C -- Yes --> D["Pick a role"]
    D --> E["Membership created immediately"]
    C -- No --> F["Offer 'Create an invitation link'"]
    F --> G["Pick a role"]
    G --> H["Link generated with a 24h expiration date, shown once"]
    H --> I["Owner or moderator shares it"]
    I --> J["Guest opens the link, signs up or signs in"]
    J --> K["Membership created on acceptance"]
```

## Direct add of an existing user

```mermaid
sequenceDiagram
    autonumber
    actor M as Moderator
    participant API as UsersController
    participant MAPI as MembersController
    participant ACC as AccessService
    participant DB as PostgreSQL
    participant GW as TierlistGateway
    actor N as New member

    Note over M,API: Step 1: search by name (same endpoint as the public profile search)

    M->>API: GET /users/search?q=ali&excludeMembersOf={tierlistId}

    opt excludeMembersOf is provided
        API->>ACC: Caller is OWNER or MODERATOR on this tierlist?
        alt Not allowed
            API-->>M: 404 Not Found
        end
    end

    API->>DB: Search users by name (prefix or partial match)

    opt excludeMembersOf is provided
        API->>DB: Exclude the owner and all members of the tierlist
    end

    API-->>M: [{id, name, avatarUrl}]

    Note over M,MAPI: Step 2: add the selected user

    M->>MAPI: POST /tierlists/{id}/members {userId, role: EDITOR}
    MAPI->>DB: BEGIN
    MAPI->>ACC: canAssignRole(moderator, EDITOR)
    MAPI->>DB: Read target's effective role (membership or defaultRole)

    alt Role not assignable by the actor, or actor lacks rights
        MAPI->>DB: ROLLBACK
        MAPI-->>M: 403 Forbidden
    else Target already has an equal or higher effective role
        MAPI->>DB: ROLLBACK
        MAPI-->>M: 409 Already has equal or higher access
    else Role grants more access
        MAPI->>DB: Insert membership, rev + 1, log op
        MAPI->>DB: COMMIT
        MAPI-->>M: 201 {membership}
        MAPI--)GW: event member.added (after commit)
        GW--)N: member.updated (new effective role)
        GW--)M: member.added (refresh the member list)
    end
```

| Topic                 | Rule                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Access                | The endpoint is the same one used to browse profiles and public tier lists. This public endpoints become private with `excludeMembersOf`    |
| Searchable field      | `name` only. **Email is never searchable and never returned**, so a user cannot be found or added by email                                  |
| Response              | `id`, `name`, `avatarUrl` only                                                                                                              |
| Pagination and limits | Minimum 2 or 3 characters, capped result count (about 10 per page), rate limited to prevent scraping                                        |
| `excludeMembersOf`    | Optional tier list UUID. When present, the owner and all current members are removed from the results. When absent, no filtering is applied |
| Notification          | **Direct add is immediate**, with no confirmation from the added user. Notification is not covered yet.                                     |

### Invitation link and account creation

```mermaid
sequenceDiagram
    autonumber
    actor M as Moderator
    participant API as InvitationsController
    participant AUTH as AuthController
    participant DB as PostgreSQL
    actor G as Guest

    M->>API: POST /tierlists/42/invitations {role: VIEWER }
    API->>API: canAssignRole(moderator, VIEWER)
    API->>DB: Insert invitation (tokenHash, role, expiry, createdBy)
    API-->>M: {url: /join/{token}} (token shown only once)
    M-->>G: Shares the link

    G->>API: GET /invitations/{token}
    API->>DB: Find by tokenHash, check expiry, not revoked
    API-->>G: {tierlistTitle, role, invitedBy}

    alt Guest is not signed in
        G->>AUTH: Sign in with Google or GitHub (return URL = /join/{token})
        AUTH->>DB: Upsert user (account created if new)
        AUTH-->>G: Session set, redirect to /join/{token}
    end

    G->>API: POST /invitations/{token}/accept
    API->>DB: BEGIN, lock invitation row
    API->>DB: Re-check validity (expiry, revoked)
    API->>DB: Read guest's effective role

    alt Guest already has equal or higher access
        API->>DB: ROLLBACK
        API-->>G: 200 {tierlistId, role: current} (nothing changes)
    else Invitation grants more access
        API->>DB: Upsert membership, rev + 1, log op
        API->>DB: COMMIT
        API-->>G: 200 {tierlistId, role}
        G->>G: Navigate to /tierlists/{id}
    end
```

| Topic                | Rule                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Link type            | Generic: anyone holding the link can accept it, including people who already have an account                                                        |
| Validity             | `expiresAt` automatic 24h, and manual revocation                                                                                                    |
| Token storage        | Only a SHA-256 hash is stored. The full link is displayed once at creation                                                                          |
| Token during sign-up | Carried through OAuth as a return URL, so the guest lands back on `/join/{token}`                                                                   |
| No downgrade         | Accepting never lowers access. If the guest already has an equal or higher effective role (including via `defaultRole`), nothing changes            |
| Role cap             | The role is checked against the creator's rights **at creation**. If the creator is later demoted or removed, their pending invitations are revoked |
| Management           | OWNER sees all invitations. A MODERATOR sees and revokes only the ones they created, or ones granting a role they could assign                      |
|                      |                                                                                                                                                     |
