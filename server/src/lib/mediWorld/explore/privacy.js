const COORD_KEYS = new Set([
  'latitude',
  'longitude',
  'lat',
  'lng',
  'coords',
  'coordinate',
  'coordinates',
  'accuracy',
  'horizontalAccuracy',
  'altitude',
  'speed',
  'speedMps',
  'heading',
]);

export function redactExploreValue(value, depth = 0) {
  if (value == null || depth > 6) return value;
  if (Array.isArray(value)) return value.map((item) => redactExploreValue(item, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (COORD_KEYS.has(key) || COORD_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = redactExploreValue(item, depth + 1);
  }
  return out;
}

export function logExploreSafe(message, payload) {
  console.warn(message, JSON.stringify(redactExploreValue(payload)));
}

export function stripSample(sample = {}) {
  return {
    latitude: sample.latitude,
    longitude: sample.longitude,
    horizontalAccuracy: sample.horizontalAccuracy,
    locationTimestamp: sample.locationTimestamp,
    mockLocation: Boolean(sample.mockLocation),
    speedMps: sample.speedMps,
    idempotencyKey: sample.idempotencyKey,
  };
}
