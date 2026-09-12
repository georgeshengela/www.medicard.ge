import { PrismaClient } from '@prisma/client';
import { setWorldXpForTests } from '../src/lib/mediWorld/engine.js';
import { cumulativeXpToReachLevel } from '../src/lib/mediWorld/ruleset.js';

const url = process.env.PHASE38_TEST_DATABASE_URL;
if (!url) process.exit(2);
const level = Number(process.argv[2] || 5);
const db = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
try {
  const user = await db.user.findUnique({ where: { email: 'world.qa@medicard.test' } });
  const now = new Date('2026-09-12T12:00:00+04:00');
  await setWorldXpForTests(user.id, cumulativeXpToReachLevel(level), { db, now });
  const p = await db.mediWorldProfile.findUnique({ where: { userId: user.id } });
  console.log(JSON.stringify({ xp: p.foundationXp, level: p.foundationLevel }));
} finally {
  await db.$disconnect();
}
