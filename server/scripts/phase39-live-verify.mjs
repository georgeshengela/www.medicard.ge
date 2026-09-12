/**
 * Phase 39 live local API + disposable database verification.
 * Never prints the URL or credentials. Does not touch production.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
if (!process.env.PHASE38_TEST_DATABASE_URL) {
  console.error('BLOCKED: PHASE38_TEST_DATABASE_URL is not set');
  process.exit(2);
}
process.env.DATABASE_URL = process.env.PHASE38_TEST_DATABASE_URL;
process.env.MEDI_WORLD_ENABLED = '1';

const { createServer } = await import('node:http');
const express = (await import('express')).default;
const bcrypt = (await import('bcryptjs')).default;
const { prisma } = await import('../src/lib/prisma.js');
const { signToken } = await import('../src/middleware/auth.js');
const { mediWorldRouter } = await import('../src/routes/mediWorld.routes.js');
const { questsRouter } = await import('../src/routes/quests.routes.js');
const { appRouter } = await import('../src/routes/app.routes.js');
const { errorHandler, notFound } = await import('../src/middleware/error.js');
const { assignDailyQuests, completeQuest } = await import('../src/lib/quest.js');
const { QUEST_TIMEZONE } = await import('../src/lib/questTime.js');

function listen(app) {
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}

async function json(res) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: { raw: text.slice(0, 200) } };
  }
}

function sanitizeProfile(body) {
  if (!body?.profile) return { enabled: body?.enabled, code: body?.code || null };
  return {
    enabled: body.enabled,
    worldLevel: body.profile.worldLevel,
    worldXp: body.profile.worldXp,
    careEnergy: body.profile.careEnergy,
    rulesetId: body.economy?.rulesetId || null,
    rulesetVersion: body.economy?.rulesetVersion ?? null,
    todayXp: body.today?.worldXp || null,
    latestReason: body.latestReward?.reasonCode || null,
  };
}

const stamp = Date.now();
const ownerEmail = `phase39.live.${stamp}@medicard.test`;
const otherEmail = `phase39.other.${stamp}@medicard.test`;
let owner = null;
let other = null;
let http = null;
const evidence = [];

try {
  owner = await prisma.user.create({
    data: {
      email: ownerEmail,
      fullName: 'Phase39 Live Owner',
      passwordHash: await bcrypt.hash('Phase39LivePass!', 12),
    },
  });
  other = await prisma.user.create({
    data: {
      email: otherEmail,
      fullName: 'Phase39 Live Other',
      passwordHash: await bcrypt.hash('Phase39LivePass!', 12),
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api/app', appRouter);
  app.use('/api/medi-world', mediWorldRouter);
  app.use('/api/quests', questsRouter);
  app.use(notFound);
  app.use(errorHandler);
  http = await listen(app);

  const ownerToken = signToken(owner);
  const otherToken = signToken(other);
  const auth = (token) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

  const unauth = await json(await fetch(`${http.origin}/api/medi-world`));
  evidence.push({ step: 'unauthenticated_GET', status: unauth.status });
  if (unauth.status !== 401) throw new Error(`expected 401, got ${unauth.status}`);

  const first = await json(await fetch(`${http.origin}/api/medi-world`, { headers: auth(ownerToken) }));
  evidence.push({ step: 'lazy_GET', status: first.status, profile: sanitizeProfile(first.body) });
  if (first.status !== 200) throw new Error(`lazy GET failed: ${first.status}`);
  if (first.body.profile.worldLevel !== 1 || first.body.profile.worldXp !== 0) {
    throw new Error('lazy profile was not zero progress');
  }

  await prisma.hydrationPreference.create({ data: { userId: owner.id, goalMl: 2000 } });
  await prisma.stepTrackingCapability.create({
    data: { userId: owner.id, status: 'AVAILABLE', source: 'APPLE_HEALTH' },
  });
  const now = new Date('2026-09-12T12:00:00+04:00');
  const options = { now, timezone: QUEST_TIMEZONE };
  await assignDailyQuests(owner.id, '2026-09-12', options);
  const steps = (await prisma.userQuest.findMany({ where: { userId: owner.id }, include: { template: true } })).find(
    (row) => row.template?.key === 'daily_steps',
  );
  await prisma.userQuest.update({ where: { id: steps.id }, data: { progress: steps.target } });
  const completed = await completeQuest(owner.id, steps.id, { ...options, source: 'sync' });
  const retry = await completeQuest(owner.id, steps.id, { ...options, source: 'sync' });
  const worldRows = await prisma.mediWorldLedger.findMany({ where: { userId: owner.id } });
  evidence.push({
    step: 'quest_complete_v2',
    completed: completed.completed,
    alreadyCompletedRetry: retry.alreadyCompleted,
    worldLedgerRows: worldRows.length,
    energyAmount: worldRows[0]?.energyAmount ?? null,
    worldXp: worldRows[0]?.foundationXp ?? null,
    rulesetVersion: worldRows[0]?.rulesetVersion ?? null,
    reasonCode: worldRows[0]?.reasonCode || null,
  });
  if (!completed.completed || !retry.alreadyCompleted || worldRows.length !== 1) {
    throw new Error('quest world award was not exactly-once');
  }
  if (worldRows[0].energyAmount !== 10 || worldRows[0].foundationXp !== 12 || worldRows[0].rulesetVersion !== 2) {
    throw new Error('quest reward was not the v2 100% band');
  }

  const after = await json(await fetch(`${http.origin}/api/medi-world`, { headers: auth(ownerToken) }));
  const afterBlob = JSON.stringify(after.body);
  evidence.push({
    step: 'GET_after_quest',
    status: after.status,
    profile: sanitizeProfile(after.body),
    leakedIdempotency: afterBlob.includes('idempotencyKey'),
    leakedMetadata: afterBlob.includes('"metadata"'),
  });
  if (afterBlob.includes('idempotencyKey') || after.body.profile.careEnergy.movement !== 10) {
    throw new Error('profile GET leaked secrets or wrong energy');
  }

  const spend = await json(
    await fetch(`${http.origin}/api/medi-world/spend`, {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({ energyType: 'movement', amount: 1 }),
    }),
  );
  evidence.push({ step: 'no_public_spend', status: spend.status });
  if (spend.status !== 404) throw new Error(`spend route should 404, got ${spend.status}`);

  const otherGet = await json(await fetch(`${http.origin}/api/medi-world`, { headers: auth(otherToken) }));
  if ((otherGet.body?.profile?.careEnergy?.movement || 0) !== 0) throw new Error('IDOR: other user saw owner energy');
  evidence.push({ step: 'no_IDOR', otherMovement: otherGet.body.profile.careEnergy.movement });

  const persisted = await prisma.mediWorldProfile.findUnique({ where: { userId: owner.id } });
  const { PrismaClient } = await import('@prisma/client');
  const restarted = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: ['error'] });
  const afterRestart = await restarted.mediWorldProfile.findUnique({ where: { userId: owner.id } });
  evidence.push({
    step: 'restart_persistence',
    movement: afterRestart?.energyMovement ?? null,
    xp: afterRestart?.foundationXp ?? null,
    sameAsBefore: afterRestart?.energyMovement === persisted.energyMovement,
  });
  if (!afterRestart || afterRestart.energyMovement !== 10 || afterRestart.foundationXp !== 12) {
    throw new Error('profile did not survive reconnect');
  }
  await restarted.$disconnect();

  const statusRes = await json(await fetch(`${http.origin}/api/app/status?version=1.0.0.7.73`));
  evidence.push({
    step: 'app_status_flag',
    status: statusRes.status,
    mediWorldEnabled: statusRes.body?.settings?.mediWorldEnabled ?? null,
  });

  console.log(JSON.stringify({ ok: true, evidence }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message, evidence }));
  process.exitCode = 1;
} finally {
  if (http) await http.close().catch(() => undefined);
  if (owner) await prisma.user.delete({ where: { id: owner.id } }).catch(() => undefined);
  if (other) await prisma.user.delete({ where: { id: other.id } }).catch(() => undefined);
  await prisma.$disconnect();
}
