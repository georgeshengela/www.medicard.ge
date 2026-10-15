/**
 * MEDIBOOK for business owners — /api/business, behind https://medicard.ge/business. Claims and new
 * registrations, then everything a claimed business manages: profile and pictures, staff, services,
 * time off, the calendar and walk-ins, clients, discounts, money, analytics, reviews and the team.
 * Access: OWNER = all, MANAGER = all but the team, STAFF = own calendar and clients (read).
 */
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { t } from '../lib/i18n.js';
import { mapboxPublicToken } from '../lib/adminUserGeo.js';
import { CATEGORY_IDS, TBILISI_CENTER, bookError, guessCategory, hoursFromMapboxPeriods, normalizeSettings } from '../lib/book/catalog.js';
import * as store from '../lib/book/store.js';
import * as bookings from '../lib/book/bookings.js';
import { buildAnalytics, periodFor } from '../lib/book/analytics.js';
import { notifyBooked, notifyChanged, notifyWaitlistAdded, notifyWaitlistOpening, offerOpenings } from '../lib/book/push.js';
import * as waitlist from '../lib/book/waitlist.js';
import * as bookSms from '../lib/book/sms.js';
import * as loyalty from '../lib/book/loyalty.js';
import { prisma } from '../lib/prisma.js';
import { addDaysYmd, isYmd, tbilisiInstant, tbilisiYmd } from '../lib/book/time.js';

export const businessRouter = Router();
businessRouter.use(requireAuth, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const lang = (req) => (req.lang === 'en' ? 'en' : 'ka');
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const MANAGE = ['OWNER', 'MANAGER'];
const ALL = ['OWNER', 'MANAGER', 'STAFF'];

// ——— my businesses, claims, registration ———

businessRouter.get('/me', asyncHandler(async (req, res) => {
  const [memberships, claims] = await Promise.all([store.membershipsOf(req.user.id), store.claimsOf(req.user.id)]);
  res.json({ memberships, claims, mapboxToken: mapboxPublicToken(), user: { id: req.user.id, name: req.user.fullName, phone: req.user.phone ?? null } });
}));

businessRouter.get('/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').slice(0, 80);
  const lat = num(req.query.lat);
  const lng = num(req.query.lng);
  const origin = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const businesses = await store.searchBusinesses({ q, limit: 20, lang: lang(req), origin });
  res.json({ businesses });
}));

/** Places map providers know that our catalogue does not (yet): the person can register from one of them. */
businessRouter.get('/external', asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80);
  const token = mapboxPublicToken();
  if (q.length < 2 || !token) return res.json({ places: [] });
  const lat = num(req.query.lat) ?? TBILISI_CENTER.lat;
  const lng = num(req.query.lng) ?? TBILISI_CENTER.lng;
  const url = new URL('https://api.mapbox.com/search/searchbox/v1/forward');
  url.searchParams.set('q', q);
  url.searchParams.set('access_token', token);
  url.searchParams.set('country', 'ge');
  url.searchParams.set('types', 'poi');
  url.searchParams.set('limit', '8');
  url.searchParams.set('proximity', `${lng},${lat}`);
  let json = null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    json = r.ok ? await r.json() : null;
  } catch {
    json = null;
  }
  const places = (json?.features ?? []).map((f) => {
    const p = f.properties ?? {};
    const meta = p.metadata ?? {};
    return {
      ref: p.mapbox_id,
      name: p.name,
      address: p.full_address ?? p.place_formatted ?? null,
      city: p.context?.place?.name ?? null,
      lat: f.geometry?.coordinates?.[1] ?? null,
      lng: f.geometry?.coordinates?.[0] ?? null,
      phone: meta.phone ?? null,
      website: meta.website ?? null,
      category: guessCategory({ mapbox: p.poi_category_ids ?? [], name: p.name ?? '' }),
      hours: meta.open_hours?.periods ? hoursFromMapboxPeriods(meta.open_hours.periods) : {},
    };
  }).filter((p) => p.lat != null);
  res.json({ places });
}));

/** Address → coordinates for the registration form (Georgia only). */
businessRouter.get('/geocode', asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 120);
  const token = mapboxPublicToken();
  if (q.length < 3 || !token) return res.json({ results: [] });
  const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  url.searchParams.set('q', q);
  url.searchParams.set('access_token', token);
  url.searchParams.set('country', 'ge');
  url.searchParams.set('limit', '6');
  url.searchParams.set('language', lang(req));
  let json = null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    json = r.ok ? await r.json() : null;
  } catch {
    json = null;
  }
  res.json({ results: (json?.features ?? []).map((f) => ({ label: f.properties?.full_address ?? f.properties?.name, lat: f.geometry?.coordinates?.[1], lng: f.geometry?.coordinates?.[0], city: f.properties?.context?.place?.name ?? null, district: f.properties?.context?.neighborhood?.name ?? f.properties?.context?.locality?.name ?? null })).filter((r) => Number.isFinite(r.lat)) });
}));

