import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { RULES, capacityStatus, loadEvents, sendTestAlert } from '../lib/capacity.js';
import { writeAdminAudit } from '../lib/adminAudit.js';

/** Admin #/capacity — fleet load, owner alerts and the Render step to take. */
export const adminCapacityRouter = Router();
adminCapacityRouter.use(requireAdmin);

adminCapacityRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { hours } = z.object({ hours: z.coerce.number().int().min(1).max(168).default(6) }).parse(req.query);
    try {
      const [status, events] = await Promise.all([capacityStatus({ hours }), loadEvents(30)]);
      const { telegramConfigured } = await import('../lib/director/telegram.js');
      const { getState } = await import('../lib/director/store.js');
      const director = await getState().catch(() => null);
      res.json({
        installed: true,
        hours,
        rules: RULES,
        telegram: { configured: telegramConfigured(), paired: Boolean(director?.ownerChatId) },
        ...status,
        events,
      });
    } catch (error) {
      if (/Capacity(Sample|Event)|42P01|does not exist/.test(String(error?.message || ''))) {
        return res.json({ installed: false, hours, rules: RULES, series: [], live: [], events: [], current: { level: 'ok', reasons: [] }, steps: [], instances: 1 });
      }
      throw error;
    }
  }),
);

adminCapacityRouter.post(
  '/test',
  asyncHandler(async (req, res) => {
    const result = await sendTestAlert();
    await writeAdminAudit({ admin: req.admin, action: 'capacity.test_alert', targetType: 'system', targetId: 'capacity', newValue: result }).catch(() => {});
    res.json(result);
  }),
);
