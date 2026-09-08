import { Router } from 'express';
import { z } from 'zod';
import { loadAppState, saveAppState } from '../lib/appState.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

export const accountRouter = Router();

accountRouter.use(requireAuth);

const patchSchema = z
  .object({
    labPanels: z.array(z.unknown()).max(200).optional(),
    weightGoal: z.unknown().optional().nullable(),
    weightLogs: z.array(z.unknown()).max(400).optional(),
    stepsGoal: z.unknown().optional().nullable(),
    stepsGoalHistory: z.array(z.unknown()).max(30).optional(),
    runHistory: z.array(z.unknown()).max(60).optional(),
    doseLogs: z.array(z.unknown()).max(400).optional(),
    symptomHistory: z.array(z.unknown()).max(24).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'განსაახლებელი ველი არ არის მითითებული');

accountRouter.get(
  '/app-state',
  asyncHandler(async (req, res) => {
    const state = await loadAppState(req.user.id);
    return res.json({ state });
  }),
);

accountRouter.put(
  '/app-state',
  asyncHandler(async (req, res) => {
    const patch = patchSchema.parse(req.body ?? {});
    const state = await saveAppState(req.user.id, patch);
    return res.json({ state });
  }),
);
