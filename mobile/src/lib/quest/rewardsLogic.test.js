import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WALLET_LEDGER_SOURCE_TYPES,
  canShowRedeem,
  coinsShortfall,
  groupMineRedemptions,
  newIdempotencyKey,
  walletSourceLabel,
} from './rewardsLogic.js';

const COPY = {
  mission: 'მისია',
  ledgerAchievement: 'მიღწევა',
  ledgerRedeem: 'Medi ჯილდო',
  ledgerSystem: 'სისტემური კორექტირება',
  ledgerAdmin: 'ადმინისტრაციული კორექტირება',
  ledgerUnknown: 'ბალანსის კორექტირება',
};

describe('phase 7 rewardsLogic', () => {
  it('computes shortfall gently', () => {
    assert.equal(coinsShortfall(300, 180), 120);
    assert.equal(coinsShortfall(300, 300), 0);
    assert.equal(coinsShortfall(300, 500), 0);
  });

  it('blocks offline and out-of-stock redeem', () => {
    const reward = {
      inventoryState: 'AVAILABLE',
      userEligibility: { canRedeem: true, reasonCode: null },
    };
    assert.equal(canShowRedeem(reward, { offline: true }), false);
    assert.equal(canShowRedeem({ ...reward, inventoryState: 'OUT_OF_STOCK' }), false);
    assert.equal(canShowRedeem(reward), true);
  });

  it('maps every canonical ledger sourceType with an intentional label', () => {
    for (const type of WALLET_LEDGER_SOURCE_TYPES) {
      const label = walletSourceLabel(type, COPY);
      assert.ok(label && label.length > 0, `missing label for ${type}`);
      if (type !== 'QUEST') {
        assert.notEqual(label, COPY.mission, `${type} must not fall back to Mission`);
      }
    }
    assert.equal(walletSourceLabel('QUEST', COPY), COPY.mission);
    assert.equal(walletSourceLabel('SYSTEM', COPY), COPY.ledgerSystem);
    assert.equal(walletSourceLabel('ADMIN_ADJUSTMENT', COPY), COPY.ledgerAdmin);
    assert.equal(walletSourceLabel('REWARD_REDEMPTION', COPY), COPY.ledgerRedeem);
    assert.equal(walletSourceLabel('ACHIEVEMENT', COPY), COPY.ledgerAchievement);
  });

  it('uses neutral fallback for unknown sourceType (never Mission)', () => {
    assert.equal(walletSourceLabel('FUTURE_WEIRD', COPY), COPY.ledgerUnknown);
    assert.notEqual(walletSourceLabel('FUTURE_WEIRD', COPY), COPY.mission);
    assert.equal(walletSourceLabel('', COPY), COPY.ledgerUnknown);
  });

  it('groups mine sections', () => {
    const g = groupMineRedemptions({ active: [1], used: [], expired: [2] });
    assert.equal(g.active.length, 1);
    assert.equal(g.expired.length, 1);
  });

  it('builds idempotency keys of sufficient length', () => {
    assert.ok(newIdempotencyKey().length >= 8);
  });
});
