import { defaultCategories, keysBetween } from '@tiermaster/shared';
import type { DefaultRole, MemberRole, PrismaClient } from '../generated/prisma/client.js';

/** Demo users, all usable through the fake OAuth provider (login hint = pseudonym in lower case). */
const DEMO_USERS = ['Alice', 'Bob', 'Carol'] as const;
type DemoUser = (typeof DEMO_USERS)[number];

interface DemoTierlist {
  title: string;
  owner: DemoUser;
  defaultRole: DefaultRole | null;
  members: [DemoUser, MemberRole][];
  /** Cards per category index; the last entry is the unsorted pool. */
  cards: string[][];
}

const DEMO_TIERLISTS: DemoTierlist[] = [
  {
    title: 'Programming languages',
    owner: 'Alice',
    defaultRole: 'VIEWER',
    members: [['Bob', 'EDITOR']],
    cards: [['TypeScript', 'Rust'], ['Go', 'Kotlin'], ['Python'], ['Java'], ['PHP'], ['COBOL', 'Fortran']],
  },
  {
    title: 'Pizza toppings',
    owner: 'Bob',
    defaultRole: 'EDITOR',
    members: [['Carol', 'MODERATOR']],
    cards: [['Mozzarella'], ['Mushrooms', 'Ham'], ['Olives'], [], ['Pineapple'], ['Anchovies', 'Corn']],
  },
  {
    title: "Alice's secret ranking",
    owner: 'Alice',
    defaultRole: null,
    members: [['Carol', 'VIEWER']],
    cards: [['Cats'], ['Dogs'], [], [], [], ['Spiders']],
  },
];

/** Creates the demo data. Idempotent: does nothing when the demo users already exist. */
export async function seed(prisma: PrismaClient): Promise<{ created: boolean }> {
  const existing = await prisma.oAuthAccount.findFirst({ where: { provider: 'fake', providerUserId: 'alice' } });
  if (existing) return { created: false };

  await prisma.$transaction(async (tx) => {
    const users = new Map<DemoUser, string>();
    for (const name of DEMO_USERS) {
      const user = await tx.user.create({
        data: {
          name,
          nameKey: name.toLowerCase(),
          email: `${name.toLowerCase()}@example.test`,
          oauthAccounts: { create: { provider: 'fake', providerUserId: name.toLowerCase() } },
        },
      });
      users.set(name, user.id);
    }

    for (const demo of DEMO_TIERLISTS) {
      const tierlist = await tx.tierlist.create({
        data: {
          title: demo.title,
          ownerId: users.get(demo.owner)!,
          defaultRole: demo.defaultRole,
          memberships: { create: demo.members.map(([user, role]) => ({ userId: users.get(user)!, role })) },
        },
      });
      const categoryIds: (string | null)[] = [];
      for (const category of defaultCategories()) {
        const created = await tx.category.create({ data: { ...category, tierlistId: tierlist.id } });
        categoryIds.push(created.id);
      }
      categoryIds.push(null);
      for (const [index, titles] of demo.cards.entries()) {
        const positions = keysBetween(null, null, titles.length);
        await tx.card.createMany({
          data: titles.map((title, i) => ({
            title,
            tierlistId: tierlist.id,
            categoryId: categoryIds[index] ?? null,
            position: positions[i]!,
          })),
        });
      }
    }
  });
  return { created: true };
}
