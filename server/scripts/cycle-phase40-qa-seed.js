/**
 * Cycle Phase 40 — postpartum copy-isolation QA seed.
 *
 *   node scripts/cycle-phase40-qa-seed.js empty|bleed|observations|track|pregnancy|peri
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6a
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
const FIXTURE = process.argv[2] || 'empty';

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
    FIXTURE === 'track'
      ? 'TRACK_PERIOD'
      : FIXTURE === 'pregnancy'
        ? 'PREGNANCY'
        : FIXTURE === 'peri'
          ? 'PERIMENOPAUSE'
          : 'POSTPARTUM';

  await prisma.cycleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode,
      lastPeriodStart:
        FIXTURE === 'track'
          ? new Date(`${addDays(today, -40)}T00:00:00.000Z`)
          : new Date(`${pregnancyRef}T00:00:00.000Z`),
      dueDate:
        mode === 'PREGNANCY'
          ? new Date(`${estimatedDueDateFromReference(pregnancyRef)}T00:00:00.000Z`)
          : null,
      isIrregular: false,
      conditions: [],
    },
    update: {
      mode,
      lastPeriodStart:
        FIXTURE === 'track'
          ? new Date(`${addDays(today, -40)}T00:00:00.000Z`)
          : new Date(`${pregnancyRef}T00:00:00.000Z`),
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
    await prisma.cyclePregnancyEpisode.create({
      data: {
        userId: user.id,
        referenceDate: pregnancyRef,
        referenceType: 'LMP',
        status: 'ENDED',
        endedAt: new Date(),
      },
    });
    const episode = await prisma.cyclePostpartumEpisode.create({
      data: {
        userId: user.id,
        referenceDate,
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
        },
      });
    }
    if (FIXTURE === 'observations') {
      await prisma.cycleLog.create({
        data: {
          userId: user.id,
          date: today,
          flow: 'none',
          trackingContext: POSTPARTUM_TRACKING_CONTEXT,
          postpartumEpisodeId: episode.id,
          symptoms: ['fatigue'],
          moods: ['tired_mood'],
          sleepQuality: 'poor',
          observations: { energy: 'low' },
          painEntries: [{ type: 'cramps', severity: 'moderate' }],
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
