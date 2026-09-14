import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { applyPrivateCache } from '../lib/cycleShare.js';
import { RATE_LIMIT_VALIDATE } from '../lib/rateLimitKey.js';
import {
  cancelHuntEncounter,
  collectHuntCapsule,
  completeHuntEncounter,
  endHuntSession,
  getHuntSession,
  huntProgressForUser,
  pauseHuntSession,
  pingHuntSession,
  publicHuntForApp,
  resumeHuntSession,
  startHuntEncounter,
  startHuntSession,
} from '../lib/hunt/session.js';

export const huntRouter = Router();
huntRouter.use(requireAuth);
huntRouter.use((_req, res, next) => {
  applyPrivateCache(res);
  next();
});

const pingLimiter = rateLimit({
  windowMs: 10_000,
  limit: 24,
  standardHeaders: true,
  legacyHeaders: false,
  validate: RATE_LIMIT_VALIDATE,
  message: { error: 'ნელა, კიდევ ერთი წამი.', code: 'HUNT_RATE' },
});

const originBody = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  accuracy: z.number().positive().max(200).optional(),
  mode: z.enum(['default', 'gentle']).optional(),
  simulation: z.boolean().optional(),
});

const pingBody = z.object({
  samples: z
    .array(
      z.object({
        lat: z.number().gte(-90).lte(90),
        lng: z.number().gte(-180).lte(180),
        accuracy: z.number().positive().max(250),
        at: z.number().int().positive(),
        seq: z.number().int().optional(),
      }),
    )
    .max(8),
});

function tz(req) {
  return req.headers['x-client-timezone'] || undefined;
}

huntRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json(await publicHuntForApp());
  }),
);

huntRouter.get(
  '/progress',
  asyncHandler(async (req, res) => {
    res.json(await huntProgressForUser(req.user.id));
  }),
);

huntRouter.post(
  '/sessions',
  pingLimiter,
  asyncHandler(async (req, res) => {
    const body = originBody.parse(req.body || {});
    res.status(201).json(
      await startHuntSession(req.user.id, body, {
        user: req.user,
        timezone: tz(req),
      }),
    );
  }),
);

huntRouter.get(
  '/sessions/:id',
  asyncHandler(async (req, res) => {
    res.json(await getHuntSession(req.user.id, req.params.id, { timezone: tz(req) }));
  }),
);

huntRouter.post(
  '/sessions/:id/ping',
  pingLimiter,
  asyncHandler(async (req, res) => {
    const body = pingBody.parse(req.body || {});
    res.json(await pingHuntSession(req.user.id, req.params.id, body, { timezone: tz(req) }));
  }),
);

huntRouter.post(
  '/sessions/:id/pause',
  asyncHandler(async (req, res) => {
    res.json(await pauseHuntSession(req.user.id, req.params.id, { timezone: tz(req) }));
  }),
);

huntRouter.post(
  '/sessions/:id/resume',
  asyncHandler(async (req, res) => {
    res.json(await resumeHuntSession(req.user.id, req.params.id, { timezone: tz(req) }));
  }),
);

huntRouter.post(
  '/sessions/:id/end',
  asyncHandler(async (req, res) => {
    res.json(await endHuntSession(req.user.id, req.params.id, { timezone: tz(req) }));
  }),
);

huntRouter.post(
  '/sessions/:id/capsules/:capsuleId',
  asyncHandler(async (req, res) => {
    res.json(await collectHuntCapsule(req.user.id, req.params.id, req.params.capsuleId, { timezone: tz(req) }));
  }),
);

huntRouter.post(
  '/sessions/:id/encounters',
  asyncHandler(async (req, res) => {
    const body = z.object({ enemyId: z.string().min(1).max(40) }).parse(req.body || {});
    res.json(await startHuntEncounter(req.user.id, req.params.id, body.enemyId, { timezone: tz(req) }));
  }),
);

huntRouter.post(
  '/sessions/:id/encounters/complete',
  asyncHandler(async (req, res) => {
    const body = z.object({ token: z.string().uuid() }).parse(req.body || {});
    res.json(await completeHuntEncounter(req.user.id, req.params.id, body, { timezone: tz(req) }));
  }),
);

huntRouter.post(
  '/sessions/:id/encounters/cancel',
  asyncHandler(async (req, res) => {
    res.json(await cancelHuntEncounter(req.user.id, req.params.id, { timezone: tz(req) }));
  }),
);
