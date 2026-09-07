/**
 * Phase 9.3 — live Companion equip + QuestCompletion → Journey E2E (local API).
 * Usage: node scripts/phase93-companion-live.mjs
 */
import { PrismaClient } from '@prisma/client';

const BASE = process.env.API_BASE || 'http://127.0.0.1:4000';
const PHONE = process.env.PHASE93_PHONE || '+995500000005';
const OTP = process.env.PHASE93_OTP || '0000';
const prisma = new PrismaClient();

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function login() {
  const start = await api('/api/auth/phone/start', { method: 'POST', body: { phone: PHONE } });
  assert(start.status === 200 || start.status === 201, `phone start ${start.status}`);
  const code = start.json?.devCode || OTP;
  const verify = await api('/api/auth/phone/verify', {
    method: 'POST',
    body: { phone: PHONE, code },
  });
  assert(verify.status === 200 && verify.json?.token, `verify ${verify.status} ${JSON.stringify(verify.json)}`);
  return { token: verify.json.token, userId: verify.json.user.id, otpUsed: code };
}

async function currentUnits(userId) {
  const rows = await prisma.questCompletion.findMany({
    where: { userId },
    include: { userQuest: { include: { template: true } } },
  });
  let units = 0;
  for (const row of rows) {
    const cadence = String(row?.userQuest?.template?.cadence || 'DAILY').toUpperCase();
    units += cadence === 'WEEKLY' ? 3 : 1;
  }
  return units;
}

async function ensureUnitsAtLeast(userId, minUnits) {
  const before = await currentUnits(userId);
  if (before >= minUnits) return { before, after: before, added: 0 };

  const dailyTemplate = await prisma.questTemplate.findFirst({
    where: { key: 'daily_medi', isActive: true },
  });
  if (!dailyTemplate) throw new Error('daily_medi template missing');

  let units = before;
  let added = 0;
  let i = 0;
  while (units < minUnits) {
    i += 1;
    const periodKey = `2025-qa-${String(i).padStart(3, '0')}`;
    const existing = await prisma.userQuest.findUnique({
      where: {
        userId_templateId_periodKey: {
          userId,
          templateId: dailyTemplate.id,
          periodKey,
        },
      },
    });
    if (existing) {
      const has = await prisma.questCompletion.findUnique({ where: { userQuestId: existing.id } });
      if (has) {
        units += 1;
        continue;
      }
    }
    const quest =
      existing ||
      (await prisma.userQuest.create({
        data: {
          userId,
          templateId: dailyTemplate.id,
          periodKey,
          target: 1,
          progress: 1,
          status: 'COMPLETED',
          assignedAt: new Date('2025-01-01T12:00:00Z'),
          completedAt: new Date('2025-01-01T12:00:00Z'),
          expiresAt: new Date('2025-01-02T12:00:00Z'),
          metadata: { phase93: true },
        },
      }));
    await prisma.questCompletion.upsert({
      where: { userQuestId: quest.id },
      create: {
        userQuestId: quest.id,
        userId,
        completedAt: new Date('2025-01-01T12:05:00Z'),
        progressAtCompletion: 1,
        source: 'system',
      },
      update: {},
    });
    units += 1;
    added += 1;
  }
  return { before, after: units, added };
}

async function seedOwnershipForEquip(userId) {
  // Need ≥12 units for MILESTONE_05 (background dawn) + earlier slots.
  const units = await ensureUnitsAtLeast(userId, 12);
  // Silent reconcile creates MediJourneyUnlock rows without toast spam (silent default true on GET).
  // Use API reconcile with silent=false only later for live celebration path.
  return units;
}

async function readEquipmentDb(userId) {
  const profile = await prisma.mediCompanionProfile.findUnique({
    where: { userId },
    select: { selectedCosmetics: true, updatedAt: true },
  });
  return profile;
}

async function countLedger(userId, since) {
  return prisma.rewardLedger.count({
    where: { userId, createdAt: { gte: since } },
  });
}

