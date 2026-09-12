/**
 * Cycle Phase 36 — exact-time prenatal reminder QA seed.
 *
 *   node scripts/cycle-phase36-qa-seed.js date|timed|exact
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6a
 *
 * date  = DATE_BASED reminder, no plannedTime
 * timed = plannedTime 14:30, still DATE_BASED (no auto-upgrade)
 * exact = plannedTime 14:30 + explicit EXACT_TIME 60 minutes
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
const FIXTURE = process.argv[2] || 'date';

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
  await prisma.pregnancyCarePlanItemState.deleteMany({ where: { userId: user.id } });
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

  const plannedDate = addDays(today, 11);
  const withTime = FIXTURE === 'timed' || FIXTURE === 'exact';
  const exact = FIXTURE === 'exact';
  await prisma.pregnancyCarePlanItemState.create({
    data: {
      userId: user.id,
      pregnancyEpisodeId: episode.id,
      careItemId: 'anatomy_ultrasound',
      status: 'PLANNED',
      plannedDate,
      plannedTime: withTime ? '14:30' : null,
      reminderEnabled: true,
      reminderOffset: 1,
      reminderMode: exact ? 'EXACT_TIME' : 'DATE_BASED',
      exactReminderOffsetMinutes: exact ? 60 : null,
      note: 'SECRET_PLANNER_NOTE',
      catalogVersion: PREGNANCY_CARE_CATALOG_VERSION,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        fixture: FIXTURE,
        userId: user.id,
        episodeId: episode.id,
        today,
        plannedDate,
        plannedTime: withTime ? '14:30' : null,
        reminderMode: exact ? 'EXACT_TIME' : 'DATE_BASED',
        exactReminderOffsetMinutes: exact ? 60 : null,
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
  .finally(async () => {
    await prisma.$disconnect();
  });
