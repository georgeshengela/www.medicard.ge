import { redactExploreValue } from '../explore/privacy.js';

const SECRET_KEYS = new Set([
  'continuationtoken',
  'token',
  'previoustoken',
  'iv',
  'tag',
  'ciphertext',
  'polyline',
  'route',
  'samples',
  'path',
]);

export function redactMovementValue(value, depth = 0) {
  if (value == null || depth > 6) return value;
  if (typeof value === 'string' && value.startsWith('mw1.')) return '[redacted]';
  if (Array.isArray(value)) return value.map((item) => redactMovementValue(item, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEYS.has(key.toLowerCase())) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = redactExploreValue(redactMovementValue(item, depth + 1), depth + 1);
  }
  return redactExploreValue(out, depth);
}

export function logMovementSafe(message, payload) {
  console.warn(message, JSON.stringify(redactMovementValue(payload)));
}

export function stripMovementSecrets(body) {
  if (!body || typeof body !== 'object') return;
  delete body.latitude;
  delete body.longitude;
  delete body.lat;
  delete body.lng;
  delete body.horizontalAccuracy;
  delete body.accuracy;
  delete body.speedMps;
  delete body.speed;
  delete body.continuationToken;
  delete body.previousToken;
  delete body.token;
  delete body.altitude;
  delete body.heading;
}

export function publicSessionSafe(payload) {
  return redactMovementValue(payload);
}
