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
    const limitLabel = usage.unlimited ? 'შეუზღუდავი' : `${usage.remaining} შეკითხვა ${usage.limit}-დან`;

    return res.json({
      ...usage,
      label: usage.unlimited
        ? 'შეუზღუდავი AI შეკითხვა'
        : usage.exceeded && usage.resetAt
          ? `ლიმიტი ამოიწურა. განახლდება ხვალ ამავე საათზე.`
          : `დარჩა ${limitLabel}`,
    });
  }),
);
