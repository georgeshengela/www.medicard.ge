/**
 * Cycle Phase 32 — pregnancy care planner QA seed.
 *
 *   node scripts/cycle-phase32-qa-seed.js t1|t2|t3|review|planned|completed|regional
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6a
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { addDays, todayInTimeZone } from '../src/lib/cycle.js';
import { estimatedDueDateFromReference } from '../src/lib/cyclePregnancy.js';

const PREGNANCY_CARE_CATALOG_VERSION = 'prenatal-care-v1';

const EMAIL = 'cycle.qa.phase6@medicard.ge';
const PASSWORD = 'CycleQaPhase6a';
const PHONE = '+995500000016';
const NAME = 'Cycle QA Phase6';
const FIXTURE = process.argv[2] || 't2';

const WEEK = {
  t1: 8,
  t2: 20,
  t3: 32,
  review: 46,
  planned: 20,
  completed: 20,
  regional: 36,
};

async function main() {
  const today = todayInTimeZone();
  const week = WEEK[FIXTURE] ?? 20;
  const elapsed = FIXTURE === 'review' ? 320 : week * 7 + 2;
  const referenceDate = addDays(today, -elapsed);
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
  try {
    await prisma.pregnancyCarePlanItemState.deleteMany({ where: { userId: user.id } });
  } catch {
    /* table may be created in this same session */
  }
  await prisma.cyclePregnancyEpisode.deleteMany({ where: { userId: user.id } });

  await prisma.cycleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode: 'PREGNANCY',
      lastPeriodStart: new Date(`${referenceDate}T00:00:00.000Z`),
      dueDate: new Date(`${estimatedDueDateFromReference(referenceDate)}T00:00:00.000Z`),
      isIrregular: false,
      conditions: [],
    },
    update: {
      mode: 'PREGNANCY',
      lastPeriodStart: new Date(`${referenceDate}T00:00:00.000Z`),
      dueDate: new Date(`${estimatedDueDateFromReference(referenceDate)}T00:00:00.000Z`),
      isIrregular: false,
      conditions: [],
    },
  });

  const episode = await prisma.cyclePregnancyEpisode.create({
    data: {
      userId: user.id,
      referenceDate,
      referenceType: 'LMP',
      status: 'ACTIVE',
    },
  });

  const states = [];
  if (FIXTURE === 'planned' || FIXTURE === 't2') {
    states.push({
      careItemId: 'anatomy_ultrasound',
      status: 'PLANNED',
      plannedDate: addDays(today, 4),
      note: FIXTURE === 'planned' ? 'კლინიკა A' : null,
    });
  }
  if (FIXTURE === 'completed') {
    states.push({
      careItemId: 'anatomy_ultrasound',
      status: 'COMPLETED',
      completedDate: addDays(today, -3),
      note: null,
    });
  }
  if (FIXTURE === 'regional') {
    states.push({
      careItemId: 'gbs_screening_discussion',
      status: 'PLANNED',
      plannedDate: addDays(today, 10),
      note: null,
    });
  }

  for (const row of states) {
    await prisma.pregnancyCarePlanItemState.create({
      data: {
        userId: user.id,
        pregnancyEpisodeId: episode.id,
        careItemId: row.careItemId,
        status: row.status,
        plannedDate: row.plannedDate,
        completedDate: row.completedDate || null,
        note: row.note,
        catalogVersion: PREGNANCY_CARE_CATALOG_VERSION,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        fixture: FIXTURE,
        userId: user.id,
        episodeId: episode.id,
        referenceDate,
        elapsed,
        week: FIXTURE === 'review' ? null : week,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
