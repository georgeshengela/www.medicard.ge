import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { applyPrivateCache } from '../lib/cycleShare.js';
import {
  getActiveRewardEntitlements,
  getMyRedemption,
  getStoreReward,
  listMyRedemptions,
  listStoreRewards,
  redeemReward,
} from '../lib/rewards.js';

export const rewardsRouter = Router();
rewardsRouter.use(requireAuth);
rewardsRouter.use((_req, res, next) => {
  applyPrivateCache(res);
  next();
});

const redeemLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'ძალიან ბევრი მოთხოვნა.', code: 'REWARD_REDEMPTION_CONFLICT' },
});

const idParam = z.object({
  id: z.string().min(1).max(128),
});

const redeemBody = z.object({
  idempotencyKey: z.string().min(8).max(128),
});

rewardsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listStoreRewards(req.user.id));
  }),
);

rewardsRouter.get(
  '/redemptions',
  asyncHandler(async (req, res) => {
    res.json(await listMyRedemptions(req.user.id));
  }),
);

rewardsRouter.get(
  '/redemptions/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await getMyRedemption(req.user.id, id));
  }),
);

rewardsRouter.get(
  '/entitlements',
  asyncHandler(async (req, res) => {
    res.json({ items: await getActiveRewardEntitlements(req.user.id) });
  }),
);

rewardsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await getStoreReward(req.user.id, id));
  }),
);

rewardsRouter.post(
  '/:id/redeem',
  redeemLimiter,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const body = redeemBody.parse(req.body || {});
    const result = await redeemReward(req.user.id, id, {
      idempotencyKey: body.idempotencyKey,
    });
    res.json({ ok: true, ...result });
  }),
);
