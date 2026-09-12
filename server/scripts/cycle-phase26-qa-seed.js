/**
 * Cycle Phase 26 — Perimenopause observation-summary QA seed.
 *
 *   node scripts/cycle-phase26-qa-seed.js empty|hot|sweats|bleeding|energy|sleep|pain|expanded|private
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6a
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { addDays, todayInTimeZone } from '../src/lib/cycle.js';

const EMAIL = 'cycle.qa.phase6@medicard.ge';
const FIXTURE = process.argv[2] || 'expanded';

function days(symptom, count, startOffset, today) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ date: addDays(today, startOffset + i), symptoms: [symptom] });
  }
  return rows;
}

function logsFor(today, fixture) {
  if (fixture === 'empty') {
    return [{ date: today, symptoms: ['hot_flashes'] }];
  }
  if (fixture === 'hot') {
    return [
      { date: addDays(today, -12), symptoms: ['hot_flashes'] },
      { date: addDays(today, -8), symptoms: ['hot_flashes'] },
      { date: addDays(today, -4), symptoms: ['hot_flashes'] },
      { date: addDays(today, -2), symptoms: ['hot_flashes'] },
      { date: today, symptoms: ['hot_flashes'] },
    ];
  }
  if (fixture === 'sweats') {
    return [
      { date: addDays(today, -9), symptoms: ['night_sweats'] },
      { date: addDays(today, -3), symptoms: ['night_sweats'] },
      { date: today, symptoms: ['night_sweats'] },
    ];
  }
  if (fixture === 'bleeding') {
    return [
      { date: addDays(today, -8), flow: 'spotting' },
      { date: addDays(today, -7), flow: 'spotting' },
      { date: addDays(today, -3), flow: 'light' },
      { date: today, flow: 'heavy' },
    ];
  }
  if (fixture === 'energy') {
    return [
      { date: addDays(today, -10), observations: { energy: 'low' } },
      { date: addDays(today, -8), observations: { energy: 'very_low' } },
      { date: addDays(today, -6), observations: { energy: 'low' } },
      { date: addDays(today, -4), observations: { energy: 'low' } },
      { date: addDays(today, -2), observations: { energy: 'very_low' } },
      { date: today, observations: { energy: 'low' } },
    ];
  }
  if (fixture === 'sleep') {
    return [
      { date: addDays(today, -9), sleepQuality: 'poor' },
      { date: addDays(today, -6), sleepQuality: 'good' },
      { date: addDays(today, -4), sleepQuality: 'poor' },
      { date: addDays(today, -2), sleepQuality: 'poor' },
      { date: today, sleepQuality: 'poor' },
    ];
  }
  if (fixture === 'pain') {
    return [
      { date: addDays(today, -5), painEntries: [{ type: 'headache', severity: 'mild' }] },
      { date: addDays(today, -2), painEntries: [{ type: 'headache', severity: 'moderate' }] },
      { date: today, painEntries: [{ type: 'headache', severity: 'severe' }] },
    ];
  }
  if (fixture === 'private') {
    return [
      { date: addDays(today, -3), symptoms: ['hot_flashes'] },
      {
        date: today,
        symptoms: ['hot_flashes', 'vaginal_dryness'],
        notes: 'პირადი ჩანაწერი',
        sexualActivity: true,
      },
    ];
  }
  return [
    ...days('hot_flashes', 3, -14, today),
    ...days('night_sweats', 3, -9, today),
    { date: addDays(today, -8), flow: 'spotting' },
    { date: addDays(today, -7), flow: 'light' },
    { date: addDays(today, -11), sleepQuality: 'poor' },
    { date: addDays(today, -4), sleepQuality: 'poor' },
    { date: addDays(today, -10), observations: { energy: 'low' } },
    { date: addDays(today, -1), observations: { energy: 'low' } },
    { date: addDays(today, -6), painEntries: [{ type: 'headache', severity: 'mild' }], symptoms: ['migraine'] },
    { date: today, painEntries: [{ type: 'headache', severity: 'moderate' }], symptoms: ['migraine', 'dizziness'] },
    { date: addDays(today, -13), symptoms: ['dizziness'] },
    { date: addDays(today, -15), symptoms: ['vaginal_dryness'], notes: 'secret' },
  ];
}

async function main() {
  const today = todayInTimeZone();
  const logs = logsFor(today, FIXTURE);
  const byDate = new Map();
  for (const row of logs) {
    const prev = byDate.get(row.date) || {};
    byDate.set(row.date, {
      ...prev,
      ...row,
      symptoms: [...new Set([...(prev.symptoms || []), ...(row.symptoms || [])])],
      moods: [...new Set([...(prev.moods || []), ...(row.moods || [])])],
      painEntries: row.painEntries || prev.painEntries || [],
      observations: { ...(prev.observations || {}), ...(row.observations || {}) },
    });
  }
  const uniqueLogs = [...byDate.values()];

  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true },
  });
  if (!user) {
    throw new Error(`QA user ${EMAIL} is missing — create it before seeding Phase 26`);
  }

  await prisma.cycleLog.deleteMany({ where: { userId: user.id } });
  await prisma.cyclePregnancyEpisode.deleteMany({ where: { userId: user.id } });

  await prisma.cycleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode: 'PERIMENOPAUSE',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      lastPeriodStart: new Date(`${addDays(today, -10)}T00:00:00.000Z`),
      isIrregular: false,
      conditions: [],
    },
    update: {
      mode: 'PERIMENOPAUSE',
      lastPeriodStart: new Date(`${addDays(today, -10)}T00:00:00.000Z`),
      dueDate: null,
      isIrregular: false,
      conditions: [],
    },
  });

  for (const row of uniqueLogs) {
    await prisma.cycleLog.create({
      data: {
        userId: user.id,
        date: row.date,
        flow: row.flow ?? null,
        symptoms: row.symptoms || [],
        moods: row.moods || [],
        sleepQuality: row.sleepQuality ?? null,
        painEntries: row.painEntries || [],
        observations: row.observations || {},
        observationSchemaVersion: 1,
        notes: row.notes ?? null,
        sexualActivity: row.sexualActivity ?? null,
      },
    });
  }

  console.log(`Phase 26 seed ${FIXTURE}: ${uniqueLogs.length} logs for ${EMAIL} mode=PERIMENOPAUSE today=${today}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
