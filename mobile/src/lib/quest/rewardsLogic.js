/**
 * Phase 7 — Rewards Store helpers (pure, testable).
 */

/** Canonical RewardLedger.sourceType values the Wallet must label intentionally. */
export const WALLET_LEDGER_SOURCE_TYPES = Object.freeze([
  'QUEST',
  'ACHIEVEMENT',
  'REWARD_REDEMPTION',
  'SYSTEM',
  'ADMIN_ADJUSTMENT',
]);

export function coinsShortfall(cost, balance) {
  const need = Math.max(0, Math.floor(Number(cost) || 0) - Math.floor(Number(balance) || 0));
  return need;
}

export function canShowRedeem(reward, { offline = false } = {}) {
  if (offline) return false;
  if (!reward) return false;
  if (reward.inventoryState === 'OUT_OF_STOCK') return false;
  return Boolean(reward.userEligibility?.canRedeem);
}

/**
 * User-facing Wallet history label. Never fall back to Mission for unknown types.
 * @param {string} sourceType
 * @param {Record<string, string>} copy — from quest catalog / rewards i18n
 */
export function walletSourceLabel(sourceType, copy = {}) {
  switch (String(sourceType || '')) {
    case 'QUEST':
      return copy.mission || 'Quest';
    case 'ACHIEVEMENT':
      return copy.ledgerAchievement || copy.achievement || 'Achievement';
    case 'REWARD_REDEMPTION':
      return copy.ledgerRedeem || 'Medi reward';
    case 'SYSTEM':
      return copy.ledgerSystem || 'System adjustment';
    case 'ADMIN_ADJUSTMENT':
      return copy.ledgerAdmin || copy.ledgerSystem || 'System adjustment';
    default:
      return copy.ledgerUnknown || 'Balance adjustment';
  }
}

export function groupMineRedemptions(payload) {
  return {
    active: payload?.active || [],
    used: payload?.used || [],
    expired: payload?.expired || [],
  };
}

export function newIdempotencyKey() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `rw-${Date.now().toString(36)}-${rand}`;
}
