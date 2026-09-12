/**
 * Cycle Phase 18 — Pregnancy mode fixtures.
 *
 *   node scripts/cycle-phase18-qa-seed.js onboard
 *   node scripts/cycle-phase18-qa-seed.js ttc
 *   node scripts/cycle-phase18-qa-seed.js lmp
 *   node scripts/cycle-phase18-qa-seed.js low
 *   node scripts/cycle-phase18-qa-seed.js pos-test
 *   node scripts/cycle-phase18-qa-seed.js spotting
 *   node scripts/cycle-phase18-qa-seed.js rich
 *   node scripts/cycle-phase18-qa-seed.js old
 *   node scripts/cycle-phase18-qa-seed.js exit
 *   node scripts/cycle-phase18-qa-seed.js reenter
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
const FIXTURE = process.argv[2] || 'lmp';

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
  const none = { contraceptionMethod: 'NONE', isIrregular: false };
  const lmp = addDays(today, -(8 * 7 + 3));
  const base = cycles(today, [28, 28, 28]);

  if (FIXTURE === 'onboard') {
    return { mode: 'TRACK_PERIOD', ...none, logs: base, episode: null };
  }
  if (FIXTURE === 'ttc') {
    return {
      mode: 'TRY_TO_CONCEIVE',
      ...none,
      logs: [...base, { date: today, ovulationTest: 'positive', pregnancyTest: 'positive' }],
      episode: null,
    };
  }
  if (FIXTURE === 'low') {
    return {
      mode: 'PREGNANCY',
      ...none,
      logs: [],
      episode: { referenceDate: lmp, referenceType: 'LMP' },
    };
  }
  if (FIXTURE === 'pos-test') {
    return {
      mode: 'TRACK_PERIOD',
      ...none,
      logs: [...base, { date: today, pregnancyTest: 'positive' }],
      episode: null,
    };
  }
  if (FIXTURE === 'spotting') {
    return {
      mode: 'PREGNANCY',
      ...none,
      logs: [
        ...base,
        { date: today, flow: 'spotting', painEntries: [{ type: 'cramps', severity: 'mild' }] },
      ],
      episode: { referenceDate: lmp, referenceType: 'LMP' },
    };
  }
  if (FIXTURE === 'rich') {
    return {
      mode: 'PREGNANCY',
      ...none,
      logs: [
        ...base,
        {
          date: today,
          flow: 'spotting',
          symptoms: ['nausea', 'fatigue', 'dizziness'],
          painEntries: [{ type: 'cramps', severity: 'moderate' }],
          notes: 'private',
        },
      ],
      episode: { referenceDate: lmp, referenceType: 'LMP' },
    };
  }
  if (FIXTURE === 'old') {
    return {
      mode: 'PREGNANCY',
      ...none,
      logs: bleedDays(addDays(today, -320), 4),
      episode: { referenceDate: addDays(today, -320), referenceType: 'LMP' },
    };
  }
  if (FIXTURE === 'exit') {
    return {
      mode: 'TRACK_PERIOD',
      ...none,
      logs: [...base, { date: addDays(today, -10), pregnancyTest: 'positive' }],
      endedEpisode: { referenceDate: addDays(today, -90), referenceType: 'LMP' },
    };
  }
  if (FIXTURE === 'reenter') {
    return {
      mode: 'PREGNANCY',
      ...none,
      logs: [...base, { date: today, symptoms: ['nausea'] }],
      endedEpisode: { referenceDate: addDays(today, -400), referenceType: 'LMP' },
      episode: { referenceDate: lmp, referenceType: 'LMP' },
    };
  }
  return {
    mode: 'PREGNANCY',
    ...none,
    logs: [...base, { date: addDays(today, -20), pregnancyTest: 'positive' }],
    episode: { referenceDate: lmp, referenceType: 'LMP' },
  };
}

async function main() {
  const today = todayInTimeZone();
  const built = build({ today });
  const byDate = new Map();
  for (const row of built.logs) byDate.set(row.date, { ...byDate.get(row.date), ...row });
  const uniqueLogs = [...byDate.values()];
  const lastStart = uniqueLogs.find((l) => l.flow === 'medium')?.date || built.episode?.referenceDate || null;

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

  const due = built.episode ? estimatedDueDateFromReference(built.episode.referenceDate) : null;
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
      dueDate: due ? new Date(`${due}T00:00:00.000Z`) : null,
      privacyEnabled: false,
    },
    update: {
      mode: built.mode,
      lastPeriodStart: lastStart ? new Date(`${lastStart}T00:00:00.000Z`) : null,
      contraceptionMethod: built.contraceptionMethod,
      contraceptionStartedAt: null,
      dueDate: due ? new Date(`${due}T00:00:00.000Z`) : null,
      isIrregular: built.isIrregular,
    },
  });

  if (built.endedEpisode) {
    await prisma.cyclePregnancyEpisode.create({
      data: {
        userId: user.id,
        referenceDate: built.endedEpisode.referenceDate,
        referenceType: built.endedEpisode.referenceType,
        status: 'ENDED',
        endedAt: new Date(),
      },
    });
  }
  if (built.episode) {
    await prisma.cyclePregnancyEpisode.create({
      data: {
        userId: user.id,
        referenceDate: built.episode.referenceDate,
        referenceType: built.episode.referenceType,
        status: 'ACTIVE',
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

  console.log(
    JSON.stringify(
      {
        fixture: FIXTURE,
        today,
        email: EMAIL,
        mode: built.mode,
        logCount: uniqueLogs.length,
        referenceDate: built.episode?.referenceDate || null,
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
