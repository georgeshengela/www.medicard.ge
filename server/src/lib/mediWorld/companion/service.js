import { prisma as defaultPrisma } from '../../prisma.js';
import { dailyPeriodKey, getEffectiveQuestTimezone } from '../../questTime.js';
import { ensureMediCompanionProfile } from '../../mediCompanion/service.js';
import { assertWorldPayloadSafe } from '../privacy.js';
import {
  ensureMediWorldProfile,
  isPrismaMissing,
  isUniqueViolation,
  publicWorldProfile,
  resolveWorldDailyPeriodKey,
  worldSchemaUnavailableError,
} from '../engine.js';
import { debitCareEnergyInTx } from '../debit.js';
import { isMediWorldEnabled, mediWorldDisabledError } from '../flags.js';
import { worldProgressFromXp } from '../ruleset.js';
import { bondProgressFromPoints } from './bond.js';
import {
  awardCareMomentBondInTx,
  awardFirstVisitBondInTx,
  awardStageUnlockBondInTx,
} from './bondAwards.js';
import {
  COSMETIC_CATALOG,
  COSMETIC_CATALOG_VERSION,
  DEFAULT_AURA_KEY,
  cosmeticByKey,
  equippedFieldForSlot,
  isCosmeticSlot,
} from './catalog.js';
import { isCareMomentKey, resolveCareDialogue } from './dialogue.js';
import {
  WORLD_EVOLUTION_RULESET_VERSION,
  WORLD_EVOLUTION_STAGES,
  evolutionStageByKey,
  eligibleEvolutionStages,
} from './evolution.js';
import { publicCompanionName, sanitizeCompanionDisplayName } from './names.js';

function dbOf(options = {}) {
  return options.db || defaultPrisma;
}

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function companionTablesReady(db) {
  return (
    typeof db?.mediCompanionProfile?.upsert === 'function' &&
    typeof db?.mediCompanionWorldStageUnlock?.create === 'function' &&
    typeof db?.mediCompanionBondEvent?.create === 'function' &&
    typeof db?.mediCompanionCosmeticOwn?.create === 'function'
  );
}

function reportMissing(context, error) {
  const msg = `[medi-world] companion schema missing (${context})`;
  if (error) console.warn(msg, error?.message || error);
  else console.warn(msg);
}

async function lockCompanion(tx, userId) {
  if (typeof tx?.$executeRaw === 'function') {
    await tx.$executeRaw`SELECT 1 FROM "MediCompanionProfile" WHERE "userId" = ${userId} FOR UPDATE`.catch(() => 0);
  }
}

async function withCompanionTx(options, fn) {
  const db = dbOf(options);
  if (!isMediWorldEnabled(options.flags)) throw mediWorldDisabledError();
  if (!companionTablesReady(db)) {
    reportMissing('companion_tx');
    throw worldSchemaUnavailableError();
  }
  try {
    if (typeof db?.$transaction === 'function') return db.$transaction((tx) => fn(tx));
    return fn(db);
  } catch (error) {
    if (isPrismaMissing(error)) {
      reportMissing('companion_tx', error);
      throw worldSchemaUnavailableError();
    }
    throw error;
  }
}

export async function ensureCompanionWorldState(userId, options = {}) {
  const db = dbOf(options);
  if (!companionTablesReady(db)) {
    reportMissing('companion_ensure');
    throw worldSchemaUnavailableError();
  }
  const companion = await ensureMediCompanionProfile(userId, options);
  const world = await ensureMediWorldProfile(userId, options);
  if (world && companion?.id && world.companionProfileId !== companion.id) {
    await db.mediWorldProfile.update({
      where: { userId },
      data: { companionProfileId: companion.id },
    }).catch(() => null);
  }
  const owned = await db.mediCompanionCosmeticOwn.findUnique({
    where: { userId_catalogKey: { userId, catalogKey: DEFAULT_AURA_KEY } },
  }).catch(() => null);
  if (!owned) {
    try {
      await db.mediCompanionCosmeticOwn.create({
        data: { userId, catalogKey: DEFAULT_AURA_KEY, catalogVersion: COSMETIC_CATALOG_VERSION },
      });
    } catch (error) {
      if (!isUniqueViolation(error) && !isPrismaMissing(error)) throw error;
    }
  }
  return {
    companion: await db.mediCompanionProfile.findUnique({ where: { userId } }),
    world: await db.mediWorldProfile.findUnique({ where: { userId } }),
  };
}

