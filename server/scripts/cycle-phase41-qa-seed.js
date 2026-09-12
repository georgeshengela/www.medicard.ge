/**
 * Cycle Phase 41 — owner-classified postpartum period QA seed.
 *
 *   node scripts/cycle-phase41-qa-seed.js bleed|classified|track|pregnancy|peri
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
const FIXTURE = process.argv[2] || 'bleed';

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

  try {
    await prisma.cyclePostpartumBleedClassification.deleteMany({ where: { userId: user.id } });
  } catch {
    /* table may not exist yet */
  }
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

  let episodeId = null;
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
    episodeId = episode.id;
    const start = addDays(today, -4);
    for (let i = 0; i < 5; i += 1) {
      const flow = i === 2 ? 'heavy' : i === 0 || i === 4 ? 'light' : 'medium';
      await prisma.cycleLog.create({
        data: {
          userId: user.id,
          date: addDays(start, i),
          flow,
          trackingContext: POSTPARTUM_TRACKING_CONTEXT,
          postpartumEpisodeId: episode.id,
        },
      });
    }
    if (FIXTURE === 'classified') {
      await prisma.cyclePostpartumBleedClassification.create({
        data: {
          userId: user.id,
          postpartumEpisodeId: episode.id,
          bleedStart: start,
          bleedEnd: today,
          classification: 'MENSTRUAL_PERIOD',
          source: 'OWNER',
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
      episodeId,
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
