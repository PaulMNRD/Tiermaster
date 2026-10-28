import { Injectable } from '@nestjs/common';
import { type Action, can, effectiveRole, type Role } from '@tiermaster/shared';
import type { Tx } from '../../adapters/prisma/transaction.runner.js';
import type { AuthUser } from '../../common/auth.js';
import { forbidden, notFound, unauthorized } from '../../common/errors.js';
import { type AccessRow, AccessRepository } from './access.repository.js';

export interface AccessContext {
  tierlist: AccessRow;
  role: Role | null;
}

/** A permission check: an action of the matrix, or a custom rule (member management uses canGrant). */
export type Authorization = Action | ((ctx: AccessContext) => boolean);

/**
 * Single place resolving the effective role (roles-and-permissions.md), used by REST, the gateway and media.
 * Error semantics: 401 anonymous without access, 404 signed in without role (existence hidden), 403 role too low.
 */
@Injectable()
export class AccessService {
  constructor(private readonly repository: AccessRepository) {}

  /** Effective role, or `null` when the tierlist does not exist (or the user has no role). */
  async resolve(userId: string | null, tierlistId: string, tx?: Tx): Promise<AccessContext | null> {
    const tierlist = await this.repository.findTierlist(tierlistId, tx);
    return tierlist ? this.contextFor(userId, tierlist, tx) : null;
  }

  /** Read path: resolves and checks, throwing 401/403/404. */
  async authorize(user: AuthUser | null, tierlistId: string, authorization: Authorization, tx?: Tx): Promise<AccessContext> {
    const ctx = await this.resolve(user?.id ?? null, tierlistId, tx);
    return this.check(user, ctx, authorization);
  }

  /** Write path: locks the tierlist row for the transaction, then checks. */
  async lockAndAuthorize(tx: Tx, user: AuthUser | null, tierlistId: string, authorization: Authorization): Promise<AccessContext> {
    const tierlist = await this.repository.lockTierlist(tx, tierlistId);
    const ctx = tierlist ? await this.contextFor(user?.id ?? null, tierlist, tx) : null;
    return this.check(user, ctx, authorization);
  }

  private async contextFor(userId: string | null, tierlist: AccessRow, tx?: Tx): Promise<AccessContext> {
    const membershipRole = userId ? await this.repository.membershipRole(tierlist.id, userId, tx) : null;
    return { tierlist, role: effectiveRole({ userId, ownerId: tierlist.ownerId, membershipRole, defaultRole: tierlist.defaultRole }) };
  }

  private check(user: AuthUser | null, ctx: AccessContext | null, authorization: Authorization): AccessContext {
    const allowed = ctx !== null && (typeof authorization === 'string' ? can(ctx.role, authorization) : authorization(ctx));
    if (allowed) return ctx;
    if (!user) throw unauthorized();
    if (ctx === null || ctx.role === null) throw notFound();
    throw forbidden();
  }
}
