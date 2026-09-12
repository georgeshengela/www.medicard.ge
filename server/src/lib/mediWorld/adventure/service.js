/**
 * Medi World Phase 41 — Daily Adventure service.
 * Orchestrates canonical Quest assignment/completion. Never awards World currency.
 */

import { prisma as defaultPrisma } from '../../prisma.js';
import { assignDailyQuests } from '../../quest.js';
import { getEffectiveQuestTimezone } from '../../questTime.js';
import { isUsableStepCapability, loadStepCapabilityStatus } from '../../stepCapability.js';
import { assertWorldPayloadSafe } from '../privacy.js';
import {
  ensureMediWorldProfile,
  isPrismaMissing,
  isUniqueViolation,
  resolveWorldDailyPeriodKey,
  worldSchemaUnavailableError,
} from '../engine.js';
import { isMediWorldEnabled, mediWorldDisabledError } from '../flags.js';
import { worldProgressFromXp } from '../ruleset.js';
import { planAdventure, planReplacement } from './engine.js';
import { companionReactionKey, narrativeKeyForState } from './narrative.js';
import {
  ADVENTURE_CATEGORIES,
  ADVENTURE_INTENSITIES,
  ADVENTURE_RULESET_ID,
  DEFAULT_ADVENTURE_PREFERENCES,
  MAX_SWAPS_PER_DAY,
  MOVEMENT_MODES,
  activeCapabilities,
  capabilityByKey,
  capabilityForTemplate,
  compatibleWithMovementMode,
} from './registry.js';

function dbOf(options = {}) {
  return options.db || defaultPrisma;
}

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function adventureTablesReady(db) {
  return (
    typeof db?.mediWorldAdventurePreference?.upsert === 'function' &&
    typeof db?.mediWorldDailyAdventure?.create === 'function' &&
    typeof db?.mediWorldAdventureSlot?.create === 'function' &&
    typeof db?.mediWorldAdventureSwap?.create === 'function'
  );
}

function reportMissing(context, error) {
  const msg = `[medi-world] adventure schema missing (${context})`;
  if (error) console.warn(msg, error?.message || error);
  else console.warn(msg);
}

async function lockAdventure(tx, userId) {
  if (typeof tx?.$executeRaw !== 'function') return;
  await tx.$executeRaw`SELECT 1 FROM "User" WHERE id = ${userId} FOR UPDATE`.catch(() => 0);
}

async function withAdventureTx(options, fn) {
  const db = dbOf(options);
  if (!isMediWorldEnabled(options.flags)) throw mediWorldDisabledError();
  if (!adventureTablesReady(db)) {
    reportMissing('adventure_tx');
    throw worldSchemaUnavailableError();
  }
  try {
    if (typeof db?.$transaction === 'function') return db.$transaction((tx) => fn(tx));
    return fn(db);
  } catch (error) {
    if (isPrismaMissing(error)) {
      reportMissing('adventure_tx', error);
      throw worldSchemaUnavailableError();
    }
    throw error;
  }
}

function asStringArray(value, allowlist) {
  const list = Array.isArray(value) ? value : [];
  const allow = new Set(allowlist);
  return [...new Set(list.map((item) => String(item)).filter((item) => allow.has(item)))];
}

