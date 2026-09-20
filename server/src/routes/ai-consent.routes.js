import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { readAiConsent, recordAiConsent } from '../lib/aiConsent.js';

export const aiConsentRouter = Router();
aiConsentRouter.use(requireAuth);
aiConsentRouter.get('/', asyncHandler(async (req, res) => res.json(await readAiConsent(req.user.id))));
aiConsentRouter.put('/', asyncHandler(async (req, res) => {
  const data = z.object({ version: z.string().length(64), decision: z.enum(['accepted', 'declined', 'revoked']) }).strict().parse(req.body);
  res.json(await recordAiConsent(req.user.id, data));
}));
