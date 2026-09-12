/**
 * Medi World Phase 38 — typed domain contract.
 * Stable identifiers. No LLM. No location. No health-note payloads.
 */

export const MEDI_WORLD_CONTRACT_ID = 'MediWorld';

export const CARE_ENERGY_TYPES = Object.freeze([
  'movement',
  'hydration',
  'calm',
  'care',
  'connection',
]);

export const PROGRESS_STATES = Object.freeze([
  'verified',
  'user_reported',
  'estimated',
  'pending',
  'rejected',
]);

export const WORLD_ACTION_SOURCES = Object.freeze([
  'QUEST_COMPLETION',
  'FOUNDATION_TEST',
  'MOVEMENT_SESSION',
  'LEVEL_UP',
  'INTERNAL_DEBIT',
]);

/** Append-only ledger direction. Amounts stay non-negative integers. */
export const WORLD_TRANSACTION_TYPES = Object.freeze(['CREDIT', 'DEBIT']);

export const WORLD_UNLOCK_KEYS = Object.freeze([
  'liveMap',
  'healthTree',
  'social',
  'storms',
  'shop',
  'pois',
]);

/** Frozen Phase 38 unlock map — later phases flip keys explicitly. */
export const PHASE38_UNLOCKS = Object.freeze({
  liveMap: false,
  healthTree: false,
  social: false,
  storms: false,
  shop: false,
  pois: false,
});

/**
 * Adapter catalog. Movement is not hardcoded to steps — wheelchair, rehab,
 * and low-mobility share the movement Care Energy category.
 */
export const ACTIVITY_ADAPTERS = Object.freeze({
  'quest.daily_steps': { energyType: 'movement', family: 'walking', source: 'QUEST_COMPLETION' },
  'quest.weekly_steps': { energyType: 'movement', family: 'walking', source: 'QUEST_COMPLETION' },
  'quest.daily_hydration': { energyType: 'hydration', family: 'hydration', source: 'QUEST_COMPLETION' },
  'quest.daily_medi': { energyType: 'care', family: 'care_routine', source: 'QUEST_COMPLETION' },
  'activity.walking': { energyType: 'movement', family: 'walking', source: 'FOUNDATION_TEST' },
  'activity.wheelchair': { energyType: 'movement', family: 'wheelchair', source: 'FOUNDATION_TEST' },
  'activity.rehab': { energyType: 'movement', family: 'rehab', source: 'FOUNDATION_TEST' },
  'activity.low_mobility': { energyType: 'movement', family: 'low_mobility', source: 'FOUNDATION_TEST' },
  'activity.breathing': { energyType: 'calm', family: 'breathing', source: 'FOUNDATION_TEST' },
  'activity.hydration': { energyType: 'hydration', family: 'hydration', source: 'FOUNDATION_TEST' },
  'activity.rest': { energyType: 'calm', family: 'rest', source: 'FOUNDATION_TEST' },
  'activity.care_routine': { energyType: 'care', family: 'care_routine', source: 'FOUNDATION_TEST' },
  'activity.connection': { energyType: 'connection', family: 'connection', source: 'FOUNDATION_TEST' },
  'activity.movement_session': { energyType: 'movement', family: 'walking', source: 'MOVEMENT_SESSION' },
});

export const QUEST_TEMPLATE_ADAPTERS = Object.freeze({
  daily_steps: 'quest.daily_steps',
  weekly_steps: 'quest.weekly_steps',
  daily_hydration: 'quest.daily_hydration',
  daily_medi: 'quest.daily_medi',
});

export const ENERGY_BALANCE_FIELDS = Object.freeze({
  movement: 'energyMovement',
  hydration: 'energyHydration',
  calm: 'energyCalm',
  care: 'energyCare',
  connection: 'energyConnection',
});

export const WORLD_FORBIDDEN_META_KEYS = Object.freeze([
  'notes',
  'healthNotes',
  'medicationName',
  'medName',
  'medicationNames',
  'doctorName',
  'symptoms',
  'diagnosis',
  'chat',
  'steps',
  'hydrationMl',
  'weight',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'gps',
  'location',
  'home',
  'continuationToken',
  'token',
  'polyline',
  'route',
]);

export function isCareEnergyType(value) {
  return CARE_ENERGY_TYPES.includes(value);
}

export function isProgressState(value) {
  return PROGRESS_STATES.includes(value);
}

export function isWorldActionSource(value) {
  return WORLD_ACTION_SOURCES.includes(value);
}

export function isWorldTransactionType(value) {
  return WORLD_TRANSACTION_TYPES.includes(value);
}

export function adapterById(adapterId) {
  return ACTIVITY_ADAPTERS[adapterId] || null;
}

export function awardsVerifiedProgress(progressState) {
  return progressState === 'verified';
}

/**
 * @typedef {object} PersonalGoalProgress
 * @property {string} adapterId
 * @property {number} personalTarget  positive integer
 * @property {number} completedAmount   non-negative integer
 * @property {number} completionRatioBps  0..10000
 * @property {string} progressState
 */

/**
 * @typedef {object} WorldActivityEvent
 * @property {string} sourceType
 * @property {string} sourceId
 * @property {string} idempotencyKey
 * @property {string} adapterId
 * @property {string} energyType
 * @property {string} progressState
 * @property {number} personalTarget
 * @property {number} completedAmount
 * @property {object} [metadata]
 */

/**
 * @typedef {object} MediWorldProfileState
 * @property {string} userId
 * @property {number} rulesetVersion
 * @property {number} foundationXp
 * @property {number} foundationLevel
 * @property {{ movement: number, hydration: number, calm: number, care: number, connection: number }} careEnergy
 * @property {{ owned: boolean, profileId: string | null }} companionRef
 * @property {string | null} coarseCommunityKey
 * @property {typeof PHASE38_UNLOCKS} unlocks
 */
