import { assertWorldPayloadSafe } from '../privacy.js';
import { gardenAtmosphere } from '../garden/rules.js';
import { bondProgressFromPoints } from '../companion/bond.js';
import { worldProgressFromXp } from '../ruleset.js';
import { evolutionStageByKey } from '../companion/evolution.js';

const SOCIAL_FORBIDDEN = Object.freeze([
  'email',
  'phone',
  'birthDate',
  'userId',
  'passwordHash',
  'careEnergy',
  'energyMovement',
  'energyHydration',
  'energyCalm',
  'energyCare',
  'energyConnection',
  'latitude',
  'longitude',
  'nurtureDays',
  'debitLedgerId',
  'creditLedgerId',
  'periodKey',
  'fullName',
  'diagnosis',
  'medication',
  'symptom',
  'labResult',
  'cycleMode',
  'hydrationMl',
  'stepCount',
]);

export function assertSocialPayloadSafe(payload) {
  assertWorldPayloadSafe(payload);
  if (payload == null || typeof payload !== 'object') return payload;
  const blob = JSON.stringify(payload);
  for (const key of SOCIAL_FORBIDDEN) {
    if (new RegExp(`"${key}"\\s*:`).test(blob)) {
      const error = new Error(`Social payload leaked ${key}`);
      error.status = 500;
      error.code = 'SOCIAL_PRIVACY';
      throw error;
    }
  }
  return payload;
}

export function socialGardenPreview(plants = []) {
  const planted = (plants || []).filter((plant) => plant && plant.plotIndex != null);
  return {
    atmosphereKey: gardenAtmosphere(planted),
    plots: planted.map((plant) => ({
      plotIndex: plant.plotIndex,
      presentationKey: plant.presentationKey,
      stage: plant.stage,
    })),
  };
}

export function publicCosmetics(companion) {
  if (!companion) return { aura: null, trail: null, charm: null };
  return {
    aura: companion.equippedAuraKey || null,
    trail: companion.equippedTrailKey || null,
    charm: companion.equippedCharmKey || null,
  };
}

export function buildFriendProjection({
  profile,
  viewerIsOwner = false,
  companion = null,
  world = null,
  plants = [],
}) {
  const stage = evolutionStageByKey(companion?.worldStageKey) || evolutionStageByKey('spark');
  const bond = companion ? bondProgressFromPoints(companion.bondPoints) : null;
  const worldLevel = world ? worldProgressFromXp(world.foundationXp || 0).level : null;
  const showWorld = Boolean(profile.showWorldLevel);
  const showBond = Boolean(profile.showBondLevel);
  const showGarden = Boolean(profile.showGardenPreview);
  const projection = {
    publicId: profile.publicId,
    displayName: profile.displayName,
    bio: profile.bio || '',
    mediPresentationKey: profile.mediPresentationKey || stage.presentationKey,
    companionStage: companion?.worldStageKey || 'spark',
    cosmetics: publicCosmetics(companion),
    worldLevel: showWorld ? worldLevel : null,
    bondLevel: showBond ? bond?.bondLevel || null : null,
    garden: showGarden ? socialGardenPreview(plants) : null,
  };
  return assertSocialPayloadSafe(projection);
}
