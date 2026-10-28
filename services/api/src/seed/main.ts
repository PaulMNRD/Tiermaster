import { PrismaPg } from '@prisma/adapter-pg';
import { loadConfig } from '../config/app-config.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { seed } from './seed.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: loadConfig().DATABASE_URL }) });
try {
  const { created } = await seed(prisma);
  console.log(created ? 'Demo data created.' : 'Demo data already present, nothing to do.');
} finally {
  await prisma.$disconnect();
}
