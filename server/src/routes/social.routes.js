import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import {
  SOCIAL_NETWORKS, SOCIAL_STATUSES, getSocialPost, listSocialEvents, listSocialPosts, socialSummary,
} from '../lib/socialPosts.js';

/**
 * Admin #/social — the social-media campaign log (lib/socialPosts.js). Read-only: posts are recorded
 * by the operator with server/scripts/social-log.mjs. Every signed-in admin may read it, like #/news,
 * #/funnel and #/errors: it holds only public marketing copy and public image URLs.
 */
export const adminSocialRouter = Router();
adminSocialRouter.use(requireAdmin, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const missingTable = (error) => /SocialPost|42P01|does not exist/.test(String(error?.message || ''));

const listQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(SOCIAL_STATUSES).optional(),
  network: z.enum(SOCIAL_NETWORKS).optional(),
  campaign: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(1000),
});

adminSocialRouter.get('/', asyncHandler(async (req, res) => {
  const q = listQuery.parse(req.query);
  try {
    const posts = await listSocialPosts({
      from: q.from ?? null, to: q.to ?? null, status: q.status ?? null, network: q.network ?? null, campaign: q.campaign ?? null, limit: q.limit,
    });
    res.json({ installed: true, posts });
  } catch (error) {
    if (missingTable(error)) return res.json({ installed: false, posts: [] });
    throw error;
  }
}));

adminSocialRouter.get('/summary', asyncHandler(async (req, res) => {
  try {
    res.json({ installed: true, ...(await socialSummary()) });
  } catch (error) {
    if (missingTable(error)) {
      return res.json({
        installed: false, total: 0, planned: 0, published: 0, status: {}, network: {}, pillar: [], campaigns: [], campaign: null, next: null, lastPublished: null,
      });
    }
    throw error;
  }
}));

adminSocialRouter.get('/events', asyncHandler(async (req, res) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(1000).default(300) }).parse(req.query);
  try {
    res.json({ installed: true, events: await listSocialEvents({ limit }) });
  } catch (error) {
    if (missingTable(error)) return res.json({ installed: false, events: [] });
    throw error;
  }
}));

adminSocialRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }).parse(req.params);
  let detail = null;
  try {
    detail = await getSocialPost(id);
  } catch (error) {
    if (!missingTable(error)) throw error;
  }
  if (!detail) return res.status(404).json({ error: 'პოსტი ვერ მოიძებნა.' });
  res.json(detail);
}));
