/**
 * Strip anything that must never appear in Companion API payloads.
 */
const FORBIDDEN = [
  'diagnosis',
  'medication',
  'medications',
  'cycle',
  'pregnancy',
  'lab',
  'labs',
  'pain',
  'weight',
  'hydrationMl',
  'hydration_ml',
  'steps',
  'chat',
  'doctor',
  'gps',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'symptom',
  'blood',
  'prescription',
];

export function assertCompanionPayloadSafe(payload, path = 'root') {
  if (payload == null || typeof payload !== 'object') return;
  if (Array.isArray(payload)) {
    payload.forEach((item, i) => assertCompanionPayloadSafe(item, `${path}[${i}]`));
    return;
  }
  for (const [key, value] of Object.entries(payload)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN.some((f) => lower === f.toLowerCase() || lower.includes(f.toLowerCase()))) {
      const err = new Error(`Companion payload leaked sensitive field: ${path}.${key}`);
      err.code = 'COMPANION_PRIVACY';
      throw err;
    }
    if (value && typeof value === 'object') assertCompanionPayloadSafe(value, `${path}.${key}`);
  }
}

export function publicCompanionPayload(input) {
  const out = structuredClone(input);
  assertCompanionPayloadSafe(out);
  return out;
}
