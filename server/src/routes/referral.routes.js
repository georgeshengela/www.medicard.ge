import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import { applyPrivateCache } from '../lib/cycleShare.js';
import { hasVerifiedPhone } from '../lib/phoneGate.js';
import { claimReferral, referralAdminOverview, referralSummary } from '../lib/referral.js';

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
  message: { error: 'ძალიან ბევრი მცდელობა. სცადე მოგვიანებით.', code: 'RATE_LIMITED' },
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
    res.json(await referralSummary(req.user.id, { withCode: hasVerifiedPhone(req.user) }));
  }),
);

// Entering a friend's code works for any new account; coins wait for a verified phone.
referralRouter.post(
  '/claim',
  claimLimiter,
  asyncHandler(async (req, res) => {
    const body = claimSchema.parse(req.body ?? {});
    const result = await claimReferral({ invitee: req.user, code: body.code, installId: body.installId });
    if (!result.ok) return res.status(409).json({ error: result.error, code: result.code });
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
