/**
 * Home news cards („სიახლეები“).
 *   /api/announcements              — the signed-in person's live cards, details, view/tap/dismiss
 *   /api/announcements/image/:id    — public picture bytes (marketing images, long cache)
 *   /api/admin/announcements        — admin CRUD, picture upload, stats (NEWS_MANAGE for writes)
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { writeAdminAudit } from '../lib/adminAudit.js';
import { clientMetaFromRequest } from '../lib/appVersion.js';
import {
  createAnnouncement,
  decodeImageDataUrl,
  liveCardsFor,
  listForAdmin,
  publishedCard,
  readImage,
  recordReceipt,
  saveImage,
  setArchived,
  updateAnnouncement,
} from '../lib/announcements.js';

export const announcementsRouter = Router();
export const adminAnnouncementsRouter = Router();

const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

/* ───────── app ───────── */

announcementsRouter.get('/image/:id', asyncHandler(async (req, res) => {
  const image = await readImage(req.params.id);
  if (!image) return res.status(404).json({ error: 'სურათი ვერ მოიძებნა.' });
  res.set('Content-Type', image.mime);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.send(Buffer.from(image.bytes));
}));

const eventLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 150,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => `announcement:${req.user?.id || 'anon'}`,
  message: { error: 'ძალიან ბევრი მოთხოვნა.', code: 'RATE_LIMITED' },
});

announcementsRouter.get('/', requireAuth, noStore, asyncHandler(async (req, res) => {
  const placement = req.query.placement === 'home' || !req.query.placement ? 'home' : null;
  if (!placement) return res.json({ announcements: [] });
  const { platform } = clientMetaFromRequest(req);
  res.json({ announcements: await liveCardsFor(req.user, { placement, platform }) });
}));

announcementsRouter.get('/:id', requireAuth, noStore, asyncHandler(async (req, res) => {
  const { platform } = clientMetaFromRequest(req);
  const card = await publishedCard(String(req.params.id), req.user, { platform });
  if (!card) return res.status(404).json({ error: 'ეს სიახლე აღარ არის აქტიური.', code: 'ANNOUNCEMENT_GONE' });
  return res.json({ announcement: card });
}));

const eventBody = z.object({ type: z.enum(['view', 'click', 'dismiss']) });
announcementsRouter.post('/:id/events', requireAuth, eventLimiter, noStore, asyncHandler(async (req, res) => {
  const { type } = eventBody.parse(req.body);
  const ok = await recordReceipt(String(req.params.id), req.user.id, type);
  res.status(ok ? 200 : 404).json({ ok });
}));

/* ───────── admin ───────── */

adminAnnouncementsRouter.use(requireAdmin, noStore);
const manage = requireAdminCapability('NEWS_MANAGE');

const auditValue = (row) => row && ({
  status: row.status, title: row.title, ctaKind: row.ctaKind, ctaTarget: row.ctaTarget,
  audience: row.audience, startsAt: row.startsAt, endsAt: row.endsAt, priority: row.priority,
});

adminAnnouncementsRouter.get('/', asyncHandler(async (req, res) => {
  res.json({ announcements: await listForAdmin({ includeArchived: req.query.archived === '1' }) });
}));

adminAnnouncementsRouter.post('/', manage, asyncHandler(async (req, res) => {
  const created = await createAnnouncement(req.body, { admin: req.admin });
  await writeAdminAudit({
    admin: req.admin, action: 'announcement.create', targetType: 'announcement', targetId: created.id,
    previousValue: null, newValue: auditValue(created),
  });
  res.status(201).json({ announcement: created });
}));

adminAnnouncementsRouter.put('/:id', manage, asyncHandler(async (req, res) => {
  const { previous, next } = await updateAnnouncement(String(req.params.id), req.body, { admin: req.admin });
  await writeAdminAudit({
    admin: req.admin,
    action: previous.status !== next.status ? `announcement.${next.status === 'PUBLISHED' ? 'publish' : 'unpublish'}` : 'announcement.update',
    targetType: 'announcement', targetId: next.id, previousValue: auditValue(previous), newValue: auditValue(next),
  });
  res.json({ announcement: next });
}));

const archiveBody = z.object({ archived: z.boolean() });
adminAnnouncementsRouter.post('/:id/archive', manage, asyncHandler(async (req, res) => {
  const { archived } = archiveBody.parse(req.body);
  const { previous, next } = await setArchived(String(req.params.id), archived, { admin: req.admin });
  await writeAdminAudit({
    admin: req.admin, action: archived ? 'announcement.archive' : 'announcement.restore', targetType: 'announcement',
    targetId: next.id, previousValue: auditValue(previous), newValue: auditValue(next),
  });
  res.json({ announcement: next });
}));

const imageBody = z.object({
  dataUrl: z.string().max(1_700_000),
  width: z.number().int().min(1).max(8000).optional(),
  height: z.number().int().min(1).max(8000).optional(),
});
adminAnnouncementsRouter.post('/images', manage, asyncHandler(async (req, res) => {
  const body = imageBody.parse(req.body);
  const decoded = decodeImageDataUrl(body.dataUrl);
  const image = await saveImage({ ...decoded, width: body.width ?? null, height: body.height ?? null }, { admin: req.admin });
  res.status(201).json({ image });
}));