businessRouter.get('/similar', asyncHandler(async (req, res) => {
  res.json({ businesses: await store.similarBusinesses({ name: String(req.query.name ?? ''), lat: num(req.query.lat), lng: num(req.query.lng) }) });
}));

const proofSchema = z.object({ position: z.string().trim().max(80).optional(), phone: z.string().trim().max(32).optional(), email: z.string().trim().max(120).optional(), website: z.string().trim().max(200).optional() }).partial();

businessRouter.post('/claims', asyncHandler(async (req, res) => {
  const body = z.object({ businessId: z.string().min(1), proof: proofSchema.optional(), note: z.string().trim().max(500).optional() }).parse(req.body ?? {});
  const claims = await store.claimBusiness({ userId: req.user.id, businessId: body.businessId, proof: body.proof ?? {}, note: body.note ?? null });
  res.status(201).json({ claims });
}));

businessRouter.post('/register', asyncHandler(async (req, res) => {
  const body = z.object({ business: z.record(z.unknown()), proof: proofSchema.optional(), note: z.string().trim().max(500).optional(), externalRef: z.string().trim().max(120).optional() }).parse(req.body ?? {});
  const row = await store.registerBusiness({ userId: req.user.id, input: body.business, proof: { ...(body.proof ?? {}), externalRef: body.externalRef ?? null }, note: body.note ?? null });
  const [memberships, claims] = await Promise.all([store.membershipsOf(req.user.id), store.claimsOf(req.user.id)]);
  res.status(201).json({ business: { id: row.id, slug: row.slug, name: row.nameKa || row.name, status: row.status }, memberships, claims });
}));

// ——— one business ———

const member = (roles) => asyncHandler(async (req, _res, next) => {
  req.member = await store.requireMember(req.user.id, String(req.params.businessId), roles);
  next();
});

businessRouter.get('/:businessId', member(ALL), asyncHandler(async (req, res) => {
  const [detail, images, staff, services, members] = await Promise.all([
    store.businessDetail(req.params.businessId, { lang: lang(req), includeHidden: true }),
    store.listImages(req.params.businessId),
    store.listStaff(req.params.businessId, { all: true }),
    store.listServices(req.params.businessId, { all: true }),
    req.member.role === 'STAFF' ? Promise.resolve([]) : store.listMembers(req.params.businessId),
  ]);
  if (!detail) throw bookError(404, 'ბიზნესი ვერ მოიძებნა.', 'BUSINESS_NOT_FOUND', 'Business not found.');
  const row = await store.businessRow(req.params.businessId);
  res.json({ business: { ...detail, nameEn: row.name, nameKa: row.nameKa, descriptionEn: row.description, descriptionKa: row.descriptionKa, addressEn: row.address, addressKa: row.addressKa, logoImageId: row.logoImageId, coverImageId: row.coverImageId, photoIds: Array.isArray(row.photos) ? row.photos : [], source: row.source }, images, staff, services, members, role: req.member.role, staffId: req.member.staffId });
}));

businessRouter.patch('/:businessId', member(MANAGE), asyncHandler(async (req, res) => {
  const input = req.body ?? {};
  const patch = store.sanitizeBusinessInput(input);
  if (input.name !== undefined && !patch.name) throw bookError(400, 'სახელი ცარიელი ვერ იქნება.', 'NAME_REQUIRED', 'The name cannot be empty.');
  if (input.category !== undefined && !patch.category) throw bookError(400, 'უცნობი კატეგორია.', 'BAD_CATEGORY', 'Unknown category.');
  // Picture roles: only this business's own pictures.
  const images = await store.listImages(req.params.businessId);
  const own = new Set(images.map((i) => i.id));
  for (const key of ['logoImageId', 'coverImageId']) {
    if (input[key] !== undefined) patch[key] = input[key] && own.has(String(input[key])) ? String(input[key]) : null;
  }
  if (input.photoIds !== undefined) patch.photos = (Array.isArray(input.photoIds) ? input.photoIds : []).map(String).filter((id) => own.has(id)).slice(0, 24);
  if (patch.settings) {
    const current = normalizeSettings((await store.businessRow(req.params.businessId))?.settings);
    const next = { ...current, ...input.settings };
    // notify is nested: a partial patch keeps what it does not mention.
    if (input.settings?.loyalty && typeof input.settings.loyalty === 'object') next.loyalty = { ...current.loyalty, ...input.settings.loyalty };
    if (input.settings?.notify && typeof input.settings.notify === 'object') {
      const n = input.settings.notify;
      next.notify = { ...current.notify, ...n, push: { ...current.notify.push, ...(n.push ?? {}) }, sms: { ...current.notify.sms, ...(n.sms ?? {}) }, email: { ...current.notify.email, ...(n.email ?? {}) } };
    }
    patch.settings = normalizeSettings(next);
  }
  const row = await store.updateBusiness(req.params.businessId, patch);
  res.json({ business: await store.businessDetail(row.id, { lang: lang(req), includeHidden: true }) });
}));

