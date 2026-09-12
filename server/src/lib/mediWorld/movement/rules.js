import { geodesicMeters, isValidLatitude, isValidLongitude } from '../explore/geo.js';

export const MOVEMENT_RULESET_ID = 'medi-world-movement-v1';

export const ACTIVE_MOVEMENT_MODES = Object.freeze(['walk', 'run', 'gentle_move']);

/** Typed for later phases. Not exposed, not selectable, not reward-eligible. */
export const INACTIVE_MOVEMENT_MODES = Object.freeze([
  'wheelchair',
  'rehabilitation',
  'low_mobility_assisted',
]);

export const TARGET_MINUTES = Object.freeze({
  gentle_move: Object.freeze([5, 10, 15]),
  walk: Object.freeze([5, 10, 15, 20, 30]),
  run: Object.freeze([5, 10, 15, 20, 30]),
});

export const DEFAULT_TARGET_MINUTES = Object.freeze({
  gentle_move: 5,
  walk: 10,
  run: 10,
});

export const OPEN_SESSION_STATUSES = Object.freeze(['created', 'active', 'paused']);
export const TERMINAL_SESSION_STATUSES = Object.freeze([
  'completed',
  'abandoned',
  'expired',
  'verification_failed',
]);

export const FRESHNESS_MS = 30_000;
export const FUTURE_SLACK_MS = 5_000;
export const ACCURACY_MAX_M = 50;
export const TOKEN_TTL_MS = 90_000;
export const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
export const MAX_CREDIT_SEC = 20;
export const MAX_GAP_MS = 45_000;
export const TELEPORT_M = 500;
export const MOTORIZED_MPS = 12;
export const SUSPICIOUS_MPS = 7;

export const MODE_MAX_MPS = Object.freeze({
  walk: 3.5,
  gentle_move: 3.5,
  run: 7,
});

export const DISTANCE_BANDS = Object.freeze([
  { maxM: 0, id: 'none' },
  { maxM: 100, id: 'within_100m' },
  { maxM: 500, id: 'within_500m' },
  { maxM: 2000, id: 'within_2km' },
  { maxM: Infinity, id: 'beyond_2km' },
]);

export const PEDOMETER_ADAPTER = Object.freeze({
  id: 'expo-pedometer',
  available: false,
  active: false,
  reason: 'inactive_expo_go',
});

export function isActiveMovementMode(value) {
  return ACTIVE_MOVEMENT_MODES.includes(value);
}

export function allowedTargetsForMode(mode) {
  return TARGET_MINUTES[mode] || [];
}

export function isAllowedTargetMinutes(mode, minutes) {
  return allowedTargetsForMode(mode).includes(Number(minutes));
}

export function defaultTargetMinutes(mode) {
  return DEFAULT_TARGET_MINUTES[mode] ?? 10;
}

export function targetDurationSec(minutes) {
  return Math.floor(Number(minutes)) * 60;
}

export function completionRatioBps(acceptedSec, targetSec) {
  const target = Math.max(1, Math.floor(Number(targetSec) || 0));
  const accepted = Math.max(0, Math.floor(Number(acceptedSec) || 0));
  return Math.min(10_000, Math.floor((accepted * 10_000) / target));
}

export function distanceBandFromMeters(meters) {
  const m = Math.max(0, Number(meters) || 0);
  if (m <= 0) return 'none';
  if (m <= 100) return 'within_100m';
  if (m <= 500) return 'within_500m';
  if (m <= 2000) return 'within_2km';
  return 'beyond_2km';
}

export function mergeAccuracyQuality(current, sampleAcc, accepted) {
  const prev = current || 'unknown';
  if (!accepted) {
    if (!Number.isFinite(sampleAcc) || sampleAcc > ACCURACY_MAX_M) {
      if (prev === 'good') return 'mixed';
      if (prev === 'unknown') return 'poor';
      return prev === 'mixed' ? 'mixed' : 'poor';
    }
    return prev;
  }
  if (sampleAcc <= 20) {
    if (prev === 'unknown' || prev === 'good') return 'good';
    return 'mixed';
  }
  return prev === 'good' ? 'mixed' : prev === 'unknown' ? 'mixed' : prev;
}

export function minDisplacementM(prevAcc, nextAcc) {
  const a = Number.isFinite(prevAcc) ? prevAcc : ACCURACY_MAX_M;
  const b = Number.isFinite(nextAcc) ? nextAcc : ACCURACY_MAX_M;
  return Math.max(8, 0.4 * (a + b));
}

export function parseSampleTimestamp(value, now = new Date()) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const stamped = Date.parse(value);
  return Number.isFinite(stamped) ? stamped : NaN;
}

