/** Phase 8 — Partner / campaign constants (commercial only). */

export const PARTNER_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
  /** Legacy Phase 7 */
  INACTIVE: 'INACTIVE',
});

export const PARTNER_CATEGORIES = Object.freeze([
  'PHARMACY',
  'LAB',
  'FITNESS',
  'WELLNESS',
  'FOOD',
  'RETAIL',
  'INSURANCE',
  'CLINIC',
  'OTHER',
]);

export const CAMPAIGN_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
  ARCHIVED: 'ARCHIVED',
});

export const FUNDING_MODELS = Object.freeze([
  'SPONSORED_FIXED',
  'PER_REDEMPTION',
  'PER_USED',
  'AFFILIATE',
  'INTERNAL',
]);

export const STOCK_STATES = Object.freeze({
  OK: 'OK',
  LOW: 'LOW',
  OUT: 'OUT',
  UNLIMITED: 'UNLIMITED',
});

export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

/** Forbidden keys that must never appear in partner/admin reward analytics payloads. */
export const PARTNER_ANALYTICS_FORBIDDEN_KEYS = Object.freeze([
  'diagnosis',
  'diagnoses',
  'medication',
  'medications',
  'adherence',
  'cycle',
  'pregnancy',
  'lab',
  'labs',
  'visit',
  'visits',
  'weight',
  'hydration',
  'steps',
  'pain',
  'medicalRecord',
  'chat',
  'chatContent',
  'baseline',
  'questBaseline',
  'smartTarget',
  'questTarget',
  'notificationReason',
  'weatherHealth',
]);
