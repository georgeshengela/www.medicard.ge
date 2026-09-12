/**
 * Cycle Phase 11 — synthetic structured-observation fixtures.
 *
 *   node scripts/cycle-phase11-qa-seed.js
 *
 * Account (synthetic): cycle.qa.phase6@medicard.ge / CycleQaPhase6!
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

function bleedDays(start, count = 5) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ date: addDays(start, i), flow: 'medium' });
  }
  return rows;
}

async function main() {
  const today = todayInTimeZone();
  const current = addDays(today, -8);
  const logs = [...bleedDays(current)];
  logs.push(
    {
      date: today,
      flow: 'none',
      symptoms: ['bloating', 'acne'],
      moods: ['tired_mood'],
      painEntries: [{ type: 'cramps', severity: 'moderate' }],
      sleepQuality: 'poor',
      observations: { energy: 'low' },
      observationSchemaVersion: 1,
    },
    {
      date: addDays(today, -1),
      flow: 'none',
      symptoms: ['constipation', 'dry_skin'],
      moods: ['anxious'],
      observations: { energy: 'very_low' },
      cervicalMucus: 'creamy',
      ovulationTest: 'negative',
    },
    {
      date: addDays(today, -2),
      flow: 'none',
      symptoms: ['unprotected', 'pain_sex'],
      sexualActivity: true,
      libido: 2,
      pregnancyTest: 'negative',
      notes: 'private QA note — not for AI',
    },
  );

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
      lastPeriodStart: new Date(`${current}T00:00:00.000Z`),
      contraceptionMethod: 'NONE',
      privacyEnabled: false,
    },
    update: {
      mode: 'TRACK_PERIOD',
      lastPeriodStart: new Date(`${current}T00:00:00.000Z`),
      contraceptionMethod: 'NONE',
      dueDate: null,
    },
  });

  for (const row of logs) {
    await prisma.cycleLog.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        date: row.date,
        flow: row.flow ?? null,
        symptoms: row.symptoms ?? [],
        moods: row.moods ?? [],
        painEntries: row.painEntries ?? [],
        sleepQuality: row.sleepQuality ?? null,
        observations: row.observations ?? {},
        observationSchemaVersion: row.observationSchemaVersion ?? 1,
        cervicalMucus: row.cervicalMucus ?? null,
        ovulationTest: row.ovulationTest ?? null,
        pregnancyTest: row.pregnancyTest ?? null,
        sexualActivity: row.sexualActivity ?? null,
        libido: row.libido ?? null,
        notes: row.notes ?? null,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        today,
        email: EMAIL,
        logCount: logs.length,
        lastPeriodStart: current,
        includes: ['energy', 'sleep', 'digestion', 'skin', 'fertility', 'private sexual-health', 'pregnancy test'],
        note: 'QA fixtures only — not product backfill',
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
