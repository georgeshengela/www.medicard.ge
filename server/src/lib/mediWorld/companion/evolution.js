export const WORLD_EVOLUTION_RULESET_VERSION = 1;

export const WORLD_EVOLUTION_STAGES = Object.freeze([
  {
    key: 'spark',
    worldLevel: 1,
    presentationKey: 'present.spark',
    figureSize: 96,
    auraIntensity: 0.18,
    meaning: 'A new care spark',
  },
  {
    key: 'glow',
    worldLevel: 5,
    presentationKey: 'present.glow',
    figureSize: 112,
    auraIntensity: 0.32,
    meaning: 'Growing consistency',
  },
  {
    key: 'bloom',
    worldLevel: 10,
    presentationKey: 'present.bloom',
    figureSize: 128,
    auraIntensity: 0.46,
    meaning: 'Healthy routines taking shape',
  },
  {
    key: 'pulse',
    worldLevel: 20,
    presentationKey: 'present.pulse',
    figureSize: 140,
    auraIntensity: 0.6,
    meaning: 'Strong personal rhythm',
  },
  {
    key: 'guardian',
    worldLevel: 35,
    presentationKey: 'present.guardian',
    figureSize: 160,
    auraIntensity: 0.74,
    meaning: 'Long-term self-care',
  },
  {
    key: 'radiant',
    worldLevel: 50,
    presentationKey: 'present.radiant',
    figureSize: 176,
    auraIntensity: 0.9,
    meaning: 'A fully awakened care companion',
  },
]);

const BY_KEY = Object.fromEntries(WORLD_EVOLUTION_STAGES.map((stage) => [stage.key, stage]));

export function evolutionStageByKey(key) {
  return BY_KEY[key] || null;
}

export function eligibleEvolutionStages(worldLevel) {
  const level = Math.max(1, Math.floor(Number(worldLevel) || 1));
  return WORLD_EVOLUTION_STAGES.filter((stage) => level >= stage.worldLevel);
}

export function highestEligibleStageKey(worldLevel) {
  const eligible = eligibleEvolutionStages(worldLevel);
  return eligible[eligible.length - 1]?.key || 'spark';
}
