import { Router } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import { usagePeriod } from '../lib/adminUsageKit.js';
import { loadCycleUsage } from '../lib/adminUsageCycle.js';
import { loadPillsUsage } from '../lib/adminUsagePills.js';
import { loadLabUsage } from '../lib/adminUsageLab.js';
import { loadFoodUsage } from '../lib/adminUsageFood.js';
import { loadQuestUsage } from '../lib/adminUsageQuest.js';
import { loadCoachUsage } from '../lib/adminUsageCoach.js';
import { loadMediUsage } from '../lib/adminUsageMedi.js';

/**
 * Admin module-usage pages (owner 2026-10-11: „როგორც მედივეტი, ისე ყველა მოდული“): read-only „who uses it and how“
 * for MEDICYCLE, MEDIPILL, MEDILAB + MEDISCAN, MEDIFOOD, MEDIQUEST, MEDICOACH and Medi. MEDIVET lives at /api/admin/pets.
 */
const LOADERS = {
  cycle: loadCycleUsage,
  pills: loadPillsUsage,
  lab: loadLabUsage,
  food: loadFoodUsage,
  quest: loadQuestUsage,
  coach: loadCoachUsage,
  medi: loadMediUsage,
};

export const adminUsageRouter = Router();
adminUsageRouter.use(requireAdmin, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

adminUsageRouter.get(
  '/:module/overview',
  requireAdminCapability('PRODUCT_USAGE_VIEW'),
  asyncHandler(async (req, res) => {
    const load = Object.hasOwn(LOADERS, req.params.module) ? LOADERS[req.params.module] : null;
    if (!load) return res.status(404).json({ error: 'ასეთი მოდული არ არსებობს.' });
    return res.json(await load({ days: usagePeriod(req.query.days), includeTeam: req.query.team === '1' }));
  }),
);
