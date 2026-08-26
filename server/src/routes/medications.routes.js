import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

export const medicationsRouter = Router();

medicationsRouter.use(requireAuth);

/** Stored as a comma-separated 24h list, e.g. "09:00, 15:00, 21:00". */
const timeList = z
  .string()
  .trim()
  .min(1, 'მიუთითეთ მიღების დრო')
  .transform((value) =>
    value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  )
  .refine((times) => times.length > 0 && times.length <= 8, 'დღეში დასაშვებია 1-დან 8 მიღებამდე')
  .refine((times) => times.every((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)), 'დრო უნდა იყოს ფორმატში 09:00')
  .transform((times) => [...new Set(times)].sort().join(', '));

const createSchema = z.object({
  medName: z.string().trim().min(2, 'მიუთითეთ მედიკამენტის დასახელება').max(120),
  dosage: z.string().trim().min(1, 'მიუთითეთ დოზა').max(80),
  frequency: timeList,
  notes: z.string().trim().max(300).optional(),
  active: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).optional(),
});

const updateSchema = createSchema.partial();
const idParam = z.object({ id: z.string().uuid('არასწორი იდენტიფიკატორი') });

medicationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const medications = await prisma.medicationSchedule.findMany({
      where: { userId: req.user.id },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    });

    return res.json({
      medications,
      // Flat, sorted dose list the mobile client turns straight into local notifications.
      schedule: buildDailySchedule(medications.filter((m) => m.active)),
    });
  }),
);

medicationsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const medication = await prisma.medicationSchedule.create({
      data: { ...data, notes: data.notes ?? null, config: data.config ?? {}, userId: req.user.id },
    });

    return res.status(201).json({ medication });
  }),
);

medicationsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const data = updateSchema.parse(req.body);

    const { count } = await prisma.medicationSchedule.updateMany({
      where: { id, userId: req.user.id },
      data,
    });
    if (count === 0) return res.status(404).json({ error: 'მედიკამენტი ვერ მოიძებნა.' });

    const medication = await prisma.medicationSchedule.findUnique({ where: { id } });
    return res.json({ medication });
  }),
);

medicationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { count } = await prisma.medicationSchedule.deleteMany({ where: { id, userId: req.user.id } });

    if (count === 0) return res.status(404).json({ error: 'მედიკამენტი ვერ მოიძებნა.' });
    return res.json({ deleted: true });
  }),
);

function buildDailySchedule(medications) {
  return medications
    .flatMap((med) =>
      med.frequency.split(',').map((time) => ({
        medicationId: med.id,
        medName: med.medName,
        dosage: med.dosage,
        notes: med.notes,
        time: time.trim(),
      })),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
}
