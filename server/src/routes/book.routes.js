/**
 * MEDIBOOK for clients — /api/book. The catalogue (nearby, search, map pins, one business), free slots,
 * booking, my appointments, cancelling, reviews, favourites and the public pictures. Catalogue reads are
 * public (public business facts only); everything about a person needs their session.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { requireVerifiedPhone } from '../lib/phoneGate.js';
import { t } from '../lib/i18n.js';
import { clientIp } from '../lib/rateLimitKey.js';
import { publicCategories } from '../lib/book/catalog.js';
import * as store from '../lib/book/store.js';
import * as bookings from '../lib/book/bookings.js';
import { notifyBooked, notifyClientCancelled } from '../lib/book/push.js';

export const bookRouter = Router();

const lang = (req) => (req.lang === 'en' ? 'en' : 'ka');
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

/** A session when one is sent; anonymous otherwise (catalogue reads mark favourites for signed-in people). */
function optionalAuth(req, res, next) {
  if (!req.headers.authorization) return next();
  return requireAuth(req, res, next);
}

bookRouter.get('/categories', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ categories: publicCategories() });
});

bookRouter.get('/image/:id', asyncHandler(async (req, res) => {
  const image = await store.readImage(req.params.id);
  if (!image) return res.status(404).json({ error: t(req, 'სურათი ვერ მოიძებნა.', 'Image not found.') });
  res.set('Content-Type', image.mime);
  res.set('Cache-Control', 'public, max-age=604800, immutable');
  return res.send(Buffer.from(image.bytes));
}));

/** Nearby (lat/lng) or a text search anywhere. */
bookRouter.get('/businesses', optionalAuth, asyncHandler(async (req, res) => {
  const lat = num(req.query.lat);
  const lng = num(req.query.lng);
  const category = req.query.category ? String(req.query.category).toUpperCase() : null;
  const q = String(req.query.q ?? '').slice(0, 80);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 40));
  const userId = req.user?.id ?? null;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const businesses = await store.nearbyBusinesses({ lat, lng, radiusKm: num(req.query.radiusKm) ?? 5, category, q, limit, lang: lang(req), userId, onlyBookable: req.query.bookable === '1' });
    return res.json({ businesses, mode: 'nearby' });
  }
  const origin = Number.isFinite(num(req.query.originLat)) && Number.isFinite(num(req.query.originLng)) ? { lat: num(req.query.originLat), lng: num(req.query.originLng) } : null;
  const businesses = await store.searchBusinesses({ q, category, city: req.query.city ? String(req.query.city).slice(0, 60) : null, limit, lang: lang(req), userId, origin });
  return res.json({ businesses, mode: 'search' });
}));

bookRouter.get('/map', asyncHandler(async (req, res) => {
  const box = { minLat: num(req.query.minLat), maxLat: num(req.query.maxLat), minLng: num(req.query.minLng), maxLng: num(req.query.maxLng) };
  if (Object.values(box).some((v) => !Number.isFinite(v))) return res.status(400).json({ error: t(req, 'რუკის საზღვრები არასწორია.', 'Invalid map bounds.') });
  const pins = await store.mapPins({ ...box, category: req.query.category ? String(req.query.category).toUpperCase() : null, q: String(req.query.q ?? '').slice(0, 80), limit: Number(req.query.limit) || 500 });
  res.set('Cache-Control', 'no-store');
  res.json({ pins });
}));

bookRouter.get('/businesses/:id', optionalAuth, asyncHandler(async (req, res) => {
  const business = await store.businessDetail(req.params.id, { lang: lang(req), userId: req.user?.id ?? null });
  if (!business) return res.status(404).json({ error: t(req, 'ბიზნესი ვერ მოიძებნა.', 'Business not found.') });
  store.recordEvent(business.id, 'VIEW', req.user?.id ?? clientIp(req)).catch(() => undefined);
  res.json({ business });
}));

const eventBody = z.object({ kind: z.enum(['CALL', 'ROUTE', 'WEBSITE', 'SHARE', 'BOOK_START']) });
bookRouter.post('/businesses/:id/events', optionalAuth, asyncHandler(async (req, res) => {
  const { kind } = eventBody.parse(req.body ?? {});
  const row = await store.businessRow(req.params.id);
  if (!row) return res.status(404).json({ error: t(req, 'ბიზნესი ვერ მოიძებნა.', 'Business not found.') });
  await store.recordEvent(row.id, kind, req.user?.id ?? clientIp(req));
  res.json({ ok: true });
}));

