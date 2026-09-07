/**
 * Phase 8 — Rewards Admin operations (commercial only; no health data).
 */
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';
import { writeAdminAudit } from './adminAudit.js';
import {
  CAMPAIGN_STATUSES,
  DEFAULT_LOW_STOCK_THRESHOLD,
  FUNDING_MODELS,
  PARTNER_ANALYTICS_FORBIDDEN_KEYS,
  PARTNER_CATEGORIES,
  PARTNER_STATUSES,
  STOCK_STATES,
} from './rewardCampaignDefs.js';
import {
  CODE_STATUSES,
  INVENTORY_MODES,
  LEDGER_SOURCE_REWARD_REDEMPTION,
  QUEST_PREMIUM_ENTITLEMENT_EXISTS,
  REWARD_STATUSES,
  REWARD_TYPES,
} from './rewardDefs.js';
import { maskCode } from './rewards.js';

function httpError(message, status = 400, code = null) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function dbOf(options = {}) {
  return options.db || prisma;
}

function isPartnerActive(status) {
  return String(status) === PARTNER_STATUSES.ACTIVE;
}

function scrubForbidden(obj, seen = new WeakSet()) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return '[cycle]';
  seen.add(obj);
  if (Array.isArray(obj)) return obj.map((x) => scrubForbidden(x, seen));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k);
    if (PARTNER_ANALYTICS_FORBIDDEN_KEYS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      continue;
    }
    out[k] = scrubForbidden(v, seen);
  }
  return out;
}

export function assertNoHealthFields(payload) {
  const json = JSON.stringify(payload || {});
  for (const key of PARTNER_ANALYTICS_FORBIDDEN_KEYS) {
    const re = new RegExp(`"${key}"\\s*:`, 'i');
    if (re.test(json)) {
      throw httpError(`Forbidden health field leaked: ${key}`, 500, 'REWARD_PRIVACY_VIOLATION');
    }
  }
  return payload;
}

