/**
 * Cycle Phase 33 — user-opted prenatal care reminder QA seed.
 *
 *   node scripts/cycle-phase33-qa-seed.js none|on|completed|past
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
const FIXTURE = process.argv[2] || 'none';

async function main() {
  const today = todayInTimeZone();
  const week = 20;
  const elapsed = week * 7 + 2;
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
    /* ignore */
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
  if (FIXTURE === 'none' || FIXTURE === 'on' || FIXTURE === 'past') {
    states.push({
      careItemId: 'anatomy_ultrasound',
      status: 'PLANNED',
      plannedDate: FIXTURE === 'past' ? addDays(today, -2) : addDays(today, 4),
      reminderEnabled: FIXTURE === 'on',
      reminderOffset: 1,
    });
  }
  if (FIXTURE === 'completed') {
    states.push({
      careItemId: 'anatomy_ultrasound',
      status: 'COMPLETED',
      completedDate: addDays(today, -1),
      plannedDate: addDays(today, 4),
      reminderEnabled: false,
      reminderOffset: 1,
    });
  }

  for (const row of states) {
    await prisma.pregnancyCarePlanItemState.create({
      data: {
        userId: user.id,
        pregnancyEpisodeId: episode.id,
        careItemId: row.careItemId,
        status: row.status,
        plannedDate: row.plannedDate || null,
        completedDate: row.completedDate || null,
        note: null,
        reminderEnabled: Boolean(row.reminderEnabled),
        reminderOffset: row.reminderOffset ?? 1,
        catalogVersion: PREGNANCY_CARE_CATALOG_VERSION,
      },
    });
  }

  console.log(JSON.stringify({ fixture: FIXTURE, userId: user.id, episodeId: episode.id, referenceDate, week }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
