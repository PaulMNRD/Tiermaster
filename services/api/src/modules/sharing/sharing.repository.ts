import { Injectable } from '@nestjs/common';
import type { MemberRole } from '@tiermaster/shared';
import { PrismaService } from '../../adapters/prisma/prisma.service.js';
import type { Tx } from '../../adapters/prisma/transaction.runner.js';

const userSelect = { id: true, name: true, avatarKey: true, avatarUrl: true } as const;
const invitationInclude = { createdBy: { select: userSelect }, invitee: { select: userSelect } } as const;

/** Pending = neither revoked nor expired. */
const pending = () => ({ revokedAt: null, expiresAt: { gt: new Date() } });

@Injectable()
export class SharingRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- members ----

  async members(tierlistId: string) {
    return this.prisma.tierlist.findUnique({
      where: { id: tierlistId },
      select: {
        owner: { select: userSelect },
        memberships: { select: { role: true, user: { select: userSelect } } },
      },
    });
  }

  async membershipRole(tx: Tx, tierlistId: string, userId: string): Promise<MemberRole | null> {
    const row = await tx.membership.findUnique({ where: { userId_tierlistId: { userId, tierlistId } }, select: { role: true } });
    return row?.role ?? null;
  }

  async setRole(tx: Tx, tierlistId: string, userId: string, role: MemberRole): Promise<void> {
    await tx.membership.upsert({
      where: { userId_tierlistId: { userId, tierlistId } },
      create: { userId, tierlistId, role },
      update: { role },
    });
  }

  async removeMembership(tx: Tx, tierlistId: string, userId: string): Promise<void> {
    await tx.membership.delete({ where: { userId_tierlistId: { userId, tierlistId } } });
  }

  /** Revokes the pending invitations created by someone who lost the right to invite. */
  async revokeInvitationsCreatedBy(tx: Tx, tierlistId: string, createdById: string): Promise<string[]> {
    const affected = await tx.invitation.findMany({ where: { tierlistId, createdById, ...pending() }, select: { inviteeId: true } });
    await tx.invitation.updateMany({ where: { tierlistId, createdById, ...pending() }, data: { revokedAt: new Date() } });
    return affected.flatMap((i) => (i.inviteeId ? [i.inviteeId] : []));
  }

  // ---- invitations ----

  createLink(tx: Tx, data: { tierlistId: string; role: MemberRole; tokenHash: string; createdById: string; expiresAt: Date }) {
    return tx.invitation.create({ data, include: invitationInclude });
  }

  /** One pending personal invitation per (tierlist, invitee): inviting again replaces it. */
  upsertPersonal(tx: Tx, data: { tierlistId: string; role: MemberRole; inviteeId: string; createdById: string; expiresAt: Date }) {
    const { tierlistId, inviteeId } = data;
    return tx.invitation.upsert({
      where: { tierlistId_inviteeId: { tierlistId, inviteeId } },
      create: data,
      update: { role: data.role, createdById: data.createdById, expiresAt: data.expiresAt, revokedAt: null, createdAt: new Date() },
      include: invitationInclude,
    });
  }

  listPending(tierlistId: string) {
    return this.prisma.invitation.findMany({ where: { tierlistId, ...pending() }, include: invitationInclude, orderBy: { createdAt: 'desc' } });
  }

  findPending(tierlistId: string, id: string) {
    return this.prisma.invitation.findFirst({ where: { id, tierlistId, ...pending() }, include: invitationInclude });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.invitation.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  findPendingByTokenHash(tokenHash: string) {
    return this.prisma.invitation.findFirst({
      where: { tokenHash, ...pending() },
      include: { ...invitationInclude, tierlist: { select: { id: true, title: true } } },
    });
  }

  findPendingForInvitee(id: string, inviteeId: string) {
    return this.prisma.invitation.findFirst({ where: { id, inviteeId, ...pending() } });
  }

  /** Locks the invitation row, then re-reads it: validity is checked again inside the transaction. */
  async lockPending(tx: Tx, id: string) {
    await tx.$queryRaw`SELECT id FROM invitation WHERE id = ${id}::uuid FOR UPDATE`;
    return tx.invitation.findFirst({ where: { id, ...pending() } });
  }

  async delete(tx: Tx, id: string): Promise<void> {
    await tx.invitation.deleteMany({ where: { id } });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.invitation.deleteMany({ where: { id } });
  }

  listMine(inviteeId: string) {
    return this.prisma.invitation.findMany({
      where: { inviteeId, ...pending() },
      include: { createdBy: { select: userSelect }, tierlist: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
