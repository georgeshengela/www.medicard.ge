import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { asyncHandler } from '../middleware/error.js';
import { clientMetaFromRequest } from '../lib/appVersion.js';
import { clientIp } from '../lib/rateLimitKey.js';
import { loadAppActivityRows } from '../lib/appActivity.js';
import { getRetentionAnalytics } from '../lib/adminAnalytics.js';
import { batchSchema, ingestFunnelEvents, loadFunnelReport } from '../lib/funnel.js';
import { t } from '../lib/i18n.js';

/**
 * Product funnel ingest. Auth is optional so install/source and onboarding views work before
 * sign-up; a valid user token attaches the account and links this install's earlier events.
 * Only this route is limited (never a global /api limiter).
 */
export const funnelRouter = Router();

const ingestLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => clientIp(req),
  message: (req) => ({ error: t(req, 'ძალიან ბევრი მოთხოვნა.', 'Too many requests.'), code: 'RATE_LIMITED' }),
});

/** User id from a Bearer token, or null. Never rejects: analytics must not break the app. */
export async function optionalUserId(req, { db = prisma, secret = env.JWT_SECRET } = {}) {
  const header = String(req.headers?.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7).trim(), secret);
    if (payload?.role === 'admin') return null;
    const id = typeof payload?.sub === 'string' ? payload.sub : '';
    if (!id) return null;
    const user = await db.user.findUnique({ where: { id }, select: { id: true, status: true } });
    return user && user.status !== 'BLOCKED' ? user.id : null;
  } catch {
    return null;
  }
}

funnelRouter.post(
  '/events',
  ingestLimiter,
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const parsed = batchSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: t(req, 'არასწორი მოთხოვნა.', 'Invalid request.'), code: 'FUNNEL_INVALID' });
    const userId = await optionalUserId(req);
    const result = await ingestFunnelEvents({
      userId,
      installId: parsed.data.installId,
      events: parsed.data.events,
      meta: clientMetaFromRequest(req),
    });
    return res.status(202).json({ ok: true, accepted: result.accepted, rejected: result.rejected });
  }),
);

export const adminFunnelRouter = Router();
adminFunnelRouter.use(requireAdmin);
adminFunnelRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await loadFunnelReport(
      { days: req.query.days },
      {
        loadActivity: (from, to) => loadAppActivityRows(from, to),
        loadRetention: () => getRetentionAnalytics({ range: '90d' }),
      },
    ));
  }),
);
