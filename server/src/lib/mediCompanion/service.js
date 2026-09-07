import { prisma as defaultPrisma } from '../prisma.js';
import { getLevelForXp } from '../questLevels.js';
import { QUEST_TIMEZONE, resolveQuestClock } from '../questTime.js';
import {
  COMPANION_COSMETICS,
  COMPANION_EQUIP_SLOTS,
  JOURNEY_MILESTONES,
  cosmeticByKey,
  milestoneByKey,
} from './catalog.js';
import { journeyUnitsFromCompletions, resolveJourneyProgress, milestonesToUnlock } from './journeyMath.js';
import { resolveMediCompanionMood } from './mood.js';
import { resolveCompanionStage } from './stages.js';
import { publicCompanionPayload } from './privacy.js';
import { emitMediJourneyMilestoneUnlocked } from '../questRealtime.js';
import { recordServerProductEvent } from '../productEvents.js';

function dbOf(options = {}) {
  return options.db || defaultPrisma;
}

const DEFAULT_EQUIPMENT = Object.freeze({
  accent: 'COSMETIC_DEFAULT_ACCENT',
  accessory: null,
  background: 'COSMETIC_DEFAULT_BACKGROUND',
  decoration: null,
});

function localHourInTimezone(now, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    return Number(parts.find((p) => p.type === 'hour')?.value || 12);
  } catch {
    return now.getHours();
  }
}

