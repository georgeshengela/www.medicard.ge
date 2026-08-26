import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

export const recordsRouter = Router();

recordsRouter.use(requireAuth);

const RECORD_TYPES = ['LAB', 'XRAY', 'CT_MRI', 'SKIN', 'SKINCARE', 'PRESCRIPTION', 'SYMPTOM'];

const listQuery = z.object({
  type: z.enum(RECORD_TYPES).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

recordsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { type, take, skip } = listQuery.parse(req.query);
    const where = { userId: req.user.id, ...(type ? { type } : {}) };

    const [records, total] = await prisma.$transaction([
      prisma.medicalRecord.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      prisma.medicalRecord.count({ where }),
    ]);

    return res.json({ records, total, take, skip });
  }),
);

recordsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const record = await prisma.medicalRecord.findFirst({ where: { id, userId: req.user.id } });

    if (!record) return res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
    return res.json({ record });
  }),
);

recordsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { count } = await prisma.medicalRecord.deleteMany({ where: { id, userId: req.user.id } });

    if (count === 0) return res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
    return res.json({ deleted: true });
  }),
);
