/**
 * Admin #/book (MEDIBOOK): the claims queue, the catalogue (search, hide, edit, add), and the numbers.
 * BOOK_VIEW reads; BOOK_MANAGE approves/rejects claims and edits businesses. Every change is audited.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import { writeAdminAudit } from '../lib/adminAudit.js';
import { CATEGORIES, bookError } from '../lib/book/catalog.js';
import * as store from '../lib/book/store.js';
import { notifyClaimReviewed } from '../lib/book/push.js';

export const adminBookRouter = Router();
adminBookRouter.use(requireAdmin, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
const view = requireAdminCapability('BOOK_VIEW');
const manage = requireAdminCapability('BOOK_MANAGE');

adminBookRouter.get('/overview', view, asyncHandler(async (_req, res) => {
  res.json({ ...(await store.adminOverview()), categories: CATEGORIES.map((c) => ({ id: c.id, label: c.ka, color: c.color })) });
}));

adminBookRouter.get('/claims', view, asyncHandler(async (req, res) => {
  const status = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'].includes(String(req.query.status)) ? String(req.query.status) : 'PENDING';
  res.json({ claims: await store.adminClaims({ status }) });
}));

adminBookRouter.post('/claims/:id/review', manage, asyncHandler(async (req, res) => {
  const { action, note } = z.object({ action: z.enum(['approve', 'reject']), note: z.string().trim().max(500).optional().default('') }).parse(req.body ?? {});
  if (action === 'reject' && !note) throw bookError(400, 'უარის მიზეზი მიუთითე — მფლობელი მას ნახავს.', null, 'Add a reason — the owner will see it.');
  const claim = await store.adminReviewClaim({ claimId: String(req.params.id), action, note, admin: req.admin });
  const business = await store.businessRow(claim.businessId);
  await writeAdminAudit({ admin: req.admin, action: `BOOK_CLAIM_${action.toUpperCase()}`, targetType: 'BookClaim', targetId: claim.id, newValue: { businessId: claim.businessId, kind: claim.kind, note } });
  notifyClaimReviewed({ userId: claim.userId, approved: action === 'approve', businessName: business?.nameKa || business?.name || 'ბიზნესი', note }).catch(() => undefined);
  res.json({ ok: true, status: claim.status });
}));

adminBookRouter.get('/businesses', view, asyncHandler(async (req, res) => {
  const status = ['LISTED', 'PENDING', 'CLAIMED', 'HIDDEN', 'ALL'].includes(String(req.query.status)) ? String(req.query.status) : 'ALL';
  res.json(await store.adminBusinesses({ q: String(req.query.q ?? ''), status, category: req.query.category ? String(req.query.category).toUpperCase() : null, limit: Number(req.query.limit) || 100, offset: Number(req.query.offset) || 0 }));
}));

adminBookRouter.get('/businesses/:id', view, asyncHandler(async (req, res) => {
  const business = await store.businessDetail(req.params.id, { includeHidden: true });
  if (!business) throw bookError(404, 'ბიზნესი ვერ მოიძებნა.', 'BUSINESS_NOT_FOUND', 'Business not found.');
  const [members, images] = await Promise.all([store.listMembers(business.id), store.listImages(business.id)]);
  res.json({ business, members, images });
}));

adminBookRouter.post('/businesses', manage, asyncHandler(async (req, res) => {
  const row = await store.adminCreateBusiness(req.body ?? {}, req.admin);
  await writeAdminAudit({ admin: req.admin, action: 'BOOK_BUSINESS_ADD', targetType: 'BookBusiness', targetId: row.id, newValue: { name: row.name, category: row.category, city: row.city } });
  res.status(201).json({ business: await store.businessDetail(row.id, { includeHidden: true }) });
}));

adminBookRouter.patch('/businesses/:id', manage, asyncHandler(async (req, res) => {
  const before = await store.requireBusiness(req.params.id);
  const patch = store.sanitizeBusinessInput(req.body ?? {});
  if (req.body?.status !== undefined) {
    if (!['LISTED', 'PENDING', 'CLAIMED', 'HIDDEN'].includes(String(req.body.status))) throw bookError(400, 'უცნობი სტატუსი.', 'BAD_STATUS', 'Unknown status.');
    // CLAIMED needs an owner; without one the admin lists it instead.
    patch.status = req.body.status === 'CLAIMED' && !before.ownerUserId ? 'LISTED' : String(req.body.status);
  }
  const row = await store.updateBusiness(before.id, patch);
  await writeAdminAudit({ admin: req.admin, action: 'BOOK_BUSINESS_UPDATE', targetType: 'BookBusiness', targetId: row.id, previousValue: { status: before.status }, newValue: { ...patch, hours: undefined, settings: undefined } });
  res.json({ business: await store.businessDetail(row.id, { includeHidden: true }) });
}));
