/**
 * Phase 7 — Medi Rewards Store redemption engine.
 * Server-authoritative. Coin ledger = RewardLedger (signed amounts).
 * sourceType REWARD_REDEMPTION with negative COIN amount.
 */

import { randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';
import { QUEST_ECONOMY, validateRewardCoinCost } from './questEconomy.js';
import {
  CODE_STATUSES,
  ENTITLEMENT_KEYS,
  INVENTORY_MODES,
  LEDGER_SOURCE_REWARD_REDEMPTION,
  PERIOD_LIMIT_TYPES,
  QUEST_PREMIUM_ENTITLEMENT_EXISTS,
  REDEMPTION_STATUSES,
  REWARD_STATUSES,
  REWARD_TYPES,
  rewardCatalogSeedRows,
} from './rewardDefs.js';
import { getRewardBalance } from './quest.js';
import { findLiveCampaignForReward, explainMissingLiveCampaign } from './rewardCampaignRuntime.js';
import { PARTNER_STATUSES } from './rewardCampaignDefs.js';

const SUCCESS_STATUSES = new Set([REDEMPTION_STATUSES.ISSUED, REDEMPTION_STATUSES.USED]);

function dbOf(options = {}) {
  return options.db || prisma;
}

function httpError(message, status = 400, code = null) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function isUniqueViolation(error) {
  return error?.code === 'P2002';
}

function coinCostBucket(cost) {
  const n = Number(cost) || 0;
  if (n < 500) return 'LOW';
  if (n < 1000) return 'MEDIUM';
  if (n < 2500) return 'HIGH';
  return 'PREMIUM';
}

function maskCode(code) {
  const s = String(code || '');
  if (s.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

function startOfLocalDay(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const ymd = fmt.format(date);
  // Approximate UTC instant for period window starts — consistent per request timezone.
  return new Date(`${ymd}T00:00:00.000Z`);
}

function periodWindowStart(now, periodLimitType, timeZone, periodWindowDays) {
  if (!periodLimitType || periodLimitType === PERIOD_LIMIT_TYPES.NONE) return null;
  if (periodLimitType === PERIOD_LIMIT_TYPES.LIFETIME) return new Date(0);
  if (periodLimitType === PERIOD_LIMIT_TYPES.ROLLING_DAYS) {
    const days = Math.max(1, Number(periodWindowDays) || 1);
    return new Date(now.getTime() - days * 86_400_000);
  }
  const dayStart = startOfLocalDay(now, timeZone);
  if (periodLimitType === PERIOD_LIMIT_TYPES.DAILY) return dayStart;
  if (periodLimitType === PERIOD_LIMIT_TYPES.WEEKLY) {
    return new Date(dayStart.getTime() - 6 * 86_400_000);
  }
  if (periodLimitType === PERIOD_LIMIT_TYPES.MONTHLY) {
    return new Date(dayStart.getTime() - 29 * 86_400_000);
  }
  return null;
}

async function writeAudit(tx, { redemptionId, userId, rewardId, coinCost, fromStatus, toStatus, note }) {
  if (typeof tx.rewardRedemptionAudit?.create !== 'function') return;
  await tx.rewardRedemptionAudit.create({
    data: {
      id: randomUUID(),
      redemptionId,
      userId,
      rewardId,
      coinCost,
      fromStatus: fromStatus ?? null,
      toStatus,
      note: note || null,
    },
  });
}

export async function ensureRewardDefinitions(db = prisma) {
  if (typeof db.rewardDefinition?.upsert !== 'function') return [];
  const rows = rewardCatalogSeedRows();
  const out = [];
  for (const row of rows) {
    validateRewardCoinCost(row.coinCost);
    let status = row.status;
    if (row.type === REWARD_TYPES.PREMIUM_ACCESS && !QUEST_PREMIUM_ENTITLEMENT_EXISTS) {
      status = REWARD_STATUSES.DRAFT;
    }
    const existing = await db.rewardDefinition.findUnique({ where: { key: row.key } });
    if (!existing) {
      const created = await db.rewardDefinition.create({
        data: {
          id: randomUUID(),
          key: row.key,
          type: row.type,
          status,
          titleKey: row.titleKey,
          descriptionKey: row.descriptionKey,
          termsKey: row.termsKey ?? null,
          imageKey: row.imageKey ?? null,
          coinCost: row.coinCost,
          inventoryMode: row.inventoryMode,
          inventoryQuantity: row.inventoryQuantity ?? null,
          perUserLimit: row.perUserLimit ?? null,
          periodLimitType: row.periodLimitType ?? null,
          periodLimitCount: row.periodLimitCount ?? null,
          periodWindowDays: row.periodWindowDays ?? null,
          redemptionExpiryDays: row.redemptionExpiryDays ?? null,
          entitlementKey: row.entitlementKey ?? null,
          entitlementDurationDays: row.entitlementDurationDays ?? null,
          sortOrder: row.sortOrder,
          featured: Boolean(row.featured),
          metadata: row.metadata ?? undefined,
        },
      });
      out.push(created);
      continue;
    }
    // Keep operator pauses/ends; never promote DRAFT safety rewards; refresh catalog fields.
    const nextStatus =
      status === REWARD_STATUSES.DRAFT
        ? REWARD_STATUSES.DRAFT
        : existing.status === REWARD_STATUSES.PAUSED ||
            existing.status === REWARD_STATUSES.ENDED ||
            existing.status === REWARD_STATUSES.ARCHIVED
          ? existing.status
          : status;
    const updated = await db.rewardDefinition.update({
      where: { id: existing.id },
      data: {
        type: row.type,
        status: nextStatus,
        titleKey: row.titleKey,
        descriptionKey: row.descriptionKey,
        termsKey: row.termsKey ?? null,
        imageKey: row.imageKey ?? null,
        coinCost: row.coinCost,
        inventoryMode: row.inventoryMode,
        inventoryQuantity: row.inventoryQuantity ?? null,
        perUserLimit: row.perUserLimit ?? null,
        periodLimitType: row.periodLimitType ?? null,
        periodLimitCount: row.periodLimitCount ?? null,
        periodWindowDays: row.periodWindowDays ?? null,
        redemptionExpiryDays: row.redemptionExpiryDays ?? null,
        entitlementKey: row.entitlementKey ?? null,
        entitlementDurationDays: row.entitlementDurationDays ?? null,
        sortOrder: row.sortOrder,
        featured: Boolean(row.featured),
        metadata: row.metadata ?? undefined,
      },
    });
    out.push(updated);
  }
  return out;
}

async function countUserRedemptions(tx, userId, rewardId, { since = null } = {}) {
  const where = {
    userId,
    rewardId,
    status: { in: [...SUCCESS_STATUSES] },
  };
  if (since) where.redeemedAt = { gte: since };
  return tx.rewardRedemption.count({ where });
}

async function resolveUserTimezone(tx, userId, options = {}) {
  if (options.timezone) return options.timezone;
  if (typeof tx.userQuestProfile?.findUnique === 'function') {
    const profile = await tx.userQuestProfile.findUnique({ where: { userId } });
    if (profile?.timezone) return profile.timezone;
  }
  return 'UTC';
}

function inventoryStateFor(reward, availableCodes = null) {
  if (reward.inventoryMode === INVENTORY_MODES.UNLIMITED) {
    return { state: 'AVAILABLE', remaining: null };
  }
  if (reward.inventoryMode === INVENTORY_MODES.FINITE) {
    const remaining = Math.max(0, Number(reward.inventoryQuantity) || 0);
    return { state: remaining > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK', remaining };
  }
  if (reward.inventoryMode === INVENTORY_MODES.CODE_POOL) {
    const remaining = availableCodes == null ? null : availableCodes;
    if (remaining === 0) return { state: 'OUT_OF_STOCK', remaining: 0 };
    return { state: remaining == null ? 'AVAILABLE' : 'AVAILABLE', remaining };
  }
  return { state: 'UNAVAILABLE', remaining: null };
}

async function codePoolAvailable(tx, rewardId) {
  return tx.rewardCode.count({
    where: { rewardId, status: CODE_STATUSES.AVAILABLE },
  });
}

async function reserveCode(tx, rewardId, redemptionId, now) {
  // Atomic claim: updateMany with status filter → only one winner under concurrency.
  const candidates = await tx.rewardCode.findMany({
    where: {
      rewardId,
      status: CODE_STATUSES.AVAILABLE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: 8,
  });
  for (const candidate of candidates) {
    const result = await tx.rewardCode.updateMany({
      where: { id: candidate.id, status: CODE_STATUSES.AVAILABLE },
      data: {
        status: CODE_STATUSES.RESERVED,
        reservedByRedemptionId: redemptionId,
        reservedAt: now,
      },
    });
    if (result.count === 1) {
      return tx.rewardCode.findUnique({ where: { id: candidate.id } });
    }
  }
  return null;
}

function assertRewardRedeemable(reward, now) {
  if (!reward) throw httpError('ჯილდო ვერ მოიძებნა.', 404, 'REWARD_NOT_FOUND');
  if (reward.status === REWARD_STATUSES.DRAFT || reward.status === REWARD_STATUSES.ARCHIVED) {
    throw httpError('ჯილდო მიუწვდომელია.', 409, 'REWARD_NOT_ACTIVE');
  }
  if (reward.status === REWARD_STATUSES.PAUSED) {
    throw httpError('ჯილდო დროებით შეჩერებულია.', 409, 'REWARD_NOT_ACTIVE');
  }
  if (reward.status === REWARD_STATUSES.ENDED) {
    throw httpError('ჯილდოს ვადა ამოიწურა.', 409, 'REWARD_ENDED');
  }
  if (reward.status !== REWARD_STATUSES.ACTIVE) {
    throw httpError('ჯილდო მიუწვდომელია.', 409, 'REWARD_NOT_ACTIVE');
  }
  if (reward.startsAt && new Date(reward.startsAt) > now) {
    throw httpError('ჯილდო ჯერ არ დაწყებულა.', 409, 'REWARD_NOT_STARTED');
  }
  if (reward.endsAt && new Date(reward.endsAt) < now) {
    throw httpError('ჯილდოს ვადა ამოიწურა.', 409, 'REWARD_ENDED');
  }
  if (reward.type === REWARD_TYPES.PREMIUM_ACCESS && !QUEST_PREMIUM_ENTITLEMENT_EXISTS) {
    throw httpError('პრემიუმ უფლება მიუწვდომელია.', 409, 'REWARD_ENTITLEMENT_UNAVAILABLE');
  }
  if (
    (reward.type === REWARD_TYPES.DIGITAL_PERK || reward.type === REWARD_TYPES.PREMIUM_ACCESS) &&
    !reward.entitlementKey
  ) {
    throw httpError('უფლების გაცემა შეუძლებელია.', 409, 'REWARD_ENTITLEMENT_UNAVAILABLE');
  }
  validateRewardCoinCost(reward.coinCost);
}

async function assertUserLimits(tx, userId, reward, now, timeZone) {
  if (reward.perUserLimit != null) {
    const total = await countUserRedemptions(tx, userId, reward.id);
    if (total >= reward.perUserLimit) {
      throw httpError('ლიმიტი ამოწურულია.', 409, 'REWARD_USER_LIMIT');
    }
  }
  const periodType = reward.periodLimitType || PERIOD_LIMIT_TYPES.NONE;
  if (periodType && periodType !== PERIOD_LIMIT_TYPES.NONE) {
    const since = periodWindowStart(now, periodType, timeZone, reward.periodWindowDays);
    const limit = Number(reward.periodLimitCount) || 1;
    const count = await countUserRedemptions(tx, userId, reward.id, { since });
    if (count >= limit) {
      throw httpError('პერიოდის ლიმიტი ამოწურულია.', 409, 'REWARD_PERIOD_LIMIT');
    }
  }
  const maxActive = Number(reward.metadata?.maxActiveEntitlement);
  if (maxActive > 0 && reward.entitlementKey) {
    const active = await tx.userRewardEntitlement.count({
      where: {
        userId,
        entitlementKey: reward.entitlementKey,
        status: 'ACTIVE',
        endsAt: { gt: now },
      },
    });
    if (active >= maxActive) {
      throw httpError('აქტიური უფლება უკვე გაქვთ.', 409, 'REWARD_USER_LIMIT');
    }
  }
}

function publicPartner(partner) {
  if (!partner || partner.status !== 'ACTIVE') return null;
  return {
    key: partner.key,
    displayName: partner.displayName,
    logoAssetKey: partner.logoAssetKey || null,
    category: partner.category || null,
  };
}

function publicReward(reward, extras = {}) {
  const inventory = extras.inventory || inventoryStateFor(reward, extras.availableCodes);
  return {
    id: reward.id,
    key: reward.key,
    type: reward.type,
    titleKey: reward.titleKey,
    descriptionKey: reward.descriptionKey,
    termsKey: reward.termsKey || null,
    imageKey: reward.imageKey || null,
    coinCost: reward.coinCost,
    availability: reward.status,
    inventoryState: inventory.state,
    inventoryRemaining: inventory.remaining,
    featured: Boolean(reward.featured),
    partnerDisplay: publicPartner(reward.partner),
    campaignKey: extras.campaignKey || null,
    commercialValueMinor: extras.commercialValueMinor ?? null,
    commercialCurrency: extras.commercialCurrency || null,
    validUntil: reward.endsAt instanceof Date ? reward.endsAt.toISOString() : reward.endsAt || null,
    redemptionExpiryDays: reward.redemptionExpiryDays ?? null,
    entitlementKey: reward.entitlementKey || null,
    entitlementDurationDays: reward.entitlementDurationDays ?? null,
    userEligibility: extras.userEligibility || { canRedeem: true, reasonCode: null },
    userRedemptionCount: extras.userRedemptionCount ?? 0,
    userBalance: extras.userBalance ?? null,
  };
}

function publicRedemption(row, { includeCode = false } = {}) {
  if (!row) return null;
  const code = row.code || null;
  return {
    id: row.id,
    status: row.status,
    coinCost: row.coinCost,
    redeemedAt: row.redeemedAt instanceof Date ? row.redeemedAt.toISOString() : row.redeemedAt,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : row.expiresAt,
    usedAt: row.usedAt instanceof Date ? row.usedAt.toISOString() : row.usedAt,
    reward: row.reward
      ? {
          id: row.reward.id,
          key: row.reward.key,
          type: row.reward.type,
          titleKey: row.reward.titleKey,
          descriptionKey: row.reward.descriptionKey,
          termsKey: row.reward.termsKey || null,
          imageKey: row.reward.imageKey || null,
          partnerDisplay: publicPartner(row.reward.partner),
        }
      : null,
    code: includeCode && code ? code.code : null,
    codeMasked: includeCode && code ? maskCode(code.code) : null,
    entitlement: row.entitlements?.[0]
      ? {
          entitlementKey: row.entitlements[0].entitlementKey,
          startsAt:
            row.entitlements[0].startsAt instanceof Date
              ? row.entitlements[0].startsAt.toISOString()
              : row.entitlements[0].startsAt,
          endsAt:
            row.entitlements[0].endsAt instanceof Date
              ? row.entitlements[0].endsAt.toISOString()
              : row.entitlements[0].endsAt,
          status: row.entitlements[0].status,
        }
      : null,
  };
}

async function userEligibilityFor(tx, userId, reward, balance, now, timeZone) {
  try {
    assertRewardRedeemable(reward, now);
    await assertUserLimits(tx, userId, reward, now, timeZone);
    const inv = inventoryStateFor(
      reward,
      reward.inventoryMode === INVENTORY_MODES.CODE_POOL ? await codePoolAvailable(tx, reward.id) : null,
    );
    if (inv.state === 'OUT_OF_STOCK') {
      return { canRedeem: false, reasonCode: 'REWARD_OUT_OF_STOCK', inventory: inv };
    }
    if (balance.coins < reward.coinCost) {
      return { canRedeem: false, reasonCode: 'REWARD_INSUFFICIENT_COINS', inventory: inv };
    }
    return { canRedeem: true, reasonCode: null, inventory: inv };
  } catch (error) {
    return {
      canRedeem: false,
      reasonCode: error.code || 'REWARD_NOT_ACTIVE',
      inventory: inventoryStateFor(reward),
    };
  }
}

export async function listStoreRewards(userId, options = {}) {
  const db = dbOf(options);
  await ensureRewardDefinitions(db);
  const now = options.now || new Date();
  const timeZone = await resolveUserTimezone(db, userId, options);
  const balance = await getRewardBalance(userId, { ...options, db });
  const rewards = await db.rewardDefinition.findMany({
    where: { status: REWARD_STATUSES.ACTIVE },
    include: { partner: true },
    orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }],
  });
  const items = [];
  for (const reward of rewards) {
    if (reward.metadata?.neverShowInProduction) continue;
    if (reward.startsAt && new Date(reward.startsAt) > now) continue;
    if (reward.endsAt && new Date(reward.endsAt) < now) continue;
    // Phase 8 — partner must be ACTIVE when linked
    if (reward.partnerId && reward.partner && reward.partner.status !== PARTNER_STATUSES.ACTIVE) {
      continue;
    }
    // If campaigns exist for this reward, require a live one (first-party w/o campaigns OK)
    let liveCampaign = null;
    if (typeof db.rewardCampaign?.count === 'function') {
      const campaignCount = await db.rewardCampaign.count({
        where: { rewardDefinitionId: reward.id },
      });
      if (campaignCount > 0) {
        liveCampaign = await findLiveCampaignForReward(db, reward.id, now);
        if (!liveCampaign) continue;
      }
    }
    const count = await countUserRedemptions(db, userId, reward.id);
    const availableCodes =
      reward.inventoryMode === INVENTORY_MODES.CODE_POOL ? await codePoolAvailable(db, reward.id) : null;
    const eligibility = await userEligibilityFor(db, userId, reward, balance, now, timeZone);
    items.push(
      publicReward(reward, {
        userEligibility: { canRedeem: eligibility.canRedeem, reasonCode: eligibility.reasonCode },
        userRedemptionCount: count,
        userBalance: balance.coins,
        inventory: eligibility.inventory,
        availableCodes,
        campaignKey: liveCampaign?.key || null,
        commercialValueMinor: liveCampaign?.commercialValueMinor ?? null,
        commercialCurrency: liveCampaign?.commercialCurrency || null,
      }),
    );
  }
  return {
    balance: { coins: balance.coins },
    featured: items.filter((item) => item.featured),
    available: items,
  };
}

export async function getStoreReward(userId, rewardId, options = {}) {
  const db = dbOf(options);
  await ensureRewardDefinitions(db);
  const now = options.now || new Date();
  const timeZone = await resolveUserTimezone(db, userId, options);
  const balance = await getRewardBalance(userId, { ...options, db });
  const reward = await db.rewardDefinition.findFirst({
    where: { OR: [{ id: rewardId }, { key: rewardId }] },
    include: { partner: true },
  });
  if (!reward || reward.status !== REWARD_STATUSES.ACTIVE || reward.metadata?.neverShowInProduction) {
    throw httpError('ჯილდო ვერ მოიძებნა.', 404, 'REWARD_NOT_FOUND');
  }
  if (reward.partnerId && reward.partner && reward.partner.status !== PARTNER_STATUSES.ACTIVE) {
    throw httpError('ჯილდო ვერ მოიძებნა.', 404, 'REWARD_NOT_FOUND');
  }
  let liveCampaign = null;
  if (typeof db.rewardCampaign?.count === 'function') {
    const campaignCount = await db.rewardCampaign.count({
      where: { rewardDefinitionId: reward.id },
    });
    if (campaignCount > 0) {
      liveCampaign = await findLiveCampaignForReward(db, reward.id, now);
      if (!liveCampaign) throw httpError('ჯილდო ვერ მოიძებნა.', 404, 'REWARD_NOT_FOUND');
    }
  }
  const count = await countUserRedemptions(db, userId, reward.id);
  const availableCodes =
    reward.inventoryMode === INVENTORY_MODES.CODE_POOL ? await codePoolAvailable(db, reward.id) : null;
  const eligibility = await userEligibilityFor(db, userId, reward, balance, now, timeZone);
  return publicReward(reward, {
    userEligibility: { canRedeem: eligibility.canRedeem, reasonCode: eligibility.reasonCode },
    userRedemptionCount: count,
    userBalance: balance.coins,
    inventory: eligibility.inventory,
    availableCodes,
    campaignKey: liveCampaign?.key || null,
    commercialValueMinor: liveCampaign?.commercialValueMinor ?? null,
    commercialCurrency: liveCampaign?.commercialCurrency || null,
  });
}

export async function listMyRedemptions(userId, options = {}) {
  const db = dbOf(options);
  const now = options.now || new Date();
  // Soft-expire in response; do not auto-refund.
  const rows = await db.rewardRedemption.findMany({
    where: { userId, status: { not: REDEMPTION_STATUSES.CANCELLED } },
    include: {
      reward: { include: { partner: true } },
      code: true,
      entitlements: true,
    },
    orderBy: { redeemedAt: 'desc' },
    take: Math.min(100, Number(options.take) || 50),
  });
  const items = [];
  for (const row of rows) {
    let status = row.status;
    if (
      status === REDEMPTION_STATUSES.ISSUED &&
      row.expiresAt &&
      new Date(row.expiresAt) < now
    ) {
      status = REDEMPTION_STATUSES.EXPIRED;
      if (options.db === prisma || !options.db) {
        await db.rewardRedemption
          .update({ where: { id: row.id }, data: { status: REDEMPTION_STATUSES.EXPIRED } })
          .catch(() => {});
      }
    }
    items.push(publicRedemption({ ...row, status }, { includeCode: true }));
  }
  return {
    active: items.filter((i) => i.status === REDEMPTION_STATUSES.ISSUED),
    used: items.filter((i) => i.status === REDEMPTION_STATUSES.USED),
    expired: items.filter((i) => i.status === REDEMPTION_STATUSES.EXPIRED),
    items,
  };
}

export async function getMyRedemption(userId, redemptionId, options = {}) {
  const db = dbOf(options);
  const row = await db.rewardRedemption.findFirst({
    where: { id: redemptionId, userId },
    include: {
      reward: { include: { partner: true } },
      code: true,
      entitlements: true,
    },
  });
  if (!row) throw httpError('გაცვლა ვერ მოიძებნა.', 404, 'REWARD_NOT_FOUND');
  return publicRedemption(row, { includeCode: true });
}

/**
 * Active cosmetic entitlements for presentation (server time).
 * Mobile must not invent validity.
 */
export async function getActiveRewardEntitlements(userId, options = {}) {
  const db = dbOf(options);
  if (typeof db.userRewardEntitlement?.findMany !== 'function') return [];
  const now = options.now || new Date();
  const rows = await db.userRewardEntitlement.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      endsAt: { gt: now },
    },
    orderBy: { endsAt: 'desc' },
  });
  return rows.map((row) => ({
    entitlementKey: row.entitlementKey,
    startsAt: row.startsAt instanceof Date ? row.startsAt.toISOString() : row.startsAt,
    endsAt: row.endsAt instanceof Date ? row.endsAt.toISOString() : row.endsAt,
  }));
}

