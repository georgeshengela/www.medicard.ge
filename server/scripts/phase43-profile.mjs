import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: ['error'] });
const userId = '34dfd803-541f-49b2-9b23-b1be8997ffb5';
const profile = await db.mediWorldProfile.findUnique({ where: { userId } });
console.log(JSON.stringify({
  energyMovement: profile?.energyMovement,
  energyHydration: profile?.energyHydration,
  foundationXp: profile?.foundationXp,
  foundationLevel: profile?.foundationLevel,
}, null, 2));
await db.$disconnect();
