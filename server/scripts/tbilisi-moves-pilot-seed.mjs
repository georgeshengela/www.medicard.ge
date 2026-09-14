/**
 * Isolated owner-pilot / visual-QA seed. Runs only against the disposable
 * 127.0.0.1:55433 cluster. Real server time. No injected clocks.
 *
 * Invoked by tbilisi-moves-pilot.mjs with DATABASE_URL already pointed at
 * medicard_tbilisi_moves_pilot or medicard_tbilisi_moves_visual.
 */
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import { TBILISI_MOVES_DISTRICTS } from '../src/lib/tbilisiMoves/catalog.js';
import { enrollUser } from '../src/lib/tbilisiMoves/membership.js';
import { putObservation } from '../src/lib/tbilisiMoves/ingest.js';
import { addDaysYmd, tbilisiMidnight, tbilisiYmd } from '../src/lib/tbilisiMoves/time.js';
import {
  assertDisposableTbilisiMovesPilotDatabase,
  assertDisposableTbilisiMovesVisualQaDatabase,
  PILOT_DB,
  VISUAL_QA_DB,
} from '../src/lib/tbilisiMoves/testEnv.js';

const OWNER_EMAIL = 'pilot.owner@medicard.test';
const OWNER_PASSWORD = 'MedicardPilot1!';
const OWNER_NAME = 'Owner Pilot';

function redactedIdentity() {
  return {
    database: process.env.TBILISI_MOVES_PILOT_DB || '',
    visualQa: process.env.TBILISI_MOVES_VISUAL_QA === '1',
  };
}

async function ensurePackage() {
  const existing = await prisma.package.findUnique({ where: { code: 'FREE' } });
  if (existing) return existing;
  return prisma.package.create({
    data: {
      code: 'FREE',
      nameKa: 'უფასო',
      nameEn: 'Free',
      descriptionKa: 'საპილოტე იზოლირებული ბაზა.',
      monthlyAiLimit: 90,
      dailyAiLimit: 3,
      priceGel: 0,
      sortOrder: 1,
      features: { doctorChat: true },
    },
  });
}

async function ensureSettings() {
  await prisma.appSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      allowRegistrations: true,
      maintenanceMode: false,
      forceUpdate: false,
      minAppVersion: '1.0.0',
      qaOtpEnabled: false,
    },
    update: {
      allowRegistrations: true,
      maintenanceMode: false,
      forceUpdate: false,
    },
  });
}

async function ensureOwner(packageId) {
  const existing = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email: OWNER_EMAIL,
      fullName: OWNER_NAME,
      passwordHash: await bcrypt.hash(OWNER_PASSWORD, 12),
      status: 'ACTIVE',
      packageId,
      adminNote: 'isolated-tbilisi-moves-owner-pilot',
    },
  });
}

async function ensureAdmin() {
  const email = String(env.ADMIN_EMAIL || 'admin@medicard.ge').toLowerCase();
  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) return { email, created: false };
  await prisma.admin.create({
    data: {
      email,
      fullName: env.ADMIN_FULL_NAME || 'Medicard Admin',
      passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12),
      capabilities: null,
    },
  });
  return { email, created: true };
}

async function enableCompetitionFlags() {
  await prisma.tbilisiMovesConfig.update({
    where: { id: 'default' },
    data: {
      featureEnabled: true,
      enrollmentOpen: true,
      ingestionPaused: false,
      competitionPaused: false,
      pilotMode: true,
    },
  });
}

function observationBody({ date, steps, now, origin }) {
  const start = tbilisiMidnight(date);
  const dayEnd = tbilisiMidnight(addDaysYmd(date, 1));
  const endMs = Math.min(now.getTime(), dayEnd.getTime() - 1000);
  const end = new Date(Math.max(endMs, start.getTime() + 1000));
  return {
    clientObservationId: randomUUID(),
    provider: 'HEALTH_CONNECT',
    sourceInstallationId: `visual-qa-${origin}`,
    tbilisiDate: date,
    intervalStart: start.toISOString(),
    intervalEnd: end.toISOString(),
    cumulativeSteps: steps,
    recordedAt: new Date(Math.min(now.getTime(), end.getTime())).toISOString(),
    clientSequence: 1,
  };
}