export async function redeemReward(userId, rewardId, options = {}) {
  const db = dbOf(options);
  await ensureRewardDefinitions(db);
  const idempotencyKey = String(options.idempotencyKey || '').trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    throw httpError('idempotencyKey სავალდებულოა.', 400, 'REWARD_REDEMPTION_CONFLICT');
  }

  const existing = await db.rewardRedemption.findFirst({
    where: { userId, idempotencyKey },
    include: {
      reward: { include: { partner: true } },
      code: true,
      entitlements: true,
    },
  });
  if (existing) {
    const balance = await getRewardBalance(userId, { ...options, db });
    return {
      redemption: publicRedemption(existing, { includeCode: true }),
      wallet: {
        previousBalance: balance.coins + existing.coinCost,
        currentBalance: balance.coins,
        spent: existing.coinCost,
      },
      entitlement: publicRedemption(existing, { includeCode: true }).entitlement,
      idempotentReplay: true,
    };
  }

  const run = async (tx) => {
    const now = options.now || new Date();
    const timeZone = await resolveUserTimezone(tx, userId, options);

    const reward = await tx.rewardDefinition.findFirst({
      where: { OR: [{ id: rewardId }, { key: rewardId }] },
      include: { partner: true },
    });
    assertRewardRedeemable(reward, now);
    if (reward.partnerId && reward.partner && reward.partner.status !== PARTNER_STATUSES.ACTIVE) {
      throw httpError('პარტნიორი მიუწვდომელია.', 409, 'REWARD_PARTNER_INACTIVE');
    }
    let liveCampaign = null;
    if (typeof tx.rewardCampaign?.count === 'function') {
      const campaignCount = await tx.rewardCampaign.count({
        where: { rewardDefinitionId: reward.id },
      });
      if (campaignCount > 0) {
        liveCampaign = await findLiveCampaignForReward(tx, reward.id, now);
        if (!liveCampaign) {
          const why = await explainMissingLiveCampaign(tx, reward.id, now);
          throw httpError(why.message, 409, why.code);
        }
        if (liveCampaign.maxRedemptions != null) {
          const issued = await tx.rewardRedemption.count({
            where: {
              campaignId: liveCampaign.id,
              status: { in: [...SUCCESS_STATUSES] },
            },
          });
          if (issued >= Number(liveCampaign.maxRedemptions)) {
            throw httpError('კამპანიის ლიმიტი ამოწურულია.', 409, 'REWARD_CAMPAIGN_LIMIT');
          }
        }
      }
    }
    await assertUserLimits(tx, userId, reward, now, timeZone);

    if (reward.inventoryMode === INVENTORY_MODES.FINITE) {
      const stock = await tx.rewardDefinition.updateMany({
        where: {
          id: reward.id,
          inventoryQuantity: { gt: 0 },
          status: REWARD_STATUSES.ACTIVE,
        },
        data: { inventoryQuantity: { decrement: 1 } },
      });
      if (stock.count !== 1) {
        throw httpError('მარაგი ამოწურულია.', 409, 'REWARD_OUT_OF_STOCK');
      }
      await tx.rewardInventoryAdjustment.create({
        data: {
          id: randomUUID(),
          rewardId: reward.id,
          delta: -1,
          reason: 'REDEMPTION',
          actorType: 'SYSTEM',
          actorId: userId,
        },
      });
    }

    const previousBalance = await getRewardBalance(userId, { ...options, db: tx });
    if (previousBalance.coins < reward.coinCost) {
      throw httpError('არასაკმარისი Medi Coins.', 409, 'REWARD_INSUFFICIENT_COINS');
    }

    const redemptionId = randomUUID();
    let codeRow = null;
    if (reward.inventoryMode === INVENTORY_MODES.CODE_POOL) {
      codeRow = await reserveCode(tx, reward.id, redemptionId, now);
      if (!codeRow) {
        throw httpError('კოდი მიუწვდომელია.', 409, 'REWARD_CODE_UNAVAILABLE');
      }
    }

    let expiresAt = null;
    if (reward.redemptionExpiryDays != null) {
      expiresAt = new Date(now.getTime() + Number(reward.redemptionExpiryDays) * 86_400_000);
    } else if (reward.entitlementDurationDays != null) {
      expiresAt = new Date(now.getTime() + Number(reward.entitlementDurationDays) * 86_400_000);
    }
    if (codeRow?.expiresAt) {
      const codeExp = new Date(codeRow.expiresAt);
      if (!expiresAt || codeExp < expiresAt) expiresAt = codeExp;
    }

    let redemption;
    try {
      const createData = {
        id: redemptionId,
        userId,
        rewardId: reward.id,
        status: REDEMPTION_STATUSES.ISSUED,
        coinCost: reward.coinCost,
        codeId: codeRow?.id || null,
        idempotencyKey,
        redeemedAt: now,
        expiresAt,
      };
      // Phase 8 snapshot fields (ignored if client/schema lag)
      if (liveCampaign?.id) createData.campaignId = liveCampaign.id;
      if (liveCampaign?.partnerId || reward.partnerId) {
        createData.partnerIdSnapshot = liveCampaign?.partnerId || reward.partnerId;
      }
      if (liveCampaign?.commercialValueMinor != null) {
        createData.commercialValueMinorSnapshot = liveCampaign.commercialValueMinor;
      }
      if (liveCampaign?.commercialCurrency) {
        createData.commercialCurrencySnapshot = liveCampaign.commercialCurrency;
      }
      redemption = await tx.rewardRedemption.create({ data: createData });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw httpError('გაცვლა უკვე შესრულდა.', 409, 'REWARD_ALREADY_REDEEMED');
      }
      throw error;
    }

    if (codeRow) {
      await tx.rewardCode.update({
        where: { id: codeRow.id },
        data: {
          status: CODE_STATUSES.USED,
          usedAt: now,
          expiresAt,
          reservedByRedemptionId: redemptionId,
        },
      });
    }

    const ledgerId = randomUUID();
    try {
      await tx.rewardLedger.create({
        data: {
          id: ledgerId,
          userId,
          currency: 'COIN',
          amount: -reward.coinCost,
          transactionType: 'REDEEM',
          sourceType: LEDGER_SOURCE_REWARD_REDEMPTION,
          sourceId: redemptionId,
          createdAt: now,
          metadata: { rewardKey: reward.key, rewardType: reward.type },
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw httpError('გაცვლა კონფლიქტშია.', 409, 'REWARD_REDEMPTION_CONFLICT');
      }
      throw error;
    }

    await tx.rewardRedemption.update({
      where: { id: redemptionId },
      data: { ledgerEntryId: ledgerId },
    });

    let entitlement = null;
    if (reward.entitlementKey && reward.entitlementDurationDays) {
      const endsAt = new Date(now.getTime() + Number(reward.entitlementDurationDays) * 86_400_000);
      entitlement = await tx.userRewardEntitlement.create({
        data: {
          id: randomUUID(),
          userId,
          rewardRedemptionId: redemptionId,
          entitlementKey: reward.entitlementKey,
          startsAt: now,
          endsAt,
          status: 'ACTIVE',
        },
      });
    } else if (
      reward.type === REWARD_TYPES.DIGITAL_PERK ||
      reward.type === REWARD_TYPES.PREMIUM_ACCESS
    ) {
      throw httpError('უფლების გაცემა შეუძლებელია.', 409, 'REWARD_ENTITLEMENT_UNAVAILABLE');
    }

    if (typeof tx.userQuestProfile?.update === 'function') {
      const nextCoins = previousBalance.coins - reward.coinCost;
      if (nextCoins < 0) {
        throw httpError('არასაკმარისი Medi Coins.', 409, 'REWARD_INSUFFICIENT_COINS');
      }
      try {
        await tx.userQuestProfile.update({
          where: { userId },
          data: { cachedCoinBalance: nextCoins },
        });
      } catch {
        // Profile may not exist in pure ledger tests — balance still authoritative via ledger.
      }
    }

    await writeAudit(tx, {
      redemptionId,
      userId,
      rewardId: reward.id,
      coinCost: reward.coinCost,
      fromStatus: null,
      toStatus: REDEMPTION_STATUSES.ISSUED,
      note: 'redeem',
    });

    const currentBalance = previousBalance.coins - reward.coinCost;
    if (currentBalance < 0) {
      throw httpError('არასაკმარისი Medi Coins.', 409, 'REWARD_INSUFFICIENT_COINS');
    }

    const full = await tx.rewardRedemption.findUnique({
      where: { id: redemptionId },
      include: {
        reward: { include: { partner: true } },
        code: true,
        entitlements: true,
      },
    });

    return {
      redemption: publicRedemption(full, { includeCode: true }),
      wallet: {
        previousBalance: previousBalance.coins,
        currentBalance,
        spent: reward.coinCost,
      },
      entitlement: entitlement
        ? {
            entitlementKey: entitlement.entitlementKey,
            startsAt: entitlement.startsAt instanceof Date ? entitlement.startsAt.toISOString() : entitlement.startsAt,
            endsAt: entitlement.endsAt instanceof Date ? entitlement.endsAt.toISOString() : entitlement.endsAt,
            status: entitlement.status,
          }
        : publicRedemption(full, { includeCode: true }).entitlement,
      idempotentReplay: false,
      _analytics: {
        rewardKey: reward.key,
        rewardType: reward.type,
        coinCost: reward.coinCost,
        partnerPresent: Boolean(reward.partnerId),
      },
    };
  };

  let result;
  try {
    if (typeof db.$transaction === 'function') {
      // Serializable when Prisma supports it; fakeDb serializes via queue.
      result = await db.$transaction((tx) => run(tx), {
        isolationLevel: 'Serializable',
        maxWait: 8_000,
        timeout: 15_000,
      }).catch(async (error) => {
        // Fake DB / older clients may reject isolationLevel options.
        if (error?.message?.includes('isolation') || error?.name === 'PrismaClientValidationError') {
          return db.$transaction((tx) => run(tx));
        }
        // Serialization failure → deterministic conflict for client retry.
        if (error?.code === 'P2034' || /could not serialize|serialization/i.test(error?.message || '')) {
          throw httpError('გაცვლა კონფლიქტშია. ხელახლა სცადე.', 409, 'REWARD_REDEMPTION_CONFLICT');
        }
        throw error;
      });
    } else {
      result = await run(db);
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      const replay = await db.rewardRedemption.findFirst({
        where: { userId, idempotencyKey },
        include: {
          reward: { include: { partner: true } },
          code: true,
          entitlements: true,
        },
      });
      if (replay) {
        const balance = await getRewardBalance(userId, { ...options, db });
        return {
          redemption: publicRedemption(replay, { includeCode: true }),
          wallet: {
            previousBalance: balance.coins + replay.coinCost,
            currentBalance: balance.coins,
            spent: replay.coinCost,
          },
          entitlement: publicRedemption(replay, { includeCode: true }).entitlement,
          idempotentReplay: true,
        };
      }
      throw httpError('გაცვლა კონფლიქტშია.', 409, 'REWARD_REDEMPTION_CONFLICT');
    }
    throw error;
  }

  if (!options.db || options.db === prisma) {
    // Analytics are client ProductEvents (privacy-safe buckets). No server quest-kind write.
  }
  delete result._analytics;
  return result;
}

