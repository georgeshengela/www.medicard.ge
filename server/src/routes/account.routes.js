import { Router } from 'express';
import { z } from 'zod';
import { loadAppState, saveAppState } from '../lib/appState.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { getEmailPreferences, setEmailMarketingOptIn } from '../lib/email/preferences.js';
import { t } from '../lib/i18n.js';

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

/**
 * Marketing email consent („სიახლეები და რჩევები ელფოსტით“ in Profile → Notifications).
 * Off by default (Law 3144: prior explicit consent). Transactional mail is not affected.
 */
accountRouter.get(
  '/email-preferences',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const prefs = await getEmailPreferences(req.user.id);
    if (!prefs) return res.status(404).json({ error: t(req, 'მომხმარებელი ვერ მოიძებნა.', 'Account not found.') });
    return res.json(prefs);
  }),
);

const emailPrefsSchema = z.object({ marketingOptIn: z.boolean() });

accountRouter.patch(
  '/email-preferences',
  asyncHandler(async (req, res) => {
    const { marketingOptIn } = emailPrefsSchema.parse(req.body ?? {});
    const current = await getEmailPreferences(req.user.id);
    if (!current) return res.status(404).json({ error: t(req, 'მომხმარებელი ვერ მოიძებნა.', 'Account not found.') });
    if (marketingOptIn && !current.canReceive) {
      return res.status(400).json({ error: t(req, 'ანგარიშზე ელფოსტა არ არის მითითებული.', 'There is no email address on your account.'), code: 'NO_EMAIL' });
    }
    return res.json(await setEmailMarketingOptIn(req.user.id, marketingOptIn));
  }),
);
