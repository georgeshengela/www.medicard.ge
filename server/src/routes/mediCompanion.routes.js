import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { applyPrivateCache } from '../lib/cycleShare.js';
import {
  getMediCompanionOverview,
  getMediCompanionJourney,
  getMediCompanionCollection,
  updateMediCompanionEquipment,
  reconcileMediJourneyForUser,
} from '../lib/mediCompanion/service.js';

export const mediCompanionRouter = Router();
mediCompanionRouter.use(requireAuth);
mediCompanionRouter.use((_req, res, next) => {
  applyPrivateCache(res);
  next();
});

const equipmentBody = z.object({
  accent: z.string().min(1).max(80).nullable().optional(),
  accessory: z.string().min(1).max(80).nullable().optional(),
  background: z.string().min(1).max(80).nullable().optional(),
  decoration: z.string().min(1).max(80).nullable().optional(),
});

mediCompanionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const weatherKey = typeof req.query.weatherKey === 'string' ? req.query.weatherKey : null;
    const isComeback = req.query.comeback === '1' || req.query.comeback === 'true';
    const recentEventKey = typeof req.query.recentEventKey === 'string' ? req.query.recentEventKey : null;
    const reducedMotion = req.query.reducedMotion === '1' || req.query.reducedMotion === 'true';
    res.json(
      await getMediCompanionOverview(req.user.id, {
        weatherKey,
        isComeback,
        recentEventKey,
        reducedMotion,
      }),
    );
  }),
);

mediCompanionRouter.get(
  '/journey',
  asyncHandler(async (req, res) => {
    res.json(await getMediCompanionJourney(req.user.id));
  }),
);

mediCompanionRouter.get(
  '/collection',
  asyncHandler(async (req, res) => {
    res.json(await getMediCompanionCollection(req.user.id));
  }),
);

mediCompanionRouter.put(
  '/equipment',
  asyncHandler(async (req, res) => {
    const patch = equipmentBody.parse(req.body || {});
    const result = await updateMediCompanionEquipment(req.user.id, patch);
    res.json({ ok: true, ...result });
  }),
);

mediCompanionRouter.post(
  '/reconcile',
  asyncHandler(async (req, res) => {
    const result = await reconcileMediJourneyForUser(req.user.id, { silent: false });
    res.json({
      ok: true,
      units: result.units,
      newlyUnlockedKeys: result.newlyUnlockedKeys,
      aggregateUnlockCount: result.aggregateUnlockCount,
    });
  }),
);
