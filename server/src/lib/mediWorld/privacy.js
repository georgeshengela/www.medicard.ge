import { WORLD_FORBIDDEN_META_KEYS } from './contract.js';

const FORBIDDEN = new Set(WORLD_FORBIDDEN_META_KEYS.map((key) => key.toLowerCase()));

function isForbiddenKey(key) {
  return FORBIDDEN.has(String(key || '').toLowerCase());
}

export function sanitizeWorldMetadata(value, depth = 0) {
  if (value == null || depth > 4) return {};
  if (typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (isForbiddenKey(key)) continue;
    if (typeof item === 'string') {
      if (item.length > 64) continue;
      out[key] = item;
      continue;
    }
    if (typeof item === 'number' && Number.isInteger(item)) {
      out[key] = item;
      continue;
    }
    if (typeof item === 'boolean') {
      out[key] = item;
    }
  }
  return out;
}

export function assertWorldPayloadSafe(payload, path = 'root') {
  if (payload == null || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    payload.forEach((item, i) => assertWorldPayloadSafe(item, `${path}[${i}]`));
    return payload;
  }
  for (const [key, value] of Object.entries(payload)) {
    if (isForbiddenKey(key)) {
      const error = new Error(`Medi World payload leaked sensitive field: ${path}.${key}`);
      error.status = 500;
      error.code = 'WORLD_PRIVACY';
      throw error;
    }
    if (value && typeof value === 'object') assertWorldPayloadSafe(value, `${path}.${key}`);
  }
  return payload;
}