async function syncEvolution(tx, userId, worldLevel, options = {}) {
  const eligible = eligibleEvolutionStages(worldLevel);
  const newly = [];
  for (const stage of eligible) {
    const existing = await tx.mediCompanionWorldStageUnlock.findUnique({
      where: { userId_stageKey: { userId, stageKey: stage.key } },
    }).catch(() => null);
    if (existing) continue;
    try {
      await tx.mediCompanionWorldStageUnlock.create({
        data: {
          userId,
          stageKey: stage.key,
          worldLevelAtUnlock: worldLevel,
          rulesetVersion: WORLD_EVOLUTION_RULESET_VERSION,
          unlockedAt: options.now || new Date(),
        },
      });
      await awardStageUnlockBondInTx(tx, userId, stage.key, options);
      newly.push(stage.key);
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      if (isPrismaMissing(error)) return newly;
      throw error;
    }
  }
  return newly;
}

function publicEquipment(row) {
  return {
    aura: row?.equippedAuraKey || DEFAULT_AURA_KEY,
    trail: row?.equippedTrailKey || null,
    charm: row?.equippedCharmKey || null,
    care_space_accent: row?.equippedAccentKey || null,
  };
}

function publicCatalog(ownedKeys, worldLevel, unlockedStages) {
  const owned = new Set(ownedKeys);
  const unlocked = new Set(unlockedStages);
  return COSMETIC_CATALOG.filter((item) => item.active || owned.has(item.key)).map((item) => {
    const stageOk = !item.stageKey || unlocked.has(item.stageKey);
    const levelOk = worldLevel >= item.worldLevel;
    return {
      key: item.key,
      slot: item.slot,
      energyType: item.energyType,
      price: item.price,
      worldLevel: item.worldLevel,
      stageKey: item.stageKey,
      active: item.active,
      owned: owned.has(item.key),
      eligible: item.defaultOwned || (item.active && levelOk && stageOk),
      presentationKey: item.presentationKey,
      nameKey: item.nameKey,
      descriptionKey: item.descriptionKey,
      fallbackLabel: item.fallbackLabel,
      catalogVersion: COSMETIC_CATALOG_VERSION,
    };
  });
}

function daysBetweenPeriod(a, b) {
  if (!a || !b) return 0;
  const aDate = Date.parse(`${a}T00:00:00Z`);
  const bDate = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(aDate) || Number.isNaN(bDate)) return 0;
  return Math.round((bDate - aDate) / 86_400_000);
}