async function equipRoundTrip(token, userId, patch, label) {
  const beforeLedger = await countLedger(userId, new Date(Date.now() - 1000));
  const put = await api('/api/medi-companion/equipment', {
    method: 'PUT',
    token,
    body: patch,
  });
  assert(put.status === 200 && put.json?.ok, `${label} PUT failed ${put.status} ${JSON.stringify(put.json)}`);
  const db = await readEquipmentDb(userId);
  const slot = Object.keys(patch)[0];
  const expected = patch[slot];
  assert(db?.selectedCosmetics?.[slot] === expected, `${label} DB mismatch got ${JSON.stringify(db?.selectedCosmetics)}`);
  const get = await api('/api/medi-companion/', { token });
  assert(get.status === 200, `${label} GET overview ${get.status}`);
  assert(get.json?.equipment?.[slot] === expected, `${label} GET equipment mismatch`);
  const afterLedger = await countLedger(userId, new Date(Date.now() - 5000));
  const ledgerDeltaRecent = await prisma.rewardLedger.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - 3000) } },
  });
  assert(ledgerDeltaRecent === 0, `${label} unexpected RewardLedger rows during equip (${ledgerDeltaRecent})`);
  return { put: put.json, db: db.selectedCosmetics, beforeLedger, afterLedger };
}

async function equipFailure(token, userId) {
  const before = await readEquipmentDb(userId);
  const bad = await api('/api/medi-companion/equipment', {
    method: 'PUT',
    token,
    body: { accessory: 'COSMETIC_DOES_NOT_EXIST' },
  });
  assert(bad.status >= 400, `expected reject got ${bad.status}`);
  const after = await readEquipmentDb(userId);
  assert(
    JSON.stringify(after?.selectedCosmetics) === JSON.stringify(before?.selectedCosmetics),
    'equipment changed after failed PUT',
  );
  return { status: bad.status, body: bad.json };
}

async function questCompletionE2E(token, userId) {
  // Position one unit before next milestone if possible, then complete a real daily_medi.
  const beforeOv = await api('/api/medi-companion/', { token });
  let unitsBefore = beforeOv.json?.journey?.units ?? 0;
  const nextAt = beforeOv.json?.journey?.nextAt;
  const nextKey = beforeOv.json?.journey?.nextMilestoneKey;

  if (nextAt != null && unitsBefore < nextAt - 1) {
    await ensureUnitsAtLeast(userId, nextAt - 1);
    await api('/api/medi-companion/reconcile', { method: 'POST', token });
    const mid = await api('/api/medi-companion/', { token });
    unitsBefore = mid.json?.journey?.units ?? unitsBefore;
  }

  const beforeUnlocks = await prisma.mediJourneyUnlock.findMany({
    where: { userId },
    select: { milestoneKey: true, unlockedAt: true },
  });
  const beforeKeys = new Set(beforeUnlocks.map((u) => u.milestoneKey));
  const ledgerBefore = await prisma.rewardLedger.count({ where: { userId } });

  // Real domain signal
  const ai = await api('/api/ai/query', {
    method: 'POST',
    token,
    body: { message: 'გამარჯობა Medi — Phase 9.3 QA ping', mode: 'DOCTOR' },
  });

  const quests = await api('/api/quests?timezone=Asia%2FTbilisi', { token });
  assert(quests.status === 200, `quests ${quests.status}`);

  const tryClaimIds = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (
      node.id &&
      typeof node.id === 'string' &&
      (node.templateKey === 'daily_medi' ||
        node.key === 'daily_medi' ||
        node.questKey === 'daily_medi' ||
        node.status === 'CLAIMABLE' ||
        node.status === 'COMPLETED')
    ) {
      tryClaimIds.push(node.id);
    }
    Object.values(node).forEach(walk);
  };
  walk(quests.json);

  let claimed = null;
  for (const id of [...new Set(tryClaimIds)]) {
    const c = await api(`/api/quests/${id}/claim`, { method: 'POST', token });
    if (c.status === 200) {
      claimed = { id, status: c.status, keys: Object.keys(c.json || {}) };
      break;
    }
  }

  // Second path: HTTP reconcile (may echo unlocks already emitted on complete)
  const recon1 = await api('/api/medi-companion/reconcile', { method: 'POST', token });
  const recon2 = await api('/api/medi-companion/reconcile', { method: 'POST', token });
  assert(recon2.json?.newlyUnlockedKeys?.length === 0, 'second reconcile must not re-unlock');

  const afterUnlocks = await prisma.mediJourneyUnlock.findMany({
    where: { userId },
    orderBy: { unlockedAt: 'desc' },
  });
  const newOnes = afterUnlocks.filter((u) => !beforeKeys.has(u.milestoneKey));
  const afterOv = await api('/api/medi-companion/', { token });
  const unitsAfter = afterOv.json?.journey?.units ?? 0;
  const ledgerAfter = await prisma.rewardLedger.count({ where: { userId } });

  const newly = recon1.json?.newlyUnlockedKeys || [];
  const dedupeIds = newly.map((k) => {
    const row = afterUnlocks.find((u) => u.milestoneKey === k);
    return `${k}:${row?.unlockedAt?.toISOString?.() || 'na'}`;
  });

  return {
    aiStatus: ai.status,
    claimed,
    unitsBefore,
    unitsAfter,
    nextAt,
    nextKey,
    recon1: recon1.json,
    recon2: recon2.json,
    newUnlocks: newOnes.map((u) => ({
      milestoneKey: u.milestoneKey,
      unlockedAt: u.unlockedAt,
    })),
    newlyFromApi: newly,
    dedupeIds,
    ledgerDelta: ledgerAfter - ledgerBefore,
    completionCount: await prisma.questCompletion.count({ where: { userId } }),
  };
}

