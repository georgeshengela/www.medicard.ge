import { randomUUID } from 'node:crypto';
import { prisma as defaultPrisma } from '../../prisma.js';
import { debitCareEnergyInTx } from '../debit.js';
import {
  isPrismaMissing,
  isUniqueViolation,
  worldSchemaUnavailableError,
} from '../engine.js';
import { worldProgressFromXp as levelFromXp } from '../ruleset.js';
import {
  gardenDisabledError,
  isMediWorldEnabled,
  isMediWorldGardenEnabled,
  mediWorldDisabledError,
} from '../flags.js';
import { assertWorldPayloadSafe } from '../privacy.js';
import { getMediWorldProfileSnapshot } from '../service.js';
import { GARDEN_PLANTS, gardenPlantByKey, publicGardenCatalog } from './catalog.js';
import {
  GARDEN_CATALOG_VERSION,
  GARDEN_INACTIVITY_MS,
  GARDEN_PLOT_COUNT,
  GARDEN_PLOT_UNLOCK_LEVELS,
  GARDEN_RULESET_ID,
  gardenAtmosphere,
  isGardenPlotIndex,
  isPlotUnlocked,
  mutationFingerprint,
  nextQualifyingDays,
  plotUnlockLevel,
} from './rules.js';

function dbOf(options = {}) {
  return options.db || defaultPrisma;
}

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function tablesReady(db) {
  return Boolean(
    db?.careGarden?.findUnique &&
      db?.careGardenPlant?.create &&
      db?.careGardenEvent?.create &&
      db?.careGardenMutation?.create &&
      db?.careGardenNurtureEvent?.create,
  );
}

function reportMissing(context, error) {
  const msg = `[medi-world] garden schema missing (${context})`;
  if (error) console.warn(msg, error?.message || error);
  else console.warn(msg);
}

async function requireGarden(options = {}) {
  if (!isMediWorldEnabled(options.flags)) throw mediWorldDisabledError();
  if (!isMediWorldGardenEnabled(options.flags)) throw gardenDisabledError();
}

async function withGardenTx(options, fn) {
  await requireGarden(options);
  const db = dbOf(options);
  if (!tablesReady(db)) {
    reportMissing('garden_tx');
    throw worldSchemaUnavailableError();
  }
  try {
    if (typeof db?.$transaction === 'function') return await db.$transaction((tx) => fn(tx));
    return await fn(db);
  } catch (error) {
    if (isPrismaMissing(error) || error?.code === 'P2021') {
      reportMissing('garden_tx', error);
      throw worldSchemaUnavailableError();
    }
    throw error;
  }
}

async function lockGarden(tx, userId) {
  if (typeof tx?.$executeRaw === 'function') {
    await tx.$executeRaw`SELECT 1 FROM "CareGarden" WHERE "userId" = ${userId} FOR UPDATE`.catch(() => 0);
    await tx.$executeRaw`SELECT 1 FROM "MediWorldProfile" WHERE "userId" = ${userId} FOR UPDATE`.catch(() => 0);
  }
}

