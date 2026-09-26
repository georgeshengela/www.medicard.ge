import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { readAiConsent, recordAiConsent } from '../lib/aiConsent.js';

/**
 * The version is the explicit disclosure epoch (`2026-09-25.1`), not a hash —
 * the shape check only guards length; `recordAiConsent` answers 409 when it is stale.
 */
export const aiConsentBodySchema = z
  .object({ version: z.string().trim().min(1).max(64), decision: z.enum(['accepted', 'declined', 'revoked']) })
  .strict();

export const aiConsentRouter = Router();
aiConsentRouter.use(requireAuth);
aiConsentRouter.get('/', asyncHandler(async (req, res) => res.json(await readAiConsent(req.user.id))));
aiConsentRouter.put('/', asyncHandler(async (req, res) => {
  const data = aiConsentBodySchema.parse(req.body);
  res.json(await recordAiConsent(req.user.id, data));
}));
