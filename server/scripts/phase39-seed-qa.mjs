/**
 * Seed disposable-local QA users for Phase 39 Android screenshots.
 * Modes: zero | progress | caps | levelup | level50
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { processWorldActivity, setWorldXpForTests } from '../src/lib/mediWorld/engine.js';

const url = process.env.PHASE38_TEST_DATABASE_URL;
if (!url) {
  console.error('BLOCKED: PHASE38_TEST_DATABASE_URL is not set');
  process.exit(2);
}

const mode = process.argv[2] || 'progress';
const prisma = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
const email = 'world.qa@medicard.test';
const now = new Date('2026-09-12T12:00:00+04:00');

try {
  const passwordHash = await bcrypt.hash('Phase38QaPass1!', 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, fullName: 'World QA' },
    create: { email, fullName: 'World QA', passwordHash },
  });
  await prisma.mediWorldLedger.deleteMany({ where: { userId: user.id } });
  await prisma.mediWorldProfile.deleteMany({ where: { userId: user.id } });

  if (mode === 'zero') {
    console.log(JSON.stringify({ ok: true, mode, email, note: 'lazy profile created on GET' }));
  } else if (mode === 'progress') {
    await processWorldActivity(
      user.id,
      {
        sourceType: 'FOUNDATION_TEST',
        sourceId: 'qa-progress',
        idempotencyKey: `qa-progress-${user.id}`,
        adapterId: 'activity.walking',
        energyType: 'movement',
        progressState: 'verified',
        personalTarget: 1500,
        completedAmount: 1500,
      },
      { db: prisma, now, timezone: 'Asia/Tbilisi' },
    );
  } else if (mode === 'caps') {
    const types = [
      ['activity.walking', 'movement'],
      ['activity.hydration', 'hydration'],
      ['activity.breathing', 'calm'],
      ['activity.care_routine', 'care'],
      ['activity.connection', 'connection'],
    ];
    for (let i = 0; i < types.length; i += 1) {
      const [adapterId, energyType] = types[i];
      await processWorldActivity(
        user.id,
        {
          sourceType: 'FOUNDATION_TEST',
          sourceId: `qa-cap-${energyType}`,
          idempotencyKey: `qa-cap-${user.id}-${energyType}`,
          adapterId,
          energyType,
          progressState: 'verified',
          personalTarget: 1500,
          completedAmount: 1500,
        },
        { db: prisma, now, timezone: 'Asia/Tbilisi' },
      );
    }
    await processWorldActivity(
      user.id,
      {
        sourceType: 'FOUNDATION_TEST',
        sourceId: 'qa-cap-move-2',
        idempotencyKey: `qa-cap-move-2-${user.id}`,
        adapterId: 'activity.walking',
        energyType: 'movement',
        progressState: 'verified',
        personalTarget: 1500,
        completedAmount: 1500,
      },
      { db: prisma, now, timezone: 'Asia/Tbilisi' },
    );
    await processWorldActivity(
      user.id,
      {
        sourceType: 'FOUNDATION_TEST',
        sourceId: 'qa-cap-xp-extra',
        idempotencyKey: `qa-cap-xp-extra-${user.id}`,
        adapterId: 'activity.rest',
        energyType: 'calm',
        progressState: 'verified',
        personalTarget: 1500,
        completedAmount: 1500,
      },
      { db: prisma, now, timezone: 'Asia/Tbilisi' },
    );
  } else if (mode === 'levelup') {
    await setWorldXpForTests(user.id, 100, { db: prisma, now });
  } else if (mode === 'level50') {
    await setWorldXpForTests(user.id, 50_000, { db: prisma, now });
  } else {
    throw new Error(`unknown mode ${mode}`);
  }

  const profile = await prisma.mediWorldProfile.findUnique({ where: { userId: user.id } });
  console.log(JSON.stringify({
    ok: true,
    mode,
    email,
    level: profile?.foundationLevel ?? null,
    xp: profile?.foundationXp ?? null,
    energy: profile
      ? {
          movement: profile.energyMovement,
          hydration: profile.energyHydration,
          calm: profile.energyCalm,
          care: profile.energyCare,
          connection: profile.energyConnection,
        }
      : null,
  }));
} finally {
  await prisma.$disconnect();
}
