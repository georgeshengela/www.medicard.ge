/**
 * Cycle Phase 23 — pregnancy observation trend QA seed.
 *
 *   node scripts/cycle-phase23-qa-seed.js [empty|two|rich|isolation]
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
const FIXTURE = process.argv[2] || 'rich';

function bleedDays(start, count = 4) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ date: addDays(start, i), flow: i === 0 ? 'medium' : 'light' });
  }
  return rows;
}

function logsFor(today, fixture) {
  const historic = [
    ...bleedDays(addDays(today, -28 * 3), 4),
    ...bleedDays(addDays(today, -28 * 2), 4),
    { date: addDays(today, -20), pregnancyTest: 'positive' },
  ];
  if (fixture === 'empty') {
    return [...historic, { date: today, notes: 'პირადი ჩანაწერი' }];
  }
  if (fixture === 'two') {
    return [
      ...historic,
      { date: addDays(today, -4), symptoms: ['nausea'] },
      { date: today, symptoms: ['nausea'] },
    ];
  }
  if (fixture === 'isolation') {
    return [
      ...historic,
      { date: addDays(today, -25), symptoms: ['nausea'] },
      { date: addDays(today, -24), symptoms: ['nausea'] },
      { date: addDays(today, -23), symptoms: ['nausea'] },
      { date: addDays(today, -22), symptoms: ['nausea'] },
      { date: addDays(today, -21), symptoms: ['nausea'] },
      { date: addDays(today, -20), symptoms: ['nausea'] },
      { date: addDays(today, -19), symptoms: ['nausea'] },
      { date: addDays(today, -18), symptoms: ['nausea'] },
      { date: addDays(today, -17), symptoms: ['nausea'] },
      { date: addDays(today, -16), symptoms: ['nausea'] },
      { date: addDays(today, -1), symptoms: ['nausea'] },
      { date: today, symptoms: ['nausea'] },
    ];
  }
  return [
    ...historic,
    { date: addDays(today, -24), symptoms: ['nausea', 'heartburn'], observations: { energy: 'low' } },
    { date: addDays(today, -20), symptoms: ['nausea', 'vomiting'], flow: 'spotting' },
    {
      date: addDays(today, -16),
      symptoms: ['nausea', 'heartburn', 'fatigue'],
      painEntries: [{ type: 'lower_back', severity: 'mild' }],
      observations: { energy: 'very_low' },
    },
    {
      date: addDays(today, -12),
      symptoms: ['nausea', 'bloating', 'constipation'],
      painEntries: [{ type: 'lower_back', severity: 'moderate' }],
      observations: { energy: 'low' },
    },
    {
      date: addDays(today, -8),
      symptoms: ['heartburn', 'fatigue', 'swelling', 'short_breath'],
      painEntries: [{ type: 'lower_back', severity: 'moderate' }, { type: 'cramps', severity: 'mild' }],
      observations: { energy: 'low' },
      flow: 'spotting',
    },
    {
      date: addDays(today, -5),
      symptoms: ['vomiting', 'diarrhea', 'frequent_urination'],
      painEntries: [{ type: 'cramps', severity: 'mild' }],
      flow: 'light',
    },
    {
      date: addDays(today, -3),
      symptoms: ['heartburn', 'dizziness', 'leg_cramps'],
      painEntries: [{ type: 'lower_back', severity: 'moderate' }],
      observations: { energy: 'low' },
    },
    {
      date: addDays(today, -1),
      symptoms: ['fatigue', 'migraine'],
      observations: { energy: 'low' },
      notes: 'პირადი ჩანაწერი',
      sexualActivity: true,
    },
    {
      date: today,
      symptoms: ['nausea', 'heartburn'],
      painEntries: [{ type: 'lower_back', severity: 'severe' }],
      observations: { energy: 'low' },
    },
  ];
}

async function main() {
  const today = todayInTimeZone();
  const week = 18;
  const referenceDate = addDays(today, -(week * 7 + 3));
  const startedAt =
    FIXTURE === 'isolation'
      ? new Date(`${addDays(today, -5)}T10:00:00.000Z`)
      : new Date(`${addDays(today, -40)}T10:00:00.000Z`);
  const logs = logsFor(today, FIXTURE);
  const byDate = new Map();
  for (const row of logs) {
    const prev = byDate.get(row.date) || {};
    byDate.set(row.date, {
      ...prev,
      ...row,
      symptoms: [...new Set([...(prev.symptoms || []), ...(row.symptoms || [])])],
      painEntries: row.painEntries || prev.painEntries || [],
    });
  }
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

  if (FIXTURE === 'isolation') {
    await prisma.cyclePregnancyEpisode.create({
      data: {
        userId: user.id,
        referenceDate,
        referenceType: 'LMP',
        status: 'ENDED',
        startedAt: new Date(`${addDays(today, -80)}T10:00:00.000Z`),
        endedAt: new Date(`${addDays(today, -6)}T10:00:00.000Z`),
      },
    });
  }

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
        fixture: `phase23-${FIXTURE}`,
        mode: 'PREGNANCY',
        startedAt: startedAt.toISOString().slice(0, 10),
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
