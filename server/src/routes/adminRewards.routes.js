/**
 * Phase 8 — Admin Rewards Partner platform routes.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import {
  activateCampaign,
  adjustFiniteInventory,
  adminImportCodes,
  createPartnerVoucherDefinition,
  disableAvailableCode,
  getRedemptionAdmin,
  listCampaigns,
  listCodesAdmin,
  listPartners,
  listRedemptionsAdmin,
  markRedemptionUsed,
  pauseCampaign,
  rewardsOverview,
  serializeCampaignForPartner,
  upsertCampaign,
  upsertPartner,
} from '../lib/rewardsAdmin.js';
import { prisma } from '../lib/prisma.js';

export const adminRewardsRouter = Router();
adminRewardsRouter.use(requireAdmin);

const mutateLimiter = rateLimit({
  windowMs: 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ძალიან ბევრი მოთხოვნა.', code: 'RATE_LIMITED' },
});

const importLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ძალიან ბევრი იმპორტი.', code: 'RATE_LIMITED' },
});

adminRewardsRouter.get(
  '/overview',
  requireAdminCapability('REWARDS_VIEW'),
  asyncHandler(async (_req, res) => {
    res.json(await rewardsOverview());
  }),
);

adminRewardsRouter.get(
  '/partners',
  requireAdminCapability('PARTNERS_VIEW'),
  asyncHandler(async (req, res) => {
    res.json({ items: await listPartners(req.query) });
  }),
);

adminRewardsRouter.post(
  '/partners',
  mutateLimiter,
  requireAdminCapability('PARTNERS_MANAGE'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        id: z.string().optional(),
        key: z.string().min(3).max(64),
        displayName: z.string().min(1).max(160),
        legalName: z.string().max(200).nullable().optional(),
        category: z.string().max(40).nullable().optional(),
        logoAssetKey: z.string().max(160).nullable().optional(),
        website: z.string().max(300).nullable().optional(),
        contactName: z.string().max(120).nullable().optional(),
        contactEmail: z.string().max(160).nullable().optional(),
        countryCode: z.string().max(2).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        status: z.string().max(20).optional(),
        lowStockThreshold: z.number().int().nullable().optional(),
      })
      .parse(req.body || {});
    const row = await upsertPartner(body, { admin: req.admin });
    res.json({ ok: true, partner: row });
  }),
);

adminRewardsRouter.patch(
  '/partners/:id',
  mutateLimiter,
  requireAdminCapability('PARTNERS_MANAGE'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.rewardPartner.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not found' });
    const body = z.object({}).passthrough().parse(req.body || {});
    const row = await upsertPartner(
      {
        ...existing,
        ...body,
        id: existing.id,
        key: body.key || existing.key,
        displayName: body.displayName || existing.displayName,
      },
      { admin: req.admin },
    );
    res.json({ ok: true, partner: row });
  }),
);

adminRewardsRouter.get(
  '/campaigns',
  requireAdminCapability('REWARDS_VIEW'),
  asyncHandler(async (req, res) => {
    res.json({ items: await listCampaigns(req.query) });
  }),
);

adminRewardsRouter.get(
  '/campaigns/:id/partner-view',
  requireAdminCapability('REWARDS_ANALYTICS_VIEW'),
  asyncHandler(async (req, res) => {
    const campaign = await prisma.rewardCampaign.findUnique({
      where: { id: req.params.id },
      include: { partner: true, reward: true },
    });
    if (!campaign) return res.status(404).json({ error: 'not found' });
    const redemptions = await prisma.rewardRedemption.count({ where: { campaignId: campaign.id } });
    res.json({
      partnerView: serializeCampaignForPartner(campaign, {
        redemptions: { issued: redemptions },
      }),
    });
  }),
);

adminRewardsRouter.post(
  '/campaigns',
  mutateLimiter,
  requireAdminCapability('REWARDS_MANAGE'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        key: z.string().min(3).max(64),
        partnerId: z.string().min(1),
        rewardDefinitionId: z.string().min(1),
        name: z.string().min(1).max(200),
        status: z.string().optional(),
        startsAt: z.string().datetime().nullable().optional(),
        endsAt: z.string().datetime().nullable().optional(),
        fundingModel: z.string().nullable().optional(),
        maxRedemptions: z.number().int().nullable().optional(),
        perUserLimit: z.number().int().nullable().optional(),
        marketCountryCode: z.string().nullable().optional(),
        commercialValueMinor: z.number().int().nullable().optional(),
        commercialCurrency: z.string().nullable().optional(),
        internalCostMinor: z.number().int().nullable().optional(),
        lowStockThreshold: z.number().int().nullable().optional(),
        sortOrder: z.number().int().optional(),
      })
      .passthrough()
      .parse(req.body || {});
    const row = await upsertCampaign(body, { admin: req.admin });
    res.json({ ok: true, campaign: row });
  }),
);

adminRewardsRouter.patch(
  '/campaigns/:id',
  mutateLimiter,
  requireAdminCapability('REWARDS_MANAGE'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.rewardCampaign.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not found' });
    const body = z.object({}).passthrough().parse(req.body || {});
    const row = await upsertCampaign(
      {
        ...existing,
        ...body,
        id: existing.id,
        key: body.key || existing.key,
        partnerId: body.partnerId || existing.partnerId,
        rewardDefinitionId: body.rewardDefinitionId || existing.rewardDefinitionId,
      },
      { admin: req.admin },
    );
    res.json({ ok: true, campaign: row });
  }),
);

adminRewardsRouter.post(
  '/campaigns/:id/activate',
  mutateLimiter,
  requireAdminCapability('REWARDS_MANAGE'),
  asyncHandler(async (req, res) => {
    res.json({ ok: true, campaign: await activateCampaign(req.params.id, { admin: req.admin }) });
  }),
);

adminRewardsRouter.post(
  '/campaigns/:id/pause',
  mutateLimiter,
  requireAdminCapability('REWARDS_MANAGE'),
  asyncHandler(async (req, res) => {
    res.json({ ok: true, campaign: await pauseCampaign(req.params.id, { admin: req.admin }) });
  }),
);

adminRewardsRouter.get(
  '/redemptions',
  requireAdminCapability('REDEMPTIONS_VIEW'),
  asyncHandler(async (req, res) => {
    res.json(await listRedemptionsAdmin(req.query));
  }),
);

adminRewardsRouter.get(
  '/redemptions/:id',
  requireAdminCapability('REDEMPTIONS_VIEW'),
  asyncHandler(async (req, res) => {
    res.json(await getRedemptionAdmin(req.params.id));
  }),
);

adminRewardsRouter.post(
  '/redemptions/:id/mark-used',
  mutateLimiter,
  requireAdminCapability('REDEMPTIONS_MANAGE'),
  asyncHandler(async (req, res) => {
    const reason = z.string().max(240).optional().parse(req.body?.reason);
    res.json({
      ok: true,
      redemption: await markRedemptionUsed(req.params.id, { admin: req.admin, reason }),
    });
  }),
);

adminRewardsRouter.get(
  '/rewards/:rewardId/codes',
  requireAdminCapability('REWARD_CODES_MANAGE'),
  asyncHandler(async (req, res) => {
    res.json(await listCodesAdmin(req.params.rewardId, req.query));
  }),
);

adminRewardsRouter.post(
  '/rewards/:rewardId/codes/import',
  importLimiter,
  requireAdminCapability('REWARD_CODES_MANAGE'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        codes: z.array(z.union([z.string(), z.object({ code: z.string(), expiresAt: z.string().optional() })])),
      })
      .parse(req.body || {});
    const report = await adminImportCodes(req.params.rewardId, body.codes, { admin: req.admin });
    res.json({ ok: true, report });
  }),
);

adminRewardsRouter.post(
  '/codes/:id/disable',
  mutateLimiter,
  requireAdminCapability('REWARD_CODES_MANAGE'),
  asyncHandler(async (req, res) => {
    res.json({ ok: true, code: await disableAvailableCode(req.params.id, { admin: req.admin }) });
  }),
);

adminRewardsRouter.post(
  '/rewards/:rewardId/inventory/adjust',
  mutateLimiter,
  requireAdminCapability('REWARDS_MANAGE'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        delta: z.number().int(),
        reason: z.string().min(3).max(240),
      })
      .parse(req.body || {});
    res.json({
      ok: true,
      ...(await adjustFiniteInventory(req.params.rewardId, { ...body, admin: req.admin })),
    });
  }),
);

adminRewardsRouter.post(
  '/definitions',
  mutateLimiter,
  requireAdminCapability('REWARDS_MANAGE'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        key: z.string().min(3).max(64),
        partnerId: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        displayName: z.string().min(1).max(200).optional(),
        description: z.string().max(400).optional(),
        terms: z.string().max(400).optional(),
        coinCost: z.number().int().min(1),
        inventoryMode: z.string().max(20).optional(),
        inventoryQuantity: z.number().int().nullable().optional(),
        redemptionExpiryDays: z.number().int().nullable().optional(),
        lowStockThreshold: z.number().int().nullable().optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(req.body || {});
    const row = await createPartnerVoucherDefinition(body, { admin: req.admin });
    res.json({ ok: true, definition: row });
  }),
);

adminRewardsRouter.get(
  '/definitions',
  requireAdminCapability('REWARDS_VIEW'),
  asyncHandler(async (req, res) => {
    const items = await prisma.rewardDefinition.findMany({
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      take: 200,
      include: { partner: true },
    });
    res.json({
      items: items.map((r) => ({
        id: r.id,
        key: r.key,
        type: r.type,
        status: r.status,
        coinCost: r.coinCost,
        inventoryMode: r.inventoryMode,
        inventoryQuantity: r.inventoryQuantity,
        partnerKey: r.partner?.key || null,
        titleKey: r.titleKey,
      })),
    });
  }),
);
