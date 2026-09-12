/**
 * Cycle Phase 38 — postpartum QA seed.
 *
 *   node scripts/cycle-phase38-qa-seed.js settings|none|ref|bleed|pregnancy
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6a
 *
 * settings  — TRACK so Settings can show explicit POSTPARTUM entry
 * none      — POSTPARTUM, no reference
 * ref       — POSTPARTUM + owner-entered reference 23 days ago
 * bleed     — POSTPARTUM + reference + stamped heavy flow today
 * pregnancy — PREGNANCY (prove no auto-transition; for transition confirm)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { addDays, todayInTimeZone } from '../src/lib/cycle.js';
import { estimatedDueDateFromReference } from '../src/lib/cyclePregnancy.js';
import { POSTPARTUM_TRACKING_CONTEXT } from '../src/lib/cyclePostpartum.js';

const EMAIL = 'cycle.qa.phase6@medicard.ge';
const PASSWORD = 'CycleQaPhase6a';
const PHONE = '+995500000016';
const NAME = 'Cycle QA Phase6';
const FIXTURE = process.argv[2] || 'none';

async function main() {
  const today = todayInTimeZone();
  const referenceDate = addDays(today, -23);
  const pregnancyRef = addDays(today, -(20 * 7 + 2));
  const free = await prisma.package.findUnique({ where: { code: 'FREE' } });
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      passwordHash,
      fullName: NAME,
      phone: PHONE,
      gender: 'FEMALE',
      birthDate: new Date('1996-03-12T00:00:00.000Z'),
      status: 'ACTIVE',
      packageId: free?.id ?? null,
    },
    update: {
      passwordHash,
      fullName: NAME,
      phone: PHONE,
      gender: 'FEMALE',
      status: 'ACTIVE',
    },
  });

  await prisma.cycleLog.deleteMany({ where: { userId: user.id } });
  await prisma.pregnancyCarePlanItemState.deleteMany({ where: { userId: user.id } });
  await prisma.cyclePregnancyEpisode.deleteMany({ where: { userId: user.id } });
  await prisma.cyclePostpartumEpisode.deleteMany({ where: { userId: user.id } });

  const mode =
    FIXTURE === 'settings' ? 'TRACK_PERIOD' : FIXTURE === 'pregnancy' ? 'PREGNANCY' : 'POSTPARTUM';

  await prisma.cycleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode,
      lastPeriodStart: new Date(`${pregnancyRef}T00:00:00.000Z`),
      dueDate:
        mode === 'PREGNANCY'
          ? new Date(`${estimatedDueDateFromReference(pregnancyRef)}T00:00:00.000Z`)
          : null,
      isIrregular: false,
      conditions: [],
    },
    update: {
      mode,
      lastPeriodStart: new Date(`${pregnancyRef}T00:00:00.000Z`),
      dueDate:
        mode === 'PREGNANCY'
          ? new Date(`${estimatedDueDateFromReference(pregnancyRef)}T00:00:00.000Z`)
          : null,
      isIrregular: false,
      conditions: [],
    },
  });

  if (mode === 'PREGNANCY') {
    await prisma.cyclePregnancyEpisode.create({
      data: {
        userId: user.id,
        referenceDate: pregnancyRef,
        referenceType: 'LMP',
        status: 'ACTIVE',
      },
    });
  }

  if (mode === 'POSTPARTUM') {
    const endedPregnancy = await prisma.cyclePregnancyEpisode.create({
      data: {
        userId: user.id,
        referenceDate: pregnancyRef,
        referenceType: 'LMP',
        status: 'ENDED',
        endedAt: new Date(),
      },
    });
    void endedPregnancy;
    const episode = await prisma.cyclePostpartumEpisode.create({
      data: {
        userId: user.id,
        referenceDate: FIXTURE === 'none' ? null : referenceDate,
        status: 'ACTIVE',
      },
    });
    if (FIXTURE === 'bleed') {
      await prisma.cycleLog.create({
        data: {
          userId: user.id,
          date: today,
          flow: 'heavy',
          trackingContext: POSTPARTUM_TRACKING_CONTEXT,
          postpartumEpisodeId: episode.id,
          symptoms: ['fatigue'],
          moods: ['tired_mood'],
          sleepQuality: 'poor',
          observations: { energy: 'low' },
        },
      });
    }
  }

  console.log(
    JSON.stringify({
      ok: true,
      fixture: FIXTURE,
      userId: user.id,
      mode,
      today,
      referenceDate: mode === 'POSTPARTUM' && FIXTURE !== 'none' ? referenceDate : null,
    }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