bookRouter.get('/businesses/:id/availability', asyncHandler(async (req, res) => {
  const result = await bookings.availability({ businessId: req.params.id, serviceId: String(req.query.serviceId ?? ''), date: String(req.query.date ?? ''), staffId: req.query.staffId ? String(req.query.staffId) : null });
  res.set('Cache-Control', 'no-store');
  res.json(result);
}));

bookRouter.get('/businesses/:id/days', asyncHandler(async (req, res) => {
  const result = await bookings.dateStrip({ businessId: req.params.id, serviceId: String(req.query.serviceId ?? ''), from: req.query.from ? String(req.query.from) : null, staffId: req.query.staffId ? String(req.query.staffId) : null, days: Number(req.query.days) || 14 });
  res.set('Cache-Control', 'no-store');
  res.json(result);
}));

// ——— the person's side ———

bookRouter.use(requireAuth);

const createBody = z.object({
  businessId: z.string().min(1),
  serviceId: z.string().min(1),
  staffId: z.string().min(1).nullable().optional(),
  startsAt: z.string().min(10),
  note: z.string().trim().max(500).optional(),
  code: z.string().trim().max(24).optional(),
});

bookRouter.post('/appointments', requireVerifiedPhone, asyncHandler(async (req, res) => {
  const body = createBody.parse(req.body ?? {});
  const platform = String(req.headers['x-medicard-platform'] ?? '');
  const row = await bookings.createAppointment({
    businessId: body.businessId,
    serviceId: body.serviceId,
    staffId: body.staffId ?? null,
    startsAt: body.startsAt,
    note: body.note ?? null,
    code: body.code ?? null,
    source: platform === 'web' ? 'WEB' : 'APP',
    user: req.user,
  });
  notifyBooked(row).catch(() => undefined);
  res.status(201).json({ appointment: bookings.appointmentPublic(row, { lang: lang(req) }) });
}));

bookRouter.get('/appointments', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await bookings.myAppointments(req.user.id, { lang: lang(req) }));
}));

bookRouter.get('/appointments/:id', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ appointment: await bookings.appointmentForUser(req.params.id, req.user.id, { lang: lang(req) }) });
}));

bookRouter.post('/appointments/:id/cancel', asyncHandler(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().max(300).optional() }).parse(req.body ?? {});
  const { row, late } = await bookings.cancelByUser({ id: req.params.id, userId: req.user.id, reason: reason ?? null });
  notifyClientCancelled(row, { late }).catch(() => undefined);
  res.json({ appointment: bookings.appointmentPublic(row, { lang: lang(req) }), late });
}));

bookRouter.post('/appointments/:id/review', asyncHandler(async (req, res) => {
  const { rating, text } = z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().max(1000).optional() }).parse(req.body ?? {});
  const row = await bookings.reviewAppointment({ id: req.params.id, userId: req.user.id, rating, text: text ?? null });
  res.json({ appointment: bookings.appointmentPublic(row, { lang: lang(req) }) });
}));

bookRouter.get('/favorites', asyncHandler(async (req, res) => {
  const origin = Number.isFinite(num(req.query.lat)) && Number.isFinite(num(req.query.lng)) ? { lat: num(req.query.lat), lng: num(req.query.lng) } : null;
  res.set('Cache-Control', 'no-store');
  res.json({ businesses: await store.favoritesOf(req.user.id, { lang: lang(req), origin }) });
}));

bookRouter.put('/favorites/:businessId', asyncHandler(async (req, res) => {
  const row = await store.requireBusiness(req.params.businessId);
  await store.setFavorite(req.user.id, row.id, true);
  store.recordEvent(row.id, 'FAVORITE', req.user.id).catch(() => undefined);
  res.json({ favorite: true });
}));

bookRouter.delete('/favorites/:businessId', asyncHandler(async (req, res) => {
  await store.setFavorite(req.user.id, String(req.params.businessId), false);
  res.json({ favorite: false });
}));

/** Keeps `prisma` referenced for tests that inject a db later. */
export const bookDb = prisma;
