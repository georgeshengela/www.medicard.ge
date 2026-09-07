/**
 * Phase 9.3 — create today's AiInteraction OK + MEDI_USED → completeQuest → journey unlock.
 */
import { PrismaClient } from '@prisma/client';
import { refreshQuestProgressForUser } from '../src/lib/quest.js';
import { QuestSignal } from '../src/lib/questSignals.js';
import { reconcileMediJourneyForUser } from '../src/lib/mediCompanion/service.js';
import { getUserQuestDashboard } from '../src/lib/quest.js';

const prisma = new PrismaClient();
const PHONE = process.env.PHASE93_PHONE || '+995500000005';

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
  const dailyTemplate = await prisma.questTemplate.findFirst({ where: { key: 'daily_medi', isActive: true } });
  let u = await unitsFor(userId);
  let i = 400;
  while (u < min) {
    i += 1;
    const periodKey = `2025-live2-${i}`;
    const quest = await prisma.userQuest.upsert({
      where: { userId_templateId_periodKey: { userId, templateId: dailyTemplate.id, periodKey } },
      create: {
        userId,
        templateId: dailyTemplate.id,
        periodKey,
        target: 1,
        progress: 1,
        status: 'COMPLETED',
        assignedAt: new Date('2025-03-01'),
        completedAt: new Date('2025-03-01'),
        expiresAt: new Date('2025-03-02'),
        metadata: { phase93: true },
      },
      update: {},
    });
    await prisma.questCompletion.upsert({
      where: { userQuestId: quest.id },
      create: {
        userQuestId: quest.id,
        userId,
        completedAt: new Date('2025-03-01'),
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
  const user = await prisma.user.findFirst({ where: { phone: PHONE } });
  if (!user) throw new Error('USER_NOT_FOUND');
  const userId = user.id;

  const prepared = await ensureUnits(userId, 16);
  await reconcileMediJourneyForUser(userId, { silent: true });

  // Ensure today's dashboard/assignment exists
  await getUserQuestDashboard(userId, { timezone: 'Asia/Tbilisi' });

  const todayQuest = await prisma.userQuest.findFirst({
    where: {
      userId,
      template: { key: 'daily_medi' },
      status: { in: ['ACTIVE', 'COMPLETED', 'CLAIMABLE'] },
    },
    include: { template: true, completions: true },
    orderBy: { assignedAt: 'desc' },
  });

  if (!todayQuest) throw new Error('NO_TODAY_DAILY_MEDI');

  // Real domain evidence for MEDI_DAILY_USE: AiInteraction OK today
  await prisma.aiInteraction.create({
    data: {
      userId,
      mode: 'DOCTOR',
      status: 'OK',
      latencyMs: 1,
      reasoningModel: 'phase93-qa',
      tokenUsage: { phase93: true },
      // Intentionally no userPrompt/assistantReply — privacy invariant for companion path
    },
  });

  const beforeUnlocks = await prisma.mediJourneyUnlock.findMany({ where: { userId } });
  const beforeKeys = new Set(beforeUnlocks.map((x) => x.milestoneKey));
  const completionsBefore = await prisma.questCompletion.count({ where: { userId } });
  const ledgerBefore = await prisma.rewardLedger.count({ where: { userId } });

  const refresh = await refreshQuestProgressForUser(userId, QuestSignal.MEDI_USED, {
    timezone: 'Asia/Tbilisi',
  });

  const completionsAfter = await prisma.questCompletion.count({ where: { userId } });
  const unitsAfter = await unitsFor(userId);

  // HTTP-equivalent second path
  const recon1 = await reconcileMediJourneyForUser(userId, { silent: false });
  const recon2 = await reconcileMediJourneyForUser(userId, { silent: false });

  const afterUnlocks = await prisma.mediJourneyUnlock.findMany({
    where: { userId },
    orderBy: { unlockedAt: 'desc' },
  });
  const newOnes = afterUnlocks.filter((x) => !beforeKeys.has(x.milestoneKey));
  const ledgerAfter = await prisma.rewardLedger.count({ where: { userId } });

  const newly = recon1.newlyUnlockedKeys?.length
    ? recon1.newlyUnlockedKeys
    : newOnes.map((x) => x.milestoneKey);

  const dedupeIds = newly.map((k) => {
    const row = afterUnlocks.find((u) => u.milestoneKey === k);
    return `${k}:${row?.unlockedAt?.toISOString?.() || 'na'}`;
  });

  const questAfter = await prisma.userQuest.findUnique({
    where: { id: todayQuest.id },
    include: { completions: true },
  });

  console.log(
    JSON.stringify(
      {
        todayQuest: {
          id: todayQuest.id,
          periodKey: todayQuest.periodKey,
          statusBefore: todayQuest.status,
          statusAfter: questAfter?.status,
          completions: questAfter?.completions?.length,
        },
        unitsPrepared: prepared,
        unitsAfter,
        completionDelta: completionsAfter - completionsBefore,
        refreshCount: Array.isArray(refresh) ? refresh.length : null,
        newUnlocks: newOnes.map((x) => ({ key: x.milestoneKey, at: x.unlockedAt })),
        recon1Newly: recon1.newlyUnlockedKeys,
        recon2Newly: recon2.newlyUnlockedKeys,
        dedupeIds,
        ledgerDelta: ledgerAfter - ledgerBefore,
        ok:
          completionsAfter > completionsBefore &&
          newly.includes('MILESTONE_06') &&
          (recon2.newlyUnlockedKeys || []).length === 0,
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('FAIL', e);
  await prisma.$disconnect();
  process.exit(1);
});