function asWeekdays(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map((item) => Number(item)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort(
    (a, b) => a - b,
  );
}

function weekdayFromPeriodKey(periodKey) {
  const [y, m, d] = String(periodKey || '').split('-').map(Number);
  if (!y || !m || !d) return 0;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function normalizeAdventurePreferences(raw = {}) {
  const intensity = ADVENTURE_INTENSITIES.includes(raw.intensity) ? raw.intensity : DEFAULT_ADVENTURE_PREFERENCES.intensity;
  const enabledCategories = asStringArray(raw.enabledCategories, ADVENTURE_CATEGORIES);
  const movementMode = MOVEMENT_MODES.includes(raw.movementMode) ? raw.movementMode : DEFAULT_ADVENTURE_PREFERENCES.movementMode;
  return {
    intensity,
    enabledCategories: enabledCategories.length ? enabledCategories : [...DEFAULT_ADVENTURE_PREFERENCES.enabledCategories],
    allowVariety: raw.allowVariety !== false,
    preferredRestWeekdays: asWeekdays(raw.preferredRestWeekdays),
    reducedPressureLanguage: raw.reducedPressureLanguage !== false,
    showTargets: raw.showTargets === true,
    movementMode,
  };
}

function publicPreferences(row) {
  return normalizeAdventurePreferences(row || {});
}

async function ensurePreferences(tx, userId) {
  const defaults = normalizeAdventurePreferences();
  const existing = await tx.mediWorldAdventurePreference.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    return await tx.mediWorldAdventurePreference.create({
      data: {
        userId,
        ...defaults,
        enabledCategories: defaults.enabledCategories,
        preferredRestWeekdays: defaults.preferredRestWeekdays,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return tx.mediWorldAdventurePreference.findUnique({ where: { userId } });
  }
}

async function hydrationEligible(tx, userId) {
  if (typeof tx?.hydrationPreference?.findUnique !== 'function') return false;
  const row = await tx.hydrationPreference.findUnique({ where: { userId } });
  return Number(row?.goalMl) > 0;
}

async function stepsEligible(tx, userId) {
  const status = await loadStepCapabilityStatus(tx, userId);
  return isUsableStepCapability(status);
}

async function listEligibleCapabilities(tx, userId, prefs) {
  const out = [];
  for (const cap of activeCapabilities()) {
    if (!prefs.enabledCategories.includes(cap.energyType)) continue;
    if (!compatibleWithMovementMode(cap, prefs.movementMode)) continue;
    if (cap.questTemplateKey === 'daily_steps' && !(await stepsEligible(tx, userId))) continue;
    if (cap.questTemplateKey === 'daily_hydration' && !(await hydrationEligible(tx, userId))) continue;
    if (cap.key === 'companion.care_moment' && typeof tx?.mediCompanionProfile?.findUnique !== 'function') continue;
    out.push(cap);
  }
  return out;
}

function capabilityKeyFromQuest(quest) {
  const templateKey = quest?.template?.key || quest?.templateKey;
  return capabilityForTemplate(templateKey)?.key || null;
}

async function loadAssignedDaily(tx, userId, periodKey) {
  if (typeof tx?.userQuest?.findMany !== 'function') return [];
  const rows = await tx.userQuest.findMany({
    where: { userId, periodKey },
    include: { template: true },
  });
  return rows
    .filter((row) => row.template?.cadence === 'DAILY')
    .filter((row) => row.status !== 'CANCELLED' && row.status !== 'EXPIRED')
    .map((row) => ({
      userQuestId: row.id,
      templateKey: row.template?.key,
      capabilityKey: capabilityKeyFromQuest(row),
      status: row.status,
      progress: row.progress,
      target: row.target,
    }))
    .filter((row) => row.capabilityKey);
}

async function recentHistory(tx, userId, periodKey) {
  const rows = await tx.mediWorldDailyAdventure.findMany({
    where: { userId },
    orderBy: { periodKey: 'desc' },
    take: 8,
    include: { slots: true },
  });
  const prior = rows.filter((row) => row.periodKey !== periodKey);
  const recentCategories = [];
  const recentOutcomes = {};
  let missStreak = 0;
  let completeStreak = 0;
  let countingMiss = true;
  let countingComplete = true;
  for (const adventure of prior) {
    const required = (adventure.slots || []).filter((slot) => slot.required && slot.status !== 'swapped');
    const cats = [...new Set(required.map((slot) => capabilityByKey(slot.capabilityKey)?.energyType).filter(Boolean))];
    recentCategories.push(...cats);
    const allDone = required.length > 0 && required.every((slot) => slot.status === 'completed');
    if (countingMiss) {
      if (!allDone) missStreak += 1;
      else countingMiss = false;
    }
    if (countingComplete) {
      if (allDone) completeStreak += 1;
      else countingComplete = false;
    }
    for (const slot of required) {
      const key = slot.capabilityKey;
      if (!recentOutcomes[key]) recentOutcomes[key] = { completed: 0, missed: 0 };
      if (slot.status === 'completed') recentOutcomes[key].completed += 1;
      else if (slot.status !== 'swapped') recentOutcomes[key].missed += 1;
    }
  }
  return { recentCategories, recentOutcomes, recentMissStreak: missStreak, recentCompleteStreak: completeStreak };
}

async function bindQuestId(tx, userId, periodKey, capabilityKey) {
  const cap = capabilityByKey(capabilityKey);
  if (!cap?.questTemplateKey) return null;
  const assigned = await loadAssignedDaily(tx, userId, periodKey);
  const match = assigned.find((row) => row.capabilityKey === capabilityKey);
  return match?.userQuestId || null;
}

async function persistPlan(tx, { userId, periodKey, timezone, plan, now }) {
  let adventure;
  try {
    adventure = await tx.mediWorldDailyAdventure.create({
      data: {
        userId,
        periodKey,
        timezone,
        restDay: plan.restDay,
        restDayActivatedAt: plan.restDay ? now : null,
        status: plan.restDay ? 'rest_day' : 'available',
        swapCount: 0,
        reasonCodes: plan.reasonCodes,
        narrativeKey: plan.narrativeKey,
        rulesetVersion: plan.rulesetVersion || ADVENTURE_RULESET_ID,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return tx.mediWorldDailyAdventure.findUnique({
      where: { userId_periodKey: { userId, periodKey } },
      include: { slots: true, swaps: true },
    });
  }
  for (const slot of plan.slots) {
    const userQuestId = await bindQuestId(tx, userId, periodKey, slot.capabilityKey);
    await tx.mediWorldAdventureSlot.create({
      data: {
        adventureId: adventure.id,
        slotKey: slot.slotKey,
        optionKey: slot.optionKey,
        capabilityKey: slot.capabilityKey,
        userQuestId,
        status: slot.selected ? 'selected' : 'available',
        selected: slot.selected !== false && slot.slotKey !== 'choice' ? true : Boolean(slot.selected),
        required: Boolean(slot.required),
      },
    });
  }
  return tx.mediWorldDailyAdventure.findUnique({
    where: { id: adventure.id },
    include: { slots: true, swaps: true },
  });
}

function questCompleted(quest) {
  return quest?.status === 'COMPLETED' || quest?.status === 'CLAIMED';
}

async function liveSlotState(tx, userId, periodKey, slot, options = {}) {
  if (slot.status === 'swapped') {
    return { status: 'swapped', progress: 0, target: null, userQuestId: slot.userQuestId };
  }
  if (slot.slotKey === 'choice' && !slot.selected && !options.includeUnselected) {
    return { status: 'available', progress: 0, target: null, userQuestId: slot.userQuestId };
  }
  const cap = capabilityByKey(slot.capabilityKey);
  if (cap?.key === 'companion.care_moment') {
    const companion = typeof tx?.mediCompanionProfile?.findUnique === 'function'
      ? await tx.mediCompanionProfile.findUnique({ where: { userId } })
      : null;
    const done = companion?.lastCareMomentPeriodKey === periodKey;
    return {
      status: done ? 'completed' : slot.selected ? 'selected' : 'available',
      progress: done ? 1 : 0,
      target: 1,
      userQuestId: null,
    };
  }
  if (slot.userQuestId && typeof tx?.userQuest?.findUnique === 'function') {
    const quest = await tx.userQuest.findUnique({ where: { id: slot.userQuestId } });
    if (quest && quest.userId === userId) {
      if (quest.status === 'CANCELLED' || quest.status === 'EXPIRED') {
        const reboundId = await bindQuestId(tx, userId, periodKey, slot.capabilityKey);
        if (reboundId && reboundId !== quest.id && slot.id && typeof tx?.mediWorldAdventureSlot?.update === 'function') {
          await tx.mediWorldAdventureSlot.update({
            where: { id: slot.id },
            data: { userQuestId: reboundId },
          });
          return liveSlotState(tx, userId, periodKey, { ...slot, userQuestId: reboundId }, options);
        }
        return {
          status: 'unavailable',
          progress: 0,
          target: quest.target,
          userQuestId: quest.id,
        };
      }
      if (questCompleted(quest)) return { status: 'completed', progress: quest.progress, target: quest.target, userQuestId: quest.id };
      if ((quest.progress || 0) > 0) return { status: 'in_progress', progress: quest.progress, target: quest.target, userQuestId: quest.id };
      return {
        status: slot.selected ? 'selected' : 'available',
        progress: quest.progress || 0,
        target: quest.target,
        userQuestId: quest.id,
      };
    }
  }
  return {
    status: slot.selected ? 'selected' : 'available',
    progress: 0,
    target: null,
    userQuestId: slot.userQuestId,
  };
}

async function reconcileAdventure(tx, adventure, { userId, periodKey, now }) {
  if (adventure.status === 'expired' || adventure.periodKey !== periodKey) {
    if (adventure.status !== 'expired' && typeof tx?.mediWorldDailyAdventure?.update === 'function') {
      await tx.mediWorldDailyAdventure.update({
        where: { id: adventure.id },
        data: { status: 'expired' },
      });
    }
    return { ...adventure, status: 'expired' };
  }
  const slots = adventure.slots || [];
  const live = [];
  for (const slot of slots) {
    const next = await liveSlotState(tx, userId, periodKey, slot);
    if (next.status !== slot.status) {
      await tx.mediWorldAdventureSlot.update({
        where: { id: slot.id },
        data: { status: next.status },
      });
    }
    live.push({ ...slot, ...next });
  }
  const required = live.filter((slot) => slot.required && slot.status !== 'swapped');
  const allRequiredDone = required.length > 0 && required.every((slot) => slot.status === 'completed');
  const anyProgress = required.some((slot) => slot.status === 'in_progress' || slot.status === 'completed');
  let status = adventure.restDay ? 'rest_day' : 'available';
  if (allRequiredDone) status = adventure.restDay ? 'rest_day' : 'completed';
  else if (anyProgress && !adventure.restDay) status = 'in_progress';
  if (required.length === 0 && adventure.restDay) status = 'rest_day';
  const completedAt = allRequiredDone ? adventure.completedAt || now : null;
  const storyEventKey = allRequiredDone ? 'adventure.day_complete' : adventure.storyEventKey;
  const reaction = companionReactionKey({
    restDay: adventure.restDay,
    completed: allRequiredDone,
    empty: required.length === 0 && (adventure.slots || []).length === 0,
  });
  const narrativeKey = narrativeKeyForState({
    restDay: adventure.restDay,
    completed: allRequiredDone,
    expired: false,
    empty: required.length === 0 && (adventure.slots || []).length === 0,
  });
  if (
    status !== adventure.status ||
    completedAt?.getTime?.() !== adventure.completedAt?.getTime?.() ||
    storyEventKey !== adventure.storyEventKey ||
    reaction !== adventure.companionReactionKey ||
    narrativeKey !== adventure.narrativeKey
  ) {
    await tx.mediWorldDailyAdventure.update({
      where: { id: adventure.id },
      data: {
        status,
        completedAt,
        storyEventKey,
        companionReactionKey: reaction,
        narrativeKey,
      },
    });
  }
  return {
    ...adventure,
    status,
    completedAt,
    storyEventKey,
    companionReactionKey: reaction,
    narrativeKey,
    slots: live,
  };
}

async function worldLevelOf(tx, userId) {
  const world = await ensureMediWorldProfile(userId, { db: tx }).catch(() => null);
  return worldProgressFromXp(world?.foundationXp || 0).level;
}

function publicSlot(slot, prefs, cap) {
  const showTargets = Boolean(prefs.showTargets) && slot.target != null;
  return {
    slotKey: slot.slotKey,
    optionKey: slot.optionKey,
    capabilityKey: slot.capabilityKey,
    energyType: cap?.energyType || null,
    locKey: cap?.locKey || slot.capabilityKey,
    status: slot.status,
    selected: Boolean(slot.selected),
    required: Boolean(slot.required),
    userQuestId: slot.userQuestId || null,
    progress: Number(slot.progress) || 0,
    target: showTargets ? Number(slot.target) || 0 : null,
    hasProgress: (Number(slot.progress) || 0) > 0 || slot.status === 'completed',
    href: cap?.key === 'companion.care_moment' ? '/medi-world/care-space' : '/medi-quest',
  };
}

function publicAdventure(adventure, prefs, extra = {}) {
  const slots = (adventure.slots || [])
    .slice()
    .sort((a, b) => `${a.slotKey}:${a.optionKey}`.localeCompare(`${b.slotKey}:${b.optionKey}`))
    .map((slot) => publicSlot(slot, prefs, capabilityByKey(slot.capabilityKey)));
  const required = slots.filter((slot) => slot.required && slot.status !== 'swapped');
  return assertWorldPayloadSafe({
    enabled: true,
    rulesetId: ADVENTURE_RULESET_ID,
    periodKey: adventure.periodKey,
    timezone: adventure.timezone,
    status: adventure.status,
    restDay: Boolean(adventure.restDay),
    expired: adventure.status === 'expired',
    swapCount: adventure.swapCount || 0,
    swapsRemaining: Math.max(0, MAX_SWAPS_PER_DAY - (adventure.swapCount || 0)),
    narrativeKey: adventure.narrativeKey,
    companionReactionKey: adventure.companionReactionKey || companionReactionKey({
      restDay: adventure.restDay,
      completed: adventure.status === 'completed',
      empty: slots.length === 0,
    }),
    completion: {
      complete: adventure.status === 'completed' || (adventure.restDay && required.length > 0 && required.every((s) => s.status === 'completed')),
      requiredCount: required.length,
      requiredCompleted: required.filter((slot) => slot.status === 'completed').length,
      completedAt: adventure.completedAt ? new Date(adventure.completedAt).toISOString() : null,
    },
    slots,
    worldLevel: extra.worldLevel || 1,
    companionStageKey: extra.companionStageKey || 'spark',
    stale: Boolean(extra.stale),
  });
}

async function withPreparedAdventureTx(userId, options, fn) {
  const clock = await prepareAdventureClock(userId, options);
  return withAdventureTx(options, (tx) => fn(tx, { ...options, clock }));
}

export async function getAdventurePreferences(userId, options = {}) {
  return withAdventureTx(options, async (tx) => {
    const prefs = await ensurePreferences(tx, userId);
    return assertWorldPayloadSafe({ enabled: true, preferences: publicPreferences(prefs) });
  });
}

export async function updateAdventurePreferences(userId, patch, options = {}) {
  const next = normalizeAdventurePreferences(patch);
  return withAdventureTx(options, async (tx) => {
    await ensurePreferences(tx, userId);
    const saved = await tx.mediWorldAdventurePreference.update({
      where: { userId },
      data: {
        intensity: next.intensity,
        enabledCategories: next.enabledCategories,
        allowVariety: next.allowVariety,
        preferredRestWeekdays: next.preferredRestWeekdays,
        reducedPressureLanguage: next.reducedPressureLanguage,
        showTargets: next.showTargets,
        movementMode: next.movementMode,
      },
    });
    return assertWorldPayloadSafe({ enabled: true, preferences: publicPreferences(saved) });
  });
}

async function prepareAdventureClock(userId, options = {}) {
  const db = dbOf(options);
  const timezone = getEffectiveQuestTimezone(options.user || {}, {
    timezone: options.timezone,
    deviceTimezone: options.deviceTimezone,
  });
  const now = options.now || new Date();
  const periodKey = await resolveWorldDailyPeriodKey(db, userId, now, timezone);
  try {
    await assignDailyQuests(userId, periodKey, options);
  } catch (error) {
    console.warn('[medi-world] adventure quest assign failed', error?.message);
  }
  return { periodKey, timezone, now };
}

async function expirePriorAdventures(tx, userId, periodKey) {
  if (typeof tx?.mediWorldDailyAdventure?.updateMany !== 'function') return 0;
  const result = await tx.mediWorldDailyAdventure.updateMany({
    where: {
      userId,
      periodKey: { not: periodKey },
      status: { not: 'expired' },
    },
    data: { status: 'expired' },
  });
  return result?.count || 0;
}

function assertMutableAdventure(adventure, periodKey) {
  if (!adventure) return;
  if (adventure.status === 'expired' || adventure.periodKey !== periodKey) {
    throw httpError('ეს გზა აღარ არის აქტიური.', 409, 'ADVENTURE_EXPIRED');
  }
}

async function generateToday(tx, userId, options) {
  const clock = options.clock || await prepareAdventureClock(userId, { ...options, db: tx });
  const { periodKey, timezone, now } = clock;
  await lockAdventure(tx, userId);
  await expirePriorAdventures(tx, userId, periodKey);
  const existing = await tx.mediWorldDailyAdventure.findUnique({
    where: { userId_periodKey: { userId, periodKey } },
    include: { slots: true, swaps: true },
  });
  if (existing) return { adventure: existing, periodKey, timezone, now };
  const prefs = publicPreferences(await ensurePreferences(tx, userId));
  const eligible = await listEligibleCapabilities(tx, userId, prefs);
  const assignedQuests = await loadAssignedDaily(tx, userId, periodKey);
  const history = await recentHistory(tx, userId, periodKey);
  const weekday = weekdayFromPeriodKey(periodKey);
  const restDay = Boolean(options.forceRestDay) || prefs.preferredRestWeekdays.includes(weekday);
  const plan = planAdventure({
    periodKey,
    intensity: prefs.intensity,
    allowVariety: prefs.allowVariety,
    eligible,
    assignedQuests,
    restDay,
    recentCategories: history.recentCategories,
    recentOutcomes: history.recentOutcomes,
    recentMissStreak: history.recentMissStreak,
    recentCompleteStreak: history.recentCompleteStreak,
  });
  const adventure = await persistPlan(tx, { userId, periodKey, timezone, plan, now });
  return { adventure, periodKey, timezone, now };
}

async function companionStage(tx, userId) {
  if (typeof tx?.mediCompanionProfile?.findUnique !== 'function') return 'spark';
  const row = await tx.mediCompanionProfile.findUnique({ where: { userId } });
  return row?.worldStageKey || 'spark';
}

async function readTodayPayload(tx, userId, options) {
  const generated = await generateToday(tx, userId, options);
  const reconciled = await reconcileAdventure(tx, generated.adventure, {
    userId,
    periodKey: generated.periodKey,
    now: generated.now,
  });
  const prefs = publicPreferences(await ensurePreferences(tx, userId));
  const worldLevel = await worldLevelOf(tx, userId);
  const companionStageKey = await companionStage(tx, userId);
  return {
    enabled: true,
    adventure: publicAdventure(reconciled, prefs, { worldLevel, companionStageKey }),
    preferences: prefs,
  };
}

export async function getTodayAdventure(userId, options = {}) {
  try {
    return await withPreparedAdventureTx(userId, options, async (tx, next) => readTodayPayload(tx, userId, next));
  } catch (error) {
    if (isUniqueViolation(error) || /25P02|current transaction is aborted/i.test(String(error?.message || ''))) {
      return withPreparedAdventureTx(userId, options, async (tx, next) => readTodayPayload(tx, userId, next));
    }
    throw error;
  }
}

export async function activateRestDay(userId, options = {}) {
  return withPreparedAdventureTx(userId, options, async (tx, next) => {
    const generated = await generateToday(tx, userId, next);
    const { adventure, periodKey, timezone, now } = generated;
    await lockAdventure(tx, userId);
    assertMutableAdventure(adventure, periodKey);
    if (adventure.restDay) {
      return readTodayPayload(tx, userId, next);
    }
    const prefs = publicPreferences(await ensurePreferences(tx, userId));
    const eligible = await listEligibleCapabilities(tx, userId, prefs);
    const assignedQuests = await loadAssignedDaily(tx, userId, periodKey);
    const history = await recentHistory(tx, userId, periodKey);
    const plan = planAdventure({
      periodKey,
      intensity: 'gentle',
      allowVariety: false,
      eligible,
      assignedQuests,
      restDay: true,
      recentCategories: history.recentCategories,
      recentOutcomes: history.recentOutcomes,
      recentMissStreak: history.recentMissStreak,
      recentCompleteStreak: history.recentCompleteStreak,
    });
    const currentRequired = (adventure.slots || []).filter((slot) => slot.required && slot.status === 'completed');
    const keepKeys = new Set(currentRequired.map((slot) => slot.capabilityKey));
    for (const slot of adventure.slots || []) {
      if (keepKeys.has(slot.capabilityKey) && slot.status === 'completed') continue;
      await tx.mediWorldAdventureSlot.update({
        where: { id: slot.id },
        data: { status: 'swapped', selected: false, required: false },
      });
    }
    for (const slot of plan.slots) {
      if (keepKeys.has(slot.capabilityKey)) continue;
      const userQuestId = await bindQuestId(tx, userId, periodKey, slot.capabilityKey);
      const existingSlot = (adventure.slots || []).find(
        (row) => row.slotKey === slot.slotKey && row.optionKey === slot.optionKey,
      );
      if (existingSlot) {
        await tx.mediWorldAdventureSlot.update({
          where: { id: existingSlot.id },
          data: {
            capabilityKey: slot.capabilityKey,
            userQuestId,
            status: 'selected',
            selected: true,
            required: false,
            swappedFromKey: existingSlot.capabilityKey,
          },
        });
      } else {
        await tx.mediWorldAdventureSlot.create({
          data: {
            adventureId: adventure.id,
            slotKey: slot.slotKey,
            optionKey: slot.optionKey,
            capabilityKey: slot.capabilityKey,
            userQuestId,
            status: 'selected',
            selected: true,
            required: false,
          },
        });
      }
    }
    await tx.mediWorldDailyAdventure.update({
      where: { id: adventure.id },
      data: {
        restDay: true,
        restDayActivatedAt: now,
        status: 'rest_day',
        reasonCodes: [...(Array.isArray(adventure.reasonCodes) ? adventure.reasonCodes : []), ...plan.reasonCodes],
        narrativeKey: plan.narrativeKey,
        timezone,
      },
    });
    return readTodayPayload(tx, userId, next);
  });
}

export async function selectAdventureChoice(userId, optionKey, options = {}) {
  if (!['a', 'b'].includes(optionKey)) {
    throw httpError('Unknown choice option.', 400, 'ADVENTURE_CHOICE_INVALID');
  }
  return withPreparedAdventureTx(userId, options, async (tx, next) => {
    const generated = await generateToday(tx, userId, next);
    const { adventure, periodKey } = generated;
    await lockAdventure(tx, userId);
    assertMutableAdventure(adventure, periodKey);
    const choices = (adventure.slots || []).filter((slot) => slot.slotKey === 'choice' && slot.status !== 'swapped');
    if (choices.length < 2) throw httpError('No choice is available today.', 400, 'ADVENTURE_CHOICE_UNAVAILABLE');
    const live = [];
    for (const slot of choices) live.push({ slot, live: await liveSlotState(tx, userId, periodKey, slot, { includeUnselected: true }) });
    const progressed = live.filter((row) => row.live.status === 'completed' || row.live.status === 'in_progress' || row.live.progress > 0);
    const selectedNow = live.find((row) => row.slot.selected);
    if (progressed.length && selectedNow && selectedNow.slot.optionKey !== optionKey) {
      throw httpError('This choice already has progress.', 409, 'ADVENTURE_CHOICE_LOCKED');
    }
    for (const row of live) {
      const selected = row.slot.optionKey === optionKey;
      await tx.mediWorldAdventureSlot.update({
        where: { id: row.slot.id },
        data: {
          selected,
          status: selected ? (row.live.status === 'available' ? 'selected' : row.live.status) : row.live.status,
        },
      });
    }
    return readTodayPayload(tx, userId, next);
  });
}

export async function swapAdventureSlot(userId, slotKey, idempotencyKey, options = {}) {
  if (!['anchor', 'balance'].includes(slotKey)) {
    throw httpError('That mission cannot be swapped.', 400, 'ADVENTURE_SWAP_INVALID');
  }
  const key = String(idempotencyKey || '').trim();
  if (!key || key.length > 180) throw httpError('Missing idempotency key.', 400, 'WORLD_IDEMPOTENCY');
  return withPreparedAdventureTx(userId, options, async (tx, next) => {
    const generated = await generateToday(tx, userId, next);
    const { adventure, periodKey } = generated;
    await lockAdventure(tx, userId);
    assertMutableAdventure(adventure, periodKey);
    const existingSwap = await tx.mediWorldAdventureSwap.findUnique({
      where: { adventureId_idempotencyKey: { adventureId: adventure.id, idempotencyKey: key } },
    });
    if (existingSwap) return readTodayPayload(tx, userId, next);
    if ((adventure.swapCount || 0) >= MAX_SWAPS_PER_DAY) {
      throw httpError('No more swaps today.', 400, 'ADVENTURE_SWAP_EXHAUSTED');
    }
    const slot = (adventure.slots || []).find((row) => row.slotKey === slotKey && row.optionKey === 'a' && row.status !== 'swapped');
    if (!slot) throw httpError('That mission cannot be swapped.', 400, 'ADVENTURE_SWAP_INVALID');
    const live = await liveSlotState(tx, userId, periodKey, slot);
    if (live.status === 'completed' || live.status === 'in_progress') {
      throw httpError('This mission already has progress.', 409, 'ADVENTURE_SWAP_LOCKED');
    }
    const prefs = publicPreferences(await ensurePreferences(tx, userId));
    const eligible = await listEligibleCapabilities(tx, userId, prefs);
    const usedKeys = (adventure.slots || [])
      .filter((row) => row.status !== 'swapped')
      .map((row) => row.capabilityKey);
    const history = await recentHistory(tx, userId, periodKey);
    const replacement = planReplacement({
      currentKey: slot.capabilityKey,
      usedKeys,
      eligible,
      recentCategories: history.recentCategories,
    });
    if (!replacement.ok) throw httpError('No other trusted mission fits today.', 400, 'ADVENTURE_NO_ALTERNATIVE');
    const userQuestId = await bindQuestId(tx, userId, periodKey, replacement.capabilityKey);
    try {
      await tx.mediWorldAdventureSwap.create({
        data: {
          adventureId: adventure.id,
          idempotencyKey: key,
          slotKey,
          fromCapability: slot.capabilityKey,
          toCapability: replacement.capabilityKey,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) return readTodayPayload(tx, userId, next);
      throw error;
    }
    await tx.mediWorldAdventureSlot.update({
      where: { id: slot.id },
      data: {
        capabilityKey: replacement.capabilityKey,
        userQuestId,
        status: 'selected',
        selected: true,
        swappedFromKey: slot.capabilityKey,
      },
    });
    await tx.mediWorldDailyAdventure.update({
      where: { id: adventure.id },
      data: {
        swapCount: { increment: 1 },
        reasonCodes: [
          ...(Array.isArray(adventure.reasonCodes) ? adventure.reasonCodes : []),
          replacement.reasonCode,
        ],
      },
    });
    return readTodayPayload(tx, userId, next);
  });
}

export async function syncAdventureAfterCanonicalChange(userId, options = {}) {
  const db = dbOf(options);
  if (!isMediWorldEnabled(options.flags)) return null;
  if (!adventureTablesReady(db)) return null;
  try {
    return withAdventureTx(options, async (tx) => {
      const timezone = getEffectiveQuestTimezone(options.user || {}, {
        timezone: options.timezone,
        deviceTimezone: options.deviceTimezone,
      });
      const now = options.now || new Date();
      const periodKey = await resolveWorldDailyPeriodKey(tx, userId, now, timezone);
      const adventure = await tx.mediWorldDailyAdventure.findUnique({
        where: { userId_periodKey: { userId, periodKey } },
        include: { slots: true, swaps: true },
      });
      if (!adventure) return null;
      await reconcileAdventure(tx, adventure, { userId, periodKey, now });
      return true;
    });
  } catch (error) {
    if (isPrismaMissing(error) || error?.code === 'WORLD_UNAVAILABLE' || error?.code === 'MEDI_WORLD_DISABLED') {
      return null;
    }
    console.warn('[medi-world] adventure reconcile hook failed', error?.message);
    return null;
  }
}
