/**
 * Cycle Phase 30 — two-window exposure comparison QA seed.
 *
 *   node scripts/cycle-phase30-qa-seed.js pregnancy-none|pregnancy-higher|pregnancy-numbers|pregnancy-short|pregnancy-cleared|peri-higher|peri-numbers|peri-imbalance
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
const FIXTURE = process.argv[2] || 'pregnancy-higher';

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
  const shortEpisode = FIXTURE === 'pregnancy-short';
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
        startedAt: new Date(`${addDays(today, shortEpisode ? -17 : -40)}T10:00:00.000Z`),
      },
    });
  }

  const days = new Map();
  if (FIXTURE === 'pregnancy-none') {
    present(days, today, 'nausea', [0, -6, -12, -18, -24]);
  } else if (FIXTURE === 'pregnancy-higher' || FIXTURE === 'peri-higher') {
    const key = peri ? 'hot_flashes' : 'nausea';
    present(days, today, key, [-1, -3, -5, -7, -9, -11, -15, -26]);
    absent(days, today, key, [0, -2, -4, -6, -14, -16, -17, -18, -19, -20, -21, -22]);
  } else if (FIXTURE === 'pregnancy-numbers' || FIXTURE === 'peri-numbers') {
    const key = peri ? 'night_sweats' : 'nausea';
    present(days, today, key, [-1, -3, -5, -7, -9, -15, -17, -19, -21]);
    absent(days, today, key, [0, -2, -4, -6, -8, -14, -16, -18, -20, -22]);
  } else if (FIXTURE === 'pregnancy-short') {
    present(days, today, 'nausea', [-1, -3, -5, -7, -9, -11, -15]);
    absent(days, today, 'nausea', [0, -2, -4, -6]);
  } else if (FIXTURE === 'pregnancy-cleared') {
    present(days, today, 'nausea', [-1, -3, -15, -26]);
    absent(days, today, 'nausea', [-14, -16, -17, -18, -19, -20, -21, -22]);
  } else if (FIXTURE === 'peri-imbalance') {
    present(days, today, 'hot_flashes', [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -15, -26]);
    absent(days, today, 'hot_flashes', [-12, -13, -14, -16, -18]);
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

  console.log(`Phase 30 seeded ${FIXTURE} for ${EMAIL} today=${today} logs=${days.size} short=${shortEpisode}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
