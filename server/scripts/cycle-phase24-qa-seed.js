/**
 * Cycle Phase 24 — Perimenopause mode QA seed.
 *
 *   node scripts/cycle-phase24-qa-seed.js [rich|empty|low]
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6a
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { addDays, todayInTimeZone } from '../src/lib/cycle.js';

const EMAIL = 'cycle.qa.phase6@medicard.ge';
const PASSWORD = 'CycleQaPhase6a';
const PHONE = '+995500000016';
const NAME = 'Cycle QA Phase6';
const FIXTURE = process.argv[2] || 'rich';

function bleedDays(start, count = 4, flow0 = 'medium') {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ date: addDays(start, i), flow: i === 0 ? flow0 : 'light' });
  }
  return rows;
}

function logsFor(today, fixture) {
  if (fixture === 'empty') {
    return [{ date: today, symptoms: ['hot_flashes'], observations: { energy: 'low' } }];
  }

  const s4 = addDays(today, -10);
  const s3 = addDays(s4, -29);
  const s2 = addDays(s3, -46);
  const s1 = addDays(s2, -31);
  const s0 = addDays(s1, -24);

  const historic = [
    ...bleedDays(s0, 4),
    ...bleedDays(s1, 3),
    ...bleedDays(s2, 5, 'heavy'),
    ...bleedDays(s3, 4),
    ...bleedDays(s4, 3),
  ];

  if (fixture === 'low') {
    return [
      ...historic,
      { date: addDays(today, -2), symptoms: ['hot_flashes'], sleepQuality: 'poor' },
      { date: today, symptoms: ['night_sweats'], moods: ['irritable'] },
    ];
  }

  return [
    ...historic,
    { date: addDays(today, -8), symptoms: ['hot_flashes'], sleepQuality: 'poor', observations: { energy: 'low' } },
    { date: addDays(today, -6), symptoms: ['night_sweats', 'migraine'], moods: ['anxious'] },
    {
      date: addDays(today, -4),
      symptoms: ['hot_flashes', 'dry_skin'],
      painEntries: [{ type: 'headache', severity: 'mild' }],
    },
    {
      date: addDays(today, -1),
      symptoms: ['vaginal_dryness'],
      notes: 'პირადი ჩანაწერი',
      sexualActivity: true,
    },
    {
      date: today,
      symptoms: ['hot_flashes', 'night_sweats'],
      moods: ['irritable'],
      sleepQuality: 'poor',
      observations: { energy: 'low' },
    },
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
      birthDate: new Date('1978-03-12T00:00:00.000Z'),
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

  console.log(`Phase 24 seed ${FIXTURE}: ${uniqueLogs.length} logs for ${EMAIL} mode=PERIMENOPAUSE today=${today}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
