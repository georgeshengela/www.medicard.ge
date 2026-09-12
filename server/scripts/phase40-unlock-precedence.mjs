/**
 * Phase 40 cosmetic unlock error-precedence live check.
 * Disposable local API + Postgres only. Does not change unlock behavior.
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
const { setWorldXpForTests } = await import('../src/lib/mediWorld/engine.js');

const origin = process.env.PHASE40_LIVE_ORIGIN || 'http://127.0.0.1:4000';
const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: ['error'] });
const stamp = Date.now();
const email = `phase40.prec.${stamp}@medicard.test`;
const password = 'Phase40PrecPass1!';

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
  const user = await db.user.create({
    data: { email, fullName: 'Phase40 Precedence', passwordHash: await bcrypt.hash(password, 12) },
  });
  const login = await json(await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }));
  const token = login.body?.token;
  if (!token) throw new Error('login failed');
  await json(await fetch(`${origin}/api/medi-world/companion`, { headers: auth(token) }));
  await setWorldXpForTests(user.id, 225, { db, now: new Date() });
  await db.mediWorldProfile.update({
    where: { userId: user.id },
    data: { energyHydration: 5, energyCalm: 40 },
  });

  const locked = await json(await fetch(`${origin}/api/medi-world/companion/cosmetics/trail_movement_pulse/unlock`, {
    method: 'POST', headers: auth(token), body: JSON.stringify({ idempotencyKey: `lock-${stamp}` }),
  }));
  const insufficient = await json(await fetch(`${origin}/api/medi-world/companion/cosmetics/aura_hydration_wave/unlock`, {
    method: 'POST', headers: auth(token), body: JSON.stringify({ idempotencyKey: `low-${stamp}` }),
  }));
  await db.mediWorldProfile.update({ where: { userId: user.id }, data: { energyHydration: 40 } });
  const first = await json(await fetch(`${origin}/api/medi-world/companion/cosmetics/aura_hydration_wave/unlock`, {
    method: 'POST', headers: auth(token), body: JSON.stringify({ idempotencyKey: `own-${stamp}` }),
  }));
  const owned = await json(await fetch(`${origin}/api/medi-world/companion/cosmetics/aura_hydration_wave/unlock`, {
    method: 'POST', headers: auth(token), body: JSON.stringify({ idempotencyKey: `own2-${stamp}` }),
  }));
  await setWorldXpForTests(user.id, 550, { db, now: new Date() });
  const conflict = await json(await fetch(`${origin}/api/medi-world/companion/cosmetics/aura_calm_glow/unlock`, {
    method: 'POST', headers: auth(token), body: JSON.stringify({ idempotencyKey: `own-${stamp}` }),
  }));

  const out = {
    ok: true,
    levelLocked: { status: locked.status, code: locked.body?.code || locked.body?.error },
    insufficient: { status: insufficient.status, code: insufficient.body?.code || insufficient.body?.error },
    alreadyOwned: { status: owned.status, alreadyOwned: owned.body?.unlock?.alreadyOwned, charged: first.body?.unlock?.charged },
    conflict: { status: conflict.status, code: conflict.body?.code || conflict.body?.error },
  };
  console.log(JSON.stringify(out, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
