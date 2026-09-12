import { PrismaClient } from '@prisma/client';

const url = process.env.PHASE38_TEST_DATABASE_URL;
if (!url) process.exit(2);
const db = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
try {
  const user = await db.user.findUnique({ where: { email: 'world.qa@medicard.test' } });
  await db.mediWorldProfile.update({
    where: { userId: user.id },
    data: { energyHydration: 40, energyCalm: 40, energyMovement: 40, energyCare: 40, energyConnection: 65 },
  });
  const p = await db.mediWorldProfile.findUnique({ where: { userId: user.id } });
  console.log(JSON.stringify({
    hydration: p.energyHydration,
    xp: p.foundationXp,
    level: p.foundationLevel,
  }));
} finally {
  await db.$disconnect();
}
