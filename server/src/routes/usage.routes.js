import { Router } from 'express';
import { getUsage } from '../lib/usage.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { t } from '../lib/i18n.js';

export const usageRouter = Router();

usageRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const usage = await getUsage(req.user.id);
    const limitLabel = usage.unlimited
      ? t(req, 'შეუზღუდავი', 'unlimited')
      : t(req, `${usage.remaining} შეკითხვა ${usage.limit}-დან`, `${usage.remaining} of ${usage.limit} questions`);

    return res.json({
      ...usage,
      label: usage.unlimited
        ? t(req, 'შეუზღუდავი AI შეკითხვა', 'Unlimited AI questions')
        : usage.exceeded && usage.resetAt
          ? t(req, `ლიმიტი ამოიწურა. განახლდება ხვალ ამავე საათზე.`, 'Limit reached. It resets at this time tomorrow.')
          : t(req, `დარჩა ${limitLabel}`, `${limitLabel} left`),
    });
  }),
);
