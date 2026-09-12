export const GARDEN_RULESET_ID = 'medi-world-garden-v1';
export const GARDEN_CATALOG_VERSION = 'medi-world-garden-v1';
export const GARDEN_PLOT_COUNT = 6;
export const GARDEN_PLOT_UNLOCK_LEVELS = Object.freeze([1, 1, 1, 5, 10, 20]);
export const GARDEN_STAGES = Object.freeze(['seed', 'sprout', 'bloom', 'radiant']);
export const GARDEN_GROWTH_DAYS = Object.freeze({
  seed: 0,
  sprout: 1,
  bloom: 3,
  radiant: 7,
});
export const GARDEN_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;
export const GARDEN_NURTURE_SOURCE_TYPES = Object.freeze(['QUEST_COMPLETION', 'MOVEMENT_SESSION']);

const STAGE_RANK = Object.freeze({ seed: 0, sprout: 1, bloom: 2, radiant: 3 });

export function isGardenPlotIndex(value) {
  return Number.isInteger(value) && value >= 0 && value < GARDEN_PLOT_COUNT;
}

export function plotUnlockLevel(plotIndex) {
  if (!isGardenPlotIndex(plotIndex)) return null;
  return GARDEN_PLOT_UNLOCK_LEVELS[plotIndex];
}

export function isPlotUnlocked(worldLevel, plotIndex) {
  const need = plotUnlockLevel(plotIndex);
  if (need == null) return false;
  return Math.max(1, Math.floor(Number(worldLevel) || 1)) >= need;
}

export function stageFromNurtureDays(days) {
  const n = Math.max(0, Math.floor(Number(days) || 0));
  if (n >= GARDEN_GROWTH_DAYS.radiant) return 'radiant';
  if (n >= GARDEN_GROWTH_DAYS.bloom) return 'bloom';
  if (n >= GARDEN_GROWTH_DAYS.sprout) return 'sprout';
  return 'seed';
}

export function stageRank(stage) {
  return STAGE_RANK[stage] ?? 0;
}

/** Never allow a computed stage to fall below the persisted one. */
export function nextPermanentStage(currentStage, nurtureDays) {
  const computed = stageFromNurtureDays(nurtureDays);
  return stageRank(computed) >= stageRank(currentStage) ? computed : currentStage;
}

export function nextQualifyingDays(nurtureDays) {
  const n = Math.max(0, Math.floor(Number(nurtureDays) || 0));
  if (n >= GARDEN_GROWTH_DAYS.radiant) return 0;
  if (n >= GARDEN_GROWTH_DAYS.bloom) return GARDEN_GROWTH_DAYS.radiant - n;
  if (n >= GARDEN_GROWTH_DAYS.sprout) return GARDEN_GROWTH_DAYS.bloom - n;
  return GARDEN_GROWTH_DAYS.sprout - n;
}

export function gardenAtmosphere(plants = []) {
  const planted = plants.filter(Boolean);
  if (!planted.length) return 'quiet_beginning';
  const stages = planted.map((plant) => plant.stage);
  if (stages.some((stage) => stage === 'radiant')) return 'radiant_garden';
  if (stages.some((stage) => stage === 'bloom')) return 'blooming_garden';
  const sprouts = stages.filter((stage) => stage === 'sprout').length;
  if (sprouts === 1 && stages.every((stage) => stage === 'seed' || stage === 'sprout')) return 'first_sprout';
  if (sprouts > 0) return 'growing_garden';
  return 'quiet_beginning';
}

export function mutationFingerprint(operation, parts = {}) {
  return [
    operation,
    parts.catalogKey || '',
    parts.plotIndex == null ? '' : String(parts.plotIndex),
    parts.plantId || '',
  ].join(':');
}

export function isEligibleNurtureSource(sourceType) {
  return GARDEN_NURTURE_SOURCE_TYPES.includes(sourceType);
}
