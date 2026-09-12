/**
 * Phase 38.1 live local API + database verification.
 * Requires PHASE38_TEST_DATABASE_URL pointing at a disposable localhost/test Postgres.
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
const { randomUUID } = await import('node:crypto');
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
    level: body.profile.foundation?.level,
    careEnergy: body.profile.careEnergy,
    ledgerTypeSample: undefined,
  };
}

const stamp = Date.now();
const ownerEmail = `phase38.live.${stamp}@medicard.test`;
const otherEmail = `phase38.other.${stamp}@medicard.test`;
let owner = null;
let other = null;
let http = null;
const evidence = [];

try {
  owner = await prisma.user.create({
    data: {
      email: ownerEmail,
      fullName: 'Phase38 Live Owner',
      passwordHash: await bcrypt.hash('Phase38LivePass!', 12),
    },
  });
  other = await prisma.user.create({
    data: {
      email: otherEmail,
      fullName: 'Phase38 Live Other',
      passwordHash: await bcrypt.hash('Phase38LivePass!', 12),
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
  evidence.push({ step: 'unauthenticated_GET', status: unauth.status, code: unauth.body?.code || null });
  if (unauth.status !== 401) throw new Error(`expected 401, got ${unauth.status}`);

  const first = await json(await fetch(`${http.origin}/api/medi-world`, { headers: auth(ownerToken) }));
  evidence.push({ step: 'lazy_GET', status: first.status, profile: sanitizeProfile(first.body) });
  if (first.status !== 200) throw new Error(`lazy GET failed: ${first.status}`);
  const persisted = await prisma.mediWorldProfile.findUnique({ where: { userId: owner.id } });
  if (!persisted) throw new Error('lazy profile was not persisted');

  const ledgerEmpty = await json(await fetch(`${http.origin}/api/medi-world/ledger?take=5`, { headers: auth(ownerToken) }));
  evidence.push({ step: 'ledger_empty', status: ledgerEmpty.status, items: ledgerEmpty.body?.items?.length ?? null });

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
    step: 'quest_complete_once',
    completed: completed.completed,
    alreadyCompletedRetry: retry.alreadyCompleted,
    worldLedgerRows: worldRows.length,
    transactionType: worldRows[0]?.transactionType || null,
    energyAmount: worldRows[0]?.energyAmount ?? null,
  });
  if (!completed.completed || !retry.alreadyCompleted || worldRows.length !== 1) {
    throw new Error('quest world award was not exactly-once');
  }

  const after = await json(await fetch(`${http.origin}/api/medi-world`, { headers: auth(ownerToken) }));
  evidence.push({ step: 'GET_after_quest', status: after.status, profile: sanitizeProfile(after.body) });

  const page1 = await json(await fetch(`${http.origin}/api/medi-world/ledger?take=1`, { headers: auth(ownerToken) }));
  const cursor = page1.body?.nextCursor || null;
  const page2 = cursor
    ? await json(await fetch(`${http.origin}/api/medi-world/ledger?take=1&cursor=${encodeURIComponent(cursor)}`, { headers: auth(ownerToken) }))
    : { status: 200, body: { items: [] } };
  evidence.push({
    step: 'ledger_paging',
    status: page1.status,
    page1: page1.body?.items?.length ?? null,
    page2: page2.body?.items?.length ?? null,
    hasCursor: Boolean(cursor),
  });

  const otherGet = await json(await fetch(`${http.origin}/api/medi-world`, { headers: auth(otherToken) }));
  evidence.push({
    step: 'no_IDOR',
    otherMovement: otherGet.body?.profile?.careEnergy?.movement ?? null,
    ownerMovement: after.body?.profile?.careEnergy?.movement ?? null,
  });
  if ((otherGet.body?.profile?.careEnergy?.movement || 0) !== 0) throw new Error('IDOR: other user saw owner energy');

  const missingUser = await json(
    await fetch(`${http.origin}/api/medi-world/${other.id}`, { headers: auth(ownerToken) }),
  );
  evidence.push({ step: 'no_userId_route', status: missingUser.status });

  const foundation = await json(
    await fetch(`${http.origin}/api/medi-world/foundation-activity`, {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({
        sourceId: 'should-not-exist',
        idempotencyKey: `x-${stamp}`,
        adapterId: 'activity.walking',
        progressState: 'verified',
        personalTarget: 1500,
        completedAmount: 1500,
      }),
    }),
  );
  evidence.push({ step: 'foundation_activity_removed', status: foundation.status });
  if (foundation.status !== 404) throw new Error(`foundation-activity should 404, got ${foundation.status}`);

  const statusRes = await json(await fetch(`${http.origin}/api/app/status?version=1.0.0.7.72`));
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
