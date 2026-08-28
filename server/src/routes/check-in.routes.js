import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { claimDailyCheckIn, getCheckInState } from '../lib/checkIn.js';

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
