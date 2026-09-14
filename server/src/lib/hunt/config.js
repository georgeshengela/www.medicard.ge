/**
 * Medi Hunt ruleset. Snapshot onto each session. Admin may mutate the live row;
 * kill switches still override a snapshot at runtime.
 */

export const HUNT_RULESET_ID = 'medi-hunt-v1';
export const HUNT_LEDGER_SOURCE = 'HUNT';
export const HUNT_MODEL_CATALOG = Object.freeze([
  { key: 'virus_1', file: 'virus_1.glb', labelKa: 'ვირუსი', labelEn: 'Virus' },
]);

export const DEFAULT_HUNT_CONFIG = Object.freeze({
  version: 1,
  enabled: true,
  rewardsEnabled: true,
  playAreaM: 1000,
  sessionMinutesDefault: 15,
  sessionMinutesGentle: 20,
  maxActiveSessions: 1,
  sessionTtlMs: 3 * 60 * 60 * 1000,
  pauseTtlMs: 45 * 60 * 1000,
  captureRadiusM: 10,
  accuracyMaxM: 10,
  dwellMs: 1600,
  minAcceptedFixes: 3,
  graphSnapM: 35,
  maxSampleAgeMs: 8_000,
  maxSpeedMps: 3.5,
  gentleMaxSpeedMps: 2.2,
  teleportM: 80,
  huntDurationSec: 120,
  huntMaxStackedSec: 240,
  shields: 3,
  contactRadiusM: 8,
  contactImmunityMs: 4_000,
  enemyCount: 4,
  capsuleCount: 6,
  minSpawnSeparationM: 45,
  chaserSpeedMps: 1.25,
  interceptorSpeedMps: 1.15,
  patrollerSpeedMps: 1.05,
  fleeSpeedMps: 1.55,
  interceptLeadM: 70,
  pingMinIntervalMs: 700,
  pingMaxBatch: 8,
  encounterTokenTtlMs: 45_000,
  overpassUrl: 'https://overpass-api.de/api/interpreter',
  overpassTimeoutMs: 20_000,
  overpassMaxBytes: 8_000_000,
  graphCacheTtlMs: 6 * 60 * 60 * 1000,
  coins: Object.freeze({
    sessionComplete: 5,
    capture: 1,
    dailyMission: 3,
    sessionCap: 10,
    dailyCap: 20,
  }),
  qualify: Object.freeze({
    meters: 250,
    activeMs: 5 * 60 * 1000,
    gentleMeters: 150,
    gentleActiveMs: 6 * 60 * 1000,
  }),
  exclusions: Object.freeze([]),
  modelKey: 'virus_1',
});

const MAX_SPEED = 4.2;
const MAX_ENEMIES = 8;
const MAX_CAPSULES = 10;

export function httpError(message, status = 400, code = 'HUNT_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function isPrismaMissing(error) {
  return error?.code === 'P2021' || /does not exist/i.test(error?.message || '');
}

export function isUniqueViolation(error) {
  return error?.code === 'P2002';
}

export function isSerializationConflict(error) {
  return error?.code === 'P2034' || /could not serialize/i.test(error?.message || '');
}

