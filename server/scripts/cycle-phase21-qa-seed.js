/**
 * Cycle Phase 21 — pregnancy timeline QA seed.
 *
 *   node scripts/cycle-phase21-qa-seed.js           # week 18 (default)
 *   node scripts/cycle-phase21-qa-seed.js 6
 *   node scripts/cycle-phase21-qa-seed.js 28
 *   node scripts/cycle-phase21-qa-seed.js 40
 *   node scripts/cycle-phase21-qa-seed.js 41
 *   node scripts/cycle-phase21-qa-seed.js review
 *   node scripts/cycle-phase21-qa-seed.js track
 *   node scripts/cycle-phase21-qa-seed.js ttc
 *   node scripts/cycle-phase21-qa-seed.js ended
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6a
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { addDays, todayInTimeZone } from '../src/lib/cycle.js';
import { estimatedDueDateFromReference } from '../src/lib/cyclePregnancy.js';

const EMAIL = 'cycle.qa.phase6@medicard.ge';
const PASSWORD = 'CycleQaPhase6a';
const PHONE = '+995500000016';
const NAME = 'Cycle QA Phase6';
const ARG = (process.argv[2] || '18').toLowerCase();

function bleedDays(start, count = 4) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ date: addDays(start, i), flow: i === 0 ? 'medium' : 'light' });
  }
  return rows;
}

function fixturePlan(today) {
  if (ARG === 'review') {
    return {
      fixture: 'review',
      mode: 'PREGNANCY',
      status: 'ACTIVE',
      referenceDate: addDays(today, -320),
      expected: 'reviewRequired',
    };
  }
  if (ARG === 'track') {
    return { fixture: 'track', mode: 'TRACK_PERIOD', status: null, referenceDate: addDays(today, -28), expected: 'TRACK, no timeline' };
  }
  if (ARG === 'ttc') {
    return { fixture: 'ttc', mode: 'TRY_TO_CONCEIVE', status: null, referenceDate: addDays(today, -28), expected: 'TTC, no timeline' };
  }
  if (ARG === 'ended') {
    return {
      fixture: 'ended',
      mode: 'PREGNANCY',
      status: 'ENDED',
      referenceDate: addDays(today, -(18 * 7)),
      expected: 'ENDED episode, no active timeline',
    };
  }
  const week = Number(ARG);
  const safeWeek = Number.isInteger(week) ? week : 18;
  return {
    fixture: `week-${String(safeWeek).padStart(2, '0')}`,
    mode: 'PREGNANCY',
    status: 'ACTIVE',
    referenceDate: addDays(today, -(safeWeek * 7 + 3)),
    expected: `${safeWeek} weeks + 3 days`,
  };
}

async function main() {
  const today = todayInTimeZone();
  const plan = fixturePlan(today);
  const logs = [
    ...bleedDays(addDays(today, -28 * 3), 4),
    ...bleedDays(addDays(today, -28 * 2), 4),
    ...bleedDays(plan.referenceDate, 4),
    { date: addDays(today, -20), pregnancyTest: 'positive' },
  ];
  const byDate = new Map();
  for (const row of logs) byDate.set(row.date, { ...byDate.get(row.date), ...row });
  const uniqueLogs = [...byDate.values()];

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

  const due = plan.mode === 'PREGNANCY' && plan.status === 'ACTIVE' ? estimatedDueDateFromReference(plan.referenceDate) : null;
  await prisma.cycleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode: plan.mode,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      isIrregular: false,
      lastPeriodStart: new Date(`${plan.referenceDate}T00:00:00.000Z`),
      contraceptionMethod: 'NONE',
      dueDate: due ? new Date(`${due}T00:00:00.000Z`) : null,
      privacyEnabled: false,
    },
    update: {
      mode: plan.mode,
      lastPeriodStart: new Date(`${plan.referenceDate}T00:00:00.000Z`),
      contraceptionMethod: 'NONE',
      contraceptionStartedAt: null,
      dueDate: due ? new Date(`${due}T00:00:00.000Z`) : null,
      isIrregular: false,
    },
  });

  if (plan.status) {
    await prisma.cyclePregnancyEpisode.create({
      data: {
        userId: user.id,
        referenceDate: plan.referenceDate,
        referenceType: 'LMP',
        status: plan.status,
        endedAt: plan.status === 'ENDED' ? new Date() : null,
      },
    });
  }

  for (const row of uniqueLogs) {
    await prisma.cycleLog.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        date: row.date,
        flow: row.flow ?? null,
        symptoms: row.symptoms ?? [],
        moods: row.moods ?? [],
        ovulationTest: row.ovulationTest ?? null,
        pregnancyTest: row.pregnancyTest ?? null,
        bbt: row.bbt ?? null,
        cervicalMucus: row.cervicalMucus ?? null,
        sexualActivity: row.sexualActivity ?? null,
        notes: row.notes ?? null,
        painEntries: row.painEntries ?? [],
      },
    });
  }

  console.log(JSON.stringify({ today, email: EMAIL, ...plan }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
