/**
 * Phase 9.3 — equip-only + next-milestone QuestCompletion E2E (idempotent).
 */
import { PrismaClient } from '@prisma/client';
import { refreshQuestProgressForUser } from '../src/lib/quest.js';
import { QuestSignal } from '../src/lib/questSignals.js';
import { reconcileMediJourneyForUser } from '../src/lib/mediCompanion/service.js';
import { getUserQuestDashboard } from '../src/lib/quest.js';

const prisma = new PrismaClient();
const BASE = process.env.API_BASE || 'http://127.0.0.1:4000';
const PHONE = process.env.PHASE93_PHONE || '+995500000005';

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function login() {
  await api('/api/auth/phone/start', { method: 'POST', body: { phone: PHONE } });
  const verify = await api('/api/auth/phone/verify', {
    method: 'POST',
    body: { phone: PHONE, code: '0000' },
  });
  if (!verify.json?.token) throw new Error(`login ${verify.status} ${JSON.stringify(verify.json)}`);
  return { token: verify.json.token, userId: verify.json.user.id };
}

async function unitsFor(userId) {
  const rows = await prisma.questCompletion.findMany({
    where: { userId },
    include: { userQuest: { include: { template: true } } },
  });
  return rows.reduce(
    (u, r) => u + (String(r.userQuest?.template?.cadence || 'DAILY').toUpperCase() === 'WEEKLY' ? 3 : 1),
    0,
  );
}

async function ensureUnits(userId, min) {
  const dailyTemplate = await prisma.questTemplate.findFirst({
    where: { key: 'daily_medi', isActive: true },
  });
  let u = await unitsFor(userId);
  let i = 900;
  while (u < min) {
    i += 1;
    const periodKey = `2025-p93b-${i}`;
    const quest = await prisma.userQuest.upsert({
      where: {
        userId_templateId_periodKey: { userId, templateId: dailyTemplate.id, periodKey },
      },
      create: {
        userId,
        templateId: dailyTemplate.id,
        periodKey,
        target: 1,
        progress: 1,
        status: 'COMPLETED',
        assignedAt: new Date('2025-04-01'),
        completedAt: new Date('2025-04-01'),
        expiresAt: new Date('2025-04-02'),
        metadata: { phase93b: true },
      },
      update: {},
    });
    await prisma.questCompletion.upsert({
      where: { userQuestId: quest.id },
      create: {
        userQuestId: quest.id,
        userId,
        completedAt: new Date('2025-04-01'),
        progressAtCompletion: 1,
        source: 'system',
      },
      update: {},
    });
    u = await unitsFor(userId);
  }
  return u;
}

