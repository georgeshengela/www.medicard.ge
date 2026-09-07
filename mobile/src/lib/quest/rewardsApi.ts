import { api } from '@/lib/api';

export type StoreReward = {
  id: string;
  key: string;
  type: string;
  titleKey: string;
  descriptionKey: string;
  termsKey: string | null;
  imageKey: string | null;
  coinCost: number;
  availability: string;
  inventoryState: string;
  inventoryRemaining: number | null;
  featured: boolean;
  partnerDisplay: { key: string; displayName: string; logoAssetKey: string | null } | null;
  validUntil: string | null;
  redemptionExpiryDays: number | null;
  entitlementKey: string | null;
  entitlementDurationDays: number | null;
  userEligibility: { canRedeem: boolean; reasonCode: string | null };
  userRedemptionCount: number;
  userBalance: number | null;
};

export type StoreCatalog = {
  balance: { coins: number };
  featured: StoreReward[];
  available: StoreReward[];
};

export type RedemptionItem = {
  id: string;
  status: string;
  coinCost: number;
  redeemedAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  reward: {
    id: string;
    key: string;
    type: string;
    titleKey: string;
    descriptionKey: string;
    termsKey: string | null;
    imageKey: string | null;
    partnerDisplay: StoreReward['partnerDisplay'];
  } | null;
  code: string | null;
  codeMasked: string | null;
  entitlement: {
    entitlementKey: string;
    startsAt: string;
    endsAt: string;
    status: string;
  } | null;
};

export type RedeemResult = {
  ok: boolean;
  redemption: RedemptionItem;
  wallet: { previousBalance: number; currentBalance: number; spent: number };
  entitlement: RedemptionItem['entitlement'];
  idempotentReplay?: boolean;
};

export const rewardsApi = {
  catalog: () => api.rewards.catalog(),
  get: (id: string) => api.rewards.get(id),
  redeem: (id: string, idempotencyKey: string) => api.rewards.redeem(id, idempotencyKey),
  mine: () => api.rewards.mine(),
  redemption: (id: string) => api.rewards.redemption(id),
  entitlements: () => api.rewards.entitlements(),
};