async function ensureGarden(tx, userId) {
  const existing = await tx.careGarden.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    return await tx.careGarden.create({
      data: {
        userId,
        rulesetVersion: GARDEN_RULESET_ID,
        catalogVersion: GARDEN_CATALOG_VERSION,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return tx.careGarden.findUnique({ where: { userId } });
  }
}

async function worldLevelOf(tx, userId, options = {}) {
  const { ensureMediWorldProfile } = await import('../engine.js');
  const profile = await ensureMediWorldProfile(userId, { ...options, db: tx });
  return levelFromXp(profile?.foundationXp || 0).level;
}

async function accessLevelOf(tx, userId, options = {}) {
  const garden = await ensureGarden(tx, userId);
  const worldLevel = await worldLevelOf(tx, userId, options);
  return stickyUnlockLevel(garden, worldLevel);
}

function stickyUnlockLevel(garden, worldLevel) {
  return Math.max(worldLevel, garden?.lastSeenUnlockLevel || 1);
}

async function syncPlotUnlocks(tx, userId, worldLevel) {
  for (let index = 0; index < GARDEN_PLOT_COUNT; index += 1) {
    if (!isPlotUnlocked(worldLevel, index)) continue;
    const uniqueKey = `plot-unlock:${index}`;
    await tx.careGardenEvent.upsert({
      where: { gardenUserId_uniqueKey: { gardenUserId: userId, uniqueKey } },
      create: {
        gardenUserId: userId,
        type: 'plot_unlocked',
        toPlot: index,
        uniqueKey,
      },
      update: {},
    });
  }
}

async function loadPlants(tx, userId) {
  return tx.careGardenPlant.findMany({
    where: { gardenUserId: userId },
    orderBy: [{ plantedAt: 'asc' }, { id: 'asc' }],
  });
}

function publicPlant(row) {
  if (!row) return null;
  const item = gardenPlantByKey(row.catalogKey);
  const stored = row.plotIndex == null;
  return assertWorldPayloadSafe({
    id: row.id,
    catalogKey: row.catalogKey,
    category: row.category,
    stage: row.stage,
    nurtureDays: row.nurtureDays,
    nextQualifyingDays: nextQualifyingDays(row.nurtureDays),
    plotIndex: stored ? null : row.plotIndex,
    stored,
    plantedAt: row.plantedAt instanceof Date ? row.plantedAt.toISOString() : row.plantedAt,
    catalogVersion: row.catalogVersion,
    presentationKey: row.presentationKey,
    stagePresentationKey: item?.growthPresentation?.[row.stage] || `${row.presentationKey}_${row.stage}`,
  });
}

function cheapestAffordable(balances = {}) {
  return GARDEN_PLANTS.filter((item) => item.active).find((item) => (balances[item.category] || 0) >= item.price) || null;
}

function resolveMediReaction({
  firstVisit,
  inactive,
  newlyUnlocked,
  plants,
  unlockedCount,
  occupiedCount,
  balances,
  action,
}) {
  if (action) return action;
  if (firstVisit) return 'first_visit';
  if (inactive) return 'returned_after_inactivity';
  if (newlyUnlocked) return 'newly_unlocked_plot';
  if (unlockedCount > 0 && occupiedCount >= unlockedCount) return 'all_plots_occupied';
  if (!plants.length) {
    return cheapestAffordable(balances) ? 'enough_energy_to_plant' : 'empty';
  }
  if (plants.some((plant) => plant.stage === 'radiant')) return 'radiant';
  if (plants.some((plant) => plant.stage === 'bloom')) return 'bloom';
  if (plants.some((plant) => plant.stage === 'sprout')) return 'first_sprout';
  if (!cheapestAffordable(balances) && plants.some((plant) => plant.plotIndex == null)) return 'stored_plant';
  return cheapestAffordable(balances) ? 'enough_energy_to_plant' : 'insufficient_energy';
}

async function snapshotWorld(userId, options) {
  try {
    return await getMediWorldProfileSnapshot(userId, options);
  } catch {
    return null;
  }
}

async function buildGardenPayload(tx, userId, options = {}, extras = {}) {
  const garden = await ensureGarden(tx, userId);
  const worldLevel = await worldLevelOf(tx, userId, options);
  const accessLevel = stickyUnlockLevel(garden, worldLevel);
  await syncPlotUnlocks(tx, userId, accessLevel);
  const plants = await loadPlants(tx, userId);
  const now = options.now || new Date();
  const previousVisit = garden.lastVisitAt;
  const firstVisit = !previousVisit;
  const inactive = Boolean(
    previousVisit && now.getTime() - new Date(previousVisit).getTime() >= GARDEN_INACTIVITY_MS,
  );
  const newlyUnlocked = accessLevel > (garden.lastSeenUnlockLevel || 1) &&
    GARDEN_PLOT_UNLOCK_LEVELS.some((need) => need > (garden.lastSeenUnlockLevel || 1) && accessLevel >= need);

  if (!options.skipVisit) {
    await tx.careGarden.update({
      where: { userId },
      data: { lastVisitAt: now, lastSeenUnlockLevel: accessLevel },
    });
  }

  const world = extras.world || await snapshotWorld(userId, { ...options, db: tx });
  const balances = world?.profile?.careEnergy || {};
  const byPlot = new Map(plants.filter((plant) => plant.plotIndex != null).map((plant) => [plant.plotIndex, plant]));
  const plots = [];
  for (let index = 0; index < GARDEN_PLOT_COUNT; index += 1) {
    const unlocked = isPlotUnlocked(accessLevel, index);
    plots.push({
      index,
      unlocked,
      unlockLevel: plotUnlockLevel(index),
      plant: unlocked ? publicPlant(byPlot.get(index) || null) : null,
    });
  }
  const stored = plants.filter((plant) => plant.plotIndex == null).map(publicPlant);
  const planted = plants.filter((plant) => plant.plotIndex != null);
  const unlockedCount = plots.filter((plot) => plot.unlocked).length;
  const occupiedCount = planted.length;
  const reaction = resolveMediReaction({
    firstVisit,
    inactive,
    newlyUnlocked,
    plants,
    unlockedCount,
    occupiedCount,
    balances,
    action: extras.mediReaction,
  });

  const payload = assertWorldPayloadSafe({
    enabled: true,
    rulesetId: GARDEN_RULESET_ID,
    catalogVersion: GARDEN_CATALOG_VERSION,
    atmosphere: gardenAtmosphere(plants),
    mediReaction: { key: reaction },
    worldLevel,
    plots,
    stored,
    world,
    plant: extras.plant ? publicPlant(extras.plant) : undefined,
    applied: extras.applied,
    duplicate: extras.duplicate,
    stale: false,
  });
  return payload;
}

async function rememberMutation(tx, userId, idempotencyKey, operation, fingerprint, plantId) {
  const existing = await tx.careGardenMutation.findUnique({
    where: { gardenUserId_idempotencyKey: { gardenUserId: userId, idempotencyKey } },
  });
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw httpError('Idempotency key already used for a different garden action.', 409, 'WORLD_IDEMPOTENCY_CONFLICT');
    }
    return existing;
  }
  return tx.careGardenMutation.create({
    data: {
      gardenUserId: userId,
      idempotencyKey,
      operation,
      fingerprint,
      plantId: plantId || null,
    },
  });
}

