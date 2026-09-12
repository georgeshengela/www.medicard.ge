/**
 * Cycle Phase 28 — observation assessment QA seed.
 *
 *   node scripts/cycle-phase28-qa-seed.js pregnancy-empty|pregnancy-partial|peri-empty|peri-partial
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6a
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { addDays, todayInTimeZone } from '../src/lib/cycle.js';
import { estimatedDueDateFromReference } from '../src/lib/cyclePregnancy.js';

const EMAIL = 'cycle.qa.phase6@medicard.ge';
const PASSWORD = 'CycleQaPhase6a';
const PHONE = '+995500000016';
const NAME = 'Cycle QA Phase6';
const FIXTURE = process.argv[2] || 'pregnancy-partial';

function isPeri(fixture) {
  return String(fixture).startsWith('peri');
}

async function main() {
  const today = todayInTimeZone();
  const peri = isPeri(FIXTURE);
  const week = 18;
  const referenceDate = addDays(today, -(week * 7 + 3));
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
  await prisma.cyclePregnancyEpisode.deleteMany({ where: { userId: user.id } });

  await prisma.cycleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode: peri ? 'PERIMENOPAUSE' : 'PREGNANCY',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      isIrregular: false,
      lastPeriodStart: new Date(`${referenceDate}T00:00:00.000Z`),
      dueDate: peri ? null : new Date(`${estimatedDueDateFromReference(referenceDate)}T00:00:00.000Z`),
      conditions: [],
    },
    update: {
      mode: peri ? 'PERIMENOPAUSE' : 'PREGNANCY',
      lastPeriodStart: new Date(`${referenceDate}T00:00:00.000Z`),
      dueDate: peri ? null : new Date(`${estimatedDueDateFromReference(referenceDate)}T00:00:00.000Z`),
      isIrregular: false,
      conditions: [],
    },
  });

  if (!peri) {
    await prisma.cyclePregnancyEpisode.create({
      data: {
        userId: user.id,
        status: 'ACTIVE',
        referenceDate,
        referenceType: 'LMP',
        startedAt: new Date(`${addDays(today, -40)}T10:00:00.000Z`),
      },
    });
  }

  const emptyToday = FIXTURE.endsWith('empty');
  const todayLog = emptyToday
    ? { date: today, symptoms: [], observationAssessments: {} }
    : peri
      ? {
          date: today,
          symptoms: ['hot_flashes'],
          observationAssessments: { night_sweats: 'ABSENT' },
        }
      : {
          date: today,
          symptoms: ['nausea'],
          observationAssessments: { vomiting: 'ABSENT' },
        };

  const yesterday = peri
    ? { date: addDays(today, -1), symptoms: ['hot_flashes'], observationAssessments: {} }
    : { date: addDays(today, -1), symptoms: ['nausea'], observationAssessments: {} };

  for (const row of [yesterday, todayLog]) {
    await prisma.cycleLog.create({
      data: {
        userId: user.id,
        date: row.date,
        symptoms: row.symptoms,
        moods: [],
        painEntries: [],
        customTagIds: [],
        observations: {},
        observationAssessments: row.observationAssessments || {},
      },
    });
  }

  console.log(`Phase 28 seeded ${FIXTURE} for ${EMAIL} today=${today}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