export function sampleFreshnessReason(sample, now = new Date()) {
  if (!sample || !isValidLatitude(sample.latitude) || !isValidLongitude(sample.longitude)) {
    return 'SEGMENT_LOCATION_UNAVAILABLE';
  }
  const stamped = parseSampleTimestamp(sample.locationTimestamp, now);
  if (!Number.isFinite(stamped)) return 'SEGMENT_STALE';
  if (stamped > now.getTime() + FUTURE_SLACK_MS) return 'SEGMENT_FUTURE';
  if (now.getTime() - stamped > FRESHNESS_MS) return 'SEGMENT_STALE';
  if (!Number.isFinite(sample.horizontalAccuracy) || sample.horizontalAccuracy > ACCURACY_MAX_M) {
    return 'SEGMENT_INACCURATE';
  }
  return null;
}

/**
 * Pure segment evaluation. Coordinates are never persisted by callers.
 */
export function evaluateMovementSegment({
  mode,
  status,
  appState,
  prev,
  next,
  now = new Date(),
} = {}) {
  if (status === 'paused') {
    return { accept: false, creditSec: 0, meters: 0, reason: 'SEGMENT_PAUSED', motorized: false };
  }
  if (status !== 'active' && status !== 'created') {
    return { accept: false, creditSec: 0, meters: 0, reason: 'SEGMENT_INACTIVE', motorized: false };
  }
  if (appState && appState !== 'active') {
    return { accept: false, creditSec: 0, meters: 0, reason: 'SEGMENT_BACKGROUND', motorized: false };
  }
  const freshness = sampleFreshnessReason(next, now);
  if (freshness) {
    return { accept: false, creditSec: 0, meters: 0, reason: freshness, motorized: false };
  }
  const nextTs = parseSampleTimestamp(next.locationTimestamp, now);
  if (prev && Number.isFinite(prev.ts) && nextTs <= prev.ts) {
    return { accept: false, creditSec: 0, meters: 0, reason: 'SEGMENT_OUT_OF_ORDER', motorized: false };
  }
  if (!prev) {
    return { accept: true, creditSec: 0, meters: 0, reason: 'SEGMENT_ANCHORED', motorized: false };
  }
  const dtMs = nextTs - prev.ts;
  if (dtMs > MAX_GAP_MS) {
    return { accept: false, creditSec: 0, meters: 0, reason: 'SEGMENT_GAP', motorized: false, reanchor: true };
  }
  const meters = geodesicMeters(
    { latitude: prev.lat, longitude: prev.lng },
    { latitude: next.latitude, longitude: next.longitude },
  );
  if (meters >= TELEPORT_M) {
    return { accept: false, creditSec: 0, meters, reason: 'SEGMENT_TELEPORT', motorized: false };
  }
  const speed = dtMs > 0 ? meters / (dtMs / 1000) : Number.POSITIVE_INFINITY;
  if (speed >= MOTORIZED_MPS) {
    return { accept: false, creditSec: 0, meters, reason: 'SEGMENT_MOTORIZED', motorized: true };
  }
  const cap = MODE_MAX_MPS[mode] ?? MODE_MAX_MPS.walk;
  if (speed > cap) {
    const reason = speed >= SUSPICIOUS_MPS ? 'SEGMENT_TOO_FAST' : 'SEGMENT_TOO_FAST';
    return { accept: false, creditSec: 0, meters, reason, motorized: speed >= SUSPICIOUS_MPS };
  }
  const minM = minDisplacementM(prev.acc, next.horizontalAccuracy);
  if (meters < minM) {
    return { accept: false, creditSec: 0, meters, reason: 'SEGMENT_STATIONARY', motorized: false, keepChain: true };
  }
  const rawSec = dtMs / 1000;
  const creditSec = Math.max(0, Math.min(MAX_CREDIT_SEC, Math.floor(rawSec)));
  if (creditSec <= 0) {
    return { accept: false, creditSec: 0, meters, reason: 'SEGMENT_STATIONARY', motorized: false, keepChain: true };
  }
  return { accept: true, creditSec, meters, reason: 'SEGMENT_ACCEPTED', motorized: false };
}

export function sessionExpired(session, now = new Date()) {
  if (!session) return false;
  if (TERMINAL_SESSION_STATUSES.includes(session.status)) return session.status === 'expired';
  const start = session.startedAt instanceof Date ? session.startedAt.getTime() : Date.parse(session.startedAt);
  if (!Number.isFinite(start)) return false;
  return now.getTime() - start >= SESSION_TTL_MS;
}