async function loadMutation(tx, userId, idempotencyKey) {
  return tx.careGardenMutation.findUnique({
    where: { gardenUserId_idempotencyKey: { gardenUserId: userId, idempotencyKey } },
  });
}

function requireIdempotency(key) {
  const value = String(key || '').trim();
  if (!value || value.length > 180) {
    throw httpError('Missing idempotency key.', 400, 'WORLD_IDEMPOTENCY');
  }
  return value;
}

async function occupiedPlot(tx, userId, plotIndex) {
  return tx.careGardenPlant.findFirst({
    where: { gardenUserId: userId, plotIndex },
  });
}

async function plantById(tx, userId, plantId) {
  const plant = await tx.careGardenPlant.findUnique({ where: { id: plantId } });
  if (!plant || plant.gardenUserId !== userId) {
    throw httpError('Plant not found.', 404, 'GARDEN_PLANT_NOT_FOUND');
  }
  return plant;
}

async function recordHistory(tx, userId, data) {
  const uniqueKey = data.uniqueKey || `${data.type}:${data.plantId || 'none'}:${randomUUID()}`;
  await tx.careGardenEvent.upsert({
    where: { gardenUserId_uniqueKey: { gardenUserId: userId, uniqueKey } },
    create: {
      gardenUserId: userId,
      type: data.type,
      plantId: data.plantId || null,
      catalogKey: data.catalogKey || null,
      fromPlot: data.fromPlot ?? null,
      toPlot: data.toPlot ?? null,
      stage: data.stage || null,
      uniqueKey,
    },
    update: {},
  });
}

export async function getGarden(userId, options = {}) {
  return withGardenTx(options, async (tx) => {
    await ensureGarden(tx, userId);
    await lockGarden(tx, userId);
    return buildGardenPayload(tx, userId, options);
  });
}