async function main() {
  const { token, userId } = await login();
  const report = { phone: PHONE, userId, steps: {} };

  // Seed ownership: need >=12 units for all 4 cosmetic slots used below
  await ensureUnits(userId, 12);
  await reconcileMediJourneyForUser(userId, { silent: true });

  const slots = [
    ['accent', 'COSMETIC_MILESTONE_04'],
    ['accessory', 'COSMETIC_MILESTONE_03'],
    ['background', 'COSMETIC_MILESTONE_05'],
    ['decoration', 'COSMETIC_MILESTONE_02'],
  ];

  for (const [slot, key] of slots) {
    const put = await api('/api/medi-companion/equipment', {
      method: 'PUT',
      token,
      body: { [slot]: key },
    });
    if (put.status !== 200) throw new Error(`${slot} PUT ${put.status}`);
    const db = await prisma.mediCompanionProfile.findUnique({ where: { userId } });
    if (db?.selectedCosmetics?.[slot] !== key) throw new Error(`${slot} DB mismatch`);
    report.steps[`equip_${slot}`] = { ok: true, key, put: put.status };
  }

  const beforeFail = await prisma.mediCompanionProfile.findUnique({ where: { userId } });
  const bad = await api('/api/medi-companion/equipment', {
    method: 'PUT',
    token,
    body: { accessory: 'COSMETIC_DOES_NOT_EXIST' },
  });
  const afterFail = await prisma.mediCompanionProfile.findUnique({ where: { userId } });
  report.steps.equipFailure = {
    status: bad.status,
    code: bad.json?.code || bad.json?.error,
    unchanged:
      JSON.stringify(afterFail?.selectedCosmetics) === JSON.stringify(beforeFail?.selectedCosmetics),
  };
  if (bad.status < 400 || !report.steps.equipFailure.unchanged) {
    throw new Error('equip failure invariant broken');
  }

  const again = await login();
  const get = await api('/api/medi-companion/', { token: again.token });
  report.steps.persistRelogin = {
    ok: true,
    equipment: get.json?.equipment,
  };
  for (const [slot, key] of slots) {
    if (get.json?.equipment?.[slot] !== key) throw new Error(`persist ${slot}`);
  }

  // Position one unit before next milestone, then real MEDI_USED completion
  const ov = await api('/api/medi-companion/', { token: again.token });
  const nextAt = ov.json?.journey?.nextAt;
  const nextKey = ov.json?.journey?.nextMilestoneKey;
  if (nextAt == null) {
    report.steps.questE2E = { skipped: true, reason: 'journey complete' };
  } else {
    await ensureUnits(userId, nextAt - 1);
    await reconcileMediJourneyForUser(userId, { silent: true });

    const beforeKeys = new Set(
      (await prisma.mediJourneyUnlock.findMany({ where: { userId } })).map((u) => u.milestoneKey),
    );
    const ledgerBefore = await prisma.rewardLedger.count({ where: { userId } });
    const completionsBefore = await prisma.questCompletion.count({ where: { userId } });

    await getUserQuestDashboard(userId, { timezone: 'Asia/Tbilisi' });
    // Reset today's daily_medi so MEDI_USED can complete again (safe QA account).
    const todayQuest = await prisma.userQuest.findFirst({
      where: {
        userId,
        template: { key: 'daily_medi' },
        status: { in: ['ACTIVE', 'COMPLETED', 'CLAIMABLE'] },
      },
      orderBy: { assignedAt: 'desc' },
      include: { completions: true },
    });
    if (todayQuest) {
      await prisma.questCompletion.deleteMany({ where: { userQuestId: todayQuest.id } });
      await prisma.userQuest.update({
        where: { id: todayQuest.id },
        data: {
          status: 'ACTIVE',
          progress: 0,
          completedAt: null,
          claimedAt: null,
        },
      });
    }

    await prisma.aiInteraction.create({
      data: {
        userId,
        mode: 'DOCTOR',
        status: 'OK',
        latencyMs: 1,
        reasoningModel: 'phase93-qa',
        tokenUsage: { phase93: true },
      },
    });
    const refresh = await refreshQuestProgressForUser(userId, QuestSignal.MEDI_USED, {
      timezone: 'Asia/Tbilisi',
    });
    const recon1 = await reconcileMediJourneyForUser(userId, { silent: false });
    const recon2 = await reconcileMediJourneyForUser(userId, { silent: false });
    const afterUnlocks = await prisma.mediJourneyUnlock.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'desc' },
    });
    const newOnes = afterUnlocks.filter((u) => !beforeKeys.has(u.milestoneKey));
    const newly = recon1.newlyUnlockedKeys?.length
      ? recon1.newlyUnlockedKeys
      : newOnes.map((u) => u.milestoneKey);
    const dedupeIds = newly.map((k) => {
      const row = afterUnlocks.find((u) => u.milestoneKey === k);
      return `${k}:${row?.unlockedAt?.toISOString?.() || 'na'}`;
    });
    const ledgerAfter = await prisma.rewardLedger.count({ where: { userId } });
    const completionsAfter = await prisma.questCompletion.count({ where: { userId } });

    report.steps.questE2E = {
      nextAt,
      nextKey,
      unitsAfter: await unitsFor(userId),
      completionDelta: completionsAfter - completionsBefore,
      refreshCount: Array.isArray(refresh) ? refresh.length : null,
      newUnlocks: newOnes.map((u) => ({ key: u.milestoneKey, at: u.unlockedAt })),
      recon1Newly: recon1.newlyUnlockedKeys || [],
      recon2Newly: recon2.newlyUnlockedKeys || [],
      dedupeIds,
      ledgerDelta: ledgerAfter - ledgerBefore,
      ok:
        completionsAfter > completionsBefore &&
        newly.includes(nextKey) &&
        (recon2.newlyUnlockedKeys || []).length === 0,
    };
    if (!report.steps.questE2E.ok) throw new Error(`questE2E failed ${JSON.stringify(report.steps.questE2E)}`);
  }

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('PHASE93B_FAIL', e);
  await prisma.$disconnect();
  process.exit(1);
});