businessRouter.get('/:businessId/overview', member(ALL), asyncHandler(async (req, res) => {
  const data = await bookings.overviewRaw({ businessId: req.params.businessId });
  if (req.member.role === 'STAFF' && req.member.staffId) {
    data.today = data.today.filter((a) => a.staffId === req.member.staffId);
    data.upcoming = data.upcoming.filter((a) => a.staffId === req.member.staffId);
  }
  res.json(data);
}));

// pictures
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 4 } });
businessRouter.post('/:businessId/images', member(MANAGE), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file?.buffer) throw bookError(400, 'აირჩიე სურათი.', 'FILE_REQUIRED', 'Choose a picture.');
  let image;
  try {
    const pipeline = sharp(req.file.buffer, { limitInputPixels: 60_000_000, failOn: 'error' }).rotate();
    const meta = await pipeline.metadata();
    const square = req.body?.kind === 'logo' || req.body?.kind === 'staff';
    const out = square
      ? await pipeline.resize(512, 512, { fit: 'cover', position: 'attention' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer({ resolveWithObject: true })
      : await pipeline.resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    image = { buffer: out.data, width: out.info.width, height: out.info.height, source: meta.format };
  } catch {
    throw bookError(400, 'სურათი ვერ წავიკითხეთ. სცადე JPG ან PNG.', 'BAD_IMAGE', 'We could not read this picture. Try a JPG or PNG.');
  }
  const saved = await store.saveImage({ businessId: req.params.businessId, buffer: image.buffer, mime: 'image/jpeg', width: image.width, height: image.height, createdBy: req.user.id });
  res.status(201).json({ image: saved });
}));

businessRouter.delete('/:businessId/images/:imageId', member(MANAGE), asyncHandler(async (req, res) => {
  await store.deleteImage(req.params.businessId, req.params.imageId);
  res.json({ ok: true });
}));

// staff
businessRouter.get('/:businessId/staff', member(ALL), asyncHandler(async (req, res) => res.json({ staff: await store.listStaff(req.params.businessId, { all: true }) })));
businessRouter.post('/:businessId/staff', member(MANAGE), asyncHandler(async (req, res) => res.status(201).json({ staff: await store.createStaff(req.params.businessId, req.body ?? {}) })));
businessRouter.patch('/:businessId/staff/:staffId', member(MANAGE), asyncHandler(async (req, res) => res.json({ staff: await store.updateStaff(req.params.businessId, req.params.staffId, req.body ?? {}) })));
businessRouter.delete('/:businessId/staff/:staffId', member(MANAGE), asyncHandler(async (req, res) => { await store.deactivateStaff(req.params.businessId, req.params.staffId); res.json({ ok: true }); }));

// services
businessRouter.get('/:businessId/services', member(ALL), asyncHandler(async (req, res) => res.json({ services: await store.listServices(req.params.businessId, { all: true }) })));
businessRouter.post('/:businessId/services', member(MANAGE), asyncHandler(async (req, res) => res.status(201).json({ service: await store.createService(req.params.businessId, req.body ?? {}) })));
businessRouter.patch('/:businessId/services/:serviceId', member(MANAGE), asyncHandler(async (req, res) => res.json({ service: await store.updateService(req.params.businessId, req.params.serviceId, req.body ?? {}) })));
businessRouter.delete('/:businessId/services/:serviceId', member(MANAGE), asyncHandler(async (req, res) => { await store.deactivateService(req.params.businessId, req.params.serviceId); res.json({ ok: true }); }));

