import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { seed } from '../../src/seed/seed.js';
import { createTestDatabase } from '../support/database.js';

describe('database schema (migrations applied on PostgreSQL)', () => {
  let prisma: PrismaClient;
  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: await createTestDatabase() }) });
  });
  afterAll(() => prisma.$disconnect());

  async function makeTierlist() {
    const owner = await prisma.user.create({ data: { email: `${crypto.randomUUID()}@test` } });
    const tierlist = await prisma.tierlist.create({ data: { title: 'T', ownerId: owner.id } });
    return { owner, tierlist };
  }

  it('cascades the deletion of a tierlist to its content', async () => {
    const { owner, tierlist } = await makeTierlist();
    const category = await prisma.category.create({ data: { tierlistId: tierlist.id, name: 'S', color: '#fff', position: 'V' } });
    await prisma.card.create({ data: { tierlistId: tierlist.id, categoryId: category.id, title: 'c', position: 'V' } });
    await prisma.membership.create({ data: { tierlistId: tierlist.id, userId: owner.id, role: 'VIEWER' } });
    await prisma.tierlist.delete({ where: { id: tierlist.id } });
    expect(await prisma.card.count({ where: { tierlistId: tierlist.id } })).toBe(0);
    expect(await prisma.category.count({ where: { tierlistId: tierlist.id } })).toBe(0);
    expect(await prisma.membership.count({ where: { tierlistId: tierlist.id } })).toBe(0);
  });

  it('moves cards to the unsorted pool when their category is deleted', async () => {
    const { tierlist } = await makeTierlist();
    const category = await prisma.category.create({ data: { tierlistId: tierlist.id, name: 'S', color: '#fff', position: 'V' } });
    const card = await prisma.card.create({ data: { tierlistId: tierlist.id, categoryId: category.id, title: 'c', position: 'V' } });
    await prisma.category.delete({ where: { id: category.id } });
    expect((await prisma.card.findUniqueOrThrow({ where: { id: card.id } })).categoryId).toBeNull();
  });

  it('rejects a duplicate clientOpId on the same tierlist', async () => {
    const { tierlist } = await makeTierlist();
    await prisma.tierlistOp.create({ data: { tierlistId: tierlist.id, rev: 1, type: 't', payload: {}, clientOpId: 'op' } });
    await expect(
      prisma.tierlistOp.create({ data: { tierlistId: tierlist.id, rev: 2, type: 't', payload: {}, clientOpId: 'op' } }),
    ).rejects.toThrow();
  });

  it('rejects two users with the same pseudonym key', async () => {
    await prisma.user.create({ data: { name: 'Zed', nameKey: 'zed' } });
    await expect(prisma.user.create({ data: { name: 'ZED', nameKey: 'zed' } })).rejects.toThrow();
  });

  it('seeds demo data once (idempotent)', async () => {
    expect(await seed(prisma)).toEqual({ created: true });
    expect(await seed(prisma)).toEqual({ created: false });
    expect(await prisma.tierlist.count({ where: { title: 'Programming languages' } })).toBe(1);
    const privateList = await prisma.tierlist.findFirstOrThrow({ where: { title: "Alice's secret ranking" } });
    expect(privateList.defaultRole).toBeNull();
    expect(await prisma.category.count({ where: { tierlistId: privateList.id } })).toBe(5);
  });
});