async function main() {
  const report = { phone: PHONE, base: BASE, steps: {} };
  const { token, userId, otpUsed } = await login();
  report.steps.login = { ok: true, userId, otpUsed };

  const seed = await seedOwnershipForEquip(userId);
  report.steps.seedOwnership = seed;
  // Silent reconcile via GET overview
  await api('/api/medi-companion/', { token });
  const reconSilent = await api('/api/medi-companion/reconcile', { method: 'POST', token });
  report.steps.reconcileAfterSeed = reconSilent.json;

  const t0 = new Date();
  const ledgerBefore = await prisma.rewardLedger.count({ where: { userId } });

  report.steps.equipAccent = await equipRoundTrip(
    token,
    userId,
    { accent: 'COSMETIC_MILESTONE_04' },
    'accent',
  );
  report.steps.equipAccessory = await equipRoundTrip(
    token,
    userId,
    { accessory: 'COSMETIC_MILESTONE_03' },
    'accessory',
  );
  report.steps.equipBackground = await equipRoundTrip(
    token,
    userId,
    { background: 'COSMETIC_MILESTONE_05' },
    'background',
  );
  report.steps.equipDecoration = await equipRoundTrip(
    token,
    userId,
    { decoration: 'COSMETIC_MILESTONE_02' },
    'decoration',
  );

  report.steps.equipFailure = await equipFailure(token, userId);

  // Persistence: re-login and GET
  const again = await login();
  const persisted = await api('/api/medi-companion/', { token: again.token });
  const eq = persisted.json?.equipment;
  assert(eq?.accent === 'COSMETIC_MILESTONE_04', 'persist accent');
  assert(eq?.accessory === 'COSMETIC_MILESTONE_03', 'persist accessory');
  assert(eq?.background === 'COSMETIC_MILESTONE_05', 'persist background');
  assert(eq?.decoration === 'COSMETIC_MILESTONE_02', 'persist decoration');
  const dbPersist = await readEquipmentDb(userId);
  report.steps.persistenceAfterRelogin = {
    ok: true,
    api: eq,
    db: dbPersist?.selectedCosmetics,
  };

  report.steps.questE2E = await questCompletionE2E(again.token, userId);

  const ledgerAfter = await prisma.rewardLedger.count({ where: { userId } });
  report.steps.economy = {
    ledgerBefore,
    ledgerAfter,
    delta: ledgerAfter - ledgerBefore,
    note: 'delta may include legitimate Quest claim rewards only',
  };

  // Reset equipment to defaults for cleanliness? keep equipped for UI QA
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('PHASE93_FAIL', e);
  await prisma.$disconnect();
  process.exit(1);
});
