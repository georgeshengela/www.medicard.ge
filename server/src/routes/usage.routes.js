import { Router } from 'express';
import { getUsage } from '../lib/usage.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

export const usageRouter = Router();

usageRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const usage = await getUsage(req.user.id);

    return res.json({
      ...usage,
      label: `დღეს დარჩენილია: ${usage.remaining}/${usage.limit} უფასო შეკითხვა`,
    });
  }),
);
