/**
 * Phase 8 — Partner Rewards Admin unit tests (fake-db style where possible).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adminHasCapability,
  normalizeCapabilities,
  REWARDS_CAPABILITIES,
} from './adminCapabilities.js';
import {
  assertNoHealthFields,
  inventoryStockState,
  maskedUserRef,
  serializeCampaignForPartner,
  validateCampaignActivation,
  validateRewardActivation,
} from './rewardsAdmin.js';
import { STOCK_STATES, PARTNER_ANALYTICS_FORBIDDEN_KEYS } from './rewardCampaignDefs.js';
import { INVENTORY_MODES, REWARD_TYPES } from './rewardDefs.js';
import { isCampaignLive } from './rewardCampaignRuntime.js';

describe('phase 8 admin capabilities', () => {
  it('legacy null capabilities = full access', () => {
    assert.equal(adminHasCapability({ capabilities: null }, 'REWARDS_VIEW'), true);
    assert.equal(adminHasCapability({}, 'PARTNERS_MANAGE'), true);
  });

  it('restricted admin must have explicit capability', () => {
    const admin = { capabilities: ['REWARDS_VIEW', 'PARTNERS_VIEW'] };
    assert.equal(adminHasCapability(admin, 'REWARDS_VIEW'), true);
    assert.equal(adminHasCapability(admin, 'REWARDS_MANAGE'), false);
  });

  it('exports canonical capability list', () => {
    assert.ok(REWARDS_CAPABILITIES.includes('REWARD_CODES_MANAGE'));
    assert.deepEqual(normalizeCapabilities(['A', 'A', 'B']), ['A', 'B']);
  });
});

describe('phase 8 privacy firewall', () => {
  it('serializer never includes user ids by default', () => {
    const view = serializeCampaignForPartner(
      {
        key: 'C1',
        name: 'Demo',
        status: 'ACTIVE',
        startsAt: null,
        endsAt: null,
        fundingModel: 'PER_REDEMPTION',
        commercialValueMinor: 1500,
        commercialCurrency: 'GEL',
        marketCountryCode: 'GE',
        partner: { key: 'P1', displayName: 'Partner', category: 'PHARMACY' },
        reward: { key: 'R1', type: 'PARTNER_VOUCHER', coinCost: 300 },
      },
      { redemptions: { issued: 3 }, inventory: { available: 10 } },
    );
    const json = JSON.stringify(view);
    assert.equal(json.includes('userId'), false);
    assert.equal(json.includes('email'), false);
    assert.equal(json.includes('diagnosis'), false);
    assertNoHealthFields(view);
  });

  it('assertNoHealthFields catches forbidden keys', () => {
    assert.throws(() => assertNoHealthFields({ steps: 1000 }), /REWARD_PRIVACY_VIOLATION|Forbidden/);
    for (const key of ['diagnosis', 'cycle', 'pain', 'hydration']) {
      assert.ok(PARTNER_ANALYTICS_FORBIDDEN_KEYS.includes(key) || PARTNER_ANALYTICS_FORBIDDEN_KEYS.some((k) => k.includes(key)));
    }
  });

  it('masked user ref never shows full id', () => {
    const ref = maskedUserRef('ccebe212-caed-430d-b1b7-02394f1b64a8');
    assert.ok(ref.startsWith('usr_'));
    assert.ok(!ref.includes('caed-430d'));
  });
});

describe('phase 8 campaign lifecycle helpers', () => {
  it('isCampaignLive respects dates and status', () => {
    const now = new Date('2026-09-07T12:00:00Z');
    assert.equal(isCampaignLive({ status: 'ACTIVE', startsAt: null, endsAt: null }, now), true);
    assert.equal(
      isCampaignLive({ status: 'ACTIVE', startsAt: new Date('2026-09-08T00:00:00Z'), endsAt: null }, now),
      false,
    );
    assert.equal(
      isCampaignLive({ status: 'PAUSED', startsAt: null, endsAt: null }, now),
      false,
    );
  });

  it('activation validation requires active partner and fulfillment', () => {
    const errors = validateCampaignActivation({
      partner: { status: 'DRAFT' },
      reward: {
        type: REWARD_TYPES.DIGITAL_PERK,
        titleKey: 't',
        descriptionKey: 'd',
        coinCost: 100,
        entitlementKey: 'quest.theme.premium',
      },
      campaign: { name: 'X' },
      availableCodes: 0,
    });
    assert.ok(errors.some((e) => /partner/i.test(e)));
  });

  it('premium without entitlement cannot activate', () => {
    const errors = validateRewardActivation({
      type: REWARD_TYPES.PREMIUM_ACCESS,
      titleKey: 't',
      descriptionKey: 'd',
      coinCost: 100,
      entitlementKey: null,
    });
    assert.ok(errors.length > 0);
  });
});

describe('phase 8 inventory states', () => {
  it('maps OK LOW OUT UNLIMITED', () => {
    assert.equal(inventoryStockState({ mode: INVENTORY_MODES.UNLIMITED, available: 0 }), STOCK_STATES.UNLIMITED);
    assert.equal(inventoryStockState({ mode: INVENTORY_MODES.CODE_POOL, available: 0, threshold: 5 }), STOCK_STATES.OUT);
    assert.equal(inventoryStockState({ mode: INVENTORY_MODES.CODE_POOL, available: 3, threshold: 5 }), STOCK_STATES.LOW);
    assert.equal(inventoryStockState({ mode: INVENTORY_MODES.CODE_POOL, available: 50, threshold: 5 }), STOCK_STATES.OK);
  });
});
