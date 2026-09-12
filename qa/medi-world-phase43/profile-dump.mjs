import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '../../server/package.json'));
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();
const email = process.argv[2] || 'world.qa@medicard.test';
const user = await db.user.findUnique({ where: { email } });
if (!user) {
  console.log(JSON.stringify({ error: 'missing user' }));
  await db.$disconnect();
  process.exit(1);
}
const profile = await db.mediWorldProfile.findUnique({ where: { userId: user.id } });
const latest = await db.mediWorldLedger.findFirst({
  where: { userId: user.id },
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
});
const rows = await db.mediWorldLedger.findMany({ where: { userId: user.id } });
const periodKeys = [...new Set(rows.map((row) => row.periodKey).filter(Boolean))];
const latestPeriod = latest?.periodKey || periodKeys.at(-1);
const todayRows = rows.filter((row) => row.periodKey === latestPeriod);
const usedXp = todayRows.reduce((sum, row) => sum + (row.foundationXp || 0), 0);
const usedMove = todayRows.filter((row) => row.energyType === 'movement').reduce((sum, row) => sum + (row.energyAmount || 0), 0);
console.log(JSON.stringify({
  userId: user.id,
  energyMovement: profile?.energyMovement ?? 0,
  foundationXp: profile?.foundationXp ?? 0,
  foundationLevel: profile?.foundationLevel ?? 1,
  periodKey: latestPeriod,
  todayWorldXp: usedXp,
  todayMovementEnergy: usedMove,
  latest: latest && {
    sourceType: latest.sourceType,
    energyType: latest.energyType,
    energyAmount: latest.energyAmount,
    worldXp: latest.foundationXp,
    reasonCode: latest.reasonCode,
    periodKey: latest.periodKey,
  },
}, null, 2));
await db.$disconnect();