function num(value, fallback, { min = -Infinity, max = Infinity, int = false } = {}) {
  const n = int ? Math.trunc(Number(value)) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(value, fallback) {
  if (value === true || value === false) return value;
  return fallback;
}

export function normalizeHuntConfig(raw = {}) {
  const base = DEFAULT_HUNT_CONFIG;
  const coinsIn = raw.coins && typeof raw.coins === 'object' ? raw.coins : {};
  const qualifyIn = raw.qualify && typeof raw.qualify === 'object' ? raw.qualify : {};
  const coins = {
    sessionComplete: num(coinsIn.sessionComplete, base.coins.sessionComplete, { min: 0, max: 20, int: true }),
    capture: num(coinsIn.capture, base.coins.capture, { min: 0, max: 10, int: true }),
    dailyMission: num(coinsIn.dailyMission, base.coins.dailyMission, { min: 0, max: 20, int: true }),
    sessionCap: num(coinsIn.sessionCap, base.coins.sessionCap, { min: 0, max: 50, int: true }),
    dailyCap: num(coinsIn.dailyCap, base.coins.dailyCap, { min: 0, max: 80, int: true }),
  };
  if (coins.sessionCap < coins.capture) {
    throw httpError('სესიის ლიმიტი ვერ იქნება დაჭერის ჯილდოზე ნაკლები.', 400, 'HUNT_CONFIG_INVALID');
  }
  if (coins.dailyCap < coins.sessionCap) {
    throw httpError('დღიური ლიმიტი ვერ იქნება სესიის ლიმიტზე ნაკლები.', 400, 'HUNT_CONFIG_INVALID');
  }
  const chaser = num(raw.chaserSpeedMps, base.chaserSpeedMps, { min: 0.4, max: MAX_SPEED });
  const interceptor = num(raw.interceptorSpeedMps, base.interceptorSpeedMps, { min: 0.4, max: MAX_SPEED });
  const patroller = num(raw.patrollerSpeedMps, base.patrollerSpeedMps, { min: 0.4, max: MAX_SPEED });
  const flee = num(raw.fleeSpeedMps, base.fleeSpeedMps, { min: 0.4, max: MAX_SPEED });
  const walkCap = num(raw.maxSpeedMps, base.maxSpeedMps, { min: 1.2, max: MAX_SPEED });
  if (Math.max(chaser, interceptor, patroller, flee) > walkCap + 0.15) {
    throw httpError('მტრის სიჩქარე ვერ აღემატება ფეხით სიარულის ზღვარს.', 400, 'HUNT_CONFIG_INVALID');
  }
  const modelKey = HUNT_MODEL_CATALOG.some((item) => item.key === raw.modelKey) ? raw.modelKey : base.modelKey;
  const exclusions = Array.isArray(raw.exclusions)
    ? raw.exclusions
        .filter((row) => row && typeof row === 'object')
        .slice(0, 20)
        .map((row) => ({
          south: num(row.south, 0, { min: -90, max: 90 }),
          west: num(row.west, 0, { min: -180, max: 180 }),
          north: num(row.north, 0, { min: -90, max: 90 }),
          east: num(row.east, 0, { min: -180, max: 180 }),
        }))
        .filter((box) => rowValid(box))
    : [];

  return {
    version: 1,
    enabled: bool(raw.enabled, base.enabled),
    rewardsEnabled: bool(raw.rewardsEnabled, base.rewardsEnabled),
    playAreaM: num(raw.playAreaM, base.playAreaM, { min: 400, max: 1600 }),
    sessionMinutesDefault: num(raw.sessionMinutesDefault, base.sessionMinutesDefault, { min: 8, max: 40, int: true }),
    sessionMinutesGentle: num(raw.sessionMinutesGentle, base.sessionMinutesGentle, { min: 10, max: 50, int: true }),
    maxActiveSessions: num(raw.maxActiveSessions, base.maxActiveSessions, { min: 1, max: 2, int: true }),
    sessionTtlMs: num(raw.sessionTtlMs, base.sessionTtlMs, { min: 30 * 60 * 1000, max: 6 * 60 * 60 * 1000, int: true }),
    pauseTtlMs: num(raw.pauseTtlMs, base.pauseTtlMs, { min: 5 * 60 * 1000, max: 2 * 60 * 60 * 1000, int: true }),
    captureRadiusM: num(raw.captureRadiusM, base.captureRadiusM, { min: 6, max: 14 }),
    accuracyMaxM: num(raw.accuracyMaxM, base.accuracyMaxM, { min: 6, max: 14 }),
    dwellMs: num(raw.dwellMs, base.dwellMs, { min: 800, max: 4000, int: true }),
    minAcceptedFixes: num(raw.minAcceptedFixes, base.minAcceptedFixes, { min: 2, max: 8, int: true }),
    graphSnapM: num(raw.graphSnapM, base.graphSnapM, { min: 15, max: 60 }),
    maxSampleAgeMs: num(raw.maxSampleAgeMs, base.maxSampleAgeMs, { min: 2500, max: 15_000, int: true }),
    maxSpeedMps: walkCap,
    gentleMaxSpeedMps: Math.min(walkCap, num(raw.gentleMaxSpeedMps, base.gentleMaxSpeedMps, { min: 0.8, max: MAX_SPEED })),
    teleportM: num(raw.teleportM, base.teleportM, { min: 40, max: 150 }),
    huntDurationSec: num(raw.huntDurationSec, base.huntDurationSec, { min: 45, max: 180, int: true }),
    huntMaxStackedSec: num(raw.huntMaxStackedSec, base.huntMaxStackedSec, { min: 90, max: 360, int: true }),
    shields: num(raw.shields, base.shields, { min: 1, max: 5, int: true }),
    contactRadiusM: num(raw.contactRadiusM, base.contactRadiusM, { min: 5, max: 12 }),
    contactImmunityMs: num(raw.contactImmunityMs, base.contactImmunityMs, { min: 1500, max: 8000, int: true }),
    enemyCount: num(raw.enemyCount, base.enemyCount, { min: 2, max: MAX_ENEMIES, int: true }),
    capsuleCount: num(raw.capsuleCount, base.capsuleCount, { min: 2, max: MAX_CAPSULES, int: true }),
    minSpawnSeparationM: num(raw.minSpawnSeparationM, base.minSpawnSeparationM, { min: 20, max: 120 }),
    chaserSpeedMps: chaser,
    interceptorSpeedMps: interceptor,
    patrollerSpeedMps: patroller,
    fleeSpeedMps: flee,
    interceptLeadM: num(raw.interceptLeadM, base.interceptLeadM, { min: 30, max: 140 }),
    pingMinIntervalMs: num(raw.pingMinIntervalMs, base.pingMinIntervalMs, { min: 400, max: 2500, int: true }),
    pingMaxBatch: num(raw.pingMaxBatch, base.pingMaxBatch, { min: 1, max: 12, int: true }),
    encounterTokenTtlMs: num(raw.encounterTokenTtlMs, base.encounterTokenTtlMs, { min: 20_000, max: 60_000, int: true }),
    overpassUrl: sanitizeOverpassUrl(raw.overpassUrl) || base.overpassUrl,
    overpassTimeoutMs: num(raw.overpassTimeoutMs, base.overpassTimeoutMs, { min: 8_000, max: 30_000, int: true }),
    overpassMaxBytes: num(raw.overpassMaxBytes, base.overpassMaxBytes, { min: 1_000_000, max: 12_000_000, int: true }),
    graphCacheTtlMs: num(raw.graphCacheTtlMs, base.graphCacheTtlMs, { min: 30 * 60 * 1000, max: 24 * 60 * 60 * 1000, int: true }),
    coins,
    qualify: {
      meters: num(qualifyIn.meters, base.qualify.meters, { min: 80, max: 800 }),
      activeMs: num(qualifyIn.activeMs, base.qualify.activeMs, { min: 2 * 60 * 1000, max: 20 * 60 * 1000, int: true }),
      gentleMeters: num(qualifyIn.gentleMeters, base.qualify.gentleMeters, { min: 60, max: 500 }),
      gentleActiveMs: num(qualifyIn.gentleActiveMs, base.qualify.gentleActiveMs, {
        min: 3 * 60 * 1000,
        max: 25 * 60 * 1000,
        int: true,
      }),
    },
    exclusions,
    modelKey,
  };
}

function rowValid(box) {
  return box.north > box.south && box.east > box.west && box.north - box.south < 2 && box.east - box.west < 2;
}

function sanitizeOverpassUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:') return '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function publicHuntStatus(config, { schemaReady = true } = {}) {
  return {
    enabled: Boolean(config?.enabled) && schemaReady,
    rewardsEnabled: Boolean(config?.enabled && config?.rewardsEnabled) && schemaReady,
    playAreaM: config?.playAreaM ?? DEFAULT_HUNT_CONFIG.playAreaM,
    captureRadiusM: config?.captureRadiusM ?? DEFAULT_HUNT_CONFIG.captureRadiusM,
    modelKey: config?.modelKey || 'virus_1',
    attribution: '© OpenStreetMap contributors',
    schemaReady: Boolean(schemaReady),
  };
}

export function sessionMinutesForMode(config, mode) {
  return mode === 'gentle' ? config.sessionMinutesGentle : config.sessionMinutesDefault;
}

export function qualifyThreshold(config, mode) {
  if (mode === 'gentle') {
    return { meters: config.qualify.gentleMeters, activeMs: config.qualify.gentleActiveMs };
  }
  return { meters: config.qualify.meters, activeMs: config.qualify.activeMs };
}

export function walkSpeedCap(config, mode) {
  return mode === 'gentle' ? config.gentleMaxSpeedMps : config.maxSpeedMps;
}

export function huntSourceId(kind, id) {
  return `hunt:${kind}:${id}`;
}

export const OPEN_HUNT_STATUSES = Object.freeze(['preparing', 'active', 'paused', 'encounter']);
export const TERMINAL_HUNT_STATUSES = Object.freeze(['completed', 'ended', 'expired', 'unavailable']);
