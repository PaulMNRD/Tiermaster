import { Injectable } from '@nestjs/common';
import type { DefaultRole, TierlistSort } from '@tiermaster/shared';
import { PrismaService } from '../../adapters/prisma/prisma.service.js';
import type { Tx } from '../../adapters/prisma/transaction.runner.js';
import { Prisma } from '../../generated/prisma/client.js';

const summarySelect = (userId: string | null) =>
  ({
    id: true,
    title: true,
    defaultRole: true,
    ownerId: true,
    updatedAt: true,
    createdAt: true,
    owner: { select: { id: true, name: true } },
    _count: { select: { cards: true } },
    memberships: { where: { userId: userId ?? '00000000-0000-0000-0000-000000000000' }, select: { role: true } },
  }) satisfies Prisma.TierlistSelect;

export type SummaryRow = Prisma.TierlistGetPayload<{ select: ReturnType<typeof summarySelect> }>;

/** Escapes LIKE wildcards in user input. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

const ORDER_BY: Record<TierlistSort, Prisma.Sql> = {
  updated: Prisma.sql`"updatedAt" DESC, id`,
  created: Prisma.sql`"createdAt" DESC, id`,
  title: Prisma.sql`lower(title) COLLATE "C", id`,
};

@Injectable()
export class TierlistsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, title: string, defaultRole: DefaultRole, categories: { name: string; color: string; position: string }[]) {
    return this.prisma.tierlist.create({
      data: { ownerId, title, defaultRole, categories: { create: categories } },
      select: summarySelect(ownerId),
    });
  }

  findSummary(id: string, userId: string | null) {
    return this.prisma.tierlist.findUnique({ where: { id }, select: summarySelect(userId) });
  }

  /** Tierlists owned by the user or shared with them through a membership. */
  listForUser(userId: string, q: string | undefined) {
    return this.prisma.tierlist.findMany({
      where: {
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      },
      select: summarySelect(userId),
    });
  }

  /** Public tierlists (defaultRole not null), one page. */
  async listPublic(q: string | undefined, sort: TierlistSort, skip: number, take: number, userId: string | null) {
    const filter = q ? Prisma.sql`AND title ILIKE ${likePattern(q)}` : Prisma.empty;
    const [ids, [{ total }]] = (await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM tierlist WHERE "defaultRole" IS NOT NULL ${filter}
        ORDER BY ${ORDER_BY[sort]} LIMIT ${take} OFFSET ${skip}`,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT count(*)::int AS total FROM tierlist WHERE "defaultRole" IS NOT NULL ${filter}`,
    ])) as [{ id: string }[], [{ total: number }]];
    const rows = await this.prisma.tierlist.findMany({ where: { id: { in: ids.map((r) => r.id) } }, select: summarySelect(userId) });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return { rows: ids.map((r) => byId.get(r.id)!).filter(Boolean), total };
  }

  async update(tx: Tx, id: string, data: { title?: string; defaultRole?: DefaultRole }): Promise<void> {
    await tx.tierlist.update({ where: { id }, data });
  }

  async delete(tx: Tx, id: string): Promise<void> {
    await tx.tierlist.delete({ where: { id } });
  }
}