async function ensureVisualUser(email, fullName, packageId) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash: await bcrypt.hash(OWNER_PASSWORD, 12),
      status: 'ACTIVE',
      packageId,
      adminNote: 'isolated-tbilisi-moves-visual-qa',
    },
  });
}

async function seedVisualFixture(packageId) {
  const now = new Date();
  const date = tbilisiYmd(now);
  const gldani = TBILISI_MOVES_DISTRICTS[0];
  const didube = TBILISI_MOVES_DISTRICTS[1];
  const vake = TBILISI_MOVES_DISTRICTS[2];

  const roster = [
    { email: 'qa.tm.01@medicard.test', handle: 'QA ლიდერი ა', district: gldani, steps: 9000, avatar: 'avatar-1' },
    { email: 'qa.tm.02@medicard.test', handle: 'QA ლიდერი ბ', district: gldani, steps: 9000, avatar: 'avatar-2' },
    { email: 'qa.tm.03@medicard.test', handle: 'QA გლდანი 3', district: gldani, steps: 7200, avatar: 'avatar-3' },
    { email: 'qa.tm.04@medicard.test', handle: 'QA გლდანი 4', district: gldani, steps: 4100, avatar: 'avatar-4' },
    { email: 'qa.tm.05@medicard.test', handle: 'QA გლდანი 5', district: gldani, steps: 2500, avatar: 'avatar-5' },
    { email: 'qa.tm.06@medicard.test', handle: 'QA დიდუბე ა', district: didube, steps: 8000, avatar: 'avatar-6' },
    { email: 'qa.tm.07@medicard.test', handle: 'QA დიდუბე ბ', district: didube, steps: 8000, avatar: 'avatar-7' },
    { email: 'qa.tm.08@medicard.test', handle: 'QA ვაკე', district: vake, steps: 1200, avatar: 'avatar-8' },
  ];

  for (let i = 9; i <= 52; i += 1) {
    const n = String(i).padStart(2, '0');
    roster.push({
      email: `qa.tm.${n}@medicard.test`,
      handle: `QA ${n}`,
      district: gldani,
      steps: Math.max(100, 2000 - i * 20),
      avatar: `avatar-${(i % 12) + 1}`,
    });
  }

  for (const row of roster) {
    const user = await ensureVisualUser(row.email, row.handle, packageId);
    const membership = await prisma.tbilisiMovesMembership.findUnique({ where: { userId: user.id } });
    if (!membership) {
      await enrollUser({
        userId: user.id,
        districtId: row.district.id,
        publicHandle: row.handle,
        publicAvatarId: row.avatar,
        now,
      });
    }
    const credit = await prisma.tbilisiMovesCredit.findUnique({
      where: { userId_date: { userId: user.id, date } },
    });
    if (!credit) {
      await putObservation({
        userId: user.id,
        body: observationBody({ date, steps: row.steps, now, origin: row.email }),
        now,
      });
    }
  }

  console.log(
    JSON.stringify({
      visualQaSeeded: true,
      date,
      people: roster.length,
      handlesPrefixed: 'QA ',
      clock: 'server',
    }),
  );
}

const identity = redactedIdentity();
const dbName = identity.visualQa ? VISUAL_QA_DB : PILOT_DB;
if (identity.visualQa) {
  await assertDisposableTbilisiMovesVisualQaDatabase(prisma);
} else {
  await assertDisposableTbilisiMovesPilotDatabase(prisma);
}

const pkg = await ensurePackage();
await ensureSettings();
await enableCompetitionFlags();
const owner = await ensureOwner(pkg.id);
const admin = await ensureAdmin();
if (identity.visualQa) {
  await seedVisualFixture(pkg.id);
}

console.log(
  JSON.stringify({
    ok: true,
    database: dbName,
    ownerEmail: OWNER_EMAIL,
    ownerUserId: owner.id,
    adminEmail: admin.email,
    adminCreated: admin.created,
    visualQa: identity.visualQa,
    flags: { featureEnabled: true, enrollmentOpen: true, ingestionPaused: false, pilotMode: true },
    passwordPrinted: false,
  }),
);

await prisma.$disconnect();
