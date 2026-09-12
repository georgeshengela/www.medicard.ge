import { isPrismaMissing, isUniqueViolation, reportWorldSchemaMissing } from '../engine.js';
import { isMediWorldGardenEnabled } from '../flags.js';
import { gardenPlantByKey } from './catalog.js';
import {
  isEligibleNurtureSource,
  nextPermanentStage,
  stageRank,
} from './rules.js';

function tablesReady(db) {
  return Boolean(
    db?.careGarden?.findUnique &&
      db?.careGardenPlant?.findMany &&
      db?.careGardenNurtureEvent?.create &&
      db?.careGardenEvent?.create,
  );
}

function eligibleCredit(input = {}) {
  const sourceType = String(input.sourceType || '');
  const energyAmount = Math.max(0, Math.floor(Number(input.energyAmount) || 0));
  const progressState = String(input.progressState || '');
  const reasonCode = String(input.reasonCode || '');
  if (!isEligibleNurtureSource(sourceType)) return false;
  if (energyAmount <= 0) return false;
  if (progressState && progressState !== 'verified') return false;
  if (reasonCode === 'LEVEL_UP_REWARD') return false;
  return true;
}

async function recordStageChange(tx, userId, plant, stage) {
  const uniqueKey = `stage:${plant.id}:${stage}`;
  await tx.careGardenEvent.upsert({
    where: { gardenUserId_uniqueKey: { gardenUserId: userId, uniqueKey } },
    create: {
      gardenUserId: userId,
      type: 'stage_changed',
      plantId: plant.id,
      catalogKey: plant.catalogKey,
      toPlot: plant.plotIndex,
      stage,
      uniqueKey,
    },
    update: {},
  });
}

/**
 * Narrow World CREDIT → Garden adapter.
 * Privacy-safe: category + periodKey + ledger id only. No steps, GPS, meds, symptoms.
 * Stored plants receive nurture. Growth never decreases. Creates no currency.
 */
export async function applyGardenNurtureInTx(tx, userId, input = {}, options = {}) {
  if (!isMediWorldGardenEnabled(options.flags)) {
    return { skipped: 'disabled', applied: false, plantIds: [] };
  }
  if (!tablesReady(tx)) {
    reportWorldSchemaMissing('garden_nurture');
    return { skipped: 'schema', applied: false, plantIds: [] };
  }
  if (!eligibleCredit(input)) {
    return { skipped: 'ineligible', applied: false, plantIds: [] };
  }

  const energyType = String(input.energyType || '');
  const periodKey = String(input.periodKey || '').trim();
  const ledgerId = input.ledgerId ? String(input.ledgerId) : null;
  const creditedAt = input.createdAt instanceof Date ? input.createdAt : options.now || new Date();
  if (!energyType || !periodKey) {
    return { skipped: 'ineligible', applied: false, plantIds: [] };
  }

  const garden = await tx.careGarden.findUnique({ where: { userId } });
  if (!garden) {
    return { skipped: 'no_garden', applied: false, plantIds: [] };
  }

  const plants = await tx.careGardenPlant.findMany({
    where: { gardenUserId: userId, category: energyType },
    orderBy: [{ plantedAt: 'asc' }, { id: 'asc' }],
  });
  const matching = plants.filter((plant) => {
    if (!plant.plantedAt) return true;
    const plantedAt = plant.plantedAt instanceof Date ? plant.plantedAt : new Date(plant.plantedAt);
    if (Number.isNaN(plantedAt.getTime())) return true;
    return plantedAt.getTime() <= creditedAt.getTime();
  });

  const plantIds = [];
  for (const plant of matching) {
    const existingNurture = await tx.careGardenNurtureEvent.findUnique({
      where: { plantId_periodKey: { plantId: plant.id, periodKey } },
    });
    if (existingNurture) continue;
    await tx.careGardenNurtureEvent.create({
      data: {
        gardenUserId: userId,
        plantId: plant.id,
        category: energyType,
        periodKey,
        creditLedgerId: ledgerId,
      },
    });
    const nextDays = (plant.nurtureDays || 0) + 1;
    const nextStage = nextPermanentStage(plant.stage, nextDays);
    const updated = await tx.careGardenPlant.update({
      where: { id: plant.id },
      data: {
        nurtureDays: nextDays,
        stage: nextStage,
      },
    });
    if (stageRank(nextStage) > stageRank(plant.stage)) {
      await recordStageChange(tx, userId, updated, nextStage);
    }
    plantIds.push(plant.id);
  }

  return { skipped: null, applied: plantIds.length > 0, plantIds };
}

export async function tryApplyGardenNurtureInTx(tx, userId, input, options = {}) {
  try {
    return await applyGardenNurtureInTx(tx, userId, input, options);
  } catch (error) {
    if (isPrismaMissing(error) || error?.code === 'P2021' || error?.code === 'WORLD_UNAVAILABLE') {
      reportWorldSchemaMissing('garden_nurture', error);
      return { skipped: 'schema', applied: false, plantIds: [] };
    }
    console.warn('[medi-world] garden_nurture_failed', error?.code || error?.message || error);
    return { skipped: 'error', applied: false, plantIds: [] };
  }
}

export function gardenPlantCatalogKey(plant, options = {}) {
  return gardenPlantByKey(plant?.catalogKey, options)?.key || plant?.catalogKey || null;
}
