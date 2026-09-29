import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { errorGroupDetail, errorGroups, errorMonitorEnabled } from '../lib/errorMonitor.js';

/** Admin #/errors — app crashes and server 500s grouped by fingerprint (lib/errorMonitor.js). */
export const adminErrorsRouter = Router();
adminErrorsRouter.use(requireAdmin);

const missingTable = (error) => /ErrorEvent|42P01|does not exist/.test(String(error?.message || ''));

adminErrorsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { hours, source } = z.object({
      hours: z.coerce.number().int().min(1).max(168).default(24),
      source: z.enum(['all', 'app', 'server']).default('all'),
    }).parse(req.query);
    try {
      res.json({ installed: true, recording: errorMonitorEnabled(), ...(await errorGroups({ hours, source })) });
    } catch (error) {
      if (missingTable(error)) {
        return res.json({ installed: false, recording: errorMonitorEnabled(), hours, source, totals: { events: 0, groups: 0, users: 0, fatal: 0, newGroups: 0 }, groups: [] });
      }
      throw error;
    }
  }),
);

adminErrorsRouter.get(
  '/:fingerprint',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { fingerprint } = z.object({ fingerprint: z.string().regex(/^[0-9a-f]{16}$/) }).parse(req.params);
    const { hours } = z.object({ hours: z.coerce.number().int().min(1).max(168).default(24) }).parse(req.query);
    try {
      res.json(await errorGroupDetail(fingerprint, { hours }));
    } catch (error) {
      if (missingTable(error)) return res.json({ fingerprint, hours, events: [], hourly: [] });
      throw error;
    }
  }),
);