async function readCompanionPayload(tx, userId, options, extras = {}) {
  const companion = await tx.mediCompanionProfile.findUnique({ where: { userId } });
  const world = await tx.mediWorldProfile.findUnique({ where: { userId } });
  const worldLevel = worldProgressFromXp(world?.foundationXp || 0).level;
  const timezone = getEffectiveQuestTimezone(options.user || {}, {
    timezone: options.timezone,
    deviceTimezone: options.deviceTimezone,
  });
  const now = options.now || new Date();
  const periodKey = extras.periodKey || dailyPeriodKey(now, timezone);
  const unlocks = await tx.mediCompanionWorldStageUnlock.findMany({ where: { userId } });
  const owns = await tx.mediCompanionCosmeticOwn.findMany({ where: { userId } });
  const ownedKeys = owns.map((row) => row.catalogKey);
  const unlockedStages = unlocks.map((row) => row.stageKey);
  const cosmeticUnlockedToday = owns.some((row) => {
    const raw = row.unlockedAt || row.createdAt;
    const at = raw instanceof Date ? raw : raw ? new Date(raw) : null;
    if (!at || Number.isNaN(at.getTime())) return false;
    return dailyPeriodKey(at, timezone) === periodKey && row.catalogKey !== DEFAULT_AURA_KEY;
  });
  const previousPeriod = extras.previousPeriod ?? companion?.lastWorldVisitPeriodKey ?? null;
  const firstVisitToday = Boolean(extras.firstVisitToday);
  const returnedAfterInactivity =
    Boolean(previousPeriod) && previousPeriod !== periodKey && daysBetweenPeriod(previousPeriod, periodKey) >= 2;
  const alreadyVisited = previousPeriod === periodKey && !firstVisitToday;
  const presentation = evolutionStageByKey(companion.worldStageKey) || evolutionStageByKey('spark');
  const bond = bondProgressFromPoints(companion.bondPoints);
  const careMomentDone = companion.lastCareMomentPeriodKey === periodKey;
  const newlyUnlockedStages = extras.newlyUnlockedStages || [];
  const payload = {
    companion: {
      id: companion.id,
      displayName: publicCompanionName(companion.displayName),
      worldStageKey: companion.worldStageKey,
      presentation,
      bond,
      equipment: publicEquipment(companion),
      careMoment: {
        canComplete: !careMomentDone,
        completedKey: careMomentDone ? companion.lastCareMomentKey : null,
        periodKey,
      },
    },
    world: {
      worldLevel,
      worldXp: worldProgressFromXp(world?.foundationXp || 0).worldXp,
      careEnergy: publicWorldProfile(world).careEnergy,
    },
    evolution: {
      stages: WORLD_EVOLUTION_STAGES.map((stage) => ({
        key: stage.key,
        worldLevel: stage.worldLevel,
        presentationKey: stage.presentationKey,
        unlocked: unlockedStages.includes(stage.key),
        selected: companion.worldStageKey === stage.key,
      })),
      newlyUnlocked: newlyUnlockedStages,
    },
    catalog: publicCatalog(ownedKeys, worldLevel, unlockedStages),
    dialogue: {
      key: resolveCareDialogue({
        firstVisitToday: firstVisitToday || !previousPeriod,
        alreadyVisited,
        newlyUnlockedStages,
        cosmeticUnlockedToday,
        returnedAfterInactivity,
        radiant: companion.worldStageKey === 'radiant' || worldLevel >= 50,
      }),
    },
    flags: {
      catalogVersion: COSMETIC_CATALOG_VERSION,
      replaceableArt: WORLD_EVOLUTION_STAGES.map((stage) => stage.presentationKey),
    },
  };
  assertWorldPayloadSafe(payload);
  return payload;
}

export async function getCompanionWorldState(userId, options = {}) {
  return withCompanionTx(options, async (tx) => {
    const ensured = await ensureCompanionWorldState(userId, { ...options, db: tx });
    const worldLevel = worldProgressFromXp(ensured.world?.foundationXp || 0).level;
    const newlyUnlockedStages = await syncEvolution(tx, userId, worldLevel, options);
    const timezone = getEffectiveQuestTimezone(options.user || {}, {
      timezone: options.timezone,
      deviceTimezone: options.deviceTimezone,
    });
    const now = options.now || new Date();
    const periodKey = await resolveWorldDailyPeriodKey(tx, userId, now, timezone);
    const previousPeriod = ensured.companion?.lastWorldVisitPeriodKey || null;
    const visit = await awardFirstVisitBondInTx(tx, userId, periodKey, options);
    await tx.mediCompanionProfile.update({
      where: { userId },
      data: { lastWorldVisitPeriodKey: periodKey, lastSeenAt: now },
    });
    return readCompanionPayload(tx, userId, options, {
      periodKey,
      previousPeriod,
      firstVisitToday: Boolean(visit?.applied),
      newlyUnlockedStages,
    });
  });
}

