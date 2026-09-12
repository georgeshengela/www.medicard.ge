import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { processWorldActivity } from '../src/lib/mediWorld/engine.js';

const url = process.env.PHASE38_TEST_DATABASE_URL;
if (!url) {
  console.error('BLOCKED: PHASE38_TEST_DATABASE_URL is not set');
  process.exit(2);
}

const prisma = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
const email = 'world.qa@medicard.test';
try {
  const passwordHash = await bcrypt.hash('Phase38QaPass1!', 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, fullName: 'World QA' },
    create: { email, fullName: 'World QA', passwordHash },
  });
  const now = new Date();
  const adapters = [
    ['activity.walking', 'movement'],
    ['activity.hydration', 'hydration'],
    ['activity.breathing', 'calm'],
    ['activity.care_routine', 'care'],
    ['activity.connection', 'connection'],
  ];
  for (const [adapterId, energyType] of adapters) {
    await processWorldActivity(
      user.id,
      {
        sourceType: 'FOUNDATION_TEST',
        sourceId: `qa-${energyType}`,
        idempotencyKey: `qa-${user.id}-${energyType}`,
        adapterId,
        energyType,
        progressState: 'verified',
        personalTarget: 1500,
        completedAmount: 1500,
      },
      { db: prisma, now },
    );
  }
  const profile = await prisma.mediWorldProfile.findUnique({ where: { userId: user.id } });
  console.log(JSON.stringify({
    ok: true,
    email,
    energy: {
      movement: profile.energyMovement,
      hydration: profile.energyHydration,
      calm: profile.energyCalm,
      care: profile.energyCare,
      connection: profile.energyConnection,
    },
  }));
} finally {
  await prisma.$disconnect();
}
