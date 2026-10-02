import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import {
  MEDIA_COOKIE, MEDIA_SESSION_SECONDS, campaignManifest, mediaCookieOptions, signMediaSession,
} from '../lib/campaignMedia.js';

/**
 * Admin #/campaigns — admin-only campaign material (lib/campaignMedia.js). Every signed-in admin may open it,
 * like #/social: it holds marketing copy and posters, no user data.
 *   GET    /               campaigns + print files that exist
 *   POST   /media-session  sets the HttpOnly cookie that opens /press/<private campaign>/… for 2 hours
 *   DELETE /media-session  clears it (sign-out)
 */
export const adminCampaignsRouter = Router();
adminCampaignsRouter.use(requireAdmin, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

adminCampaignsRouter.get('/', (_req, res) => {
  res.json({ campaigns: campaignManifest() });
});

adminCampaignsRouter.post('/media-session', asyncHandler(async (req, res) => {
  res.cookie(MEDIA_COOKIE, signMediaSession(req.admin.id), mediaCookieOptions());
  res.json({ ok: true, expiresAt: new Date(Date.now() + MEDIA_SESSION_SECONDS * 1000).toISOString() });
}));

adminCampaignsRouter.delete('/media-session', (_req, res) => {
  const { maxAge, ...opts } = mediaCookieOptions();
  res.clearCookie(MEDIA_COOKIE, opts);
  res.json({ ok: true });
});
