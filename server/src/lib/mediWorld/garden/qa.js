import { prisma as defaultPrisma } from '../../prisma.js';
import { worldSchemaUnavailableError } from '../engine.js';
import { canLoadGardenFixtures } from '../flags.js';
import { GARDEN_GROWTH_DAYS, GARDEN_STAGES, nextPermanentStage, stageFromNurtureDays } from './rules.js';

function forbidden() {
  const error = new Error('მოთხოვნილი მისამართი ვერ მოიძებნა.');
  error.status = 404;
  error.code = 'GARDEN_QA_FORBIDDEN';
  return error;
}

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

/**
 * Non-production visual fixture. Never debits, never mints Care Energy / XP / Bond.
 * Impossible when NODE_ENV === 'production'.
 */
export async function applyGardenQaStage(userId, body = {}, options = {}) {
  if (!canLoadGardenFixtures(options.flags || {})) throw forbidden();
  const db = options.db || defaultPrisma;
  if (!db?.careGardenPlant?.update) {
    throw worldSchemaUnavailableError();
  }
  const plantId = String(body.plantId || '').trim();
  if (!plantId) throw httpError('Plant not found.', 404, 'GARDEN_PLANT_NOT_FOUND');
  const plant = await db.careGardenPlant.findUnique({ where: { id: plantId } });
  if (!plant || plant.gardenUserId !== userId) {
    throw httpError('Plant not found.', 404, 'GARDEN_PLANT_NOT_FOUND');
  }
  let days = plant.nurtureDays;
  if (body.stage && GARDEN_STAGES.includes(body.stage)) {
    days = GARDEN_GROWTH_DAYS[body.stage];
  } else if (body.nurtureDays != null) {
    days = Math.max(0, Math.floor(Number(body.nurtureDays) || 0));
  }
  const stage = nextPermanentStage(plant.stage, days);
  const updated = await db.careGardenPlant.update({
    where: { id: plant.id },
    data: { nurtureDays: days, stage },
  });
  return {
    ok: true,
    fixture: true,
    plantId: updated.id,
    stage: updated.stage,
    nurtureDays: updated.nurtureDays,
    computedStage: stageFromNurtureDays(days),
  };
}
