import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { applyPrivateCache } from '../lib/cycleShare.js';
import { claimAchievement, getAchievementsOverview, reconcileAchievements } from '../lib/achievements.js';

export const achievementsRouter = Router();
achievementsRouter.use(requireAuth);
achievementsRouter.use((_req, res, next) => {
  applyPrivateCache(res);
  next();
});

const idParam = z.object({
  id: z.string().uuid(),
});

achievementsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getAchievementsOverview(req.user.id));
  }),
);

achievementsRouter.post(
  '/reconcile',
  asyncHandler(async (req, res) => {
    const result = await reconcileAchievements(req.user.id);
    res.json({ ok: true, repairedUnlocks: result.repairedUnlocks });
  }),
);

achievementsRouter.post(
  '/:id/claim',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const result = await claimAchievement(req.user.id, id);
    res.json({
      ok: true,
      claimed: result.claimed,
      alreadyClaimed: result.alreadyClaimed,
      achievement: result.achievement,
      reward: result.reward,
      profile: result.profile,
    });
  }),
);
