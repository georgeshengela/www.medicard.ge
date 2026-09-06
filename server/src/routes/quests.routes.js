import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { applyPrivateCache } from '../lib/cycleShare.js';
import {
  claimQuest,
  getQuestHistory,
  getQuestProfile,
  getQuestRewards,
  getUserQuestDashboard,
  publicQuest,
  setQuestTimezone,
} from '../lib/quest.js';

export const questsRouter = Router();
questsRouter.use(requireAuth);
questsRouter.use((_req, res, next) => {
  applyPrivateCache(res);
  next();
});

const idParam = z.object({
  id: z.string().uuid(),
});

const timezoneBody = z.object({
  timezone: z.string().trim().min(3).max(64),
});

function questClaimDto(quest) {
  const pub = publicQuest(quest);
  return {
    id: pub.id,
    key: pub.key,
    status: pub.status,
    completedAt: pub.completedAt,
    claimedAt: pub.claimedAt,
  };
}

questsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const timezone = typeof req.query.timezone === 'string' ? req.query.timezone : undefined;
    res.json(await getUserQuestDashboard(req.user.id, { deviceTimezone: timezone }));
  }),
);

questsRouter.get(
  '/profile',
  asyncHandler(async (req, res) => {
    res.json({ profile: await getQuestProfile(req.user.id) });
  }),
);

questsRouter.get(
  '/history',
  asyncHandler(async (req, res) => {
    const take = req.query.take != null ? Number(req.query.take) : undefined;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    res.json(await getQuestHistory(req.user.id, { take, before: cursor }));
  }),
);

questsRouter.get(
  '/rewards',
  asyncHandler(async (req, res) => {
    res.json(await getQuestRewards(req.user.id));
  }),
);

questsRouter.put(
  '/timezone',
  asyncHandler(async (req, res) => {
    const { timezone } = timezoneBody.parse(req.body ?? {});
    const profile = await setQuestTimezone(req.user.id, timezone);
    res.json({ ok: true, timezone: profile.timezone });
  }),
);

questsRouter.post(
  '/:id/claim',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const result = await claimQuest(req.user.id, id);
    res.json({
      ok: true,
      claimed: result.claimed,
      alreadyClaimed: result.alreadyClaimed,
      quest: questClaimDto(result.quest),
      reward: result.reward,
      profile: result.profile,
    });
  }),
);
