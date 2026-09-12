/**
 * Medi World Phase 41 — CapabilityRegistry.
 * Only active, audited adapters may appear to users.
 */

export const ADVENTURE_RULESET_ID = 'medi-world-adventure-v1';
export const ADVENTURE_RULESET_VERSION = 1;
export const MAX_SWAPS_PER_DAY = 2;

export const ADVENTURE_INTENSITIES = Object.freeze(['gentle', 'balanced', 'active']);
export const ADVENTURE_CATEGORIES = Object.freeze(['movement', 'hydration', 'calm', 'care', 'connection']);
export const ADVENTURE_SLOT_KEYS = Object.freeze(['anchor', 'balance', 'choice']);
export const ADVENTURE_OPTION_KEYS = Object.freeze(['a', 'b']);
export const ADVENTURE_SLOT_STATES = Object.freeze([
  'available',
  'selected',
  'in_progress',
  'completed',
  'swapped',
  'expired',
  'rest_day',
  'unavailable',
]);
export const ADVENTURE_STATES = Object.freeze([
  'available',
  'in_progress',
  'completed',
  'rest_day',
  'expired',
  'unavailable',
]);
export const MOVEMENT_MODES = Object.freeze(['default', 'wheelchair', 'low_mobility']);

export const DEFAULT_ADVENTURE_PREFERENCES = Object.freeze({
  intensity: 'gentle',
  enabledCategories: Object.freeze(['movement', 'hydration', 'care']),
  allowVariety: true,
  preferredRestWeekdays: Object.freeze([]),
  reducedPressureLanguage: true,
  showTargets: false,
  movementMode: 'default',
});

function cap(row) {
  return Object.freeze({ ...row, slots: Object.freeze([...row.slots]) });
}

/**
 * Active capabilities are ones the installed app can actually complete.
 * Future adapters stay typed and inactive — never shown.
 */
export const CAPABILITY_REGISTRY = Object.freeze([
  cap({
    key: 'quest.daily_steps',
    energyType: 'movement',
    questTemplateKey: 'daily_steps',
    evidence: 'quest_progress',
    targetSource: 'canonical_quest',
    minTarget: 1,
    maxTarget: null,
    accessibility: Object.freeze({ walking: true, wheelchair: false, lowMobility: false }),
    slots: ['anchor', 'balance', 'choice'],
    locKey: 'cap.daily_steps',
    version: 1,
    active: true,
    restCompatible: false,
  }),
  cap({
    key: 'quest.daily_hydration',
    energyType: 'hydration',
    questTemplateKey: 'daily_hydration',
    evidence: 'quest_progress',
    targetSource: 'canonical_quest',
    minTarget: 1,
    maxTarget: null,
    accessibility: Object.freeze({ walking: true, wheelchair: true, lowMobility: true }),
    slots: ['anchor', 'balance', 'choice'],
    locKey: 'cap.daily_hydration',
    version: 1,
    active: true,
    restCompatible: true,
  }),
  cap({
    key: 'quest.daily_medi',
    energyType: 'care',
    questTemplateKey: 'daily_medi',
    evidence: 'quest_progress',
    targetSource: 'canonical_quest',
    minTarget: 1,
    maxTarget: null,
    accessibility: Object.freeze({ walking: true, wheelchair: true, lowMobility: true }),
    slots: ['anchor', 'balance', 'choice'],
    locKey: 'cap.daily_medi',
    version: 1,
    active: true,
    restCompatible: true,
  }),
  cap({
    key: 'companion.care_moment',
    energyType: 'care',
    questTemplateKey: null,
    evidence: 'care_moment_period',
    targetSource: 'companion_care_moment',
    minTarget: 1,
    maxTarget: 1,
    accessibility: Object.freeze({ walking: true, wheelchair: true, lowMobility: true }),
    slots: ['anchor', 'balance', 'choice'],
    locKey: 'cap.care_moment',
    version: 1,
    active: true,
    restCompatible: true,
  }),
  cap({
    key: 'future.wheelchair_movement',
    energyType: 'movement',
    questTemplateKey: null,
    evidence: 'none',
    targetSource: 'none',
    minTarget: null,
    maxTarget: null,
    accessibility: Object.freeze({ walking: false, wheelchair: true, lowMobility: false }),
    slots: ['anchor', 'balance', 'choice'],
    locKey: 'cap.wheelchair',
    version: 1,
    active: false,
    restCompatible: true,
  }),
  cap({
    key: 'future.rehab_movement',
    energyType: 'movement',
    questTemplateKey: null,
    evidence: 'none',
    targetSource: 'none',
    minTarget: null,
    maxTarget: null,
    accessibility: Object.freeze({ walking: false, wheelchair: true, lowMobility: true }),
    slots: ['anchor', 'balance'],
    locKey: 'cap.rehab',
    version: 1,
    active: false,
    restCompatible: true,
  }),
  cap({
    key: 'future.low_mobility',
    energyType: 'movement',
    questTemplateKey: null,
    evidence: 'none',
    targetSource: 'none',
    minTarget: null,
    maxTarget: null,
    accessibility: Object.freeze({ walking: false, wheelchair: true, lowMobility: true }),
    slots: ['anchor', 'balance', 'choice'],
    locKey: 'cap.low_mobility',
    version: 1,
    active: false,
    restCompatible: true,
  }),
  cap({
    key: 'future.breathing',
    energyType: 'calm',
    questTemplateKey: null,
    evidence: 'none',
    targetSource: 'none',
    minTarget: null,
    maxTarget: null,
    accessibility: Object.freeze({ walking: true, wheelchair: true, lowMobility: true }),
    slots: ['balance', 'choice'],
    locKey: 'cap.breathing',
    version: 1,
    active: false,
    restCompatible: true,
  }),
  cap({
    key: 'future.rest_recovery',
    energyType: 'calm',
    questTemplateKey: null,
    evidence: 'none',
    targetSource: 'none',
    minTarget: null,
    maxTarget: null,
    accessibility: Object.freeze({ walking: true, wheelchair: true, lowMobility: true }),
    slots: ['anchor', 'balance'],
    locKey: 'cap.rest',
    version: 1,
    active: false,
    restCompatible: true,
  }),
  cap({
    key: 'future.connection',
    energyType: 'connection',
    questTemplateKey: null,
    evidence: 'none',
    targetSource: 'none',
    minTarget: null,
    maxTarget: null,
    accessibility: Object.freeze({ walking: true, wheelchair: true, lowMobility: true }),
    slots: ['balance', 'choice'],
    locKey: 'cap.connection',
    version: 1,
    active: false,
    restCompatible: true,
  }),
]);

export function capabilityByKey(key) {
  return CAPABILITY_REGISTRY.find((row) => row.key === key) || null;
}

export function activeCapabilities() {
  return CAPABILITY_REGISTRY.filter((row) => row.active);
}

export function capabilityForTemplate(templateKey) {
  return CAPABILITY_REGISTRY.find((row) => row.active && row.questTemplateKey === templateKey) || null;
}

export function isWalkingOnlyCapability(key) {
  const row = capabilityByKey(key);
  return Boolean(row?.accessibility?.walking && !row.accessibility.wheelchair && !row.accessibility.lowMobility);
}

export function compatibleWithMovementMode(capability, movementMode) {
  if (!capability) return false;
  if (movementMode === 'wheelchair') return Boolean(capability.accessibility.wheelchair);
  if (movementMode === 'low_mobility') return Boolean(capability.accessibility.lowMobility);
  return Boolean(capability.accessibility.walking);
}