// time off
function range(req, defaultDays = 7) {
  const from = isYmd(req.query.from) ? tbilisiInstant(String(req.query.from), 0) : tbilisiInstant(tbilisiYmd(), 0);
  const to = isYmd(req.query.to) ? tbilisiInstant(addDaysYmd(String(req.query.to), 1), 0) : new Date(from.getTime() + defaultDays * 86400_000);
  if (to.getTime() - from.getTime() > 120 * 86400_000) throw bookError(400, 'პერიოდი მაქსიმუმ 120 დღეა.', 'RANGE_TOO_LONG', 'The period is at most 120 days.');
  return { from, to };
}
businessRouter.get('/:businessId/time-off', member(ALL), asyncHandler(async (req, res) => res.json({ timeOff: await store.listTimeOff(req.params.businessId, range(req, 60)) })));
businessRouter.post('/:businessId/time-off', member(MANAGE), asyncHandler(async (req, res) => {
  const body = z.object({ staffId: z.string().nullable().optional(), startsAt: z.string(), endsAt: z.string(), reason: z.string().trim().max(120).optional() }).parse(req.body ?? {});
  res.status(201).json({ timeOff: await store.addTimeOff(req.params.businessId, { staffId: body.staffId ?? null, startsAt: body.startsAt, endsAt: body.endsAt, reason: body.reason ?? null }) });
}));
businessRouter.delete('/:businessId/time-off/:id', member(MANAGE), asyncHandler(async (req, res) => {
  const [off] = await prisma.$queryRaw`SELECT "startsAt", "endsAt" FROM "BookTimeOff" WHERE id = ${req.params.id} AND "businessId" = ${req.params.businessId}`;
  await store.removeTimeOff(req.params.businessId, req.params.id);
  // The freed days may fit someone on the waiting list.
  if (off) {
    const dates = [];
    for (let d = tbilisiYmd(off.startsAt); d <= tbilisiYmd(off.endsAt) && dates.length < 14; d = addDaysYmd(d, 1)) dates.push(d);
    offerOpenings({ businessId: req.params.businessId, dates }).catch(() => undefined);
  }
  res.json({ ok: true });
}));

// calendar
businessRouter.get('/:businessId/appointments', member(ALL), asyncHandler(async (req, res) => {
  const { from, to } = range(req);
  const staffId = req.member.role === 'STAFF' && req.member.staffId ? req.member.staffId : req.query.staffId ? String(req.query.staffId) : null;
  const status = req.query.status && ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(String(req.query.status)) ? String(req.query.status) : null;
  res.json({ appointments: await bookings.businessAppointments({ businessId: req.params.businessId, from, to, staffId, status, clientId: req.query.clientId ? String(req.query.clientId) : null }) });
}));

businessRouter.get('/:businessId/availability', member(ALL), asyncHandler(async (req, res) => {
  res.json(await bookings.availability({ businessId: req.params.businessId, serviceId: String(req.query.serviceId ?? ''), serviceIds: req.query.serviceIds ? String(req.query.serviceIds) : undefined, date: String(req.query.date ?? ''), staffId: req.query.staffId ? String(req.query.staffId) : null, ignoreLead: true }));
}));

const walkInBody = z.object({
  serviceId: z.string().min(1).optional(),
  serviceIds: z.array(z.string().min(1)).min(1).max(8).optional(),
  staffId: z.string().min(1).nullable().optional(),
  startsAt: z.string().min(10),
  clientId: z.string().optional(),
  clientName: z.string().trim().max(120).optional(),
  clientPhone: z.string().trim().max(32).optional(),
  clientUserId: z.string().optional(),
  note: z.string().trim().max(500).optional(),
  internalNote: z.string().trim().max(1000).optional(),
  force: z.boolean().optional(),
});

businessRouter.post('/:businessId/appointments', member(ALL), asyncHandler(async (req, res) => {
  const body = walkInBody.parse(req.body ?? {});
  let clientName = body.clientName ?? null;
  let clientPhone = body.clientPhone ?? null;
  let user = null;
  if (body.clientId) {
    const { client } = await bookings.clientDetail({ businessId: req.params.businessId, clientId: body.clientId });
    clientName = clientName ?? client.name;
    clientPhone = clientPhone ?? client.phone;
    if (client.userId) user = { id: client.userId, fullName: client.name, phone: client.phone };
  }
  if (!clientName) throw bookError(400, 'მიუთითე კლიენტის სახელი.', 'NAME_REQUIRED', 'Enter the client name.');
  if (!body.serviceId && !body.serviceIds?.length) throw bookError(400, 'აირჩიე სერვისი.', 'SERVICE_REQUIRED', 'Pick a service.');
  const staffId = req.member.role === 'STAFF' && req.member.staffId ? req.member.staffId : body.staffId ?? null;
  const row = await bookings.createAppointment({ businessId: req.params.businessId, serviceId: body.serviceId, serviceIds: body.serviceIds, staffId, startsAt: body.startsAt, note: body.note ?? null, user, clientName, clientPhone, byBusiness: true, force: Boolean(body.force) });
  if (body.internalNote) await bookings.updateByBusiness({ businessId: req.params.businessId, id: row.id, patch: { internalNote: body.internalNote }, actorUserId: req.user.id });
  notifyBooked(row).catch(() => undefined);
  waitlist.markBooked({ businessId: req.params.businessId, userId: row.clientUserId, clientId: row.clientId, appointmentId: row.id, startsAt: row.startsAt, serviceIds: [row.serviceId, ...(Array.isArray(row.items) ? row.items.map((i) => i.id) : [])] }).catch(() => undefined);
  res.status(201).json({ appointment: bookings.appointmentPublic(await bookings.appointmentRow(row.id)) });
}));

