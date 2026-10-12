import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import { FAMILY_ADMIN_PERIODS, loadFamilyOverview } from '../lib/family/adminFamily.js';

/** Admin #/family (MEDIFAMILY): read-only, aggregate usage — never a child's name or health value. */
export const adminFamilyRouter = Router();
adminFamilyRouter.use(requireAdmin, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

adminFamilyRouter.get(
  '/overview',
  requireAdminCapability('FAMILY_VIEW'),
  asyncHandler(async (req, res) => {
    const days = FAMILY_ADMIN_PERIODS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    res.json(await loadFamilyOverview({ days, includeTeam: req.query.team === '1' }));
  }),
);