export function getGardenCatalog(options = {}) {
  if (!isMediWorldEnabled(options.flags)) throw mediWorldDisabledError();
  if (!isMediWorldGardenEnabled(options.flags)) throw gardenDisabledError();
  return assertWorldPayloadSafe({
    enabled: true,
    ...publicGardenCatalog(options),
  });
}

export async function plantInPlot(userId, plotIndex, body = {}, options = {}) {
  const index = Number(plotIndex);
  if (!isGardenPlotIndex(index)) throw httpError('Unknown garden plot.', 400, 'GARDEN_PLOT_INVALID');
  if (body.price != null || body.category != null || body.energyType || body.amount != null) {
    throw httpError('Client cannot set price or category.', 400, 'GARDEN_CLIENT_PRICE');
  }
  const catalogKey = String(body.catalogKey || '').trim();
  const item = gardenPlantByKey(catalogKey, options);
  if (!item) throw httpError('Unknown garden plant.', 400, 'GARDEN_UNKNOWN_PLANT');
  if (!item.active) throw httpError('This plant is not available.', 400, 'GARDEN_PLANT_INACTIVE');
  const key = requireIdempotency(body.idempotencyKey);
  const fingerprint = mutationFingerprint('plant', { catalogKey: item.key, plotIndex: index });

  return withGardenTx(options, async (tx) => {
    await ensureGarden(tx, userId);
    await lockGarden(tx, userId);
    const worldLevel = await accessLevelOf(tx, userId, options);
    await syncPlotUnlocks(tx, userId, worldLevel);
    if (!isPlotUnlocked(worldLevel, index)) {
      throw httpError('This plot is still locked.', 400, 'GARDEN_PLOT_LOCKED');
    }

    const existingMutation = await loadMutation(tx, userId, key);
    if (existingMutation) {
      if (existingMutation.fingerprint !== fingerprint) {
        throw httpError('Idempotency key already used for a different garden action.', 409, 'WORLD_IDEMPOTENCY_CONFLICT');
      }
      const plant = existingMutation.plantId
        ? await tx.careGardenPlant.findUnique({ where: { id: existingMutation.plantId } })
        : await tx.careGardenPlant.findFirst({ where: { gardenUserId: userId, plantIdempotencyKey: key } });
      const world = await snapshotWorld(userId, { ...options, db: tx });
      return buildGardenPayload(tx, userId, { ...options, skipVisit: true }, {
        world,
        plant,
        applied: false,
        duplicate: true,
        mediReaction: 'newly_planted_seed',
      });
    }

    const occupant = await occupiedPlot(tx, userId, index);
    if (occupant) throw httpError('This plot already has a plant.', 400, 'GARDEN_PLOT_OCCUPIED');

    const debit = await debitCareEnergyInTx(
      tx,
      userId,
      {
        energyType: item.category,
        amount: item.price,
        idempotencyKey: key,
        reasonCode: 'GARDEN_PLANT',
        sourceId: `garden-plant:${userId}:${index}:${item.key}`,
        adapterId: 'system.debit',
      },
      options,
    );

    let plant;
    try {
      plant = await tx.careGardenPlant.create({
        data: {
          gardenUserId: userId,
          catalogKey: item.key,
          category: item.category,
          plotIndex: index,
          stage: 'seed',
          nurtureDays: 0,
          plantedAt: options.now || new Date(),
          catalogVersion: item.catalogVersion,
          presentationKey: item.presentationKey,
          plantIdempotencyKey: key,
          debitLedgerId: debit.ledger?.id || null,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      plant = await tx.careGardenPlant.findFirst({
        where: { gardenUserId: userId, plantIdempotencyKey: key },
      });
    }
    await rememberMutation(tx, userId, key, 'plant', fingerprint, plant.id);
    await recordHistory(tx, userId, {
      type: 'planted',
      plantId: plant.id,
      catalogKey: item.key,
      toPlot: index,
      stage: 'seed',
      uniqueKey: `planted:${key}`,
    });
    const world = await snapshotWorld(userId, { ...options, db: tx });
    return buildGardenPayload(tx, userId, { ...options, skipVisit: true }, {
      world,
      plant,
      applied: Boolean(debit.applied),
      duplicate: Boolean(debit.duplicate),
      mediReaction: 'newly_planted_seed',
    });
  });
}

export async function movePlant(userId, plantId, body = {}, options = {}) {
  const index = Number(body.plotIndex);
  if (!isGardenPlotIndex(index)) throw httpError('Unknown garden plot.', 400, 'GARDEN_PLOT_INVALID');
  const key = requireIdempotency(body.idempotencyKey);
  const fingerprint = mutationFingerprint('move', { plantId, plotIndex: index });

  return withGardenTx(options, async (tx) => {
    await ensureGarden(tx, userId);
    await lockGarden(tx, userId);
    const worldLevel = await accessLevelOf(tx, userId, options);
    if (!isPlotUnlocked(worldLevel, index)) {
      throw httpError('This plot is still locked.', 400, 'GARDEN_PLOT_LOCKED');
    }
    const existingMutation = await loadMutation(tx, userId, key);
    if (existingMutation) {
      if (existingMutation.fingerprint !== fingerprint) {
        throw httpError('Idempotency key already used for a different garden action.', 409, 'WORLD_IDEMPOTENCY_CONFLICT');
      }
      const plant = await plantById(tx, userId, plantId);
      return buildGardenPayload(tx, userId, { ...options, skipVisit: true }, {
        plant,
        applied: false,
        duplicate: true,
      });
    }
    const plant = await plantById(tx, userId, plantId);
    if (plant.plotIndex === index) {
      await rememberMutation(tx, userId, key, 'move', fingerprint, plant.id);
      return buildGardenPayload(tx, userId, { ...options, skipVisit: true }, { plant, applied: false, duplicate: true });
    }
    const occupant = await occupiedPlot(tx, userId, index);
    if (occupant && occupant.id !== plant.id) {
      throw httpError('This plot already has a plant.', 400, 'GARDEN_PLOT_OCCUPIED');
    }
    const fromPlot = plant.plotIndex;
    const updated = await tx.careGardenPlant.update({
      where: { id: plant.id },
      data: { plotIndex: index, storedAt: null },
    });
    await rememberMutation(tx, userId, key, 'move', fingerprint, plant.id);
    await recordHistory(tx, userId, {
      type: 'moved',
      plantId: plant.id,
      catalogKey: plant.catalogKey,
      fromPlot,
      toPlot: index,
      uniqueKey: `moved:${key}`,
    });
    return buildGardenPayload(tx, userId, { ...options, skipVisit: true }, { plant: updated, applied: true });
  });
}

export async function storePlant(userId, plantId, body = {}, options = {}) {
  const key = requireIdempotency(body.idempotencyKey);
  const fingerprint = mutationFingerprint('store', { plantId });

  return withGardenTx(options, async (tx) => {
    await ensureGarden(tx, userId);
    await lockGarden(tx, userId);
    const existingMutation = await loadMutation(tx, userId, key);
    if (existingMutation) {
      if (existingMutation.fingerprint !== fingerprint) {
        throw httpError('Idempotency key already used for a different garden action.', 409, 'WORLD_IDEMPOTENCY_CONFLICT');
      }
      const plant = await plantById(tx, userId, plantId);
      return buildGardenPayload(tx, userId, { ...options, skipVisit: true }, {
        plant,
        applied: false,
        duplicate: true,
        mediReaction: 'stored_plant',
      });
    }
    const plant = await plantById(tx, userId, plantId);
    if (plant.plotIndex == null) {
      await rememberMutation(tx, userId, key, 'store', fingerprint, plant.id);
      return buildGardenPayload(tx, userId, { ...options, skipVisit: true }, {
        plant,
        applied: false,
        duplicate: true,
        mediReaction: 'stored_plant',
      });
    }
    const fromPlot = plant.plotIndex;
    const updated = await tx.careGardenPlant.update({
      where: { id: plant.id },
      data: { plotIndex: null, storedAt: options.now || new Date() },
    });
    await rememberMutation(tx, userId, key, 'store', fingerprint, plant.id);
    await recordHistory(tx, userId, {
      type: 'stored',
      plantId: plant.id,
      catalogKey: plant.catalogKey,
      fromPlot,
      uniqueKey: `stored:${key}`,
    });
    return buildGardenPayload(tx, userId, { ...options, skipVisit: true }, {
      plant: updated,
      applied: true,
      mediReaction: 'stored_plant',
    });
  });
}

export async function restorePlant(userId, plantId, body = {}, options = {}) {
  const index = Number(body.plotIndex);
  if (!isGardenPlotIndex(index)) throw httpError('Unknown garden plot.', 400, 'GARDEN_PLOT_INVALID');
  const key = requireIdempotency(body.idempotencyKey);
  const fingerprint = mutationFingerprint('restore', { plantId, plotIndex: index });

  return withGardenTx(options, async (tx) => {
    await ensureGarden(tx, userId);
    await lockGarden(tx, userId);
    const worldLevel = await accessLevelOf(tx, userId, options);
    if (!isPlotUnlocked(worldLevel, index)) {
      throw httpError('This plot is still locked.', 400, 'GARDEN_PLOT_LOCKED');
    }
    const existingMutation = await loadMutation(tx, userId, key);
    if (existingMutation) {
      if (existingMutation.fingerprint !== fingerprint) {
        throw httpError('Idempotency key already used for a different garden action.', 409, 'WORLD_IDEMPOTENCY_CONFLICT');
      }
      const plant = await plantById(tx, userId, plantId);
      return buildGardenPayload(tx, userId, { ...options, skipVisit: true }, {
        plant,
        applied: false,
        duplicate: true,
        mediReaction: 'restored_plant',
      });
    }
    const plant = await plantById(tx, userId, plantId);
    if (plant.plotIndex != null) {
      throw httpError('This plant is already in a plot.', 400, 'GARDEN_PLANT_NOT_STORED');
    }
    const occupant = await occupiedPlot(tx, userId, index);
    if (occupant) throw httpError('This plot already has a plant.', 400, 'GARDEN_PLOT_OCCUPIED');
    const updated = await tx.careGardenPlant.update({
      where: { id: plant.id },
      data: { plotIndex: index, storedAt: null },
    });
    await rememberMutation(tx, userId, key, 'restore', fingerprint, plant.id);
    await recordHistory(tx, userId, {
      type: 'restored',
      plantId: plant.id,
      catalogKey: plant.catalogKey,
      toPlot: index,
      uniqueKey: `restored:${key}`,
    });
    return buildGardenPayload(tx, userId, { ...options, skipVisit: true }, {
      plant: updated,
      applied: true,
      mediReaction: 'restored_plant',
    });
  });
}

export async function getGardenHistory(userId, options = {}) {
  return withGardenTx(options, async (tx) => {
    await ensureGarden(tx, userId);
    const take = Math.min(50, Math.max(1, Number(options.take) || 20));
    const where = { gardenUserId: userId };
    if (options.cursor) {
      const raw = String(options.cursor);
      const split = raw.lastIndexOf('_');
      const iso = split > 0 ? raw.slice(0, split) : raw;
      const id = split > 0 ? raw.slice(split + 1) : '';
      const at = new Date(iso);
      if (Number.isNaN(at.getTime())) {
        throw httpError('Invalid garden history cursor.', 400, 'GARDEN_HISTORY_CURSOR');
      }
      where.OR = id
        ? [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }]
        : [{ createdAt: { lt: at } }];
    }
    const rows = await tx.careGardenEvent.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
    });
    const page = rows.slice(0, take);
    const next = rows[take];
    return assertWorldPayloadSafe({
      enabled: true,
      rulesetId: GARDEN_RULESET_ID,
      nextCursor: next
        ? `${(next.createdAt instanceof Date ? next.createdAt : new Date(next.createdAt)).toISOString()}_${next.id}`
        : null,
      items: page.map((row) => ({
        id: row.id,
        type: row.type,
        catalogKey: row.catalogKey,
        plantId: row.plantId,
        fromPlot: row.fromPlot,
        toPlot: row.toPlot,
        stage: row.stage,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      })),
    });
  });
}

export { GARDEN_PLOT_COUNT, GARDEN_PLOT_UNLOCK_LEVELS, GARDEN_RULESET_ID };
