import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  type AcceptInvitationResponse,
  canGrant,
  type CreateInvitation,
  type CreateInvitationResponse,
  effectiveRole,
  grantsMoreAccess,
  type Invitation,
  type InvitationPreview,
  type MyInvitation,
  type Role,
} from '@tiermaster/shared';
import { TransactionRunner } from '../../adapters/prisma/transaction.runner.js';
import type { AuthUser } from '../../common/auth.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { REALTIME_BROADCASTER, type RealtimeBroadcaster } from '../../ports/realtime-broadcaster.port.js';
import { AccessService } from '../access/access.service.js';
import { TierlistWriter } from '../tierlists/tierlist-writer.service.js';
import { toPublicUser, UsersService } from '../users/users.service.js';
import { SharingRepository } from './sharing.repository.js';

export const LINK_TTL_MS = 24 * 3600 * 1000;
export const PERSONAL_TTL_MS = 7 * 24 * 3600 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const named = <T extends { name: string | null }>(user: T) => ({ ...user, name: user.name ?? '?' });

type InvitationRow = Awaited<ReturnType<SharingRepository['listPending']>>[number];

function toInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    kind: row.inviteeId ? 'user' : 'link',
    role: row.role,
    invitee: row.invitee ? toPublicUser(named(row.invitee)) : null,
    createdBy: toPublicUser(named(row.createdBy)),
    expiresAt: row.expiresAt.toISOString(),
  };
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly sharing: SharingRepository,
    private readonly access: AccessService,
    private readonly writer: TierlistWriter,
    private readonly transactions: TransactionRunner,
    private readonly users: UsersService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(REALTIME_BROADCASTER) private readonly broadcaster: RealtimeBroadcaster,
  ) {}

  /**
   * By pseudonym (`inviteeId`): a pending personal invitation the invitee accepts or declines.
   * Otherwise a generic link, valid 24h, whose token is shown once (only its hash is stored).
   * The role is checked against the creator's rights at creation (canGrant).
   */
  async create(actor: AuthUser, tierlistId: string, body: CreateInvitation): Promise<CreateInvitationResponse> {
    const invitee = body.inviteeId ? await this.users.findPublic(body.inviteeId) : null;
    if (body.inviteeId && !invitee) {
      await this.access.authorize(actor, tierlistId, 'member.invite');
      throw notFound('user_not_found');
    }
    const token = invitee ? null : randomBytes(32).toString('base64url');
    const row = await this.transactions.run(async (tx) => {
      const ctx = await this.access.lockAndAuthorize(tx, actor, tierlistId, 'member.invite');
      if (!invitee) {
        if (!canGrant(ctx.role, null, body.role)) throw forbidden();
        const expiresAt = new Date(Date.now() + LINK_TTL_MS);
        return this.sharing.createLink(tx, { tierlistId, role: body.role, tokenHash: hashToken(token!), createdById: actor.id, expiresAt });
      }
      const isOwner = invitee.id === ctx.tierlist.ownerId;
      const membership = isOwner ? null : await this.sharing.membershipRole(tx, tierlistId, invitee.id);
      if (!canGrant(ctx.role, isOwner ? 'OWNER' : membership, body.role)) throw forbidden();
      const current = effectiveRole({ userId: invitee.id, ownerId: ctx.tierlist.ownerId, membershipRole: membership, defaultRole: ctx.tierlist.defaultRole });
      if (!grantsMoreAccess(current, body.role)) throw conflict('already_has_access');
      const expiresAt = new Date(Date.now() + PERSONAL_TTL_MS);
      return this.sharing.upsertPersonal(tx, { tierlistId, role: body.role, inviteeId: invitee.id, createdById: actor.id, expiresAt });
    });
    if (invitee) this.notify(invitee.id);
    return { invitation: toInvitation(row), url: token ? new URL(`/join/${token}`, this.config.PUBLIC_URL).toString() : null };
  }

  /** The owner sees every pending invitation; a moderator those they created or could have created. */
  async list(actor: AuthUser, tierlistId: string): Promise<Invitation[]> {
    const { role } = await this.access.authorize(actor, tierlistId, 'member.invite');
    const rows = await this.sharing.listPending(tierlistId);
    return rows.filter((row) => this.canSee(role, actor, row)).map(toInvitation);
  }

  async revoke(actor: AuthUser, tierlistId: string, invitationId: string): Promise<void> {
    const { role } = await this.access.authorize(actor, tierlistId, 'member.invite');
    const row = await this.sharing.findPending(tierlistId, invitationId);
    if (!row || !this.canSee(role, actor, row)) throw notFound('invitation_not_found');
    await this.sharing.revoke(row.id);
    if (row.inviteeId) this.notify(row.inviteeId);
  }

  async preview(token: string): Promise<InvitationPreview> {
    const row = await this.sharing.findPendingByTokenHash(hashToken(token));
    if (!row) throw notFound('invitation_invalid');
    return {
      tierlistId: row.tierlist.id,
      tierlistTitle: row.tierlist.title,
      role: row.role,
      invitedBy: row.createdBy.name ?? '?',
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async acceptLink(user: AuthUser, token: string): Promise<AcceptInvitationResponse> {
    const row = await this.sharing.findPendingByTokenHash(hashToken(token));
    if (!row) throw notFound('invitation_invalid');
    return this.accept(user, row.tierlistId, row.id, false);
  }

  async mine(user: AuthUser): Promise<MyInvitation[]> {
    const rows = await this.sharing.listMine(user.id);
    return rows.map((row) => ({
      id: row.id,
      tierlist: row.tierlist,
      role: row.role,
      invitedBy: row.createdBy.name ?? '?',
      expiresAt: row.expiresAt.toISOString(),
    }));
  }

  async acceptMine(user: AuthUser, invitationId: string): Promise<AcceptInvitationResponse> {
    const row = await this.sharing.findPendingForInvitee(invitationId, user.id);
    if (!row) throw notFound('invitation_invalid');
    const result = await this.accept(user, row.tierlistId, row.id, true);
    this.notify(user.id);
    return result;
  }

  async declineMine(user: AuthUser, invitationId: string): Promise<void> {
    const row = await this.sharing.findPendingForInvitee(invitationId, user.id);
    if (!row) throw notFound('invitation_invalid');
    await this.sharing.deleteById(row.id);
    this.notify(user.id);
  }

  /**
   * Accepting never lowers access: when the invitation does not raise the effective role (membership or defaultRole),
   * nothing changes. Validity is re-checked with the invitation row locked.
   */
  private async accept(user: AuthUser, tierlistId: string, invitationId: string, consume: boolean): Promise<AcceptInvitationResponse> {
    let role: Role | null = null;
    let changed = false;
    await this.writer.write({
      user,
      tierlistId,
      // The invitation itself grants the right to join; it is checked below.
      authorize: () => true,
      apply: async (tx, ctx) => {
        const invitation = await this.sharing.lockPending(tx, invitationId);
        if (!invitation) throw notFound('invitation_invalid');
        if (consume) await this.sharing.delete(tx, invitation.id);
        if (!grantsMoreAccess(ctx.role, invitation.role)) {
          role = ctx.role;
          return null;
        }
        const membership = await this.sharing.membershipRole(tx, tierlistId, user.id);
        await this.sharing.setRole(tx, tierlistId, user.id, invitation.role);
        role = invitation.role;
        changed = true;
        return {
          type: membership ? 'member.updated' : 'member.added',
          payload: { userId: user.id, role: invitation.role },
          after: [{ kind: 'access.changed', tierlistId, userIds: [user.id] }],
        };
      },
    });
    return { tierlistId, role: role!, changed };
  }

  private canSee(role: Role | null, actor: AuthUser, row: { role: InvitationRow['role']; createdById: string }): boolean {
    return role === 'OWNER' || row.createdById === actor.id || canGrant(role, null, row.role);
  }

  private notify(userId: string): void {
    this.broadcaster.publish({ kind: 'user.notify', userId, type: 'invitations.changed' });
  }

}
