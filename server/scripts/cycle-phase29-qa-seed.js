/**
 * Cycle Phase 29 — exposure-aware rate QA seed.
 *
 *   node scripts/cycle-phase29-qa-seed.js pregnancy-occurrence|pregnancy-qualified|pregnancy-sparse|peri-qualified|peri-clear
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
const FIXTURE = process.argv[2] || 'pregnancy-qualified';

function isPeri(fixture) {
  return String(fixture).startsWith('peri');
}

function upsertDay(map, date, patch) {
  const cur = map.get(date) || { date, symptoms: [], observationAssessments: {} };
  const next = {
    date,
    symptoms: [...new Set([...(cur.symptoms || []), ...(patch.symptoms || [])])],
    observationAssessments: { ...(cur.observationAssessments || {}), ...(patch.observationAssessments || {}) },
  };
  map.set(date, next);
}

function present(map, today, key, offsets) {
  for (const offset of offsets) {
    upsertDay(map, addDays(today, offset), { symptoms: [key] });
  }
}

function absent(map, today, key, offsets) {
  for (const offset of offsets) {
    upsertDay(map, addDays(today, offset), { observationAssessments: { [key]: 'ABSENT' } });
  }
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

  const days = new Map();
  if (FIXTURE === 'pregnancy-occurrence') {
    present(days, today, 'nausea', [0, -6, -12, -18, -24]);
  } else if (FIXTURE === 'pregnancy-sparse') {
    present(days, today, 'nausea', [0, -10]);
  } else if (FIXTURE === 'pregnancy-qualified') {
    present(days, today, 'nausea', [-1, -4, -8, -12]);
    absent(days, today, 'nausea', [-2, -5, -9, -13, -16, -20]);
    present(days, today, 'vomiting', [-3, -6]);
    present(days, today, 'fatigue', [-1, -4, -8, -12]);
    absent(days, today, 'fatigue', [-2, -5, -9, -13, -16, -20]);
  } else if (FIXTURE === 'peri-qualified') {
    present(days, today, 'hot_flashes', [-1, -4, -8, -12]);
    absent(days, today, 'hot_flashes', [-2, -5, -9, -13, -16, -20]);
    present(days, today, 'night_sweats', [-3, -6]);
    present(days, today, 'fatigue', [-1, -4, -8, -12]);
    absent(days, today, 'fatigue', [-2, -5, -9, -13, -16, -20]);
  } else if (FIXTURE === 'peri-clear') {
    present(days, today, 'hot_flashes', [-1, -4, -8, -12]);
    absent(days, today, 'hot_flashes', [0, -5, -9, -13, -16]);
  } else {
    throw new Error(`Unknown fixture ${FIXTURE}`);
  }

  for (const row of days.values()) {
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

  console.log(`Phase 29 seeded ${FIXTURE} for ${EMAIL} today=${today} logs=${days.size}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
