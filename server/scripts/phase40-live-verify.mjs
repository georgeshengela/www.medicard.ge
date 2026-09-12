/**
 * Phase 40 live local API + disposable database verification.
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
const { setWorldXpForTests } = await import('../src/lib/mediWorld/engine.js');

const origin = process.env.PHASE40_LIVE_ORIGIN || 'http://127.0.0.1:4000';
const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: ['error'] });
const stamp = Date.now();
const ownerEmail = `phase40.live.${stamp}@medicard.test`;
const otherEmail = `phase40.other.${stamp}@medicard.test`;
const password = 'Phase40LivePass1!';
let owner = null;
let other = null;
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

function sanitizeCompanion(body) {
  return {
    enabled: body?.enabled ?? null,
    name: body?.companion?.displayName || null,
    stage: body?.companion?.worldStageKey || null,
    bondLevel: body?.companion?.bond?.bondLevel ?? null,
    bondPoints: body?.companion?.bond?.bondPoints ?? null,
    aura: body?.companion?.equipment?.aura || null,
    careMoment: body?.companion?.careMoment?.canComplete ?? null,
    owned: (body?.catalog || []).filter((row) => row.owned).map((row) => row.key),
    hydration: body?.world?.careEnergy?.hydration ?? null,
    unlockCharged: body?.unlock?.charged ?? null,
  };
}

try {
  owner = await db.user.create({
    data: {
      email: ownerEmail,
      fullName: 'Phase40 Live Owner',
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  other = await db.user.create({
    data: {
      email: otherEmail,
      fullName: 'Phase40 Live Other',
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  const loginOwner = await json(
    await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerEmail, password }),
    }),
  );
  const loginOther = await json(
    await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otherEmail, password }),
    }),
  );
  if (!loginOwner.body?.token || !loginOther.body?.token) {
    throw new Error(`login failed: ${loginOwner.status}/${loginOther.status}`);
  }
  const ownerToken = loginOwner.body.token;
  const otherToken = loginOther.body.token;
  evidence.push({ step: 'login', status: loginOwner.status });

  const unauth = await json(await fetch(`${origin}/api/medi-world/companion`));
  evidence.push({ step: 'unauthenticated_GET', status: unauth.status });
  if (unauth.status !== 401) throw new Error(`expected 401, got ${unauth.status}`);

  const first = await json(await fetch(`${origin}/api/medi-world/companion`, { headers: auth(ownerToken) }));
  evidence.push({ step: 'lazy_GET', status: first.status, companion: sanitizeCompanion(first.body) });
  if (first.status !== 200) throw new Error(`lazy GET failed: ${first.status}`);
  if (first.body.companion.worldStageKey !== 'spark') throw new Error('expected spark');
  if (first.body.companion.bond.bondPoints < 6) throw new Error('expected visit+spark Bond');
  const companionId = first.body.companion.id;

  const again = await json(await fetch(`${origin}/api/medi-world/companion`, { headers: auth(ownerToken) }));
  if (again.body.companion.id !== companionId) throw new Error('companion id changed');
  if (again.body.companion.bond.bondPoints !== first.body.companion.bond.bondPoints) {
    throw new Error('visit Bond was not idempotent');
  }

  const renamed = await json(
    await fetch(`${origin}/api/medi-world/companion`, {
      method: 'PATCH',
      headers: auth(ownerToken),
      body: JSON.stringify({ displayName: 'ნათება' }),
    }),
  );
  evidence.push({ step: 'rename', status: renamed.status, name: renamed.body.companion?.displayName });
  if (renamed.body.companion.displayName !== 'ნათება') throw new Error('rename failed');
  if (renamed.body.companion.bond.bondPoints !== first.body.companion.bond.bondPoints) {
    throw new Error('rename reset Bond');
  }

  const moment = await json(
    await fetch(`${origin}/api/medi-world/companion/care-moment`, {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({ interactionKey: 'greet' }),
    }),
  );
  evidence.push({
    step: 'care_moment',
    status: moment.status,
    canComplete: moment.body.companion?.careMoment?.canComplete,
    bond: moment.body.companion?.bond?.bondPoints,
  });
  if (moment.body.companion.careMoment.canComplete !== false) throw new Error('care moment not consumed');
  const momentRetry = await json(
    await fetch(`${origin}/api/medi-world/companion/care-moment`, {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({ interactionKey: 'breathe' }),
    }),
  );
  if (momentRetry.body.companion.bond.bondPoints !== moment.body.companion.bond.bondPoints) {
    throw new Error('care moment retry awarded Bond');
  }

  const now = new Date('2026-09-12T12:00:00+04:00');
  await setWorldXpForTests(owner.id, 225, { db, now });
  await db.mediWorldProfile.update({
    where: { userId: owner.id },
    data: { energyHydration: 40, energyCalm: 5 },
  });

  const locked = await json(
    await fetch(`${origin}/api/medi-world/companion/cosmetics/trail_movement_pulse/unlock`, {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({ idempotencyKey: `trail-${stamp}` }),
    }),
  );
  evidence.push({ step: 'locked_unlock', status: locked.status, code: locked.body?.code || locked.body?.error });
  if (locked.status < 400) throw new Error('locked cosmetic should reject');

  const clientPrice = await json(
    await fetch(`${origin}/api/medi-world/companion/cosmetics/aura_hydration_wave/unlock`, {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({ idempotencyKey: `priced-${stamp}`, price: 1, energyType: 'calm' }),
    }),
  );
  evidence.push({ step: 'client_price_rejected', status: clientPrice.status, code: clientPrice.body?.code });
  if (clientPrice.status < 400) throw new Error('client price injection must be rejected');

  const unlock = await json(
    await fetch(`${origin}/api/medi-world/companion/cosmetics/aura_hydration_wave/unlock`, {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({ idempotencyKey: `unlock-${stamp}` }),
    }),
  );
  evidence.push({ step: 'unlock', status: unlock.status, companion: sanitizeCompanion(unlock.body) });
  if (unlock.status !== 200 || !unlock.body.unlock?.charged) throw new Error('unlock did not charge');
  if (unlock.body.world.careEnergy.hydration !== 10) throw new Error('hydration not debited 30');

  const retry = await json(
    await fetch(`${origin}/api/medi-world/companion/cosmetics/aura_hydration_wave/unlock`, {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({ idempotencyKey: `unlock-${stamp}` }),
    }),
  );
  if (retry.body.unlock?.charged) throw new Error('retry charged again');
  if (retry.body.world.careEnergy.hydration !== 10) throw new Error('retry changed balance');

  const conflict = await json(
    await fetch(`${origin}/api/medi-world/companion/cosmetics/aura_calm_glow/unlock`, {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({ idempotencyKey: `unlock-${stamp}` }),
    }),
  );
  evidence.push({ step: 'idempotency_conflict', status: conflict.status, code: conflict.body?.code });
  if (conflict.status < 400) throw new Error('conflicting idempotency should fail');

  const insufficient = await json(
    await fetch(`${origin}/api/medi-world/companion/cosmetics/aura_calm_glow/unlock`, {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({ idempotencyKey: `calm-${stamp}` }),
    }),
  );
  evidence.push({ step: 'insufficient', status: insufficient.status, code: insufficient.body?.code });
  if (insufficient.status < 400) throw new Error('insufficient energy should reject');

  const equip = await json(
    await fetch(`${origin}/api/medi-world/companion/equipment`, {
      method: 'PUT',
      headers: auth(ownerToken),
      body: JSON.stringify({ slot: 'aura', catalogKey: 'aura_hydration_wave' }),
    }),
  );
  if (equip.body.companion.equipment.aura !== 'aura_hydration_wave') throw new Error('equip failed');
  const unequip = await json(
    await fetch(`${origin}/api/medi-world/companion/equipment`, {
      method: 'PUT',
      headers: auth(ownerToken),
      body: JSON.stringify({ slot: 'aura', catalogKey: null }),
    }),
  );
  if (unequip.body.companion.equipment.aura !== 'aura_teal_origin') throw new Error('default aura not restored');

  const otherGet = await json(await fetch(`${origin}/api/medi-world/companion`, { headers: auth(otherToken) }));
  if (otherGet.body.companion.id === companionId) throw new Error('IDOR: other saw owner companion');
  if (otherGet.body.catalog.find((row) => row.key === 'aura_hydration_wave')?.owned) {
    throw new Error('IDOR: other owned owner cosmetic');
  }

  const spend = await json(
    await fetch(`${origin}/api/medi-world/spend`, {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({ energyType: 'hydration', amount: 1 }),
    }),
  );
  evidence.push({ step: 'no_public_spend', status: spend.status });
  if (spend.status !== 404) throw new Error(`spend route should 404, got ${spend.status}`);

  const blob = JSON.stringify(unlock.body);
  if (blob.includes('idempotencyKey') || blob.includes('intentFingerprint')) {
    throw new Error('companion payload leaked internal keys');
  }

  const persisted = await db.mediCompanionProfile.findUnique({ where: { userId: owner.id } });
  const restarted = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: ['error'] });
  const afterRestart = await restarted.mediCompanionProfile.findUnique({ where: { userId: owner.id } });
  const owned = await restarted.mediCompanionCosmeticOwn.count({
    where: { userId: owner.id, catalogKey: 'aura_hydration_wave' },
  });
  evidence.push({
    step: 'restart_persistence',
    name: afterRestart?.displayName || null,
    bond: afterRestart?.bondPoints ?? null,
    sameName: afterRestart?.displayName === persisted.displayName,
    owned,
  });
  if (!afterRestart || afterRestart.displayName !== 'ნათება' || owned !== 1) {
    throw new Error('companion did not persist');
  }
  await restarted.$disconnect();

  console.log(JSON.stringify({ ok: true, evidence }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message, evidence }));
  process.exitCode = 1;
} finally {
  if (owner) {
    await db.mediCompanionBondEvent.deleteMany({ where: { userId: owner.id } }).catch(() => undefined);
    await db.mediCompanionCosmeticOwn.deleteMany({ where: { userId: owner.id } }).catch(() => undefined);
    await db.mediCompanionWorldStageUnlock.deleteMany({ where: { userId: owner.id } }).catch(() => undefined);
    await db.mediWorldLedger.deleteMany({ where: { userId: owner.id } }).catch(() => undefined);
    await db.mediWorldProfile.deleteMany({ where: { userId: owner.id } }).catch(() => undefined);
    await db.mediCompanionProfile.deleteMany({ where: { userId: owner.id } }).catch(() => undefined);
    await db.user.delete({ where: { id: owner.id } }).catch(() => undefined);
  }
  if (other) {
    await db.mediCompanionBondEvent.deleteMany({ where: { userId: other.id } }).catch(() => undefined);
    await db.mediCompanionCosmeticOwn.deleteMany({ where: { userId: other.id } }).catch(() => undefined);
    await db.mediCompanionWorldStageUnlock.deleteMany({ where: { userId: other.id } }).catch(() => undefined);
    await db.mediWorldLedger.deleteMany({ where: { userId: other.id } }).catch(() => undefined);
    await db.mediWorldProfile.deleteMany({ where: { userId: other.id } }).catch(() => undefined);
    await db.mediCompanionProfile.deleteMany({ where: { userId: other.id } }).catch(() => undefined);
    await db.user.delete({ where: { id: other.id } }).catch(() => undefined);
  }
  await db.$disconnect();
}
