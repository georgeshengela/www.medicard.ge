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
  createPartnerVoucherDefinition,
  inventoryStockState,
  maskedUserRef,
  serializeCampaignForPartner,
  upsertPartner,
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

  it('empty capabilities array denies all', () => {
    assert.equal(adminHasCapability({ capabilities: [] }, 'REWARDS_VIEW'), false);
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

describe('phase 8 partner upsert', () => {
  it('status-only activate keeps existing key and contact fields', async () => {
    const existing = {
      id: 'p1',
      key: 'MEDI_PHARMACY_DEMO',
      displayName: 'Aversi',
      legalName: 'Aversi Ltd',
      category: 'PHARMACY',
      logoAssetKey: 'logo',
      website: 'https://aversi.ge',
      contactName: 'Nino',
      contactEmail: 'nino@aversi.ge',
      countryCode: 'GE',
      notes: 'demo',
      lowStockThreshold: 5,
      status: 'DRAFT',
    };
    let updated = null;
    const db = {
      rewardPartner: {
        findUnique: async ({ where }) => (where.id === existing.id ? { ...existing } : null),
        update: async ({ data }) => {
          updated = { ...existing, ...data };
          return updated;
        },
      },
    };
    const row = await upsertPartner({ id: existing.id, status: 'ACTIVE' }, { admin: { email: 'qa@test' } }, { db });
    assert.equal(row.status, 'ACTIVE');
    assert.equal(row.key, 'MEDI_PHARMACY_DEMO');
    assert.equal(row.displayName, 'Aversi');
    assert.equal(row.contactEmail, 'nino@aversi.ge');
    assert.equal(row.website, 'https://aversi.ge');
    assert.equal(updated.notes, 'demo');
  });

  it('create still rejects a missing partner key', async () => {
    await assert.rejects(
      () => upsertPartner({ displayName: 'X', status: 'ACTIVE' }, {}, { db: { rewardPartner: {} } }),
      /partner key invalid/,
    );
  });

  it('creates a DRAFT partner voucher linked to the partner', async () => {
    let created = null;
    const db = {
      rewardPartner: {
        findUnique: async ({ where }) => (where.id === 'p1' ? { id: 'p1', key: 'AVERSI', status: 'ACTIVE' } : null),
      },
      rewardDefinition: {
        create: async ({ data }) => {
          created = { ...data };
          return created;
        },
      },
    };
    const row = await createPartnerVoucherDefinition(
      { key: 'aversi-10', partnerId: 'p1', title: 'Aversi 10%', coinCost: 250 },
      { admin: { email: 'qa@test' } },
      { db },
    );
    assert.equal(row.key, 'AVERSI_10');
    assert.equal(row.type, 'PARTNER_VOUCHER');
    assert.equal(row.status, 'DRAFT');
    assert.equal(row.partnerId, 'p1');
    assert.equal(row.inventoryMode, 'CODE_POOL');
    assert.equal(created.coinCost, 250);
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
