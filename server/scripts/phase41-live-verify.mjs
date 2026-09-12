/**
 * Phase 41 live local API + disposable database verification.
 * Hits the already-running local API. Never prints the URL or credentials.
 * Does not touch production.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
if (!process.env.PHASE38_TEST_DATABASE_URL) {
  console.error('BLOCKED: PHASE38_TEST_DATABASE_URL is not set');
  process.exit(2);
}
process.env.DATABASE_URL = process.env.PHASE38_TEST_DATABASE_URL;
process.env.MEDI_WORLD_ENABLED = '1';

const bcrypt = (await import('bcryptjs')).default;
const { PrismaClient } = await import('@prisma/client');

const origin = process.env.PHASE41_LIVE_ORIGIN || 'http://127.0.0.1:4000';
const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: ['error'] });
const stamp = Date.now();
const ownerEmail = `phase41.live.${stamp}@medicard.test`;
const otherEmail = `phase41.other.${stamp}@medicard.test`;
const password = 'Phase41LivePass1!';
const evidence = [];

async function json(res) {
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: { raw: text.slice(0, 200) } };
  }
}

function auth(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

try {
  const owner = await db.user.create({
    data: { email: ownerEmail, fullName: 'Phase41 Live Owner', passwordHash: await bcrypt.hash(password, 12) },
  });
  const other = await db.user.create({
    data: { email: otherEmail, fullName: 'Phase41 Live Other', passwordHash: await bcrypt.hash(password, 12) },
  });
  await db.hydrationPreference.create({ data: { userId: owner.id, goalMl: 2000 } });
  await db.stepTrackingCapability.create({ data: { userId: owner.id, status: 'AVAILABLE', source: 'APPLE_HEALTH' } });

  const loginOwner = await json(await fetch(`${origin}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ownerEmail, password }),
  }));
  const loginOther = await json(await fetch(`${origin}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: otherEmail, password }),
  }));
  const ownerToken = loginOwner.body?.token;
  const otherToken = loginOther.body?.token;
  if (!ownerToken || !otherToken) throw new Error('login failed');

  const unauth = await json(await fetch(`${origin}/api/medi-world/adventure/today`));
  evidence.push({ name: 'unauth', status: unauth.status });

  const first = await json(await fetch(`${origin}/api/medi-world/adventure/today`, { headers: auth(ownerToken) }));
  const again = await json(await fetch(`${origin}/api/medi-world/adventure/today`, { headers: auth(ownerToken) }));
  evidence.push({
    name: 'idempotent-get',
    status: first.status,
    samePeriod: first.body?.adventure?.periodKey === again.body?.adventure?.periodKey,
    ruleset: first.body?.adventure?.rulesetId,
    leakedReason: JSON.stringify(first.body).includes('reasonCodes'),
  });

  const otherGet = await json(await fetch(`${origin}/api/medi-world/adventure/today`, { headers: auth(otherToken) }));
  evidence.push({
    name: 'idor',
    otherStatus: otherGet.status,
    differentUser: first.body?.adventure?.periodKey && otherGet.body?.adventure?.periodKey
      ? true
      : otherGet.status >= 400,
  });

  const inject = await json(await fetch(`${origin}/api/medi-world/adventure/today/swap`, {
    method: 'POST',
    headers: auth(ownerToken),
    body: JSON.stringify({ slotKey: 'anchor', idempotencyKey: 'x', target: 99999, category: 'movement' }),
  }));
  evidence.push({ name: 'target-injection', status: inject.status });

  const rest = await json(await fetch(`${origin}/api/medi-world/adventure/today/rest-day`, {
    method: 'POST',
    headers: auth(ownerToken),
    body: JSON.stringify({}),
  }));
  evidence.push({ name: 'rest-day', status: rest.status, restDay: rest.body?.adventure?.restDay === true });

  console.log(JSON.stringify({ ok: true, evidence }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
