/**
 * Seed disposable-local QA users for Phase 40 Android screenshots.
 * Modes: spark | glow | bloom | pulse | guardian | radiant | energy
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { processWorldActivity, setWorldXpForTests } from '../src/lib/mediWorld/engine.js';
import { getCompanionWorldState, selectEvolutionStage } from '../src/lib/mediWorld/companion/service.js';
import { cumulativeXpToReachLevel } from '../src/lib/mediWorld/ruleset.js';

const url = process.env.PHASE38_TEST_DATABASE_URL;
if (!url) {
  console.error('BLOCKED: PHASE38_TEST_DATABASE_URL is not set');
  process.exit(2);
}

const mode = process.argv[2] || 'spark';
const prisma = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
const email = 'world.qa@medicard.test';
const now = new Date('2026-09-12T12:00:00+04:00');

const LEVEL = {
  spark: 1,
  glow: 5,
  bloom: 10,
  pulse: 20,
  guardian: 35,
  radiant: 50,
  energy: 12,
};

try {
  const passwordHash = await bcrypt.hash('Phase38QaPass1!', 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, fullName: 'World QA' },
    create: { email, fullName: 'World QA', passwordHash },
  });
  await prisma.healthProfile.upsert({
    where: { userId: user.id },
    update: { completedAt: new Date(), extraAnswers: { assessmentPhaseComplete: true } },
    create: {
      userId: user.id,
      completedAt: new Date(),
      extraAnswers: { assessmentPhaseComplete: true },
      chronicConditions: [],
      allergies: [],
      medications: [],
      familyHistory: [],
      healthGoals: [],
    },
  });
  await prisma.mediWorldLedger.deleteMany({ where: { userId: user.id } });
  await prisma.mediCompanionBondEvent.deleteMany({ where: { userId: user.id } });
  await prisma.mediCompanionCosmeticOwn.deleteMany({ where: { userId: user.id } });
  await prisma.mediCompanionWorldStageUnlock.deleteMany({ where: { userId: user.id } });
  await prisma.mediWorldProfile.deleteMany({ where: { userId: user.id } });
  await prisma.mediCompanionProfile.deleteMany({ where: { userId: user.id } });

  const level = LEVEL[mode] || 1;
  if (level > 1) {
    await setWorldXpForTests(user.id, cumulativeXpToReachLevel(level), { db: prisma, now });
  }
  if (mode === 'energy') {
    const days = [
      ['activity.hydration', 'hydration'],
      ['activity.hydration', 'hydration'],
      ['activity.breathing', 'calm'],
      ['activity.walking', 'movement'],
      ['activity.care_routine', 'care'],
      ['activity.connection', 'connection'],
    ];
    for (let i = 0; i < days.length; i += 1) {
      const [adapterId, energyType] = days[i];
      await processWorldActivity(
        user.id,
        {
          sourceType: 'FOUNDATION_TEST',
          sourceId: `qa40-${energyType}-${i}`,
          idempotencyKey: `qa40-${user.id}-${energyType}-${i}`,
          adapterId,
          energyType,
          progressState: 'verified',
          personalTarget: 1500,
          completedAmount: 1500,
        },
        { db: prisma, now: new Date(now.getTime() - i * 86_400_000), timezone: 'Asia/Tbilisi' },
      );
    }
    await prisma.mediWorldProfile.update({
      where: { userId: user.id },
      data: { energyHydration: 40, energyCalm: 40, energyMovement: 40, energyCare: 40, energyConnection: 65 },
    });
  }
  let state = await getCompanionWorldState(user.id, { db: prisma, now, timezone: 'Asia/Tbilisi' });
  if (LEVEL[mode] && mode !== 'energy') {
    state = await selectEvolutionStage(user.id, mode, { db: prisma, now, timezone: 'Asia/Tbilisi' });
  }
  console.log(JSON.stringify({
    ok: true,
    mode,
    email,
    stage: state.companion.worldStageKey,
    bond: state.companion.bond,
    energy: state.world.careEnergy,
    unlocked: state.evolution.stages.filter((row) => row.unlocked).map((row) => row.key),
  }));
} finally {
  await prisma.$disconnect();
}
