import { env } from '../../config/env.js';

function parseFlag(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (['1', 'true', 'on', 'yes'].includes(value)) return true;
  if (['0', 'false', 'off', 'no'].includes(value)) return false;
  return null;
}

/**
 * Medi World is on in development/test unless explicitly disabled.
 * Production stays off unless MEDI_WORLD_ENABLED=1.
 */
export function isMediWorldEnabled({
  nodeEnv = env.NODE_ENV,
  flag = process.env.MEDI_WORLD_ENABLED,
} = {}) {
  const parsed = parseFlag(flag);
  if (parsed != null) return parsed;
  return nodeEnv !== 'production';
}

/** Client/test activity path — internal only. Never an HTTP route. Never in production. */
export function isMediWorldFoundationTestPathEnabled(options = {}) {
  const nodeEnv = options.nodeEnv ?? env.NODE_ENV;
  if (nodeEnv === 'production') return false;
  return isMediWorldEnabled(options);
}

export function mediWorldDisabledError() {
  const error = new Error('მოთხოვნილი მისამართი ვერ მოიძებნა.');
  error.status = 404;
  error.code = 'MEDI_WORLD_DISABLED';
  return error;
}

export function isMediWorldExploreEnabled({
  nodeEnv = env.NODE_ENV,
  flag = process.env.MEDI_WORLD_ENABLED,
  exploreFlag = process.env.MEDI_WORLD_EXPLORE_ENABLED,
} = {}) {
  if (!isMediWorldEnabled({ nodeEnv, flag })) return false;
  const parsed = parseFlag(exploreFlag);
  if (parsed != null) return parsed;
  return nodeEnv !== 'production';
}

export function canLoadExploreFixtures({
  nodeEnv = env.NODE_ENV,
} = {}) {
  return nodeEnv !== 'production';
}

export function exploreDisabledError() {
  const error = new Error('მოთხოვნილი მისამართი ვერ მოიძებნა.');
  error.status = 404;
  error.code = 'EXPLORE_DISABLED';
  return error;
}

export function isMediWorldMovementEnabled({
  nodeEnv = env.NODE_ENV,
  flag = process.env.MEDI_WORLD_ENABLED,
  movementFlag = process.env.MEDI_WORLD_MOVEMENT_ENABLED,
} = {}) {
  if (!isMediWorldEnabled({ nodeEnv, flag })) return false;
  const parsed = parseFlag(movementFlag);
  if (parsed != null) return parsed;
  return nodeEnv !== 'production';
}

export function movementDisabledError() {
  const error = new Error('მოთხოვნილი მისამართი ვერ მოიძებნა.');
  error.status = 404;
  error.code = 'MOVEMENT_DISABLED';
  return error;
}

export function isMediWorldGardenEnabled({
  nodeEnv = env.NODE_ENV,
  flag = process.env.MEDI_WORLD_ENABLED,
  gardenFlag = process.env.MEDI_WORLD_GARDEN_ENABLED,
} = {}) {
  if (!isMediWorldEnabled({ nodeEnv, flag })) return false;
  const parsed = parseFlag(gardenFlag);
  if (parsed != null) return parsed;
  return nodeEnv !== 'production';
}

export function canLoadGardenFixtures({
  nodeEnv = env.NODE_ENV,
} = {}) {
  return nodeEnv !== 'production';
}

export function gardenDisabledError() {
  const error = new Error('მოთხოვნილი მისამართი ვერ მოიძებნა.');
  error.status = 404;
  error.code = 'GARDEN_DISABLED';
  return error;
}
