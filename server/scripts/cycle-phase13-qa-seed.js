/**
 * Cycle Phase 13 — Journal observation-trend fixtures.
 *
 *   node scripts/cycle-phase13-qa-seed.js              # rich (default)
 *   node scripts/cycle-phase13-qa-seed.js empty
 *   node scripts/cycle-phase13-qa-seed.js minimal
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6a
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { addDays, todayInTimeZone } from '../src/lib/cycle.js';

const EMAIL = 'cycle.qa.phase6@medicard.ge';
const PASSWORD = 'CycleQaPhase6a';
const PHONE = '+995500000016';
const NAME = 'Cycle QA Phase6';

const FIXTURE = process.argv[2] || 'rich';

function bleedDays(start, count = 4, extra = {}) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ date: addDays(start, i), flow: i === 0 ? 'medium' : 'light', ...extra });
  }
  return rows;
}

function buildLogs(today) {
  if (FIXTURE === 'empty') {
    return bleedDays(addDays(today, -8));
  }
  if (FIXTURE === 'minimal') {
    return [
      ...bleedDays(addDays(today, -8)),
      { date: addDays(today, -2), flow: 'none', symptoms: ['bloating'] },
      { date: addDays(today, -1), flow: 'none', symptoms: ['bloating'] },
    ];
  }
  const p1 = addDays(today, -112);
  const p2 = addDays(today, -84);
  const p3 = addDays(today, -56);
  const p4 = addDays(today, -28);
  return [
    ...bleedDays(p1, 4, { painEntries: [{ type: 'cramps', severity: 'moderate' }] }),
    ...bleedDays(p2, 4, { painEntries: [{ type: 'cramps', severity: 'mild' }] }),
    ...bleedDays(p3, 4, { painEntries: [{ type: 'cramps', severity: 'moderate' }] }),
    ...bleedDays(p4, 4, { painEntries: [{ type: 'cramps', severity: 'severe' }] }),
    { date: addDays(today, -20), flow: 'none', symptoms: ['acne'] },
    { date: addDays(today, -12), flow: 'none', symptoms: ['acne', 'bloating'] },
    { date: addDays(today, -9), flow: 'none', symptoms: ['bloating', 'nausea'], observations: { energy: 'very_low' } },
    { date: addDays(today, -6), flow: 'none', symptoms: ['bloating'], observations: { energy: 'low' } },
    { date: addDays(today, -4), flow: 'none', symptoms: ['acne', 'gas'], observations: { energy: 'low' } },
    { date: addDays(today, -3), flow: 'none', symptoms: ['fatigue'] },
    {
      date: addDays(today, -2),
      flow: 'none',
      symptoms: ['bloating'],
      observations: { energy: 'low' },
      sexualActivity: true,
      notes: 'private — must not appear in trends',
      ovulationTest: 'positive',
    },
    {
      date: today,
      flow: 'none',
      symptoms: ['bloating', 'acne'],
      painEntries: [{ type: 'cramps', severity: 'moderate' }],
      observations: { energy: 'low' },
    },
  ];
}

async function main() {
  const today = todayInTimeZone();
  const logs = buildLogs(today);
  const byDate = new Map();
  for (const row of logs) byDate.set(row.date, { ...byDate.get(row.date), ...row });
  const uniqueLogs = [...byDate.values()];
  const lastStart =
    FIXTURE === 'rich' ? addDays(today, -28) : logs.find((l) => l.flow === 'medium' || l.flow === 'light')?.date || addDays(today, -8);

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
  await prisma.cycleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode: 'TRACK_PERIOD',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      isIrregular: false,
      lastPeriodStart: new Date(`${lastStart}T00:00:00.000Z`),
      contraceptionMethod: 'NONE',
      privacyEnabled: false,
    },
    update: {
      mode: 'TRACK_PERIOD',
      lastPeriodStart: new Date(`${lastStart}T00:00:00.000Z`),
      contraceptionMethod: 'NONE',
      dueDate: null,
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
        painEntries: row.painEntries ?? [],
        observations: row.observations ?? {},
        observationSchemaVersion: 1,
        ovulationTest: row.ovulationTest ?? null,
        sexualActivity: row.sexualActivity ?? null,
        notes: row.notes ?? null,
      },
    });
  }

  console.log(JSON.stringify({ fixture: FIXTURE, today, email: EMAIL, logCount: uniqueLogs.length }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
