/**
 * DEV visual QA fixtures for Rewards Store — never written to LIVE cache/DB.
 */

export const REWARD_DEV_SCENARIOS = Object.freeze([
  'AVAILABLE',
  'INSUFFICIENT_BALANCE',
  'OUT_OF_STOCK',
  'LIMIT_REACHED',
  'EXPIRING',
  'CODE_ISSUED',
  'USED',
  'EXPIRED',
  'LONG_TITLE',
  'LARGE_BALANCE',
  'ZERO_BALANCE',
]);

function baseReward(overrides = {}) {
  return {
    id: 'dev-reward-1',
    key: 'MEDI_THEME_7D',
    type: 'DIGITAL_PERK',
    titleKey: 'reward.mediTheme7d.title',
    descriptionKey: 'reward.mediTheme7d.description',
    termsKey: 'reward.mediTheme7d.terms',
    imageKey: 'theme',
    coinCost: 300,
    availability: 'ACTIVE',
    inventoryState: 'AVAILABLE',
    inventoryRemaining: null,
    featured: true,
    partnerDisplay: null,
    validUntil: null,
    redemptionExpiryDays: null,
    entitlementKey: 'quest.theme.premium',
    entitlementDurationDays: 7,
    userEligibility: { canRedeem: true, reasonCode: null },
    userRedemptionCount: 0,
    userBalance: 1240,
    ...overrides,
  };
}

export function buildRewardsDevCatalog(scenario = 'AVAILABLE') {
  const balance =
    scenario === 'ZERO_BALANCE' ? 0 : scenario === 'LARGE_BALANCE' ? 125000 : scenario === 'INSUFFICIENT_BALANCE' ? 180 : 1240;

  let reward = baseReward({ userBalance: balance });
  if (scenario === 'INSUFFICIENT_BALANCE') {
    reward = baseReward({
      userBalance: 180,
      userEligibility: { canRedeem: false, reasonCode: 'REWARD_INSUFFICIENT_COINS' },
    });
  } else if (scenario === 'OUT_OF_STOCK') {
    reward = baseReward({
      inventoryState: 'OUT_OF_STOCK',
      inventoryRemaining: 0,
      userEligibility: { canRedeem: false, reasonCode: 'REWARD_OUT_OF_STOCK' },
    });
  } else if (scenario === 'LIMIT_REACHED') {
    reward = baseReward({
      userRedemptionCount: 1,
      userEligibility: { canRedeem: false, reasonCode: 'REWARD_PERIOD_LIMIT' },
    });
  } else if (scenario === 'LONG_TITLE') {
    reward = baseReward({
      titleKey: 'reward.mediProfileStyle30d.title',
      descriptionKey: 'reward.mediProfileStyle30d.description',
      coinCost: 600,
    });
  } else if (scenario === 'EXPIRING') {
    reward = baseReward({
      validUntil: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      redemptionExpiryDays: 7,
    });
  }

  const style = baseReward({
    id: 'dev-reward-2',
    key: 'MEDI_PROFILE_STYLE_30D',
    titleKey: 'reward.mediProfileStyle30d.title',
    descriptionKey: 'reward.mediProfileStyle30d.description',
    termsKey: 'reward.mediProfileStyle30d.terms',
    coinCost: 600,
    featured: false,
    userBalance: balance,
    userEligibility:
      balance >= 600
        ? { canRedeem: true, reasonCode: null }
        : { canRedeem: false, reasonCode: 'REWARD_INSUFFICIENT_COINS' },
  });

  return {
    balance: { coins: balance },
    featured: [reward],
    available: [reward, style],
  };
}

export function buildRewardsDevMine(scenario = 'CODE_ISSUED') {
  const issued = {
    id: 'dev-red-1',
    status: scenario === 'USED' ? 'USED' : scenario === 'EXPIRED' ? 'EXPIRED' : 'ISSUED',
    coinCost: 1500,
    redeemedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + (scenario === 'EXPIRED' ? -86_400_000 : 7 * 86_400_000)).toISOString(),
    usedAt: scenario === 'USED' ? new Date().toISOString() : null,
    reward: {
      id: 'dev-partner',
      key: 'PARTNER_TEST_10',
      type: 'PARTNER_VOUCHER',
      titleKey: 'reward.partnerTest10.title',
      descriptionKey: 'reward.partnerTest10.description',
      termsKey: 'reward.partnerTest10.terms',
      imageKey: 'partner',
      partnerDisplay: { key: 'dev_partner', displayName: 'Dev Partner', logoAssetKey: null },
    },
    code: scenario === 'CODE_ISSUED' || scenario === 'USED' || scenario === 'EXPIRED' ? 'MEDI-DEV-QA-01' : null,
    codeMasked: '********QA-01',
    entitlement: null,
  };
  const groups = { active: [], used: [], expired: [], items: [issued] };
  if (issued.status === 'ISSUED') groups.active = [issued];
  if (issued.status === 'USED') groups.used = [issued];
  if (issued.status === 'EXPIRED') groups.expired = [issued];
  return groups;
}
