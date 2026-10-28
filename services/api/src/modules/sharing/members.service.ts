import { Injectable } from '@nestjs/common';
import { canGrant, type Member, type MemberRole, ROLE_RANK } from '@tiermaster/shared';
import type { Tx } from '../../adapters/prisma/transaction.runner.js';
import type { AuthUser } from '../../common/auth.js';
import { forbidden, notFound } from '../../common/errors.js';
import type { RealtimeMessage } from '../../ports/realtime-broadcaster.port.js';
import { AccessService } from '../access/access.service.js';
import { TierlistWriter } from '../tierlists/tierlist-writer.service.js';
import { toPublicUser } from '../users/users.service.js';
import { SharingRepository } from './sharing.repository.js';

@Injectable()
export class MembersService {
  constructor(
    private readonly sharing: SharingRepository,
    private readonly writer: TierlistWriter,
    private readonly access: AccessService,
  ) {}

  /** Owner first, then members by role (highest first) and name. Readable by anyone who can read the tierlist. */
  async list(user: AuthUser | null, tierlistId: string): Promise<Member[]> {
    await this.access.authorize(user, tierlistId, 'tierlist.read');
    const row = await this.sharing.members(tierlistId);
    if (!row) throw notFound();
    const named = <T extends { name: string | null }>(u: T) => ({ ...u, name: u.name ?? '?' });
    const members: Member[] = row.memberships
      .map((m) => ({ user: toPublicUser(named(m.user)), role: m.role }))
      .sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.user.name.localeCompare(b.user.name));
    return [{ user: toPublicUser(named(row.owner)), role: 'OWNER' }, ...members];
  }

  /** Changes the role of a member, checked with canGrant against the target's current role (inside the transaction). */
  async changeRole(actor: AuthUser, tierlistId: string, targetId: string, role: MemberRole): Promise<{ rev: number }> {
    return this.writer.write({
      user: actor,
      tierlistId,
      authorize: 'member.manage',
      apply: async (tx, ctx) => {
        const current = await this.targetRole(tx, tierlistId, targetId, ctx.tierlist.ownerId);
        if (!canGrant(ctx.role, current, role)) throw forbidden();
        await this.sharing.setRole(tx, tierlistId, targetId, role);
        const after = await this.afterLosingInviteRight(tx, tierlistId, targetId, current === 'MODERATOR' && role !== 'MODERATOR');
        return { type: 'member.updated', payload: { userId: targetId, role }, after };
      },
    });
  }

  async remove(actor: AuthUser, tierlistId: string, targetId: string): Promise<{ rev: number }> {
    return this.writer.write({
      user: actor,
      tierlistId,
      authorize: 'member.manage',
      apply: async (tx, ctx) => {
        const current = await this.targetRole(tx, tierlistId, targetId, ctx.tierlist.ownerId);
        if (!canGrant(ctx.role, current, null)) throw forbidden();
        await this.sharing.removeMembership(tx, tierlistId, targetId);
        const after = await this.afterLosingInviteRight(tx, tierlistId, targetId, current === 'MODERATOR');
        return { type: 'member.removed', payload: { userId: targetId }, after };
      },
    });
  }

  /** A member removes their own membership. The owner cannot leave (ownership transfer is not covered). */
  async leave(user: AuthUser, tierlistId: string): Promise<{ rev: number }> {
    return this.writer.write({
      user,
      tierlistId,
      authorize: 'tierlist.leave',
      apply: async (tx) => {
        const current = await this.sharing.membershipRole(tx, tierlistId, user.id);
        if (current === null) throw notFound('not_member');
        await this.sharing.removeMembership(tx, tierlistId, user.id);
        const after = await this.afterLosingInviteRight(tx, tierlistId, user.id, current === 'MODERATOR');
        return { type: 'member.removed', payload: { userId: user.id }, after };
      },
    });
  }

  /** Current role of a management target: OWNER for the owner, the membership role, else 404. */
  private async targetRole(tx: Tx, tierlistId: string, targetId: string, ownerId: string) {
    if (targetId === ownerId) return 'OWNER' as const;
    const role = await this.sharing.membershipRole(tx, tierlistId, targetId);
    if (role === null) throw notFound('member_not_found');
    return role;
  }

  /** Re-evaluates the target's sockets; revokes their invitations if they can no longer invite. */
  private async afterLosingInviteRight(tx: Tx, tierlistId: string, userId: string, lostInviteRight: boolean): Promise<RealtimeMessage[]> {
    const messages: RealtimeMessage[] = [{ kind: 'access.changed', tierlistId, userIds: [userId] }];
    if (lostInviteRight) {
      for (const invitee of await this.sharing.revokeInvitationsCreatedBy(tx, tierlistId, userId)) {
        messages.push({ kind: 'user.notify', userId: invitee, type: 'invitations.changed' });
      }
    }
    return messages;
  }
}
