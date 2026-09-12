/**
 * Seed disposable-local QA user for Phase 41 Android screenshots.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { updateAdventurePreferences } from '../src/lib/mediWorld/adventure/service.js';

const url = process.env.PHASE38_TEST_DATABASE_URL;
if (!url) {
  console.error('BLOCKED: PHASE38_TEST_DATABASE_URL is not set');
  process.exit(2);
}

const mode = process.argv[2] || 'balanced';
const prisma = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
const email = 'world.qa@medicard.test';
const now = new Date('2026-09-12T12:00:00+04:00');

try {
  const passwordHash = await bcrypt.hash('Phase38QaPass11', 12);
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
  await prisma.hydrationPreference.upsert({
    where: { userId: user.id },
    update: { goalMl: 2000 },
    create: { userId: user.id, goalMl: 2000 },
  });
  await prisma.stepTrackingCapability.upsert({
    where: { userId: user.id },
    update: { status: mode === 'one-cap' ? 'UNKNOWN' : 'AVAILABLE', source: 'APPLE_HEALTH' },
    create: {
      userId: user.id,
      status: mode === 'one-cap' ? 'UNKNOWN' : 'AVAILABLE',
      source: 'APPLE_HEALTH',
    },
  });
  const prefs = {
    balanced: { intensity: 'active', allowVariety: true, enabledCategories: ['movement', 'hydration', 'care'] },
    gentle: { intensity: 'gentle', allowVariety: false, enabledCategories: ['care'] },
    'one-cap': { intensity: 'active', allowVariety: true, enabledCategories: ['care'] },
    rest: { intensity: 'gentle', preferredRestWeekdays: [6], enabledCategories: ['care'] },
  }[mode] || { intensity: 'active' };
  await updateAdventurePreferences(user.id, prefs, { db: prisma, now, timezone: 'Asia/Tbilisi' });
  console.log(JSON.stringify({ ok: true, mode, userSet: Boolean(user.id) }));
} finally {
  await prisma.$disconnect();
}