const patchBody = z.object({
  startsAt: z.string().optional(),
  staffId: z.string().nullable().optional(),
  serviceId: z.string().optional(),
  durationMin: z.number().int().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
  cancelReason: z.string().trim().max(300).optional(),
  price: z.union([z.number(), z.string(), z.null()]).optional(),
  paidAmount: z.union([z.number(), z.string(), z.null()]).optional(),
  paidMethod: z.string().max(16).nullable().optional(),
  internalNote: z.string().trim().max(1000).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  clientName: z.string().trim().max(120).optional(),
  clientPhone: z.string().trim().max(32).nullable().optional(),
  force: z.boolean().optional(),
  /** On completion: how the visit is paid besides money (a gift-card code, bonus to spend, a membership to use). */
  payment: z.object({ giftCode: z.string().trim().max(16).optional(), bonusAmount: z.union([z.number(), z.string()]).optional(), clientMembershipId: z.string().optional() }).optional(),
});

businessRouter.patch('/:businessId/appointments/:id', member(ALL), asyncHandler(async (req, res) => {
  const patch = patchBody.parse(req.body ?? {});
  if (req.member.role === 'STAFF') {
    const current = await bookings.appointmentRow(req.params.id);
    if (!current || current.businessId !== req.params.businessId || (req.member.staffId && current.staffId !== req.member.staffId)) throw bookError(403, 'მხოლოდ საკუთარი ჩანაწერების შეცვლა შეგიძლია.', 'ROLE_REQUIRED', 'You can only change your own appointments.');
    delete patch.price;
    delete patch.paidAmount;
  }
  const result = await bookings.updateByBusiness({ businessId: req.params.businessId, id: req.params.id, patch, actorUserId: req.user.id });
  // The client push is skipped inside for walk-ins; the SMS (people without the app) must still go out.
  if (result.moved || result.statusChanged) notifyChanged(result.row, { previousStatus: result.previousStatus, moved: result.moved }).catch(() => undefined);
  // A cancelled or moved booking frees its old day: offer it to the waiting list before answering, so the
  // panel can say how many people were told.
  let waitlistOffered = 0;
  if ((result.statusChanged && result.row.status === 'CANCELLED') || result.moved) {
    waitlistOffered = await offerOpenings({ businessId: req.params.businessId, dates: [tbilisiYmd(new Date(result.previousStartsAt ?? result.row.startsAt))] });
  }
  res.json({ appointment: bookings.appointmentPublic(result.row), waitlistOffered });
}));

