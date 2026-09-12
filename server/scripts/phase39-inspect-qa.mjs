import { PrismaClient } from '@prisma/client';
import { signToken } from '../src/middleware/auth.js';

const url = process.env.PHASE38_TEST_DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
try {
  const user = await prisma.user.findUnique({ where: { email: 'world.qa@medicard.test' } });
  const profile = await prisma.mediWorldProfile.findUnique({ where: { userId: user.id } });
  const ledger = await prisma.mediWorldLedger.count({ where: { userId: user.id } });
  const token = signToken(user);
  const res = await fetch('http://127.0.0.1:4000/api/medi-world', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  console.log(JSON.stringify({
    http: res.status,
    dbXp: profile?.foundationXp ?? null,
    dbLevel: profile?.foundationLevel ?? null,
    dbMove: profile?.energyMovement ?? null,
    ledger,
    apiXp: body.profile?.worldXp ?? null,
    apiMove: body.profile?.careEnergy?.movement ?? null,
    todayXp: body.today?.worldXp ?? null,
    latest: body.latestReward?.reasonCode ?? null,
  }));
} finally {
  await prisma.$disconnect();
}
