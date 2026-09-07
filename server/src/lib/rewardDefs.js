/**
 * Phase 7 — Medi Rewards Store catalog.
 * Prices are explicit. Cosmetics only — no pay-to-win.
 *
 * ACTIVE only when the entitlement can be fulfilled.
 * Premium package billing ≠ Quest Premium entitlement → PREMIUM_* stay DRAFT.
 * PARTNER_TEST_10 is DEV/QA architecture only → always DRAFT in production seed.
 */

export const REWARD_TYPES = Object.freeze({
  DIGITAL_PERK: 'DIGITAL_PERK',
  COUPON_CODE: 'COUPON_CODE',
  PARTNER_VOUCHER: 'PARTNER_VOUCHER',
  PREMIUM_ACCESS: 'PREMIUM_ACCESS',
});

export const REWARD_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
  ARCHIVED: 'ARCHIVED',
});

export const INVENTORY_MODES = Object.freeze({
  UNLIMITED: 'UNLIMITED',
  FINITE: 'FINITE',
  CODE_POOL: 'CODE_POOL',
});

export const REDEMPTION_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  ISSUED: 'ISSUED',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

export const CODE_STATUSES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  DISABLED: 'DISABLED',
});

export const PERIOD_LIMIT_TYPES = Object.freeze({
  NONE: 'NONE',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  LIFETIME: 'LIFETIME',
  ROLLING_DAYS: 'ROLLING_DAYS',
});

export const LEDGER_SOURCE_REWARD_REDEMPTION = 'REWARD_REDEMPTION';

/** Canonical entitlement keys for first-party digital perks. */
export const ENTITLEMENT_KEYS = Object.freeze({
  QUEST_THEME_PREMIUM: 'quest.theme.premium',
  QUEST_PROFILE_STYLE: 'quest.style.profile',
});

/**
 * MediCard does not yet have a Quest/Medi Premium entitlement separate from
 * AI package billing (FREE/STANDARD/ULTIMATE). Do not fake premium=true.
 */
export const QUEST_PREMIUM_ENTITLEMENT_EXISTS = false;

export const REWARD_CATALOG = Object.freeze([
  {
    key: 'MEDI_THEME_7D',
    type: REWARD_TYPES.DIGITAL_PERK,
    status: REWARD_STATUSES.ACTIVE,
    titleKey: 'reward.mediTheme7d.title',
    descriptionKey: 'reward.mediTheme7d.description',
    termsKey: 'reward.mediTheme7d.terms',
    imageKey: 'theme',
    coinCost: 300,
    inventoryMode: INVENTORY_MODES.UNLIMITED,
    perUserLimit: null,
    periodLimitType: PERIOD_LIMIT_TYPES.ROLLING_DAYS,
    periodLimitCount: 1,
    periodWindowDays: 14,
    redemptionExpiryDays: null,
    entitlementKey: ENTITLEMENT_KEYS.QUEST_THEME_PREMIUM,
    entitlementDurationDays: 7,
    sortOrder: 10,
    featured: true,
  },
  {
    key: 'MEDI_PROFILE_STYLE_30D',
    type: REWARD_TYPES.DIGITAL_PERK,
    status: REWARD_STATUSES.ACTIVE,
    titleKey: 'reward.mediProfileStyle30d.title',
    descriptionKey: 'reward.mediProfileStyle30d.description',
    termsKey: 'reward.mediProfileStyle30d.terms',
    imageKey: 'style',
    coinCost: 600,
    inventoryMode: INVENTORY_MODES.UNLIMITED,
    perUserLimit: null,
    periodLimitType: PERIOD_LIMIT_TYPES.NONE,
    periodLimitCount: null,
    periodWindowDays: null,
    redemptionExpiryDays: null,
    entitlementKey: ENTITLEMENT_KEYS.QUEST_PROFILE_STYLE,
    entitlementDurationDays: 30,
    /** Soft rule: max 1 overlapping ACTIVE entitlement for this key. */
    maxActiveEntitlement: 1,
    sortOrder: 20,
    featured: true,
  },
  {
    key: 'MEDI_PREMIUM_DAY',
    type: REWARD_TYPES.PREMIUM_ACCESS,
    status: QUEST_PREMIUM_ENTITLEMENT_EXISTS ? REWARD_STATUSES.ACTIVE : REWARD_STATUSES.DRAFT,
    titleKey: 'reward.mediPremiumDay.title',
    descriptionKey: 'reward.mediPremiumDay.description',
    termsKey: 'reward.mediPremiumDay.terms',
    imageKey: 'premium',
    coinCost: 900,
    inventoryMode: INVENTORY_MODES.UNLIMITED,
    perUserLimit: null,
    periodLimitType: PERIOD_LIMIT_TYPES.NONE,
    entitlementKey: 'quest.premium.access',
    entitlementDurationDays: 1,
    sortOrder: 30,
    featured: false,
  },
  {
    key: 'MEDI_PREMIUM_3D',
    type: REWARD_TYPES.PREMIUM_ACCESS,
    status: QUEST_PREMIUM_ENTITLEMENT_EXISTS ? REWARD_STATUSES.ACTIVE : REWARD_STATUSES.DRAFT,
    titleKey: 'reward.mediPremium3d.title',
    descriptionKey: 'reward.mediPremium3d.description',
    termsKey: 'reward.mediPremium3d.terms',
    imageKey: 'premium',
    coinCost: 2200,
    inventoryMode: INVENTORY_MODES.UNLIMITED,
    perUserLimit: null,
    periodLimitType: PERIOD_LIMIT_TYPES.NONE,
    entitlementKey: 'quest.premium.access',
    entitlementDurationDays: 3,
    sortOrder: 40,
    featured: false,
  },
  {
    key: 'PARTNER_TEST_10',
    type: REWARD_TYPES.PARTNER_VOUCHER,
    status: REWARD_STATUSES.DRAFT,
    titleKey: 'reward.partnerTest10.title',
    descriptionKey: 'reward.partnerTest10.description',
    termsKey: 'reward.partnerTest10.terms',
    imageKey: 'partner',
    coinCost: 1500,
    inventoryMode: INVENTORY_MODES.CODE_POOL,
    perUserLimit: 1,
    periodLimitType: PERIOD_LIMIT_TYPES.LIFETIME,
    periodLimitCount: 1,
    redemptionExpiryDays: 30,
    sortOrder: 90,
    featured: false,
    metadata: { purpose: 'DEV_QA_ONLY', neverShowInProduction: true },
  },
]);

export function rewardCatalogSeedRows() {
  return REWARD_CATALOG.map((row) => {
    const { maxActiveEntitlement, ...data } = row;
    return {
      ...data,
      metadata: {
        ...(data.metadata || {}),
        ...(maxActiveEntitlement != null ? { maxActiveEntitlement } : {}),
      },
    };
  });
}