async function sumXp(userId, db) {
  if (typeof db?.rewardLedger?.findMany !== 'function') return 0;
  const rows = await db.rewardLedger.findMany({ where: { userId, currency: 'XP' } });
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

export async function ensureMediCompanionProfile(userId, options = {}) {
  const db = dbOf(options);
  if (typeof db?.mediCompanionProfile?.upsert !== 'function') {
    return {
      userId,
      selectedCosmetics: { ...DEFAULT_EQUIPMENT },
      selectedEnvironmentKey: 'env.day',
    };
  }
  return db.mediCompanionProfile.upsert({
    where: { userId },
    create: {
      userId,
      selectedCosmetics: { ...DEFAULT_EQUIPMENT },
      selectedEnvironmentKey: 'env.day',
    },
    update: {},
  });
}

async function loadCompletionRows(userId, options = {}) {
  const db = dbOf(options);
  if (typeof db?.questCompletion?.findMany !== 'function') return [];
  return db.questCompletion.findMany({
    where: { userId },
    include: {
      userQuest: {
        include: { template: true },
      },
    },
  });
}

export async function calculateJourneyProgressForUser(userId, options = {}) {
  const rows = await loadCompletionRows(userId, options);
  const units = journeyUnitsFromCompletions(rows);
  return resolveJourneyProgress(units);
}

/**
 * Idempotent unlock of MediJourneyUnlock rows from derived units.
 * Never writes RewardLedger / XP / coins / achievements.
 */
export async function reconcileMediJourneyForUser(userId, options = {}) {
  const db = dbOf(options);
  const progress = await calculateJourneyProgressForUser(userId, options);
  let existing = [];
  if (typeof db?.mediJourneyUnlock?.findMany === 'function') {
    existing = await db.mediJourneyUnlock.findMany({ where: { userId } });
  }
  const have = existing.map((r) => r.milestoneKey);
  const toUnlock = milestonesToUnlock(progress.units, have);
  const newlyUnlocked = [];

  for (const milestone of toUnlock) {
    if (typeof db?.mediJourneyUnlock?.create !== 'function') {
      newlyUnlocked.push(milestone);
      continue;
    }
    try {
      const row = await db.mediJourneyUnlock.create({
        data: {
          userId,
          milestoneKey: milestone.key,
          unlockedAt: options.now || new Date(),
        },
      });
      newlyUnlocked.push({ ...milestone, unlockedAt: row.unlockedAt });
    } catch (error) {
      if (error?.code === 'P2002' || /unique/i.test(String(error?.message || ''))) continue;
      throw error;
    }
  }

  if (newlyUnlocked.length && options.silent === false) {
    for (const m of newlyUnlocked) {
      emitMediJourneyMilestoneUnlocked(userId, {
        milestoneKey: m.key,
        chapterKey: m.chapterKey,
        unlockedAt: m.unlockedAt || new Date().toISOString(),
      });
      try {
        await recordServerProductEvent({
          userId,
          kind: 'medi_journey_milestone_unlocked',
          entityId: m.key,
          category: m.chapterKey,
          source: 'companion',
        });
      } catch {
        /* optional */
      }
    }
  }

  const allKeys = [...new Set([...have, ...newlyUnlocked.map((m) => m.key)])];
  return {
    ...progress,
    unlockedMilestoneKeys: allKeys.sort(),
    newlyUnlockedKeys: newlyUnlocked.map((m) => m.key),
    aggregateUnlockCount: newlyUnlocked.length,
  };
}

async function loadQuestLevel(userId, options = {}) {
  const db = dbOf(options);
  if (typeof db?.rewardLedger?.findMany === 'function') {
    const totalXp = await sumXp(userId, db);
    return getLevelForXp(totalXp).level;
  }
  if (typeof db?.userQuestProfile?.findUnique === 'function') {
    const profile = await db.userQuestProfile.findUnique({ where: { userId } });
    return profile?.currentLevel || 1;
  }
  return 1;
}

async function loadSafeEngagementContext(userId, options = {}) {
  const db = dbOf(options);
  const now = options.now || new Date();
  const timezone = options.timezone || QUEST_TIMEZONE;
  const clock = resolveQuestClock(now, timezone);
  const localHour = localHourInTimezone(now, clock.timezone);

  let allDailyComplete = false;
  let meaningfulQuestProgress = false;

  if (typeof db?.userQuest?.findMany === 'function') {
    const dailies = await db.userQuest.findMany({
      where: { userId, periodKey: clock.today },
      include: { template: true },
    });
    const activeDailies = dailies.filter((q) => q.template?.cadence === 'DAILY' || !q.template);
    const actionable = activeDailies.filter((q) => ['ACTIVE', 'COMPLETED', 'CLAIMED'].includes(q.status));
    if (actionable.length) {
      allDailyComplete = actionable.every((q) => q.status === 'COMPLETED' || q.status === 'CLAIMED');
      meaningfulQuestProgress = actionable.some(
        (q) => q.status === 'ACTIVE' && q.target > 0 && q.progress / q.target >= 0.4,
      );
    }
  }

  return {
    localHour,
    allDailyComplete,
    meaningfulQuestProgress,
    isComeback: Boolean(options.isComeback),
    recentEventKey: options.recentEventKey || null,
    weatherKey: options.weatherKey || null,
    reducedMotion: Boolean(options.reducedMotion),
  };
}

function ownedCosmeticKeys(unlockedMilestoneKeys) {
  const owned = new Set(
    COMPANION_COSMETICS.filter((c) => c.unlockSource === 'DEFAULT').map((c) => c.key),
  );
  for (const mKey of unlockedMilestoneKeys) {
    const m = milestoneByKey(mKey);
    if (m?.cosmeticKey) owned.add(m.cosmeticKey);
  }
  return owned;
}

function sanitizeEquipment(raw, owned) {
  const out = { ...DEFAULT_EQUIPMENT };
  const src = raw && typeof raw === 'object' ? raw : {};
  for (const slot of COMPANION_EQUIP_SLOTS) {
    const key = src[slot];
    if (!key) {
      out[slot] = slot === 'accent' || slot === 'background' ? DEFAULT_EQUIPMENT[slot] : null;
      continue;
    }
    const cosmetic = cosmeticByKey(key);
    if (!cosmetic || !cosmetic.isActive || cosmetic.slot !== slot || !owned.has(key)) {
      out[slot] = DEFAULT_EQUIPMENT[slot] ?? null;
      continue;
    }
    out[slot] = key;
  }
  return out;
}

export async function getMediCompanionOverview(userId, options = {}) {
  await ensureMediCompanionProfile(userId, options);
  const reconcile = await reconcileMediJourneyForUser(userId, {
    ...options,
    silent: options.silent !== false,
  });
  const level = await loadQuestLevel(userId, options);
  const stage = resolveCompanionStage(level);
  const engagement = await loadSafeEngagementContext(userId, options);
  const mood = resolveMediCompanionMood(engagement);

  const db = dbOf(options);
  let profile = {
    selectedCosmetics: { ...DEFAULT_EQUIPMENT },
    selectedEnvironmentKey: mood.environmentKey,
  };
  if (typeof db?.mediCompanionProfile?.findUnique === 'function') {
    profile = (await db.mediCompanionProfile.findUnique({ where: { userId } })) || profile;
  }

  const owned = ownedCosmeticKeys(reconcile.unlockedMilestoneKeys);
  const equipment = sanitizeEquipment(profile.selectedCosmetics, owned);
  const collection = COMPANION_COSMETICS.filter((c) => c.isActive && owned.has(c.key)).map((c) => ({
    key: c.key,
    type: c.type,
    styleTier: c.styleTier,
    assetKey: c.visualKey || c.assetKey,
    visualKey: c.visualKey || c.assetKey,
    titleKey: c.titleKey,
    descriptionKey: c.descriptionKey,
    slot: c.slot,
    unlocked: true,
  }));

  const journeyMilestones = JOURNEY_MILESTONES.map((m) => ({
    key: m.key,
    at: m.at,
    chapterKey: m.chapterKey,
    titleKey: m.titleKey,
    descriptionKey: m.descriptionKey,
    major: m.major,
    unlocked: reconcile.unlockedMilestoneKeys.includes(m.key),
    cosmeticKey: m.cosmeticKey,
  }));

  const poseKey = equipment.accessory || `pose.${stage.toLowerCase()}`;

  return publicCompanionPayload({
    companion: {
      level,
      stage,
      moodKey: mood.moodKey,
      poseKey,
      environmentKey: profile.selectedEnvironmentKey || mood.environmentKey,
      messageKey: mood.messageKey,
      daypart: mood.daypart,
      reducedMotion: engagement.reducedMotion,
    },
    journey: {
      units: reconcile.units,
      chapterKey: reconcile.chapterKey,
      currentMilestoneKey: reconcile.currentMilestoneKey,
      nextMilestoneKey: reconcile.nextMilestoneKey,
      nextAt: reconcile.nextAt,
      milestones: journeyMilestones,
      newlyUnlockedKeys: reconcile.newlyUnlockedKeys || [],
      aggregateUnlockCount: reconcile.aggregateUnlockCount || 0,
    },
    equipment,
    collection,
    recentUnlocks: (reconcile.newlyUnlockedKeys || []).map((key) => ({
      kind: 'JOURNEY_MILESTONE',
      key,
    })),
  });
}

export async function getMediCompanionJourney(userId, options = {}) {
  const overview = await getMediCompanionOverview(userId, options);
  return {
    companion: {
      level: overview.companion.level,
      stage: overview.companion.stage,
      moodKey: overview.companion.moodKey,
    },
    journey: overview.journey,
  };
}

export async function getMediCompanionCollection(userId, options = {}) {
  const overview = await getMediCompanionOverview(userId, options);
  return {
    equipment: overview.equipment,
    collection: overview.collection,
  };
}

export async function updateMediCompanionEquipment(userId, patch = {}, options = {}) {
  const db = dbOf(options);
  await ensureMediCompanionProfile(userId, options);
  const progress = await calculateJourneyProgressForUser(userId, options);
  const owned = ownedCosmeticKeys(progress.unlockedMilestoneKeys);

  const current =
    typeof db?.mediCompanionProfile?.findUnique === 'function'
      ? await db.mediCompanionProfile.findUnique({ where: { userId } })
      : null;
  const next = sanitizeEquipment({ ...(current?.selectedCosmetics || {}), ...patch }, owned);

  for (const slot of COMPANION_EQUIP_SLOTS) {
    if (patch[slot] === undefined) continue;
    const key = patch[slot];
    if (key == null || key === '') {
      next[slot] = slot === 'accent' || slot === 'background' ? DEFAULT_EQUIPMENT[slot] : null;
      continue;
    }
    const cosmetic = cosmeticByKey(key);
    if (!cosmetic || !cosmetic.isActive) {
      const err = new Error('Invalid cosmetic.');
      err.status = 400;
      err.code = 'COMPANION_COSMETIC_INVALID';
      throw err;
    }
    if (cosmetic.slot !== slot) {
      const err = new Error('Cosmetic does not fit this slot.');
      err.status = 400;
      err.code = 'COMPANION_SLOT_MISMATCH';
      throw err;
    }
    if (!owned.has(key)) {
      const err = new Error('Cosmetic is locked.');
      err.status = 403;
      err.code = 'COMPANION_COSMETIC_LOCKED';
      throw err;
    }
    next[slot] = key;
  }

  if (typeof db?.mediCompanionProfile?.update === 'function') {
    await db.mediCompanionProfile.update({
      where: { userId },
      data: { selectedCosmetics: next },
    });
  }

  return { equipment: next };
}

/** Safe no-op hook after quest completion — never throws into quest engine. */
export async function reconcileMediJourneyAfterQuestSafe(userId, options = {}) {
  try {
    return await reconcileMediJourneyForUser(userId, { ...options, silent: false });
  } catch (error) {
    console.warn('[medi-companion] journey reconcile failed', error?.message);
    return null;
  }
}
