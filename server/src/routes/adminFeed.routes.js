import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { asyncHandler } from '../middleware/error.js';
import { FEED_LIMIT_MAX, loadFeed } from '../lib/adminFeed.js';

/** Admin live feed history (the bell's „აქტივობა“ sheet); new events arrive over the admin socket as `ops:feed`. */
export const adminFeedRouter = Router();
adminFeedRouter.use(requireAdmin, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

adminFeedRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const before = req.query.before && !Number.isNaN(Date.parse(String(req.query.before))) ? String(req.query.before) : null;
    const limit = Math.min(FEED_LIMIT_MAX, Math.max(1, Number(req.query.limit) || 60));
    res.json({ events: await loadFeed({ before, limit }) });
  }),
);
