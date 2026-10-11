import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import { PETS_ADMIN_PERIODS, loadPetsOverview } from '../lib/adminPets.js';

/** Admin #/pets (MEDIVET): read-only usage analytics of „ჩემი ცხოველები“ and Medi Vet. */
export const adminPetsRouter = Router();
adminPetsRouter.use(requireAdmin, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

adminPetsRouter.get(
  '/overview',
  requireAdminCapability('PETS_VIEW'),
  asyncHandler(async (req, res) => {
    const days = PETS_ADMIN_PERIODS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    res.json(await loadPetsOverview({ days, includeTeam: req.query.team === '1' }));
  }),
);