/** Internal: import partner codes (no public upload). Never logs full codes. */
export async function importRewardCodes(rewardKey, codes, options = {}) {
  const db = dbOf(options);
  const reward = await db.rewardDefinition.findUnique({ where: { key: rewardKey } });
  if (!reward) throw httpError('ჯილდო ვერ მოიძებნა.', 404, 'REWARD_NOT_FOUND');
  if (reward.inventoryMode !== INVENTORY_MODES.CODE_POOL) {
    throw httpError('კოდის იმპორტი მხოლოდ CODE_POOL-ისთვისაა.', 400);
  }
  let accepted = 0;
  let rejected = 0;
  const unique = [...new Set((codes || []).map((c) => String(c || '').trim()).filter(Boolean))];
  for (const code of unique) {
    try {
      await db.rewardCode.create({
        data: {
          id: randomUUID(),
          rewardId: reward.id,
          code,
          status: CODE_STATUSES.AVAILABLE,
        },
      });
      accepted += 1;
    } catch (error) {
      if (isUniqueViolation(error)) rejected += 1;
      else throw error;
    }
  }
  return { accepted, rejected, total: unique.length };
}

export {
  coinCostBucket,
  maskCode,
  ENTITLEMENT_KEYS,
  QUEST_ECONOMY,
};