// loyalty: cashback rules + numbers, gift cards, memberships, the client's card, payment options for a completion
businessRouter.get('/:businessId/loyalty', member(MANAGE), asyncHandler(async (req, res) => {
  const row = await store.businessRow(req.params.businessId);
  res.json({ loyalty: normalizeSettings(row?.settings).loyalty, overview: await loyalty.loyaltyOverview(req.params.businessId) });
}));
businessRouter.get('/:businessId/gift-cards', member(ALL), asyncHandler(async (req, res) => res.json({ giftCards: await loyalty.listGiftCards(req.params.businessId, { status: req.query.status ? String(req.query.status) : 'ACTIVE' }) })));
businessRouter.get('/:businessId/gift-cards/find', member(ALL), asyncHandler(async (req, res) => {
  const row = await loyalty.findGiftCard(req.params.businessId, String(req.query.code ?? ''));
  res.json({ giftCard: row ? loyalty.giftCardPublic(row) : null });
}));
businessRouter.post('/:businessId/gift-cards', member(ALL), asyncHandler(async (req, res) => {
  const body = z.object({ amount: z.union([z.number(), z.string()]), buyerClientId: z.string().optional(), buyerName: z.string().trim().max(120).optional(), recipientName: z.string().trim().max(120).optional(), recipientPhone: z.string().trim().max(32).optional(), note: z.string().trim().max(300).optional(), expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), paidMethod: z.string().max(16).optional() }).parse(req.body ?? {});
  res.status(201).json({ giftCard: await loyalty.sellGiftCard({ businessId: req.params.businessId, ...body, actorUserId: req.user.id }) });
}));
businessRouter.patch('/:businessId/gift-cards/:id', member(MANAGE), asyncHandler(async (req, res) => {
  const patch = z.object({ status: z.enum(['CANCELLED']).optional(), note: z.string().trim().max(300).nullable().optional(), recipientName: z.string().trim().max(120).nullable().optional(), recipientPhone: z.string().trim().max(32).nullable().optional() }).parse(req.body ?? {});
  res.json({ giftCard: await loyalty.updateGiftCard({ businessId: req.params.businessId, id: req.params.id, patch }) });
}));
businessRouter.get('/:businessId/memberships', member(ALL), asyncHandler(async (req, res) => res.json({ memberships: await loyalty.listMemberships(req.params.businessId, { all: req.query.all === '1' }) })));
const membershipBody = z.object({ title: z.string().trim().max(120), description: z.string().trim().max(300).optional(), kind: z.enum(['VISITS', 'AMOUNT']).optional(), serviceIds: z.array(z.string()).max(50).optional(), visitsTotal: z.union([z.number(), z.string()]).optional(), amountTotal: z.union([z.number(), z.string()]).optional(), price: z.union([z.number(), z.string()]), validDays: z.union([z.number(), z.string()]).optional(), active: z.boolean().optional() });
businessRouter.post('/:businessId/memberships', member(MANAGE), asyncHandler(async (req, res) => res.status(201).json({ membership: await loyalty.saveMembership({ businessId: req.params.businessId, input: membershipBody.parse(req.body ?? {}) }) })));
businessRouter.patch('/:businessId/memberships/:id', member(MANAGE), asyncHandler(async (req, res) => res.json({ membership: await loyalty.saveMembership({ businessId: req.params.businessId, id: req.params.id, input: membershipBody.parse(req.body ?? {}) }) })));
businessRouter.delete('/:businessId/memberships/:id', member(MANAGE), asyncHandler(async (req, res) => { await loyalty.deactivateMembership({ businessId: req.params.businessId, id: req.params.id }); res.json({ ok: true }); }));
businessRouter.get('/:businessId/client-memberships', member(ALL), asyncHandler(async (req, res) => res.json({ clientMemberships: await loyalty.listClientMemberships(req.params.businessId, { clientId: req.query.clientId ? String(req.query.clientId) : null, status: req.query.status ? String(req.query.status) : 'ACTIVE' }) })));
businessRouter.post('/:businessId/client-memberships', member(ALL), asyncHandler(async (req, res) => {
  const body = z.object({ membershipId: z.string().min(1), clientId: z.string().min(1), paidMethod: z.string().max(16).optional(), startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.body ?? {});
  res.status(201).json({ clientMembership: await loyalty.sellMembership({ businessId: req.params.businessId, ...body, actorUserId: req.user.id }) });
}));
businessRouter.patch('/:businessId/client-memberships/:id', member(MANAGE), asyncHandler(async (req, res) => {
  z.object({ status: z.enum(['CANCELLED']) }).parse(req.body ?? {});
  await loyalty.cancelClientMembership({ businessId: req.params.businessId, id: req.params.id });
  res.json({ ok: true });
}));
businessRouter.get('/:businessId/clients/:clientId/loyalty', member(ALL), asyncHandler(async (req, res) => res.json(await loyalty.clientLoyalty({ businessId: req.params.businessId, clientId: req.params.clientId }))));
businessRouter.post('/:businessId/clients/:clientId/bonus', member(MANAGE), asyncHandler(async (req, res) => {
  const body = z.object({ amount: z.union([z.number(), z.string()]), note: z.string().trim().max(300).optional() }).parse(req.body ?? {});
  res.json(await loyalty.adjustBonus({ businessId: req.params.businessId, clientId: req.params.clientId, amount: Number(body.amount), note: body.note ?? null, actorUserId: req.user.id }));
}));
businessRouter.get('/:businessId/appointments/:id/payment-options', member(ALL), asyncHandler(async (req, res) => {
  const row = await bookings.appointmentRow(req.params.id);
  if (!row || row.businessId !== req.params.businessId) throw bookError(404, 'ჯავშანი ვერ მოიძებნა.', 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
  res.json(await loyalty.paymentOptions({ businessId: req.params.businessId, appointment: row }));
}));

// notifications: what the clients get (push / SMS / email), this month's SMS usage, sample texts
businessRouter.get('/:businessId/notifications', member(MANAGE), asyncHandler(async (req, res) => {
  const row = await store.businessRow(req.params.businessId);
  const settings = normalizeSettings(row?.settings);
  const [svc] = await prisma.$queryRaw`SELECT name, "nameKa" FROM "BookService" WHERE "businessId" = ${req.params.businessId} AND active ORDER BY "sortOrder" LIMIT 1`;
  const usage = await bookSms.smsUsage(req.params.businessId);
  res.json({ notify: settings.notify, usage: { ...usage, cap: settings.notify.sms.monthlyCap }, samples: bookSms.sampleTexts(row ?? {}, svc?.nameKa || svc?.name || 'სერვისი'), smsAvailable: process.env.BOOK_SMS_DISABLED !== 'true' });
}));

// waiting list
const waitInput = z.object({
  clientId: z.string().optional(),
  clientName: z.string().trim().max(120).optional(),
  clientPhone: z.string().trim().max(32).optional(),
  serviceId: z.string().min(1).optional(),
  serviceIds: z.array(z.string().min(1)).min(1).max(8).optional(),
  staffId: z.string().min(1).nullable().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dayParts: z.array(z.enum(['MORNING', 'AFTERNOON', 'EVENING'])).max(3).optional(),
  note: z.string().trim().max(300).optional(),
});
businessRouter.get('/:businessId/waitlist', member(ALL), asyncHandler(async (req, res) => {
  res.json(await waitlist.listForBusiness(req.params.businessId, { status: req.query.status ? String(req.query.status) : 'open', limit: Number(req.query.limit) || 500 }));
}));
businessRouter.post('/:businessId/waitlist', member(ALL), asyncHandler(async (req, res) => {
  const body = waitInput.parse(req.body ?? {});
  if (!body.serviceId && !body.serviceIds?.length) throw bookError(400, 'აირჩიე სერვისი.', 'SERVICE_REQUIRED', 'Pick a service.');
  const row = await waitlist.addByBusiness({ businessId: req.params.businessId, ...body, staffId: body.staffId ?? null });
  notifyWaitlistAdded(row).catch(() => undefined);
  res.status(201).json({ entry: waitlist.waitlistPublic(row) });
}));
businessRouter.patch('/:businessId/waitlist/:id', member(ALL), asyncHandler(async (req, res) => {
  const patch = z.object({
    status: z.enum(['WAITING', 'CANCELLED', 'BOOKED']).optional(),
    appointmentId: z.string().optional(),
    note: z.string().trim().max(300).nullable().optional(),
    offer: z.object({ startsAt: z.string().min(10), staffId: z.string().nullable().optional() }).optional(),
  }).parse(req.body ?? {});
  const row = await waitlist.updateByBusiness({ businessId: req.params.businessId, id: req.params.id, patch });
  let notified = 0;
  if (patch.offer && row.clientUserId) notified = (await notifyWaitlistOpening(row, { startsAt: patch.offer.startsAt })).sent ?? 0;
  res.json({ entry: waitlist.waitlistPublic(row), notified });
}));
businessRouter.delete('/:businessId/waitlist/:id', member(MANAGE), asyncHandler(async (req, res) => { await waitlist.remove({ businessId: req.params.businessId, id: req.params.id }); res.json({ ok: true }); }));

// clients
businessRouter.get('/:businessId/clients', member(ALL), asyncHandler(async (req, res) => res.json(await bookings.listClients({ businessId: req.params.businessId, q: String(req.query.q ?? ''), sort: String(req.query.sort ?? 'recent'), limit: Number(req.query.limit) || 200, offset: Number(req.query.offset) || 0 }))));
businessRouter.get('/:businessId/clients/:clientId', member(ALL), asyncHandler(async (req, res) => res.json(await bookings.clientDetail({ businessId: req.params.businessId, clientId: req.params.clientId }))));
businessRouter.post('/:businessId/clients', member(ALL), asyncHandler(async (req, res) => res.status(201).json({ client: await bookings.createClient({ businessId: req.params.businessId, ...(req.body ?? {}) }) })));
businessRouter.patch('/:businessId/clients/:clientId', member(ALL), asyncHandler(async (req, res) => res.json({ client: await bookings.updateClient({ businessId: req.params.businessId, clientId: req.params.clientId, patch: req.body ?? {} }) })));

// discounts
businessRouter.get('/:businessId/discounts', member(ALL), asyncHandler(async (req, res) => res.json({ discounts: await bookings.listDiscounts(req.params.businessId) })));
businessRouter.post('/:businessId/discounts', member(MANAGE), asyncHandler(async (req, res) => res.status(201).json({ discount: await bookings.createDiscount(req.params.businessId, req.body ?? {}) })));
businessRouter.patch('/:businessId/discounts/:id', member(MANAGE), asyncHandler(async (req, res) => res.json({ discount: await bookings.updateDiscount(req.params.businessId, req.params.id, req.body ?? {}) })));
businessRouter.delete('/:businessId/discounts/:id', member(MANAGE), asyncHandler(async (req, res) => { await bookings.deleteDiscount(req.params.businessId, req.params.id); res.json({ ok: true }); }));

// money
businessRouter.get('/:businessId/finance', member(MANAGE), asyncHandler(async (req, res) => {
  const { from, to, label } = periodFor(String(req.query.range ?? '30'));
  const transactions = await bookings.listTransactions({ businessId: req.params.businessId, from, to, limit: 2000 });
  const income = transactions.filter((x) => x.kind === 'INCOME').reduce((s, x) => s + x.amount, 0);
  const expense = transactions.filter((x) => x.kind === 'EXPENSE').reduce((s, x) => s + x.amount, 0);
  const raw = await bookings.analyticsRaw({ businessId: req.params.businessId, from, to });
  const analytics = buildAnalytics({ ...raw, from, to });
  res.json({ range: label, from, to, totals: { income: Math.round(income * 100) / 100, expense: Math.round(expense * 100) / 100, profit: Math.round((income - expense) * 100) / 100, averageTicket: analytics.totals.averageTicket, discountGiven: analytics.totals.discountGiven }, series: analytics.series.map((d) => ({ date: d.date, revenue: d.revenue, expense: d.expense })), methods: analytics.money.methods, expenseByCategory: analytics.money.expenseByCategory, byStaff: analytics.utilisation.map((u) => ({ staffId: u.staffId, name: u.name, revenue: u.revenue, completed: u.completed })), transactions, categories: { income: bookings.INCOME_CATEGORIES, expense: bookings.EXPENSE_CATEGORIES } });
}));
businessRouter.post('/:businessId/transactions', member(MANAGE), asyncHandler(async (req, res) => {
  const body = z.object({ kind: z.enum(['INCOME', 'EXPENSE']), category: z.string().max(24).optional(), amount: z.union([z.number(), z.string()]), method: z.string().max(16).nullable().optional(), note: z.string().trim().max(300).optional(), at: z.string().optional(), staffId: z.string().nullable().optional() }).parse(req.body ?? {});
  const id = await bookings.addTransaction({ businessId: req.params.businessId, ...body, actorUserId: req.user.id });
  res.status(201).json({ id });
}));
businessRouter.delete('/:businessId/transactions/:id', member(MANAGE), asyncHandler(async (req, res) => { await bookings.deleteTransaction({ businessId: req.params.businessId, id: req.params.id }); res.json({ ok: true }); }));

// analytics
businessRouter.get('/:businessId/analytics', member(MANAGE), asyncHandler(async (req, res) => {
  const { from, to, label } = periodFor(String(req.query.range ?? '30'));
  const raw = await bookings.analyticsRaw({ businessId: req.params.businessId, from, to });
  res.json({ range: label, ...buildAnalytics({ ...raw, from, to }) });
}));

// reviews
businessRouter.get('/:businessId/reviews', member(ALL), asyncHandler(async (req, res) => res.json({ reviews: await bookings.businessReviews(req.params.businessId) })));
businessRouter.post('/:businessId/reviews/:reviewId/reply', member(MANAGE), asyncHandler(async (req, res) => {
  const { reply } = z.object({ reply: z.string().trim().max(1000).nullable() }).parse(req.body ?? {});
  await bookings.replyReview({ businessId: req.params.businessId, reviewId: req.params.reviewId, reply });
  res.json({ ok: true });
}));

// team
businessRouter.get('/:businessId/members', member(MANAGE), asyncHandler(async (req, res) => res.json({ members: await store.listMembers(req.params.businessId) })));
businessRouter.post('/:businessId/members', member(['OWNER']), asyncHandler(async (req, res) => {
  const body = z.object({ phone: z.string().trim().max(32).optional(), email: z.string().trim().max(120).optional(), role: z.enum(['OWNER', 'MANAGER', 'STAFF']).optional(), staffId: z.string().nullable().optional() }).parse(req.body ?? {});
  if (!body.phone && !body.email) throw bookError(400, 'მიუთითე ტელეფონი ან ელფოსტა.', 'CONTACT_REQUIRED', 'Enter a phone or an email.');
  await store.addMember({ businessId: req.params.businessId, phone: body.phone, email: body.email, role: body.role ?? 'STAFF', staffId: body.staffId ?? null });
  res.status(201).json({ members: await store.listMembers(req.params.businessId) });
}));
businessRouter.patch('/:businessId/members/:memberId', member(['OWNER']), asyncHandler(async (req, res) => {
  const body = z.object({ role: z.enum(['OWNER', 'MANAGER', 'STAFF']).optional(), staffId: z.string().nullable().optional() }).parse(req.body ?? {});
  await store.updateMember({ businessId: req.params.businessId, memberId: req.params.memberId, role: body.role, staffId: body.staffId });
  res.json({ members: await store.listMembers(req.params.businessId) });
}));
businessRouter.delete('/:businessId/members/:memberId', member(['OWNER']), asyncHandler(async (req, res) => {
  await store.removeMember({ businessId: req.params.businessId, memberId: req.params.memberId, actorUserId: req.user.id });
  res.json({ members: await store.listMembers(req.params.businessId) });
}));

export const BUSINESS_CATEGORY_IDS = CATEGORY_IDS;
export const businessT = t;
