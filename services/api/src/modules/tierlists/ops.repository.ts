import { Injectable } from '@nestjs/common';
import type { TierlistEvent } from '@tiermaster/shared';
import { PrismaService } from '../../adapters/prisma/prisma.service.js';
import type { Tx } from '../../adapters/prisma/transaction.runner.js';
import type { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class OpsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByClientOpId(tx: Tx, tierlistId: string, clientOpId: string) {
    return tx.tierlistOp.findUnique({ where: { tierlistId_clientOpId: { tierlistId, clientOpId } } });
  }

  /** Increments `rev` (the row is already locked) and logs the operation. */
  async append(tx: Tx, event: TierlistEvent): Promise<void> {
    await tx.tierlist.update({ where: { id: event.tierlistId }, data: { rev: event.rev } });
    await tx.tierlistOp.create({
      data: {
        tierlistId: event.tierlistId,
        rev: event.rev,
        type: event.type,
        payload: event.payload as Prisma.InputJsonValue,
        authorId: event.authorId,
        clientOpId: event.clientOpId,
      },
    });
  }

  listSince(tierlistId: string, since: number, limit: number) {
    return this.prisma.tierlistOp.findMany({
      where: { tierlistId, rev: { gt: since } },
      orderBy: { rev: 'asc' },
      take: limit,
    });
  }
}
