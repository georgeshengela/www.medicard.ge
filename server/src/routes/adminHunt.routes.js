import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import {
  grantHuntQa,
  huntOverview,
  listHuntCaptures,
  listHuntQa,
  listHuntSessions,
  listHuntSuspicious,
  listHuntAudit,
  revokeHuntQa,
  terminateHuntSession,
  updateHuntConfig,
} from '../lib/hunt/admin.js';

export const adminHuntRouter = Router();
adminHuntRouter.use(requireAdmin);

const mutateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'ძალიან ბევრი მოთხოვნა.', code: 'RATE_LIMITED' },
});

adminHuntRouter.get(
  '/overview',
  requireAdminCapability('HUNT_VIEW'),
  asyncHandler(async (_req, res) => {
    res.json(await huntOverview());
  }),
);

adminHuntRouter.put(
  '/config',
  mutateLimiter,
  requireAdminCapability('HUNT_MANAGE'),
  asyncHandler(async (req, res) => {
    const body = z.record(z.any()).parse(req.body || {});
    res.json({ config: await updateHuntConfig(body, { admin: req.admin }) });
  }),
);

adminHuntRouter.get(
  '/sessions',
  requireAdminCapability('HUNT_VIEW'),
  asyncHandler(async (req, res) => {
    res.json(await listHuntSessions(req.query));
  }),
);

adminHuntRouter.post(
  '/sessions/:id/terminate',
  mutateLimiter,
  requireAdminCapability('HUNT_MANAGE'),
  asyncHandler(async (req, res) => {
    res.json(await terminateHuntSession(req.params.id, { admin: req.admin }));
  }),
);

adminHuntRouter.get(
  '/captures',
  requireAdminCapability('HUNT_VIEW'),
  asyncHandler(async (req, res) => {
    res.json(await listHuntCaptures(req.query));
  }),
);

adminHuntRouter.get(
  '/suspicious',
  requireAdminCapability('HUNT_VIEW'),
  asyncHandler(async (req, res) => {
    res.json(await listHuntSuspicious(req.query));
  }),
);

adminHuntRouter.get(
  '/qa',
  requireAdminCapability('HUNT_QA_GRANT'),
  asyncHandler(async (_req, res) => {
    res.json(await listHuntQa());
  }),
);

adminHuntRouter.post(
  '/qa',
  mutateLimiter,
  requireAdminCapability('HUNT_QA_GRANT'),
  asyncHandler(async (req, res) => {
    const body = z.object({ userId: z.string().min(8).max(80) }).parse(req.body || {});
    res.json(await grantHuntQa(body.userId, { admin: req.admin }));
  }),
);

adminHuntRouter.delete(
  '/qa/:userId',
  mutateLimiter,
  requireAdminCapability('HUNT_QA_GRANT'),
  asyncHandler(async (req, res) => {
    res.json(await revokeHuntQa(req.params.userId, { admin: req.admin }));
  }),
);

adminHuntRouter.get(
  '/audit',
  requireAdminCapability('HUNT_VIEW'),
  asyncHandler(async (req, res) => {
    res.json(await listHuntAudit(req.query));
  }),
);
