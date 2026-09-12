/**
 * Cycle Phase 16 — TTC fixtures.
 *
 *   node scripts/cycle-phase16-qa-seed.js empty
 *   node scripts/cycle-phase16-qa-seed.js low
 *   node scripts/cycle-phase16-qa-seed.js normal
 *   node scripts/cycle-phase16-qa-seed.js irregular
 *   node scripts/cycle-phase16-qa-seed.js opk-pos
 *   node scripts/cycle-phase16-qa-seed.js opk-neg
 *   node scripts/cycle-phase16-qa-seed.js bbt
 *   node scripts/cycle-phase16-qa-seed.js mucus
 *   node scripts/cycle-phase16-qa-seed.js preg
 *   node scripts/cycle-phase16-qa-seed.js private
 *   node scripts/cycle-phase16-qa-seed.js conflict
 *   node scripts/cycle-phase16-qa-seed.js history
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
const FIXTURE = process.argv[2] || 'normal';

function bleedDays(start, count = 4) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ date: addDays(start, i), flow: i === 0 ? 'medium' : 'light' });
  }
  return rows;
}

function cycles(today, gaps) {
  const starts = [];
  let cursor = addDays(today, -gaps[gaps.length - 1]);
  for (let i = gaps.length - 1; i >= 0; i -= 1) {
    starts.unshift(cursor);
    if (i > 0) cursor = addDays(cursor, -gaps[i - 1]);
  }
  return starts.flatMap((start) => bleedDays(start, 4));
}

function build({ today }) {
  const mode = 'TRY_TO_CONCEIVE';
  const none = { contraceptionMethod: 'NONE', isIrregular: false };
  if (FIXTURE === 'empty') {
    return { mode, ...none, logs: bleedDays(addDays(today, -8)) };
  }
  if (FIXTURE === 'low') {
    return { mode, ...none, logs: bleedDays(addDays(today, -8)) };
  }
  if (FIXTURE === 'irregular') {
    return {
      mode,
      contraceptionMethod: 'NONE',
      isIrregular: true,
      logs: [...cycles(today, [21, 40, 22]), { date: today, ovulationTest: 'negative' }],
    };
  }
  const base = cycles(today, [28, 28, 28]);
  if (FIXTURE === 'opk-pos') {
    return { mode, ...none, logs: [...base, { date: today, ovulationTest: 'positive' }] };
  }
  if (FIXTURE === 'opk-neg') {
    return { mode, ...none, logs: [...base, { date: today, ovulationTest: 'negative' }] };
  }
  if (FIXTURE === 'bbt') {
    const rows = [];
    for (let i = 6; i >= 0; i -= 1) {
      rows.push({ date: addDays(today, -i), bbt: Number((36.3 + i * 0.05).toFixed(2)) });
    }
    return { mode, ...none, logs: [...base, ...rows] };
  }
  if (FIXTURE === 'mucus') {
    return {
      mode,
      ...none,
      logs: [
        ...base,
        { date: addDays(today, -3), cervicalMucus: 'sticky' },
        { date: addDays(today, -2), cervicalMucus: 'watery' },
        { date: today, cervicalMucus: 'eggwhite' },
      ],
    };
  }
  if (FIXTURE === 'preg') {
    return { mode, ...none, logs: [...base, { date: today, pregnancyTest: 'positive' }] };
  }
  if (FIXTURE === 'private') {
    return { mode, ...none, logs: [...base, { date: today, sexualActivity: true }] };
  }
  if (FIXTURE === 'conflict') {
    return {
      mode,
      contraceptionMethod: 'COMBINED_PILL',
      isIrregular: false,
      logs: base,
    };
  }
  if (FIXTURE === 'history') {
    return {
      mode: 'TRACK_PERIOD',
      ...none,
      logs: [...base, { date: today, ovulationTest: 'positive', bbt: 36.6, cervicalMucus: 'watery' }],
    };
  }
  return {
    mode,
    ...none,
    logs: [...base, { date: today, ovulationTest: 'positive', bbt: 36.6, cervicalMucus: 'watery' }],
  };
}

async function main() {
  const today = todayInTimeZone();
  const built = build({ today });
  const byDate = new Map();
  for (const row of built.logs) byDate.set(row.date, { ...byDate.get(row.date), ...row });
  const uniqueLogs = [...byDate.values()];
  const lastStart = uniqueLogs.find((l) => l.flow === 'medium')?.date || null;

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
      mode: built.mode,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      isIrregular: built.isIrregular,
      lastPeriodStart: lastStart ? new Date(`${lastStart}T00:00:00.000Z`) : null,
      contraceptionMethod: built.contraceptionMethod,
      privacyEnabled: false,
    },
    update: {
      mode: built.mode,
      lastPeriodStart: lastStart ? new Date(`${lastStart}T00:00:00.000Z`) : null,
      contraceptionMethod: built.contraceptionMethod,
      contraceptionStartedAt: built.contraceptionMethod === 'NONE' ? null : new Date(`${addDays(today, -40)}T00:00:00.000Z`),
      dueDate: null,
      isIrregular: built.isIrregular,
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
      },
    });
  }

  console.log(JSON.stringify({ fixture: FIXTURE, today, email: EMAIL, mode: built.mode, logCount: uniqueLogs.length }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
