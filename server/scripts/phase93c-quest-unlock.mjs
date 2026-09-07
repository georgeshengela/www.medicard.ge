/**
 * Diagnose + complete today's daily_medi via MEDI_USED for Phase 9.3.
 */
import { PrismaClient } from '@prisma/client';
import { refreshQuestProgressForUser } from '../src/lib/quest.js';
import { QuestSignal } from '../src/lib/questSignals.js';
import { reconcileMediJourneyForUser } from '../src/lib/mediCompanion/service.js';
import { getUserQuestDashboard } from '../src/lib/quest.js';

const prisma = new PrismaClient();
const PHONE = '+995500000005';
const TZ = 'Asia/Tbilisi';

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
  let i = 1200;
  while (u < min) {
    i += 1;
    const periodKey = `2025-p93c-${i}`;
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
        assignedAt: new Date('2025-05-01'),
        completedAt: new Date('2025-05-01'),
        expiresAt: new Date('2025-05-02'),
        metadata: { phase93c: true },
      },
      update: {},
    });
    await prisma.questCompletion.upsert({
      where: { userQuestId: quest.id },
      create: {
        userQuestId: quest.id,
        userId,
        completedAt: new Date('2025-05-01'),
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
  if (!user) throw new Error('no user');
  const userId = user.id;

  const dash = await getUserQuestDashboard(userId, { timezone: TZ });
  const mediTemplate = await prisma.questTemplate.findFirst({ where: { key: 'daily_medi' } });
  const candidates = await prisma.userQuest.findMany({
    where: { userId, templateId: mediTemplate.id },
    orderBy: { assignedAt: 'desc' },
    take: 12,
    include: { completions: true },
  });

  // Prefer real today periodKey (YYYY-MM-DD), not seed keys
  let todayQuest =
    candidates.find((q) => /^\d{4}-\d{2}-\d{2}$/.test(q.periodKey) && q.status !== 'EXPIRED') ||
    candidates.find((q) => /^\d{4}-\d{2}-\d{2}$/.test(q.periodKey));

  const { calculateJourneyProgressForUser } = await import('../src/lib/mediCompanion/service.js');
  let progress = await calculateJourneyProgressForUser(userId);
  console.log(
    JSON.stringify(
      {
        dashKeys: Array.isArray(dash?.quests)
          ? dash.quests.map((q) => q.templateKey || q.key || q.template?.key)
          : Object.keys(dash || {}),
        picked: todayQuest && {
          id: todayQuest.id,
          periodKey: todayQuest.periodKey,
          status: todayQuest.status,
          progress: todayQuest.progress,
          completions: todayQuest.completions.length,
        },
        recent: candidates.slice(0, 6).map((q) => ({
          periodKey: q.periodKey,
          status: q.status,
          completions: q.completions.length,
        })),
        progress,
      },
      null,
      2,
    ),
  );

  if (!todayQuest || !/^\d{4}-\d{2}-\d{2}$/.test(todayQuest.periodKey)) {
    throw new Error('no calendar daily_medi for today');
  }

  // Reset TODAY first so historical seed can land exactly on nextAt-1.
  await prisma.questCompletion.deleteMany({ where: { userQuestId: todayQuest.id } });
  await prisma.userQuest.update({
    where: { id: todayQuest.id },
    data: { status: 'ACTIVE', progress: 0, completedAt: null, claimedAt: null },
  });

  progress = await calculateJourneyProgressForUser(userId);
  await ensureUnits(userId, progress.nextAt - 1);
  await reconcileMediJourneyForUser(userId, { silent: true });
  progress = await calculateJourneyProgressForUser(userId);

  const beforeKeys = new Set(
    (await prisma.mediJourneyUnlock.findMany({ where: { userId } })).map((u) => u.milestoneKey),
  );
  const completionsBefore = await prisma.questCompletion.count({ where: { userId } });

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
    timezone: TZ,
  });
  const recon1 = await reconcileMediJourneyForUser(userId, { silent: false });
  const recon2 = await reconcileMediJourneyForUser(userId, { silent: false });
  const afterUnlocks = await prisma.mediJourneyUnlock.findMany({
    where: { userId },
    orderBy: { unlockedAt: 'desc' },
  });
  const newOnes = afterUnlocks.filter((u) => !beforeKeys.has(u.milestoneKey));
  const questAfter = await prisma.userQuest.findUnique({
    where: { id: todayQuest.id },
    include: { completions: true },
  });

  const result = {
    unitsBeforeComplete: progress.units,
    targetKey: progress.nextMilestoneKey,
    targetAt: progress.nextAt,
    refreshLen: Array.isArray(refresh) ? refresh.length : refresh,
    questAfter: {
      status: questAfter?.status,
      progress: questAfter?.progress,
      completions: questAfter?.completions?.length,
    },
    completionDelta: (await prisma.questCompletion.count({ where: { userId } })) - completionsBefore,
    unitsAfter: await unitsFor(userId),
    newUnlocks: newOnes.map((u) => ({
      key: u.milestoneKey,
      at: u.unlockedAt,
      dedupe: `${u.milestoneKey}:${u.unlockedAt.toISOString()}`,
    })),
    recon1Newly: recon1.newlyUnlockedKeys || [],
    recon2Newly: recon2.newlyUnlockedKeys || [],
    ok:
      questAfter?.status === 'COMPLETED' &&
      newOnes.some((u) => u.milestoneKey === progress.nextMilestoneKey) &&
      (recon2.newlyUnlockedKeys || []).length === 0,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