export async function renameCompanion(userId, displayName, options = {}) {
  return withCompanionTx(options, async (tx) => {
    await ensureCompanionWorldState(userId, { ...options, db: tx });
    const sanitized = sanitizeCompanionDisplayName(displayName);
    await tx.mediCompanionProfile.update({
      where: { userId },
      data: { displayName: sanitized.defaulted ? null : sanitized.name },
    });
    return readCompanionPayload(tx, userId, options);
  });
}

export async function completeCareMoment(userId, interactionKey, options = {}) {
  if (!isCareMomentKey(interactionKey)) {
    throw httpError('Unknown Care Moment.', 400, 'COMPANION_CARE_MOMENT');
  }
  return withCompanionTx(options, async (tx) => {
    await ensureCompanionWorldState(userId, { ...options, db: tx });
    const timezone = getEffectiveQuestTimezone(options.user || {}, {
      timezone: options.timezone,
      deviceTimezone: options.deviceTimezone,
    });
    const now = options.now || new Date();
    const periodKey = await resolveWorldDailyPeriodKey(tx, userId, now, timezone);
    const companion = await tx.mediCompanionProfile.findUnique({ where: { userId } });
    if (companion.lastCareMomentPeriodKey !== periodKey) {
      await awardCareMomentBondInTx(tx, userId, periodKey, options);
      await tx.mediCompanionProfile.update({
        where: { userId },
        data: {
          lastCareMomentPeriodKey: periodKey,
          lastCareMomentKey: interactionKey,
        },
      });
    }
    return readCompanionPayload(tx, userId, options, { periodKey });
  }).then(async (payload) => {
    try {
      const { syncAdventureAfterCanonicalChange } = await import('../adventure/service.js');
      await syncAdventureAfterCanonicalChange(userId, options);
    } catch (error) {
      console.warn('[medi-world] adventure care-moment hook failed', error?.message);
    }
    return payload;
  });
}

export async function selectEvolutionStage(userId, stageKey, options = {}) {
  const stage = evolutionStageByKey(stageKey);
  if (!stage) throw httpError('Unknown evolution stage.', 400, 'COMPANION_STAGE');
  return withCompanionTx(options, async (tx) => {
    await ensureCompanionWorldState(userId, { ...options, db: tx });
    const world = await tx.mediWorldProfile.findUnique({ where: { userId } });
    const worldLevel = worldProgressFromXp(world?.foundationXp || 0).level;
    await syncEvolution(tx, userId, worldLevel, options);
    const unlocked = await tx.mediCompanionWorldStageUnlock.findUnique({
      where: { userId_stageKey: { userId, stageKey: stage.key } },
    });
    if (!unlocked) throw httpError('This stage is still locked.', 400, 'COMPANION_STAGE_LOCKED');
    await tx.mediCompanionProfile.update({
      where: { userId },
      data: { worldStageKey: stage.key },
    });
    return readCompanionPayload(tx, userId, options);
  });
}

export async function equipCosmetic(userId, slot, catalogKey, options = {}) {
  if (!isCosmeticSlot(slot)) throw httpError('Unknown cosmetic slot.', 400, 'COMPANION_SLOT');
  const field = equippedFieldForSlot(slot);
  return withCompanionTx(options, async (tx) => {
    await ensureCompanionWorldState(userId, { ...options, db: tx });
    if (catalogKey == null) {
      await tx.mediCompanionProfile.update({
        where: { userId },
        data: { [field]: slot === 'aura' ? DEFAULT_AURA_KEY : null },
      });
      return readCompanionPayload(tx, userId, options);
    }
    const item = cosmeticByKey(catalogKey);
    if (!item || item.slot !== slot) throw httpError('Unknown cosmetic.', 400, 'COMPANION_COSMETIC');
    const owned = await tx.mediCompanionCosmeticOwn.findUnique({
      where: { userId_catalogKey: { userId, catalogKey } },
    });
    if (!owned) throw httpError('You do not own this item.', 400, 'COMPANION_NOT_OWNED');
    await tx.mediCompanionProfile.update({
      where: { userId },
      data: { [field]: catalogKey },
    });
    return readCompanionPayload(tx, userId, options);
  });
}

