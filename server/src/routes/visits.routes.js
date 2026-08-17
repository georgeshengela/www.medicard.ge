import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

export const visitsRouter = Router();

visitsRouter.use(requireAuth);

const doctorType = z.enum([
  'GP',
  'DENTIST',
  'CARDIO',
  'GYN',
  'NEURO',
  'ORTHO',
  'THERAPIST',
  'OPHTHALMO',
  'DERM',
  'PED',
  'OTHER',
]);

const visitDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'არასწორი თარიღი');
const visitTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'დრო უნდა იყოს HH:mm');

const reminderConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    offsetsMinutes: z.array(z.number().int().min(5).max(60 * 24 * 14)).max(6).default([1440, 60]),
    repeatCount: z.number().int().min(1).max(3).default(1),
  })
  .default({ enabled: true, offsetsMinutes: [1440, 60], repeatCount: 1 });

const createSchema = z.object({
  doctorType: doctorType,
  doctorFirstName: z.string().trim().max(80).optional(),
  doctorLastName: z.string().trim().max(80).optional(),
  visitDate: visitDate,
  visitTime: visitTime,
  address: z.string().trim().max(300).optional(),
  addressLabel: z.string().trim().max(400).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  notes: z.string().trim().max(500).optional(),
  reminderConfig: reminderConfigSchema.optional(),
  active: z.boolean().default(true),
});

const updateSchema = createSchema.partial();
const idParam = z.object({ id: z.string().uuid('არასწორი იდენტიფიკატორი') });

visitsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const visits = await prisma.doctorVisit.findMany({
      where: { userId: req.user.id },
      orderBy: [{ visitDate: 'asc' }, { visitTime: 'asc' }],
    });
    return res.json({ visits });
  }),
);

visitsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const visit = await prisma.doctorVisit.create({
      data: {
        userId: req.user.id,
        doctorType: data.doctorType,
        doctorFirstName: data.doctorFirstName ?? null,
        doctorLastName: data.doctorLastName ?? null,
        visitDate: data.visitDate,
        visitTime: data.visitTime,
        address: data.address ?? null,
        addressLabel: data.addressLabel ?? null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        notes: data.notes ?? null,
        reminderConfig: data.reminderConfig ?? { enabled: true, offsetsMinutes: [1440, 60], repeatCount: 1 },
        active: data.active ?? true,
      },
    });
    return res.status(201).json({ visit });
  }),
);

visitsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const data = updateSchema.parse(req.body);

    const { count } = await prisma.doctorVisit.updateMany({
      where: { id, userId: req.user.id },
      data: {
        ...data,
        doctorFirstName: data.doctorFirstName === undefined ? undefined : data.doctorFirstName ?? null,
        doctorLastName: data.doctorLastName === undefined ? undefined : data.doctorLastName ?? null,
        address: data.address === undefined ? undefined : data.address ?? null,
        addressLabel: data.addressLabel === undefined ? undefined : data.addressLabel ?? null,
        lat: data.lat === undefined ? undefined : data.lat ?? null,
        lng: data.lng === undefined ? undefined : data.lng ?? null,
        notes: data.notes === undefined ? undefined : data.notes ?? null,
      },
    });
    if (count === 0) return res.status(404).json({ error: 'ვიზიტი ვერ მოიძებნა.' });

    const visit = await prisma.doctorVisit.findUnique({ where: { id } });
    return res.json({ visit });
  }),
);

visitsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { count } = await prisma.doctorVisit.deleteMany({ where: { id, userId: req.user.id } });
    if (count === 0) return res.status(404).json({ error: 'ვიზიტი ვერ მოიძებნა.' });
    return res.json({ deleted: true });
  }),
);

async function nominatimSearch(q, { countryOnly = false, viewboxBias = false } = {}) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '8');
  if (countryOnly) url.searchParams.set('countrycodes', 'ge');
  if (viewboxBias) {
    // Georgia bounding box — prefer local matches without hard-restricting results.
    url.searchParams.set('viewbox', '39.955,41.053,46.725,43.586');
    url.searchParams.set('bounded', '0');
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ka,en',
      'User-Agent': 'Medicard.GE/1.0 (doctor visits; contact@medicard.ge)',
    },
  });

  if (!response.ok) return null;

  const rows = await response.json();
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: String(row.place_id),
    label: row.display_name,
    lat: Number(row.lat),
    lng: Number(row.lon),
  }));
}

/** Nominatim proxy — keeps User-Agent policy server-side. */
visitsRouter.get(
  '/geocode',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 3) return res.json({ results: [] });

    let results =
      (await nominatimSearch(q, { countryOnly: true, viewboxBias: true })) ??
      [];

    if (results.length === 0) {
      results =
        (await nominatimSearch(q, { countryOnly: false, viewboxBias: true })) ??
        [];
    }

    if (results.length === 0) {
      return res.json({ results: [] });
    }

    return res.json({ results: results.slice(0, 6) });
  }),
);
