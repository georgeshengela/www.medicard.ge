/**
 * Cycle Phase 22 — pregnancy observation QA seed.
 *
 *   node scripts/cycle-phase22-qa-seed.js
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6a
 * Leaves an ACTIVE week-18 episode with recent body-change logs.
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

function bleedDays(start, count = 4) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ date: addDays(start, i), flow: i === 0 ? 'medium' : 'light' });
  }
  return rows;
}

async function main() {
  const today = todayInTimeZone();
  const week = 18;
  const referenceDate = addDays(today, -(week * 7 + 3));
  const startedAt = new Date(`${addDays(today, -40)}T10:00:00.000Z`);
  const logs = [
    ...bleedDays(addDays(today, -28 * 3), 4),
    ...bleedDays(addDays(today, -28 * 2), 4),
    ...bleedDays(referenceDate, 4),
    { date: addDays(today, -20), pregnancyTest: 'positive' },
    {
      date: addDays(today, -4),
      symptoms: ['heartburn', 'swelling', 'short_breath'],
      sleepQuality: 'okay',
    },
    {
      date: addDays(today, -3),
      symptoms: ['bloating', 'constipation', 'diarrhea'],
    },
    {
      date: addDays(today, -2),
      flow: 'spotting',
      painEntries: [{ type: 'cramps', severity: 'mild' }],
      symptoms: ['nausea'],
    },
    {
      date: addDays(today, -1),
      sleepQuality: 'poor',
      stressLevel: 'high',
      observations: { energy: 'low' },
      symptoms: ['fatigue'],
    },
    {
      date: today,
      symptoms: ['nausea', 'fatigue', 'heartburn'],
      painEntries: [{ type: 'lower_back', severity: 'moderate' }],
      observations: { energy: 'low' },
      sleepQuality: 'okay',
      stressLevel: 'medium',
      notes: 'პირადი ჩანაწერი',
      sexualActivity: true,
    },
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

  const due = estimatedDueDateFromReference(referenceDate);
  await prisma.cycleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode: 'PREGNANCY',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      isIrregular: false,
      lastPeriodStart: new Date(`${referenceDate}T00:00:00.000Z`),
      contraceptionMethod: 'NONE',
      dueDate: due ? new Date(`${due}T00:00:00.000Z`) : null,
      privacyEnabled: false,
    },
    update: {
      mode: 'PREGNANCY',
      lastPeriodStart: new Date(`${referenceDate}T00:00:00.000Z`),
      contraceptionMethod: 'NONE',
      contraceptionStartedAt: null,
      dueDate: due ? new Date(`${due}T00:00:00.000Z`) : null,
      isIrregular: false,
    },
  });

  await prisma.cyclePregnancyEpisode.create({
    data: {
      userId: user.id,
      referenceDate,
      referenceType: 'LMP',
      status: 'ACTIVE',
      startedAt,
    },
  });

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
        sleepQuality: row.sleepQuality ?? null,
        stressLevel: row.stressLevel ?? null,
        observations: row.observations ?? {},
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        today,
        email: EMAIL,
        fixture: 'phase22-observations',
        mode: 'PREGNANCY',
        expected: `${week} weeks + 3 days, recent observations`,
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
