import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { getUserLocationSnapshot, upsertUserLocation } from '../lib/userLocation.js';

export const locationRouter = Router();

const pingSchema = z.object({
  lat: z.number().gte(-90).lte(90).optional(),
  lng: z.number().gte(-180).lte(180).optional(),
  accuracy: z.number().min(0).max(100_000).optional().nullable(),
  enabled: z.boolean().optional(),
  prompted: z.boolean().optional(),
  source: z.enum(['grant', 'skip', 'heartbeat', 'watch', 'revoke']).optional(),
});

locationRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await getUserLocationSnapshot(req.user.id);
    res.json({ ok: true, ...result });
  }),
);

locationRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = pingSchema.parse(req.body ?? {});
    if ((body.lat == null) !== (body.lng == null)) {
      return res.status(400).json({ error: 'lat და lng ერთად უნდა გაიგზავნოს.' });
    }
    const result = await upsertUserLocation(req.user.id, body);
    res.json({ ok: true, ...result });
  }),
);