export function maskedUserRef(userId) {
  const s = String(userId || '');
  if (s.length < 8) return 'usr_••••';
  return `usr_${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function inventoryStockState({ mode, available, threshold }) {
  if (mode === INVENTORY_MODES.UNLIMITED) return STOCK_STATES.UNLIMITED;
  const n = Number(available) || 0;
  const low = Number.isFinite(Number(threshold)) ? Number(threshold) : DEFAULT_LOW_STOCK_THRESHOLD;
  if (n <= 0) return STOCK_STATES.OUT;
  if (n <= low) return STOCK_STATES.LOW;
  return STOCK_STATES.OK;
}

export async function codeInventoryCounts(rewardId, options = {}) {
  const db = dbOf(options);
  const groups = await db.rewardCode.groupBy({
    by: ['status'],
    where: { rewardId },
    _count: { _all: true },
  });
  const counts = {
    total: 0,
    available: 0,
    reserved: 0,
    used: 0,
    expired: 0,
    disabled: 0,
  };
  for (const g of groups) {
    const n = g._count._all;
    counts.total += n;
    const st = String(g.status).toLowerCase();
    if (st === 'available') counts.available += n;
    else if (st === 'reserved') counts.reserved += n;
    else if (st === 'used') counts.used += n;
    else if (st === 'expired') counts.expired += n;
    else if (st === 'disabled') counts.disabled += n;
  }
  return counts;
}

export function serializeCampaignForPartner(campaign, aggregates = {}) {
  const payload = scrubForbidden({
    key: campaign.key,
    name: campaign.name,
    status: campaign.status,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    fundingModel: campaign.fundingModel || null,
    commercialValueMinor: campaign.commercialValueMinor ?? null,
    commercialCurrency: campaign.commercialCurrency || null,
    marketCountryCode: campaign.marketCountryCode || null,
    inventory: aggregates.inventory || null,
    redemptions: aggregates.redemptions || null,
    partner: campaign.partner
      ? {
          key: campaign.partner.key,
          displayName: campaign.partner.displayName,
          category: campaign.partner.category || null,
        }
      : null,
    reward: campaign.reward
      ? {
          key: campaign.reward.key,
          type: campaign.reward.type,
          coinCost: campaign.reward.coinCost,
        }
      : null,
  });
  return assertNoHealthFields(payload);
}

export function validateRewardActivation(reward, { availableCodes = 0 } = {}) {
  const errors = [];
  if (!reward?.titleKey) errors.push('titleKey required');
  if (!reward?.descriptionKey) errors.push('descriptionKey required');
  if (!Number.isFinite(Number(reward?.coinCost)) || Number(reward.coinCost) < 1) {
    errors.push('coinCost invalid');
  }
  if (reward.type === REWARD_TYPES.PREMIUM_ACCESS && !QUEST_PREMIUM_ENTITLEMENT_EXISTS) {
    errors.push('PREMIUM_ACCESS fulfillment unavailable');
  }
  if (
    (reward.type === REWARD_TYPES.DIGITAL_PERK || reward.type === REWARD_TYPES.PREMIUM_ACCESS) &&
    !reward.entitlementKey
  ) {
    errors.push('entitlementKey required');
  }
  if (
    (reward.type === REWARD_TYPES.COUPON_CODE || reward.type === REWARD_TYPES.PARTNER_VOUCHER) &&
    reward.inventoryMode === INVENTORY_MODES.CODE_POOL &&
    availableCodes < 0
  ) {
    errors.push('code pool invalid');
  }
  return errors;
}

export function validateCampaignActivation({ partner, reward, campaign, availableCodes = 0 }) {
  const errors = [];
  if (!isPartnerActive(partner?.status)) errors.push('partner must be ACTIVE');
  if (reward?.status !== REWARD_STATUSES.ACTIVE && reward?.status !== REWARD_STATUSES.DRAFT) {
    // allow activating campaign while promoting reward together — but reward must be activatable
  }
  errors.push(...validateRewardActivation(reward, { availableCodes }));
  if (!campaign?.name) errors.push('campaign name required');
  if (campaign?.startsAt && campaign?.endsAt && new Date(campaign.startsAt) >= new Date(campaign.endsAt)) {
    errors.push('invalid date range');
  }
  if (campaign?.marketCountryCode) {
    if (!/^[A-Z]{2}$/.test(String(campaign.marketCountryCode))) {
      errors.push('marketCountryCode must be ISO-3166 alpha-2');
    }
    // Phase 8: no trusted account-market signal yet (GPS/UserLocation is forbidden).
    // Do not activate geo-restricted production campaigns until a canonical market exists.
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_GEO_RESTRICTED_REWARDS !== '1') {
      errors.push('geo-restricted campaigns require trusted market signal (not available)');
    }
  }
  if (
    campaign?.commercialCurrency &&
    !/^[A-Z]{3}$/.test(String(campaign.commercialCurrency))
  ) {
    errors.push('commercialCurrency must be ISO-4217');
  }
  if (campaign?.fundingModel && !FUNDING_MODELS.includes(campaign.fundingModel)) {
    errors.push('invalid fundingModel');
  }
  if (
    reward?.inventoryMode === INVENTORY_MODES.CODE_POOL &&
    availableCodes <= 0
  ) {
    // allow ACTIVE with zero stock (shows OUT) — warn only via inventory state, not hard block
  }
  return errors;
}

export async function listPartners(query = {}, options = {}) {
  const db = dbOf(options);
  const where = {};
  if (query.status) where.status = String(query.status);
  if (query.category) where.category = String(query.category);
  const rows = await db.rewardPartner.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: Math.min(200, Number(query.limit) || 50),
  });
  return rows.map((p) => ({
    id: p.id,
    key: p.key,
    displayName: p.displayName,
    legalName: p.legalName,
    category: p.category,
    status: p.status,
    countryCode: p.countryCode,
    website: p.website,
    updatedAt: p.updatedAt,
  }));
}

function pickPartnerField(input, previous, field, fallback = null) {
  if (input[field] !== undefined) return input[field];
  if (previous && previous[field] !== undefined) return previous[field];
  return fallback;
}

export async function upsertPartner(input, { admin } = {}, options = {}) {
  const db = dbOf(options);
  let previous = null;
  if (input.id) {
    previous = await db.rewardPartner.findUnique({ where: { id: input.id } });
    if (!previous) throw httpError('partner not found', 404);
  }
  const key = String(input.key || previous?.key || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_');
  if (!key || key.length < 3) throw httpError('partner key invalid', 400);
  const category = pickPartnerField(input, previous, 'category', null);
  if (category && !PARTNER_CATEGORIES.includes(category)) {
    throw httpError('invalid category', 400);
  }
  const status = input.status || previous?.status || PARTNER_STATUSES.DRAFT;
  if (!Object.values(PARTNER_STATUSES).includes(status)) {
    throw httpError('invalid partner status', 400);
  }
  const data = {
    key,
    displayName: String(pickPartnerField(input, previous, 'displayName', '') || '').trim() || key,
    legalName: pickPartnerField(input, previous, 'legalName', null) || null,
    category,
    logoAssetKey: pickPartnerField(input, previous, 'logoAssetKey', null) || null,
    website: pickPartnerField(input, previous, 'website', null) || null,
    contactName: pickPartnerField(input, previous, 'contactName', null) || null,
    contactEmail: pickPartnerField(input, previous, 'contactEmail', null) || null,
    countryCode: pickPartnerField(input, previous, 'countryCode', null) || null,
    notes: pickPartnerField(input, previous, 'notes', null) || null,
    lowStockThreshold: pickPartnerField(input, previous, 'lowStockThreshold', null) ?? null,
    status,
  };
  let row;
  if (input.id) {
    row = await db.rewardPartner.update({ where: { id: input.id }, data });
  } else {
    row = await db.rewardPartner.upsert({
      where: { key },
      create: { id: randomUUID(), ...data },
      update: data,
    });
  }
  await writeAdminAudit({
    admin,
    action: previous ? 'PARTNER_UPDATED' : 'PARTNER_CREATED',
    targetType: 'rewardPartner',
    targetId: row.id,
    previousValue: previous,
    newValue: { id: row.id, key: row.key, status: row.status, category: row.category },
  });
  return row;
}

export async function createPartnerVoucherDefinition(input, { admin } = {}, options = {}) {
  const db = dbOf(options);
  const key = String(input.key || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_');
  if (!key || key.length < 3) throw httpError('reward key invalid', 400);
  const partner = await db.rewardPartner.findUnique({ where: { id: input.partnerId } });
  if (!partner) throw httpError('partner not found', 404);
  const coinCost = Number(input.coinCost);
  if (!Number.isFinite(coinCost) || coinCost < 1) throw httpError('coinCost invalid', 400);
  const inventoryMode = input.inventoryMode || INVENTORY_MODES.CODE_POOL;
  if (!Object.values(INVENTORY_MODES).includes(inventoryMode)) {
    throw httpError('invalid inventory mode', 400);
  }
  const title = String(input.title || input.displayName || key).trim();
  if (!title) throw httpError('title required', 400);
  const row = await db.rewardDefinition.create({
    data: {
      id: randomUUID(),
      key,
      type: REWARD_TYPES.PARTNER_VOUCHER,
      status: REWARD_STATUSES.DRAFT,
      titleKey: title,
      descriptionKey: String(input.description || title).trim(),
      termsKey: input.terms ? String(input.terms).trim() : null,
      coinCost,
      partnerId: partner.id,
      inventoryMode,
      inventoryQuantity:
        inventoryMode === INVENTORY_MODES.FINITE ? Number(input.inventoryQuantity) || 0 : null,
      featured: false,
      sortOrder: Number(input.sortOrder) || 80,
      redemptionExpiryDays: input.redemptionExpiryDays ?? 30,
      lowStockThreshold: input.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
    },
  });
  await writeAdminAudit({
    admin,
    action: 'REWARD_DEFINITION_CREATED',
    targetType: 'rewardDefinition',
    targetId: row.id,
    previousValue: null,
    newValue: { id: row.id, key: row.key, type: row.type, partnerId: partner.id },
  });
  return row;
}

export async function listCampaigns(query = {}, options = {}) {
  const db = dbOf(options);
  const where = {};
  if (query.status) where.status = String(query.status);
  if (query.partnerId) where.partnerId = String(query.partnerId);
  if (query.rewardDefinitionId) where.rewardDefinitionId = String(query.rewardDefinitionId);
  const rows = await db.rewardCampaign.findMany({
    where,
    include: {
      partner: true,
      reward: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    take: Math.min(200, Number(query.limit) || 50),
  });
  const out = [];
  for (const c of rows) {
    const codes =
      c.reward.inventoryMode === INVENTORY_MODES.CODE_POOL
        ? await codeInventoryCounts(c.reward.id, { db })
        : null;
    const redemptions = await db.rewardRedemption.count({ where: { campaignId: c.id } });
    const available =
      c.reward.inventoryMode === INVENTORY_MODES.CODE_POOL
        ? codes.available
        : c.reward.inventoryMode === INVENTORY_MODES.FINITE
          ? c.reward.inventoryQuantity ?? 0
          : null;
    out.push({
      id: c.id,
      key: c.key,
      name: c.name,
      status: c.status,
      partner: { id: c.partner.id, key: c.partner.key, displayName: c.partner.displayName, status: c.partner.status },
      reward: {
        id: c.reward.id,
        key: c.reward.key,
        type: c.reward.type,
        coinCost: c.reward.coinCost,
        inventoryMode: c.reward.inventoryMode,
      },
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      redemptions,
      inventory: {
        available,
        stockState: inventoryStockState({
          mode: c.reward.inventoryMode,
          available,
          threshold: c.lowStockThreshold ?? c.reward.lowStockThreshold,
        }),
        codes,
      },
      commercialValueMinor: c.commercialValueMinor,
      commercialCurrency: c.commercialCurrency,
      fundingModel: c.fundingModel,
    });
  }
  return assertNoHealthFields(out);
}

export async function upsertCampaign(input, { admin } = {}, options = {}) {
  const db = dbOf(options);
  const key = String(input.key || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_');
  if (!key || key.length < 3) throw httpError('campaign key invalid', 400);
  const partner = await db.rewardPartner.findUnique({ where: { id: input.partnerId } });
  if (!partner) throw httpError('partner not found', 404);
  const reward = await db.rewardDefinition.findUnique({ where: { id: input.rewardDefinitionId } });
  if (!reward) throw httpError('reward not found', 404);
  const status = input.status || CAMPAIGN_STATUSES.DRAFT;
  if (!Object.values(CAMPAIGN_STATUSES).includes(status)) {
    throw httpError('invalid campaign status', 400);
  }
  const data = {
    key,
    partnerId: partner.id,
    rewardDefinitionId: reward.id,
    name: String(input.name || '').trim() || key,
    status,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    fundingModel: input.fundingModel || null,
    budgetType: input.budgetType || null,
    budgetValue: input.budgetValue ?? null,
    maxRedemptions: input.maxRedemptions ?? null,
    perUserLimit: input.perUserLimit ?? null,
    periodLimitType: input.periodLimitType || null,
    periodLimitCount: input.periodLimitCount ?? null,
    periodWindowDays: input.periodWindowDays ?? null,
    marketCountryCode: input.marketCountryCode || null,
    commercialValueMinor: input.commercialValueMinor ?? null,
    commercialCurrency: input.commercialCurrency || null,
    internalCostMinor: input.internalCostMinor ?? null,
    lowStockThreshold: input.lowStockThreshold ?? null,
    sortOrder: Number(input.sortOrder) || 0,
    updatedByAdminId: admin?.id || null,
  };
  let previous = null;
  let row;
  if (input.id) {
    previous = await db.rewardCampaign.findUnique({ where: { id: input.id } });
    row = await db.rewardCampaign.update({ where: { id: input.id }, data });
  } else {
    row = await db.rewardCampaign.create({
      data: { id: randomUUID(), createdByAdminId: admin?.id || null, ...data },
    });
  }
  await writeAdminAudit({
    admin,
    action: previous ? 'CAMPAIGN_UPDATED' : 'CAMPAIGN_CREATED',
    targetType: 'rewardCampaign',
    targetId: row.id,
    previousValue: previous ? { id: previous.id, status: previous.status, key: previous.key } : null,
    newValue: { id: row.id, status: row.status, key: row.key },
  });
  return row;
}

export async function activateCampaign(campaignId, { admin } = {}, options = {}) {
  const db = dbOf(options);
  const campaign = await db.rewardCampaign.findUnique({
    where: { id: campaignId },
    include: { partner: true, reward: true },
  });
  if (!campaign) throw httpError('campaign not found', 404);
  const codes =
    campaign.reward.inventoryMode === INVENTORY_MODES.CODE_POOL
      ? await codeInventoryCounts(campaign.reward.id, { db })
      : { available: 0 };
  const errors = validateCampaignActivation({
    partner: campaign.partner,
    reward: campaign.reward,
    campaign,
    availableCodes: codes.available,
  });
  if (errors.length) {
    throw httpError(errors.join('; '), 409, 'REWARD_CAMPAIGN_INACTIVE');
  }
  if (campaign.reward.status !== REWARD_STATUSES.ACTIVE) {
    const actErrors = validateRewardActivation(campaign.reward, { availableCodes: codes.available });
    if (actErrors.length) throw httpError(actErrors.join('; '), 409, 'REWARD_NOT_ACTIVE');
    await db.rewardDefinition.update({
      where: { id: campaign.reward.id },
      data: { status: REWARD_STATUSES.ACTIVE },
    });
  }
  const row = await db.rewardCampaign.update({
    where: { id: campaignId },
    data: { status: CAMPAIGN_STATUSES.ACTIVE, updatedByAdminId: admin?.id || null },
  });
  await writeAdminAudit({
    admin,
    action: 'CAMPAIGN_ACTIVATED',
    targetType: 'rewardCampaign',
    targetId: row.id,
    previousValue: { status: campaign.status },
    newValue: { status: row.status },
  });
  return row;
}

export async function pauseCampaign(campaignId, { admin } = {}, options = {}) {
  const db = dbOf(options);
  const previous = await db.rewardCampaign.findUnique({ where: { id: campaignId } });
  if (!previous) throw httpError('campaign not found', 404);
  const row = await db.rewardCampaign.update({
    where: { id: campaignId },
    data: { status: CAMPAIGN_STATUSES.PAUSED, updatedByAdminId: admin?.id || null },
  });
  await writeAdminAudit({
    admin,
    action: 'CAMPAIGN_PAUSED',
    targetType: 'rewardCampaign',
    targetId: row.id,
    previousValue: { status: previous.status },
    newValue: { status: row.status },
  });
  return row;
}

export async function adjustFiniteInventory(rewardId, { delta, reason, admin }, options = {}) {
  const db = dbOf(options);
  const d = Math.trunc(Number(delta));
  if (!Number.isFinite(d) || d === 0) {
    throw httpError('invalid delta', 400, 'REWARD_INVENTORY_ADJUSTMENT_INVALID');
  }
  if (!reason || String(reason).trim().length < 3) {
    throw httpError('reason required', 400, 'REWARD_INVENTORY_ADJUSTMENT_INVALID');
  }
  const result = await db.$transaction(async (tx) => {
    const reward = await tx.rewardDefinition.findUnique({ where: { id: rewardId } });
    if (!reward) throw httpError('reward not found', 404);
    if (reward.inventoryMode !== INVENTORY_MODES.FINITE) {
      throw httpError('only FINITE inventory adjusts', 400, 'REWARD_INVENTORY_ADJUSTMENT_INVALID');
    }
    const next = (reward.inventoryQuantity ?? 0) + d;
    if (next < 0) {
      throw httpError('stock cannot go negative', 409, 'REWARD_INVENTORY_ADJUSTMENT_INVALID');
    }
    await tx.rewardDefinition.update({
      where: { id: rewardId },
      data: { inventoryQuantity: next },
    });
    await tx.rewardInventoryAdjustment.create({
      data: {
        id: randomUUID(),
        rewardId,
        delta: d,
        reason: String(reason).slice(0, 240),
        actorType: 'ADMIN',
        actorId: admin?.id || null,
      },
    });
    return { previous: reward.inventoryQuantity ?? 0, next };
  });
  await writeAdminAudit({
    admin,
    action: 'INVENTORY_ADJUSTED',
    targetType: 'rewardDefinition',
    targetId: rewardId,
    previousValue: { inventoryQuantity: result.previous },
    newValue: { inventoryQuantity: result.next, delta: d, reason },
  });
  return result;
}

/**
 * Import codes for a reward. Accepts strings or { code, expiresAt }.
 * Never returns plaintext codes.
 */
export async function adminImportCodes(rewardId, rows, { admin } = {}, options = {}) {
  const db = dbOf(options);
  const reward = await db.rewardDefinition.findUnique({ where: { id: rewardId } });
  if (!reward) throw httpError('reward not found', 404, 'REWARD_NOT_FOUND');
  if (reward.inventoryMode !== INVENTORY_MODES.CODE_POOL) {
    throw httpError('CODE_POOL only', 400, 'REWARD_CODE_IMPORT_INVALID');
  }
  const now = options.now || new Date();
  let accepted = 0;
  let duplicates = 0;
  let invalid = 0;
  let expiredRejected = 0;
  const seen = new Set();
  const normalized = [];
  for (const raw of rows || []) {
    const code = String(typeof raw === 'string' ? raw : raw?.code || '')
      .trim();
    if (!code || code.length < 4 || code.length > 128) {
      invalid += 1;
      continue;
    }
    let expiresAt = null;
    if (raw && typeof raw === 'object' && raw.expiresAt) {
      const d = new Date(raw.expiresAt);
      if (Number.isNaN(d.getTime())) {
        invalid += 1;
        continue;
      }
      if (d.getTime() <= now.getTime()) {
        expiredRejected += 1;
        continue;
      }
      expiresAt = d;
    }
    const key = code.toLowerCase();
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    normalized.push({ code, expiresAt });
  }
  for (const row of normalized) {
    try {
      await db.rewardCode.create({
        data: {
          id: randomUUID(),
          rewardId,
          code: row.code,
          status: CODE_STATUSES.AVAILABLE,
          expiresAt: row.expiresAt,
        },
      });
      accepted += 1;
    } catch (error) {
      if (String(error?.code) === 'P2002' || /unique/i.test(String(error?.message || ''))) {
        duplicates += 1;
      } else {
        throw error;
      }
    }
  }
  const report = {
    total: (rows || []).length,
    accepted,
    duplicates,
    invalid,
    expiredRejected,
  };
  await writeAdminAudit({
    admin,
    action: 'CODE_POOL_IMPORTED',
    targetType: 'rewardDefinition',
    targetId: rewardId,
    previousValue: null,
    newValue: report,
  });
  return report;
}

export async function listCodesAdmin(rewardId, query = {}, options = {}) {
  const db = dbOf(options);
  const take = Math.min(100, Number(query.limit) || 25);
  const skip = Math.max(0, Number(query.offset) || 0);
  const where = { rewardId };
  if (query.status) where.status = String(query.status);
  const [total, rows] = await Promise.all([
    db.rewardCode.count({ where }),
    db.rewardCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      select: {
        id: true,
        code: true,
        status: true,
        expiresAt: true,
        reservedAt: true,
        usedAt: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      codeMasked: maskCode(r.code),
      status: r.status,
      expiresAt: r.expiresAt,
      reservedAt: r.reservedAt,
      usedAt: r.usedAt,
      createdAt: r.createdAt,
    })),
  };
}

export async function disableAvailableCode(codeId, { admin } = {}, options = {}) {
  const db = dbOf(options);
  const code = await db.rewardCode.findUnique({ where: { id: codeId } });
  if (!code) throw httpError('code not found', 404);
  if (code.status !== CODE_STATUSES.AVAILABLE) {
    throw httpError('only AVAILABLE codes can be disabled', 409);
  }
  const row = await db.rewardCode.update({
    where: { id: codeId },
    data: { status: CODE_STATUSES.DISABLED },
  });
  await writeAdminAudit({
    admin,
    action: 'CODE_DISABLED',
    targetType: 'rewardCode',
    targetId: codeId,
    previousValue: { status: CODE_STATUSES.AVAILABLE, codeMasked: maskCode(code.code) },
    newValue: { status: CODE_STATUSES.DISABLED, codeMasked: maskCode(row.code) },
  });
  return { id: row.id, status: row.status, codeMasked: maskCode(row.code) };
}

export async function listRedemptionsAdmin(query = {}, options = {}) {
  const db = dbOf(options);
  const where = {};
  if (query.status) where.status = String(query.status);
  if (query.rewardId) where.rewardId = String(query.rewardId);
  if (query.campaignId) where.campaignId = String(query.campaignId);
  if (query.partnerId) where.partnerIdSnapshot = String(query.partnerId);
  if (query.redemptionId) where.id = String(query.redemptionId);
  const take = Math.min(100, Number(query.limit) || 25);
  const skip = Math.max(0, Number(query.offset) || 0);
  const [total, rows] = await Promise.all([
    db.rewardRedemption.count({ where }),
    db.rewardRedemption.findMany({
      where,
      include: {
        reward: { include: { partner: true } },
        campaign: true,
        code: true,
      },
      orderBy: { redeemedAt: 'desc' },
      take,
      skip,
    }),
  ]);
  const items = rows.map((r) => ({
    id: r.id,
    status: r.status,
    coinCost: r.coinCost,
    redeemedAt: r.redeemedAt,
    expiresAt: r.expiresAt,
    usedAt: r.usedAt,
    maskedUserRef: maskedUserRef(r.userId),
    reward: r.reward
      ? { id: r.reward.id, key: r.reward.key, titleKey: r.reward.titleKey, type: r.reward.type }
      : null,
    partner: r.reward?.partner
      ? { key: r.reward.partner.key, displayName: r.reward.partner.displayName }
      : r.partnerIdSnapshot
        ? { id: r.partnerIdSnapshot }
        : null,
    campaign: r.campaign ? { id: r.campaign.id, key: r.campaign.key, name: r.campaign.name } : null,
    codeState: r.code?.status || null,
    codeMasked: r.code ? maskCode(r.code.code) : null,
    commercialValueMinorSnapshot: r.commercialValueMinorSnapshot,
    commercialCurrencySnapshot: r.commercialCurrencySnapshot,
  }));
  return assertNoHealthFields({ total, items });
}

export async function getRedemptionAdmin(id, options = {}) {
  const db = dbOf(options);
  const r = await db.rewardRedemption.findUnique({
    where: { id },
    include: {
      reward: { include: { partner: true } },
      campaign: true,
      code: true,
      auditLogs: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!r) throw httpError('redemption not found', 404);
  return assertNoHealthFields({
    id: r.id,
    status: r.status,
    coinCost: r.coinCost,
    ledgerEntryId: r.ledgerEntryId,
    redeemedAt: r.redeemedAt,
    expiresAt: r.expiresAt,
    usedAt: r.usedAt,
    cancelledAt: r.cancelledAt,
    cancellationReason: r.cancellationReason,
    maskedUserRef: maskedUserRef(r.userId),
    reward: r.reward
      ? {
          id: r.reward.id,
          key: r.reward.key,
          type: r.reward.type,
          titleKey: r.reward.titleKey,
          descriptionKey: r.reward.descriptionKey,
          termsKey: r.reward.termsKey,
        }
      : null,
    partner: r.reward?.partner
      ? {
          key: r.reward.partner.key,
          displayName: r.reward.partner.displayName,
          category: r.reward.partner.category,
        }
      : null,
    campaign: r.campaign
      ? {
          id: r.campaign.id,
          key: r.campaign.key,
          name: r.campaign.name,
          status: r.campaign.status,
        }
      : null,
    code: r.code
      ? {
          id: r.code.id,
          status: r.code.status,
          codeMasked: maskCode(r.code.code),
          expiresAt: r.code.expiresAt,
          usedAt: r.code.usedAt,
        }
      : null,
    commercialValueMinorSnapshot: r.commercialValueMinorSnapshot,
    commercialCurrencySnapshot: r.commercialCurrencySnapshot,
    audit: (r.auditLogs || []).map((a) => ({
      id: a.id,
      fromStatus: a.fromStatus,
      toStatus: a.toStatus,
      note: a.note,
      createdAt: a.createdAt,
      coinCost: a.coinCost,
    })),
  });
}

export async function markRedemptionUsed(id, { admin, reason } = {}, options = {}) {
  const db = dbOf(options);
  const previous = await db.rewardRedemption.findUnique({ where: { id } });
  if (!previous) throw httpError('redemption not found', 404);
  if (previous.status !== 'ISSUED') {
    throw httpError('only ISSUED can be marked USED', 409);
  }
  const row = await db.$transaction(async (tx) => {
    const updated = await tx.rewardRedemption.update({
      where: { id },
      data: { status: 'USED', usedAt: new Date() },
    });
    if (previous.codeId) {
      await tx.rewardCode.update({
        where: { id: previous.codeId },
        data: { status: CODE_STATUSES.USED, usedAt: new Date() },
      });
    }
    await tx.rewardRedemptionAudit.create({
      data: {
        id: randomUUID(),
        redemptionId: id,
        userId: previous.userId,
        rewardId: previous.rewardId,
        coinCost: previous.coinCost,
        fromStatus: previous.status,
        toStatus: 'USED',
        note: reason ? String(reason).slice(0, 240) : 'admin_mark_used',
      },
    });
    return updated;
  });
  await writeAdminAudit({
    admin,
    action: 'REDEMPTION_STATUS_CHANGED',
    targetType: 'rewardRedemption',
    targetId: id,
    previousValue: { status: previous.status },
    newValue: { status: row.status, reason: reason || null },
  });
  return row;
}

export async function rewardsOverview(options = {}) {
  const db = dbOf(options);
  const now = options.now || new Date();
  const startToday = new Date(now);
  startToday.setUTCHours(0, 0, 0, 0);
  const start7 = new Date(now.getTime() - 7 * 86_400_000);

  const [
    activeCampaigns,
    redemptionsToday,
    redemptions7d,
    partnersActive,
  ] = await Promise.all([
    db.rewardCampaign.count({ where: { status: CAMPAIGN_STATUSES.ACTIVE } }),
    db.rewardRedemption.count({ where: { redeemedAt: { gte: startToday } } }),
    db.rewardRedemption.count({ where: { redeemedAt: { gte: start7 } } }),
    db.rewardPartner.count({ where: { status: PARTNER_STATUSES.ACTIVE } }),
  ]);

  const poolRewards = await db.rewardDefinition.findMany({
    where: { inventoryMode: INVENTORY_MODES.CODE_POOL, status: REWARD_STATUSES.ACTIVE },
    select: { id: true, key: true, lowStockThreshold: true },
  });
  let codesAvailable = 0;
  const lowStock = [];
  for (const r of poolRewards) {
    const c = await codeInventoryCounts(r.id, { db });
    codesAvailable += c.available;
    const state = inventoryStockState({
      mode: INVENTORY_MODES.CODE_POOL,
      available: c.available,
      threshold: r.lowStockThreshold,
    });
    if (state === STOCK_STATES.LOW || state === STOCK_STATES.OUT) {
      lowStock.push({ rewardKey: r.key, available: c.available, stockState: state });
    }
  }

  const spentAgg = await db.rewardLedger.aggregate({
    where: {
      currency: 'COIN',
      sourceType: LEDGER_SOURCE_REWARD_REDEMPTION,
      createdAt: { gte: start7 },
      amount: { lt: 0 },
    },
    _sum: { amount: true },
  });
  const coinsSpent7d = Math.abs(Number(spentAgg._sum.amount) || 0);

  const recent = await db.rewardRedemption.findMany({
    take: 8,
    orderBy: { redeemedAt: 'desc' },
    include: { reward: true, campaign: true },
  });

  const trendDays = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dayStart = new Date(now.getTime() - i * 86_400_000);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const count = await db.rewardRedemption.count({
      where: { redeemedAt: { gte: dayStart, lt: dayEnd } },
    });
    trendDays.push({ day: dayStart.toISOString().slice(0, 10), redemptions: count });
  }

  const endingSoon = await db.rewardCampaign.findMany({
    where: {
      status: CAMPAIGN_STATUSES.ACTIVE,
      endsAt: { not: null, lte: new Date(now.getTime() + 7 * 86_400_000), gt: now },
    },
    take: 10,
    orderBy: { endsAt: 'asc' },
    include: { partner: true },
  });

  return assertNoHealthFields({
    kpis: {
      activeCampaigns,
      partnersActive,
      redemptionsToday,
      redemptions7d,
      codesAvailable,
      codesLowStock: lowStock.length,
      coinsSpentOnRewards7d: coinsSpent7d,
    },
    trend7d: trendDays,
    needsAttention: {
      lowStock,
      endingSoon: endingSoon.map((c) => ({
        id: c.id,
        key: c.key,
        name: c.name,
        endsAt: c.endsAt,
        partnerKey: c.partner?.key,
      })),
    },
    recentActivity: recent.map((r) => ({
      id: r.id,
      status: r.status,
      coinCost: r.coinCost,
      redeemedAt: r.redeemedAt,
      rewardKey: r.reward?.key,
      campaignKey: r.campaign?.key || null,
      maskedUserRef: maskedUserRef(r.userId),
    })),
  });
}

/** Live campaign eligible for store/redeem (server clock). */
export { isCampaignLive, findLiveCampaignForReward } from './rewardCampaignRuntime.js';

export async function ensureDevPartnerFixture(db = prisma) {
  if (typeof db.rewardPartner?.upsert !== 'function') return null;
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_PARTNER !== '1') {
    return null;
  }
  const partner = await db.rewardPartner.upsert({
    where: { key: 'MEDI_PHARMACY_DEMO' },
    create: {
      id: randomUUID(),
      key: 'MEDI_PHARMACY_DEMO',
      displayName: 'Medi Pharmacy Demo',
      legalName: 'MediCard DEV Partner (not for production users)',
      category: 'PHARMACY',
      status: PARTNER_STATUSES.ACTIVE,
      notes: 'DEV ONLY — never activate for production catalog users',
      countryCode: 'GE',
    },
    update: {
      displayName: 'Medi Pharmacy Demo',
      status: PARTNER_STATUSES.ACTIVE,
    },
  });
  return partner;
}
