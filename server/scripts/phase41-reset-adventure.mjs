import { PrismaClient } from '@prisma/client';
import { completeQuest } from '../src/lib/quest.js';
import { getTodayAdventure } from '../src/lib/mediWorld/adventure/service.js';

const url = process.env.PHASE38_TEST_DATABASE_URL;
const db = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
const mode = process.argv[2] || 'three';
const now = new Date();
const opts = { db, now, timezone: 'Asia/Tbilisi' };

try {
  const user = await db.user.findUnique({ where: { email: 'world.qa@medicard.test' } });
  if (!user) throw new Error('qa user missing');
  if (mode !== 'finish') {
    await db.mediWorldAdventureSwap.deleteMany({ where: { adventure: { userId: user.id } } });
    await db.mediWorldAdventureSlot.deleteMany({ where: { adventure: { userId: user.id } } });
    await db.mediWorldDailyAdventure.deleteMany({ where: { userId: user.id } });
  }
  if (mode === 'one') {
    await db.stepTrackingCapability.upsert({
      where: { userId: user.id },
      update: { status: 'AVAILABLE' },
      create: { userId: user.id, status: 'AVAILABLE', source: 'APPLE_HEALTH' },
    });
    await db.hydrationPreference.deleteMany({ where: { userId: user.id } });
    await db.mediWorldAdventurePreference.upsert({
      where: { userId: user.id },
      update: { intensity: 'active', allowVariety: true, enabledCategories: ['movement'] },
      create: { userId: user.id, intensity: 'active', allowVariety: true, enabledCategories: ['movement'] },
    });
  } else if (mode === 'recovery') {
    await db.stepTrackingCapability.upsert({
      where: { userId: user.id },
      update: { status: 'UNKNOWN' },
      create: { userId: user.id, status: 'UNKNOWN', source: 'APPLE_HEALTH' },
    });
    await db.hydrationPreference.deleteMany({ where: { userId: user.id } });
    await db.mediWorldAdventurePreference.upsert({
      where: { userId: user.id },
      update: {
        intensity: 'gentle',
        allowVariety: false,
        enabledCategories: ['calm'],
        preferredRestWeekdays: [6],
      },
      create: {
        userId: user.id,
        intensity: 'gentle',
        allowVariety: false,
        enabledCategories: ['calm'],
        preferredRestWeekdays: [6],
      },
    });
  } else {
    await db.stepTrackingCapability.upsert({
      where: { userId: user.id },
      update: { status: 'AVAILABLE' },
      create: { userId: user.id, status: 'AVAILABLE', source: 'APPLE_HEALTH' },
    });
    await db.hydrationPreference.upsert({
      where: { userId: user.id },
      update: { goalMl: 2000 },
      create: { userId: user.id, goalMl: 2000 },
    });
    await db.mediWorldAdventurePreference.upsert({
      where: { userId: user.id },
      update: {
        intensity: 'active',
        allowVariety: true,
        enabledCategories: ['movement', 'hydration', 'care'],
        preferredRestWeekdays: [],
        showTargets: mode === 'partial' || mode === 'complete' || mode === 'finish',
      },
      create: {
        userId: user.id,
        intensity: 'active',
        allowVariety: true,
        enabledCategories: ['movement', 'hydration', 'care'],
        preferredRestWeekdays: [],
        showTargets: mode === 'partial' || mode === 'complete' || mode === 'finish',
      },
    });
  }

  let extra = {};
  if (mode === 'complete' || mode === 'finish' || mode === 'partial') {
    const userPeriod = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Tbilisi' }).slice(0, 10);
    await db.userQuest.updateMany({
      where: { userId: user.id, periodKey: userPeriod, status: 'CANCELLED' },
      data: { status: 'ACTIVE' },
    });
  }
  if (mode === 'partial' || mode === 'complete' || mode === 'finish' || mode === 'recovery') {
    const today = await getTodayAdventure(user.id, opts);
    extra = {
      periodKey: today.adventure.periodKey,
      status: today.adventure.status,
      slots: today.adventure.slots.map((slot) => ({
        slotKey: slot.slotKey,
        capabilityKey: slot.capabilityKey,
        status: slot.status,
        progress: slot.progress,
        target: slot.target,
        userQuestId: slot.userQuestId,
        required: slot.required,
      })),
    };
    if (mode === 'partial' || mode === 'complete' || mode === 'finish') {
      const questSlots = today.adventure.slots.filter((slot) => slot.userQuestId && slot.required && slot.status !== 'swapped');
      for (const slot of questSlots) {
        const quest = await db.userQuest.findUnique({ where: { id: slot.userQuestId } });
        if (!quest) continue;
        if (mode === 'partial') {
          if (quest.target <= 1) continue;
          const next = Math.max(1, Math.min(quest.target - 1, Math.floor(quest.target / 2) || 1));
          await db.userQuest.update({ where: { id: quest.id }, data: { progress: next } });
          extra.partialQuestId = quest.id;
          extra.partialProgress = next;
          extra.partialTarget = quest.target;
          break;
        }
        extra.questStatuses = extra.questStatuses || [];
        extra.questStatuses.push({ id: quest.id, status: quest.status, progress: quest.progress, target: quest.target });
        if (quest.status !== 'ACTIVE') continue;
        await db.userQuest.update({ where: { id: quest.id }, data: { progress: quest.target } });
        try {
          const done = await completeQuest(user.id, quest.id, opts);
          extra.completed = extra.completed || [];
          extra.completed.push({ id: quest.id, completed: done.completed, already: done.alreadyCompleted });
        } catch (err) {
          extra.completed = extra.completed || [];
          extra.completed.push({ id: quest.id, error: err.message, status: err.status });
        }
      }
      const careSlots = today.adventure.slots.filter(
        (slot) => slot.capabilityKey === 'companion.care_moment' && slot.required && slot.status !== 'swapped',
      );
      if (mode === 'complete' && careSlots.length) {
        await db.mediCompanionProfile.upsert({
          where: { userId: user.id },
          update: { lastCareMomentPeriodKey: today.adventure.periodKey },
          create: { userId: user.id, lastCareMomentPeriodKey: today.adventure.periodKey },
        });
      }
      const after = await getTodayAdventure(user.id, opts);
      extra.status = after.adventure.status;
      extra.complete = after.adventure.completion.complete;
      extra.ledger = await db.mediWorldLedger.count({
        where: { userId: user.id, sourceType: 'QUEST_COMPLETION' },
      });
    }
  }
  console.log(JSON.stringify({ ok: true, mode, ...extra }));
} finally {
  await db.$disconnect();
}
