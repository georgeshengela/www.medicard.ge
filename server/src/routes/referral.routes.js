import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import { applyPrivateCache } from '../lib/cycleShare.js';
import { hasVerifiedPhone } from '../lib/phoneGate.js';
import { clientIp } from '../lib/rateLimitKey.js';
import { claimReferral, referralAdminOverview, referralSummary } from '../lib/referral.js';
import { t } from '../lib/i18n.js';

/** Referral with Medi coins (Phase 3.4). Coins have no monetary value. */
export const referralRouter = Router();
referralRouter.use(requireAuth);
referralRouter.use((_req, res, next) => {
  applyPrivateCache(res);
  next();
});

const claimLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: (req) => ({ error: t(req, 'ძალიან ბევრი მცდელობა. სცადე მოგვიანებით.', 'Too many attempts. Please try again later.'), code: 'RATE_LIMITED' }),
});

const claimSchema = z.object({
  code: z.string().trim().min(4).max(20),
  installId: z.string().trim().max(200).optional(),
});

// Sharing your own code needs a verified phone (anti-abuse, owner decision 2026-09-26):
// without one the summary comes back with code null and phoneRequired true.
referralRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json(await referralSummary(req.user.id, { withCode: hasVerifiedPhone(req.user), lang: req.lang }));
  }),
);

// „ვინ მოგიწვია?“: a friend's code (any new account, both sides paid at once) or an influencer's code
// (verified phone, registration credited to the influencer after the hold — lib/influencer/store.js).
referralRouter.post(
  '/claim',
  claimLimiter,
  asyncHandler(async (req, res) => {
    const body = claimSchema.parse(req.body ?? {});
    const result = await claimReferral({ invitee: req.user, code: body.code, installId: body.installId, ip: clientIp(req), lang: req.lang });
    if (!result.ok) {
      return res.status(result.httpStatus || 409).json({
        error: result.error,
        code: result.code,
        ...(result.feature ? { feature: result.feature } : {}),
        // An influencer code after its window: the app explains it calmly with the account's own date.
        ...(result.kind ? { kind: result.kind, windowDays: result.windowDays, accountCreatedAt: result.accountCreatedAt } : {}),
      });
    }
    return res.status(201).json(result);
  }),
);

export const adminReferralRouter = Router();
adminReferralRouter.use(requireAdmin);
adminReferralRouter.get(
  '/',
  requireAdminCapability('REWARDS_VIEW'),
  asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await referralAdminOverview());
  }),
);
