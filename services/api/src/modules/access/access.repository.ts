import { Injectable } from '@nestjs/common';
import type { DefaultRole, MemberRole } from '@tiermaster/shared';
import { PrismaService } from '../../adapters/prisma/prisma.service.js';
import type { Tx } from '../../adapters/prisma/transaction.runner.js';

export interface AccessRow {
  id: string;
  ownerId: string;
  defaultRole: DefaultRole;
  rev: number;
}

@Injectable()
export class AccessRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTierlist(id: string, tx: Tx = this.prisma): Promise<AccessRow | null> {
    return tx.tierlist.findUnique({ where: { id }, select: { id: true, ownerId: true, defaultRole: true, rev: true } });
  }

  /** Locks the tierlist row until the end of the transaction: serializes writes and `rev` increments. */
  async lockTierlist(tx: Tx, id: string): Promise<AccessRow | null> {
    const rows = await tx.$queryRaw<AccessRow[]>`
      SELECT id, "ownerId", "defaultRole"::text AS "defaultRole", rev FROM tierlist WHERE id = ${id}::uuid FOR UPDATE`;
    return rows[0] ?? null;
  }

  async membershipRole(tierlistId: string, userId: string, tx: Tx = this.prisma): Promise<MemberRole | null> {
    const membership = await tx.membership.findUnique({
      where: { userId_tierlistId: { userId, tierlistId } },
      select: { role: true },
    });
    return membership?.role ?? null;
  }
}
