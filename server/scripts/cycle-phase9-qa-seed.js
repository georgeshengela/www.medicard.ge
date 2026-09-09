/**
 * Cycle Phase 9 — synthetic prediction-history fixtures.
 * Seeds CycleLog + CyclePredictionSnapshot for Journal UX QA.
 * These are QA observations, not product backfill.
 *
 *   node scripts/cycle-phase9-qa-seed.js --state=three-plus
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6!
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { addDays, todayInTimeZone } from '../src/lib/cycle.js';
import { CYCLE_PREDICTION_ENGINE_VERSION } from '../src/lib/cyclePredictionHistory.js';

const EMAIL = 'cycle.qa.phase6@medicard.ge';
const PASSWORD = 'CycleQaPhase6!';
const PHONE = '+995500000016';
const NAME = 'Cycle QA Phase6';

const STATES = [
  'empty',
  'open',
  'one',
  'two',
  'three-plus',
  'revised',
  'exact',
  'earlier',
  'later',
  'gap',
  'many',
];

function argState() {
  const raw = process.argv.find((a) => a.startsWith('--state='));
  const state = raw ? raw.slice('--state='.length) : 'three-plus';
  if (!STATES.includes(state)) {
    throw new Error(`Unknown state ${state}. Use: ${STATES.join(', ')}`);
  }
  return state;
}

function bleedDays(start, count = 5) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ date: addDays(start, i), flow: 'medium' });
  }
  return rows;
}

function snapshot({
  userId,
  anchor,
  predicted,
  on,
  confidence = 'medium',
  hour = 10,
}) {
  return {
    id: randomUUID(),
    userId,
    type: 'NEXT_PERIOD_START',
    predictedDate: predicted,
    snapshotDate: on,
    snapshotAt: new Date(`${on}T${String(hour).padStart(2, '0')}:00:00.000Z`),
    cycleAnchorDate: anchor,
    confidence,
    engineVersion: CYCLE_PREDICTION_ENGINE_VERSION,
    validGapCount: 3,
    isIrregular: false,
    source: 'inferred',
  };
}

function buildFixture(today, state) {
  const logs = [];
  const snaps = [];
  const starts = [];

  const pushCycle = (start) => {
    starts.push(start);
    logs.push(...bleedDays(start));
  };

  if (state === 'empty') {
    // Keep lastPeriod so Cycle stays out of onboarding. No snapshots —
    // History empty copy is captured after wiping any observe-created row.
    const current = addDays(today, -8);
    pushCycle(current);
    return { logs, snaps, lastPeriodStart: current };
  }

  if (state === 'gap') {
    const a = addDays(today, -200);
    const b = addDays(today, -10);
    pushCycle(a);
    pushCycle(b);
    snaps.push({
      builder: (userId) => snapshot({
        userId,
        anchor: a,
        predicted: addDays(a, 28),
        on: addDays(a, 2),
      }),
    });
    return { logs, snaps, lastPeriodStart: b };
  }

  const count = {
    open: 1,
    one: 2,
    exact: 2,
    earlier: 2,
    later: 2,
    revised: 2,
    two: 3,
    'three-plus': 5,
    many: 9,
  }[state] ?? 2;

  let cursor = addDays(today, -8);
  const periodStarts = [];
  for (let i = 0; i < count; i += 1) {
    periodStarts.unshift(cursor);
    cursor = addDays(cursor, -28);
  }
  for (const start of periodStarts) pushCycle(start);

  const completedPairs = [];
  for (let i = 0; i < periodStarts.length - 1; i += 1) {
    completedPairs.push({ anchor: periodStarts[i], actual: periodStarts[i + 1] });
  }

  for (const [idx, pair] of completedPairs.entries()) {
    const predicted = addDays(pair.anchor, 28);
    let first = predicted;
    let last = predicted;
    if (state === 'revised' && idx === completedPairs.length - 1) {
      first = addDays(pair.actual, -2);
      last = pair.actual;
    } else if (state === 'exact') {
      first = pair.actual;
      last = pair.actual;
    } else if (state === 'earlier') {
      first = addDays(pair.actual, 2);
      last = addDays(pair.actual, 2);
    } else if (state === 'later') {
      first = addDays(pair.actual, -2);
      last = addDays(pair.actual, -2);
    } else if (state === 'three-plus' || state === 'many') {
      const offsets = [1, 2, 0, 1, 2, 1, 0, 1];
      last = addDays(pair.actual, -(offsets[idx] ?? 1));
      first = last;
    }
    snaps.push({
      builder: (userId) => snapshot({
        userId,
        anchor: pair.anchor,
        predicted: first,
        on: addDays(pair.anchor, 2),
        hour: 8,
      }),
    });
    if (first !== last) {
      snaps.push({
        builder: (userId) => snapshot({
          userId,
          anchor: pair.anchor,
          predicted: addDays(first, 1),
          on: addDays(pair.anchor, 10),
          hour: 9,
        }),
      });
      snaps.push({
        builder: (userId) => snapshot({
          userId,
          anchor: pair.anchor,
          predicted: last,
          on: addDays(pair.anchor, 20),
          hour: 10,
        }),
      });
    }
  }

  if (state === 'open') {
    const current = periodStarts[periodStarts.length - 1];
    snaps.push({
      builder: (userId) => snapshot({
        userId,
        anchor: current,
        predicted: addDays(current, 28),
        on: addDays(current, 1),
      }),
    });
  }

  return {
    logs,
    snaps,
    lastPeriodStart: periodStarts[periodStarts.length - 1],
  };
}

async function wipeSnaps() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error('QA user missing');
  const res = await prisma.cyclePredictionSnapshot.deleteMany({ where: { userId: user.id } });
  console.log(JSON.stringify({ wipedSnapshots: res.count, email: EMAIL }));
}

async function main() {
  if (process.argv.includes('--wipe-snaps')) {
    await wipeSnaps();
    return;
  }
  const state = argState();
  const today = todayInTimeZone();
  const fixture = buildFixture(today, state);
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

  await prisma.cyclePredictionSnapshot.deleteMany({ where: { userId: user.id } });
  await prisma.cycleLog.deleteMany({ where: { userId: user.id } });
  await prisma.cycleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode: 'TRACK_PERIOD',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      isIrregular: false,
      lastPeriodStart: fixture.lastPeriodStart
        ? new Date(`${fixture.lastPeriodStart}T00:00:00.000Z`)
        : null,
      contraceptionMethod: 'NONE',
      privacyEnabled: false,
    },
    update: {
      mode: 'TRACK_PERIOD',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      isIrregular: false,
      lastPeriodStart: fixture.lastPeriodStart
        ? new Date(`${fixture.lastPeriodStart}T00:00:00.000Z`)
        : null,
      contraceptionMethod: 'NONE',
      dueDate: null,
      privacyEnabled: false,
    },
  });

  for (const row of fixture.logs) {
    await prisma.cycleLog.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        date: row.date,
        flow: row.flow,
        symptoms: [],
        moods: [],
        painEntries: [],
      },
    });
  }

  for (const row of fixture.snaps) {
    await prisma.cyclePredictionSnapshot.create({ data: row.builder(user.id) });
  }

  console.log(JSON.stringify({
    state,
    today,
    email: EMAIL,
    logCount: fixture.logs.length,
    snapshotCount: fixture.snaps.length,
    lastPeriodStart: fixture.lastPeriodStart,
    note: 'QA fixtures only — not product backfill',
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