export async function unlockCosmetic(userId, catalogKey, idempotencyKey, options = {}) {
  if (options.client?.price != null || options.client?.energyType != null || options.client?.category != null) {
    throw httpError('Client cannot set price or category.', 400, 'COMPANION_UNLOCK_CLIENT_PRICE');
  }
  const item = cosmeticByKey(catalogKey);
  if (!item || !item.active) throw httpError('This item is not available.', 404, 'COMPANION_CATALOG');
  const key = String(idempotencyKey || '').trim();
  if (!key || key.length > 180) throw httpError('Missing idempotency key.', 400, 'WORLD_IDEMPOTENCY');
  return withCompanionTx(options, async (tx) => {
    await ensureCompanionWorldState(userId, { ...options, db: tx });
    await lockCompanion(tx, userId);
    const owned = await tx.mediCompanionCosmeticOwn.findUnique({
      where: { userId_catalogKey: { userId, catalogKey: item.key } },
    });
    if (owned) {
      const state = await readCompanionPayload(tx, userId, options);
      return { ...state, unlock: { applied: false, alreadyOwned: true, charged: false } };
    }
    if (item.defaultOwned || item.price <= 0) {
      await tx.mediCompanionCosmeticOwn.create({
        data: { userId, catalogKey: item.key, catalogVersion: COSMETIC_CATALOG_VERSION },
      });
      const state = await readCompanionPayload(tx, userId, options);
      return { ...state, unlock: { applied: true, alreadyOwned: false, charged: false } };
    }
    const world = await tx.mediWorldProfile.findUnique({ where: { userId } });
    const worldLevel = worldProgressFromXp(world?.foundationXp || 0).level;
    await syncEvolution(tx, userId, worldLevel, options);
    if (worldLevel < item.worldLevel) {
      throw httpError('World level is not high enough yet.', 400, 'COMPANION_LEVEL_LOCKED');
    }
    const debit = await debitCareEnergyInTx(
      tx,
      userId,
      {
        energyType: item.energyType,
        amount: item.price,
        idempotencyKey: key,
        reasonCode: 'COMPANION_UNLOCK',
        sourceId: `companion-unlock:${item.key}`,
        adapterId: 'system.debit',
      },
      options,
    );
    try {
      await tx.mediCompanionCosmeticOwn.create({
        data: {
          userId,
          catalogKey: item.key,
          catalogVersion: COSMETIC_CATALOG_VERSION,
          debitLedgerId: debit.ledger?.id || null,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    const state = await readCompanionPayload(tx, userId, options);
    return {
      ...state,
      unlock: {
        applied: Boolean(debit.applied),
        alreadyOwned: false,
        charged: Boolean(debit.applied),
        energyType: item.energyType,
        amount: item.price,
        resultingBalance: state.world.careEnergy[item.energyType],
      },
    };
  });
}

export async function recordWorldVisitBond(userId, options = {}) {
  if (!isMediWorldEnabled(options.flags)) return null;
  const db = dbOf(options);
  if (!companionTablesReady(db)) return null;
  try {
    return withCompanionTx(options, async (tx) => {
      await ensureCompanionWorldState(userId, { ...options, db: tx });
      const timezone = getEffectiveQuestTimezone(options.user || {}, {
        timezone: options.timezone,
        deviceTimezone: options.deviceTimezone,
      });
      const now = options.now || new Date();
      const periodKey = await resolveWorldDailyPeriodKey(tx, userId, now, timezone);
      await awardFirstVisitBondInTx(tx, userId, periodKey, options);
      return true;
    });
  } catch (error) {
    if (isPrismaMissing(error) || error?.code === 'WORLD_UNAVAILABLE') return null;
    throw error;
  }
}
