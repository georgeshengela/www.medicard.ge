import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { awardStepsGoalPoints, claimDailyCheckIn, getCheckInState } from '../lib/checkIn.js';

export const checkInRouter = Router();

checkInRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const checkIn = await getCheckInState(req.user.id);
    if (!checkIn) return res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა.' });
    res.json({ checkIn });
  }),
);

checkInRouter.post(
  '/claim',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await claimDailyCheckIn(req.user.id);
    res.json(result);
  }),
);

const stepsGoalAwardSchema = z.object({
  goalId: z.string().trim().min(3).max(80),
});

checkInRouter.post(
  '/steps-goal',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { goalId } = stepsGoalAwardSchema.parse(req.body ?? {});
    const result = await awardStepsGoalPoints(req.user.id, goalId);
    res.json(result);
  }),
);
