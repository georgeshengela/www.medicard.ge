export const STEP_CAPABILITY_STATUSES = Object.freeze([
  'AVAILABLE',
  'UNAVAILABLE',
  'PERMISSION_DENIED',
  'NOT_CONFIGURED',
  'UNKNOWN',
]);

export const STEP_CAPABILITY_SOURCES = Object.freeze([
  'APPLE_HEALTH',
  'HEALTH_CONNECT',
  'OTHER',
  'UNKNOWN',
]);

export function isUsableStepCapability(status) {
  return status === 'AVAILABLE';
}

export function normalizeStepCapability({ status, source } = {}) {
  const nextStatus = STEP_CAPABILITY_STATUSES.includes(status) ? status : null;
  const nextSource = STEP_CAPABILITY_SOURCES.includes(source) ? source : 'UNKNOWN';
  if (!nextStatus) {
    const error = new Error('არასწორი ნაბიჯების სტატუსი.');
    error.status = 400;
    error.code = 'STEP_CAPABILITY_INVALID';
    throw error;
  }
  return { status: nextStatus, source: nextSource };
}

export async function loadStepCapabilityStatus(db, userId) {
  if (typeof db?.stepTrackingCapability?.findUnique !== 'function') return 'UNKNOWN';
  const row = await db.stepTrackingCapability.findUnique({ where: { userId } });
  return row?.status || 'UNKNOWN';
}
