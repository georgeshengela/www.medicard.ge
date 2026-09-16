export const TRANSIENT_STATUSES = new Set([0, 408, 429, 500, 502, 503, 504]);

export const FATAL_CODES = new Set([
  'FEATURE_DISABLED',
  'SCHEMA_NOT_READY',
  'SOURCE_CONFLICT',
  'OBSERVATION_CONFLICT',
  'PROVIDER_UNSUPPORTED',
  'NOT_ENROLLED',
  'DISTRICT_LOCKED',
  'ENROLLMENT_CLOSED',
  'COMPETITION_PAUSED',
  'INGESTION_PAUSED',
  'INGESTION_HOLD_OVERLAP',
  'ROUND_CLOSED',
  'DATE_OUT_OF_WINDOW',
  'NO_DISTRICT_FOR_DATE',
  'INTERVAL_START_MISMATCH',
  'INTERVAL_OUT_OF_DAY',
  'INVALID_INTERVAL',
  'INVALID_STEPS',
  'STEPS_SANITY',
  'FUTURE_INTERVAL',
  'FUTURE_OBSERVATION',
  'FUTURE_DATE',
]);

export function classifySyncError(error) {
  const status = Number(error?.status) || 0;
  const code = String(error?.code || '');
  if (status === 401) return { retry: false, kind: 'unauthorized' };
  if (status === 409 && code === 'SOURCE_CONFLICT') return { retry: false, kind: 'source_conflict' };
  if (FATAL_CODES.has(code) || (status >= 400 && status < 500 && status !== 408 && status !== 429)) {
    return { retry: false, kind: 'validation' };
  }
  if (TRANSIENT_STATUSES.has(status) || !status) return { retry: true, kind: 'transient' };
  return { retry: false, kind: 'unknown' };
}

export function backoffMs(attempt) {
  return Math.min(8000, 1000 * 2 ** Math.max(0, attempt));
}

export function shouldSubmitForUser(expectedUserId, activeUserId) {
  return Boolean(expectedUserId && activeUserId && expectedUserId === activeUserId);
}

export const SYNC_THROTTLE_MS = 90_000;
export const MAX_TRANSIENT_RETRIES = 3;
export const ENROLL_SYNC_BUDGET_MS = 12_000;

export function shouldPromptForCompetitionRead(reason, extras = {}) {
  void reason;
  void extras;
  // District war copies HealthMetricDaily. Native Health permission stays on Home / personal sync.
  return false;
}

/** Yesterday's grace read must not discard today's accepted credit. */
export function ignoreGraceDateSensorFailure({ dateYmd, todayYmd, todayAccepted }) {
  return Boolean(todayAccepted && dateYmd && todayYmd && dateYmd !== todayYmd);
}
