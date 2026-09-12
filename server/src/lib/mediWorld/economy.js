/**
 * Medi World economy helpers.
 * Active awards use medi-world-economy-v2. Phase 38 v1 constants stay frozen.
 */

import {
  COMPLETION_RATIO_CAP_BPS,
  MEDI_WORLD_ECONOMY_V2,
  MEDI_WORLD_FOUNDATION_V1,
  MEDI_WORLD_RULESET_VERSION,
  bandForRatioBps,
  worldProgressFromXp,
} from './ruleset.js';

export const MEDI_WORLD_RULESET_VERSION_EXPORT = MEDI_WORLD_RULESET_VERSION;
export { MEDI_WORLD_RULESET_VERSION } from './ruleset.js';
export const MEDI_WORLD_FOUNDATION = MEDI_WORLD_FOUNDATION_V1;

export function requireNonNegativeInt(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    const error = new Error(`${name} must be a non-negative integer.`);
    error.status = 400;
    error.code = 'WORLD_INVALID_PROGRESS';
    throw error;
  }
  return value;
}

export function requirePositiveInt(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error(`${name} must be a positive integer.`);
    error.status = 400;
    error.code = 'WORLD_INVALID_PROGRESS';
    throw error;
  }
  return value;
}

/** Ratio of personal-goal completion in basis points. Never uses raw-step ranking. */
export function completionRatioBps(completedAmount, personalTarget) {
  const completed = requireNonNegativeInt(completedAmount, 'completedAmount');
  const target = requirePositiveInt(personalTarget, 'personalTarget');
  const raw = Math.floor((completed * COMPLETION_RATIO_CAP_BPS) / target);
  return Math.min(COMPLETION_RATIO_CAP_BPS, Math.max(0, raw));
}

export function energyForRatioBps(ratioBps) {
  return bandForRatioBps(ratioBps).energy;
}

export function worldXpForRatioBps(ratioBps) {
  return bandForRatioBps(ratioBps).worldXp;
}

/** @deprecated name kept so Phase 38 tests can import; values follow v2. */
export function foundationXpForRatioBps(ratioBps) {
  return worldXpForRatioBps(ratioBps);
}

export function foundationProgressFromXp(totalXp) {
  return worldProgressFromXp(totalXp);
}

export function cappedVerifiedReward(ratioBps) {
  const ratio = Math.min(COMPLETION_RATIO_CAP_BPS, Math.max(0, Math.floor(Number(ratioBps) || 0)));
  const band = bandForRatioBps(ratio);
  return {
    energyAmount: Math.min(MEDI_WORLD_ECONOMY_V2.perEventEnergyCap, band.energy),
    foundationXp: Math.min(MEDI_WORLD_ECONOMY_V2.perEventWorldXpCap, band.worldXp),
    worldXp: Math.min(MEDI_WORLD_ECONOMY_V2.perEventWorldXpCap, band.worldXp),
    completionRatioBps: ratio,
    reasonCode: band.reasonCode,
  };
}

export const WORLD_TRANSACTION_CREDIT = 'CREDIT';
export const WORLD_TRANSACTION_DEBIT = 'DEBIT';

export function signedLedgerDelta(transactionType, amount) {
  const value = requireNonNegativeInt(amount, 'amount');
  if (transactionType === WORLD_TRANSACTION_CREDIT) return value;
  if (transactionType === WORLD_TRANSACTION_DEBIT) return -value;
  const error = new Error('Unknown Medi World transaction type.');
  error.status = 400;
  error.code = 'WORLD_TRANSACTION_TYPE';
  throw error;
}

export function nextNonNegativeBalance(current, transactionType, amount) {
  const base = requireNonNegativeInt(current, 'current');
  const next = base + signedLedgerDelta(transactionType, amount);
  if (next < 0) {
    const error = new Error('Medi World balance cannot become negative.');
    error.status = 400;
    error.code = 'WORLD_NEGATIVE_BALANCE';
    throw error;
  }
  return next;
}
