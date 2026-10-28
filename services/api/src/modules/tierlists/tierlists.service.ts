import { Inject, Injectable } from '@nestjs/common';
import {
  can,
  type CommunityQuery,
  type CreateTierlist,
  defaultCategories,
  effectiveRole,
  type ListTierlistsQuery,
  type TierlistPage,
  type TierlistSort,
  type TierlistSummary,
  type UpdateTierlist,
} from '@tiermaster/shared';
import { TransactionRunner } from '../../adapters/prisma/transaction.runner.js';
import type { AuthUser } from '../../common/auth.js';
import { REALTIME_BROADCASTER, type RealtimeBroadcaster } from '../../ports/realtime-broadcaster.port.js';
import { AccessService } from '../access/access.service.js';
import { TierlistWriter } from './tierlist-writer.service.js';
import { type SummaryRow, TierlistsRepository } from './tierlists.repository.js';

function toSummary(row: SummaryRow, userId: string | null): TierlistSummary {
  return {
    id: row.id,
    title: row.title,
    defaultRole: row.defaultRole,
    role: effectiveRole({ userId, ownerId: row.ownerId, membershipRole: row.memberships[0]?.role ?? null, defaultRole: row.defaultRole }),
    owner: row.owner,
    cardCount: row._count.cards,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Same orders as the SQL used for the community page (title: lower-cased, code-unit order). */
const ROW_ORDER: Record<TierlistSort, (a: SummaryRow, b: SummaryRow) => number> = {
  updated: (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  created: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  title: (a, b) => {
    const [x, y] = [a.title.toLowerCase(), b.title.toLowerCase()];
    return x < y ? -1 : x > y ? 1 : 0;
  },
};

@Injectable()
export class TierlistsService {
  constructor(
    private readonly tierlists: TierlistsRepository,
    private readonly writer: TierlistWriter,
    private readonly access: AccessService,
    private readonly transactions: TransactionRunner,
    @Inject(REALTIME_BROADCASTER) private readonly broadcaster: RealtimeBroadcaster,
  ) {}

  async create(user: AuthUser, body: CreateTierlist): Promise<TierlistSummary> {
    const row = await this.tierlists.create(user.id, body.title, body.defaultRole, defaultCategories());
    return toSummary(row, user.id);
  }

  async listMine(user: AuthUser, query: ListTierlistsQuery): Promise<TierlistSummary[]> {
    const rows = await this.tierlists.listForUser(user.id, query.q);
    return rows.sort(ROW_ORDER[query.sort]).map((row) => toSummary(row, user.id));
  }

  async listCommunity(user: AuthUser | null, query: CommunityQuery): Promise<TierlistPage> {
    const userId = user?.id ?? null;
    const skip = (query.page - 1) * query.pageSize;
    const { rows, total } = await this.tierlists.listPublic(query.q, query.sort, skip, query.pageSize, userId);
    return { items: rows.map((row) => toSummary(row, userId)), total, page: query.page, pageSize: query.pageSize };
  }

  async summary(user: AuthUser | null, id: string): Promise<TierlistSummary> {
    await this.access.authorize(user, id, 'tierlist.read');
    return toSummary((await this.tierlists.findSummary(id, user?.id ?? null))!, user?.id ?? null);
  }

  /** Rename (EDITOR+) and/or change the default role (OWNER only), as one operation. */
  async update(user: AuthUser, id: string, body: UpdateTierlist): Promise<{ rev: number }> {
    const changesDefaultRole = body.defaultRole !== undefined;
    return this.writer.write({
      user,
      tierlistId: id,
      clientOpId: body.clientOpId,
      authorize: ({ role }) =>
        (body.title === undefined || can(role, 'tierlist.rename')) &&
        (!changesDefaultRole || can(role, 'tierlist.changeDefaultRole')),
      apply: async (tx) => {
        const data = { title: body.title, defaultRole: body.defaultRole };
        await this.tierlists.update(tx, id, data);
        return {
          type: 'tierlist.updated',
          payload: data,
          // Everyone without membership depends on defaultRole: re-evaluate the whole room.
          after: changesDefaultRole ? [{ kind: 'access.changed', tierlistId: id }] : [],
        };
      },
    });
  }

  async delete(user: AuthUser, id: string): Promise<void> {
    await this.transactions.run(async (tx) => {
      await this.access.lockAndAuthorize(tx, user, id, 'tierlist.delete');
      await this.tierlists.delete(tx, id);
    });
    this.broadcaster.publish({ kind: 'tierlist.deleted', tierlistId: id });
  }
}
