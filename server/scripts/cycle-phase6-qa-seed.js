/**
 * Cycle Phase 6 — synthetic QA fixtures.
 * Seeds raw CycleLog + CycleProfile only. Engine computes phase/confidence/late.
 *
 * Usage:
 *   node scripts/cycle-phase6-qa-seed.js --state=regular
 *   node scripts/cycle-phase6-qa-seed.js --state=period
 *
 * Account (synthetic, not a real person):
 *   email    cycle.qa.phase6@medicard.ge
 *   password CycleQaPhase6!
 *   phone    +995500000016
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { addDays, todayInTimeZone } from '../src/lib/cycle.js';

const EMAIL = 'cycle.qa.phase6@medicard.ge';
const PASSWORD = 'CycleQaPhase6!';
const PHONE = '+995500000016';
const NAME = 'Cycle QA Phase6';

const STATES = [
  'period',
  'regular',
  'fertile',
  'ovulation',
  'luteal',
  'low-history',
  'irregular',
  'late',
  'contraception',
  'symptoms',
  'empty',
];

function argState() {
  const raw = process.argv.find((a) => a.startsWith('--state='));
  const state = raw ? raw.slice('--state='.length) : 'regular';
  if (!STATES.includes(state)) {
    throw new Error(`Unknown state ${state}. Use: ${STATES.join(', ')}`);
  }
  return state;
}

function bleedDays(start, count, flow = 'medium') {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ date: addDays(start, i), flow, symptoms: [], moods: [], painEntries: [] });
  }
  return rows;
}

function regularHistory(today, { lastOffset, cycles = 6, period = 5, length = 28 }) {
  const lastStart = addDays(today, -lastOffset);
  const logs = [...bleedDays(lastStart, period)];
  let cursor = lastStart;
  for (let i = 0; i < cycles; i += 1) {
    cursor = addDays(cursor, -length);
    logs.push(...bleedDays(cursor, period));
  }
  return { lastStart, logs };
}

function buildState(today, state) {
  const profile = {
    mode: 'TRACK_PERIOD',
    avgCycleLength: 28,
    avgPeriodLength: 5,
    isIrregular: false,
    lastPeriodStart: null,
    contraceptionMethod: 'NONE',
    contraceptionStartedAt: null,
    conditions: [],
    privacyEnabled: false,
  };
  let logs = [];

  if (state === 'empty') {
    return { profile, logs };
  }

  if (state === 'low-history') {
    const lastStart = addDays(today, -8);
    profile.lastPeriodStart = lastStart;
    logs = bleedDays(lastStart, 5);
    return { profile, logs };
  }

  if (state === 'irregular') {
    profile.isIrregular = true;
    const lastStart = addDays(today, -10);
    profile.lastPeriodStart = lastStart;
    logs = [
      ...bleedDays(lastStart, 6, 'heavy'),
      ...bleedDays(addDays(lastStart, -38), 4, 'light'),
      ...bleedDays(addDays(lastStart, -38 - 21), 7, 'medium'),
      ...bleedDays(addDays(lastStart, -38 - 21 - 32), 5, 'medium'),
    ];
    return { profile, logs };
  }

  if (state === 'late') {
    const { lastStart, logs: hist } = regularHistory(today, { lastOffset: 36, cycles: 6 });
    profile.lastPeriodStart = lastStart;
    logs = hist;
    return { profile, logs };
  }

  if (state === 'period') {
    const { lastStart, logs: hist } = regularHistory(today, { lastOffset: 1, cycles: 6 });
    profile.lastPeriodStart = lastStart;
    logs = hist.map((row) =>
      row.date === today ? { ...row, flow: 'medium', symptoms: ['fatigue'], moods: ['tired_mood'] } : row,
    );
    return { profile, logs };
  }

  const offsets = {
    regular: 8,
    fertile: 12,
    ovulation: 14,
    luteal: 20,
    contraception: 8,
    symptoms: 8,
  };
  const lastOffset = offsets[state] ?? 8;
  const { lastStart, logs: hist } = regularHistory(today, { lastOffset, cycles: 6 });
  profile.lastPeriodStart = lastStart;
  logs = hist;

  if (state === 'contraception') {
    profile.contraceptionMethod = 'COMBINED_PILL';
    profile.contraceptionStartedAt = addDays(today, -120);
  }

  if (state === 'symptoms') {
    logs.push({
      date: today,
      flow: 'none',
      symptoms: ['bloating', 'fatigue'],
      moods: ['irritable'],
      painEntries: [{ type: 'cramps', severity: 'moderate' }],
    });
  }

  return { profile, logs };
}

async function main() {
  const state = argState();
  const today = todayInTimeZone();
  const { profile, logs } = buildState(today, state);
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
      packageId: free?.id ?? undefined,
    },
  });

  await prisma.healthProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      completedAt: new Date(),
      extraAnswers: {
        assessmentPhaseComplete: true,
        avatarId: 'female-1',
        phoneVerified: true,
        faceIdPrompted: true,
        privacyAccepted: true,
        notificationsEnabled: false,
        locationPrompted: true,
      },
    },
    update: {
      completedAt: new Date(),
      extraAnswers: {
        assessmentPhaseComplete: true,
        avatarId: 'female-1',
        phoneVerified: true,
        faceIdPrompted: true,
        privacyAccepted: true,
        notificationsEnabled: false,
        locationPrompted: true,
      },
    },
  });

  await prisma.cycleLog.deleteMany({ where: { userId: user.id } });
  try {
    await prisma.cyclePredictionSnapshot.deleteMany({ where: { userId: user.id } });
  } catch {
    /* table may be absent on older local DBs */
  }
  await prisma.cycleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode: profile.mode,
      avgCycleLength: profile.avgCycleLength,
      avgPeriodLength: profile.avgPeriodLength,
      isIrregular: profile.isIrregular,
      lastPeriodStart: profile.lastPeriodStart ? new Date(`${profile.lastPeriodStart}T00:00:00.000Z`) : null,
      contraceptionMethod: profile.contraceptionMethod,
      contraceptionStartedAt: profile.contraceptionStartedAt
        ? new Date(`${profile.contraceptionStartedAt}T00:00:00.000Z`)
        : null,
      conditions: profile.conditions,
      privacyEnabled: false,
    },
    update: {
      mode: profile.mode,
      avgCycleLength: profile.avgCycleLength,
      avgPeriodLength: profile.avgPeriodLength,
      isIrregular: profile.isIrregular,
      lastPeriodStart: profile.lastPeriodStart ? new Date(`${profile.lastPeriodStart}T00:00:00.000Z`) : null,
      contraceptionMethod: profile.contraceptionMethod,
      contraceptionStartedAt: profile.contraceptionStartedAt
        ? new Date(`${profile.contraceptionStartedAt}T00:00:00.000Z`)
        : null,
      conditions: profile.conditions,
      privacyEnabled: false,
      dueDate: null,
    },
  });

  for (const row of logs) {
    await prisma.cycleLog.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        date: row.date,
        flow: row.flow,
        symptoms: row.symptoms ?? [],
        moods: row.moods ?? [],
        painEntries: row.painEntries ?? [],
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        state,
        today,
        userId: user.id,
        email: EMAIL,
        lastPeriodStart: profile.lastPeriodStart,
        logCount: logs.length,
        contraception: profile.contraceptionMethod,
        irregular: profile.isIrregular,
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
