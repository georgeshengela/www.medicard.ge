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
    const limitLabel = usage.unlimited ? 'შეუზღუდავი' : `${usage.remaining}/${usage.limit}`;

    return res.json({
      ...usage,
      label:
        usage.periodType === 'subscription'
          ? `გამოწერის პერიოდში დარჩენილია: ${limitLabel} AI შეკითხვა`
          : `ამ თვეში დარჩენილია: ${limitLabel} AI შეკითხვა`,
    });
  }),
);
