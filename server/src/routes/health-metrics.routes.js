import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

export const healthMetricsRouter = Router();

healthMetricsRouter.use(requireAuth);

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'არასწორი თარიღის ფორმატი');

const dailyRowSchema = z.object({
  date: dateKey,
  steps: z.number().int().min(0).max(200_000).optional(),
  weightKg: z.number().min(20).max(300).optional(),
  bloodPressureSystolic: z.number().int().min(70).max(250).optional(),
  bloodPressureDiastolic: z.number().int().min(40).max(150).optional(),
  heartRate: z.number().min(30).max(220).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  nutritionKcal: z.number().min(0).max(20_000).optional(),
  hydrationMl: z.number().min(0).max(20_000).optional(),
  activeMinutes: z.number().int().min(0).max(1_440).optional(),
  distanceKm: z.number().min(0).max(500).optional(),
});

const stepLogSchema = z.object({
  at: z.string().datetime(),
  count: z.number().int().min(0).max(100_000),
});

const syncSchema = z.object({
  daily: z.array(dailyRowSchema).max(400).default([]),
  stepLogs: z.array(stepLogSchema).max(2_000).default([]),
});

function mergeDaily(existing, incoming) {
  const pick = (next, prev) => (next != null ? next : prev ?? null);
  const maxInt = (next, prev) => {
    if (next == null) return prev ?? null;
    if (prev == null) return next;
    return Math.max(next, prev);
  };

  return {
    steps: maxInt(incoming.steps, existing?.steps),
    weightKg: pick(incoming.weightKg, existing?.weightKg),
    bloodPressureSystolic: pick(incoming.bloodPressureSystolic, existing?.bloodPressureSystolic),
    bloodPressureDiastolic: pick(incoming.bloodPressureDiastolic, existing?.bloodPressureDiastolic),
    heartRate: pick(incoming.heartRate, existing?.heartRate),
    sleepHours:
      incoming.sleepHours != null
        ? existing?.sleepHours != null
          ? Math.max(incoming.sleepHours, existing.sleepHours)
          : incoming.sleepHours
        : (existing?.sleepHours ?? null),
    nutritionKcal:
      incoming.nutritionKcal != null
        ? existing?.nutritionKcal != null
          ? existing.nutritionKcal + incoming.nutritionKcal
          : incoming.nutritionKcal
        : (existing?.nutritionKcal ?? null),
    hydrationMl:
      incoming.hydrationMl != null
        ? existing?.hydrationMl != null
          ? existing.hydrationMl + incoming.hydrationMl
          : incoming.hydrationMl
        : (existing?.hydrationMl ?? null),
    activeMinutes: maxInt(incoming.activeMinutes, existing?.activeMinutes),
    distanceKm: pick(incoming.distanceKm, existing?.distanceKm),
    source: 'merged',
  };
}

function publicDaily(row) {
  if (!row) return null;
  return {
    date: row.date,
    steps: row.steps,
    weightKg: row.weightKg,
    bloodPressureSystolic: row.bloodPressureSystolic,
    bloodPressureDiastolic: row.bloodPressureDiastolic,
    heartRate: row.heartRate,
    sleepHours: row.sleepHours,
    nutritionKcal: row.nutritionKcal,
    hydrationMl: row.hydrationMl,
    activeMinutes: row.activeMinutes,
    distanceKm: row.distanceKm,
    source: row.source,
    syncedAt: row.syncedAt.toISOString(),
  };
}

healthMetricsRouter.post(
  '/sync',
  asyncHandler(async (req, res) => {
    const { daily, stepLogs } = syncSchema.parse(req.body);
    const userId = req.user.id;
    const now = new Date();

    let dailyUpserted = 0;
    for (const row of daily) {
      const { date, ...metrics } = row;
      const existing = await prisma.healthMetricDaily.findUnique({
        where: { userId_date: { userId, date } },
      });
      const merged = mergeDaily(existing, metrics);

      await prisma.healthMetricDaily.upsert({
        where: { userId_date: { userId, date } },
        create: {
          userId,
          date,
          ...merged,
          syncedAt: now,
        },
        update: {
          ...merged,
          syncedAt: now,
        },
      });
      dailyUpserted += 1;
    }

    let stepLogsInserted = 0;
    if (stepLogs.length) {
      const result = await prisma.stepLog.createMany({
        data: stepLogs.map((log) => ({
          userId,
          recordedAt: new Date(log.at),
          stepCount: log.count,
          source: 'device',
        })),
        skipDuplicates: true,
      });
      stepLogsInserted = result.count;

      const days = [...new Set(stepLogs.map((l) => l.at.slice(0, 10)))];
      for (const date of days) {
        const start = new Date(`${date}T00:00:00.000Z`);
        const end = new Date(`${date}T23:59:59.999Z`);
        const agg = await prisma.stepLog.aggregate({
          where: { userId, recordedAt: { gte: start, lte: end } },
          _sum: { stepCount: true },
        });
        const steps = agg._sum.stepCount ?? 0;
        if (steps <= 0) continue;

        const existing = await prisma.healthMetricDaily.findUnique({
          where: { userId_date: { userId, date } },
        });
        const mergedSteps = Math.max(steps, existing?.steps ?? 0);

        await prisma.healthMetricDaily.upsert({
          where: { userId_date: { userId, date } },
          create: { userId, date, steps: mergedSteps, syncedAt: now },
          update: { steps: mergedSteps, syncedAt: now },
        });
      }
    }

    return res.json({
      ok: true,
      dailyUpserted,
      stepLogsInserted,
      syncedAt: now.toISOString(),
    });
  }),
);

healthMetricsRouter.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;

    if (from) dateKey.parse(from);
    if (to) dateKey.parse(to);

    const rows = await prisma.healthMetricDaily.findMany({
      where: {
        userId: req.user.id,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: 400,
    });

    return res.json({ daily: rows.map(publicDaily).reverse() });
  }),
);

healthMetricsRouter.get(
  '/steps',
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;

    const fromDate = from ? new Date(`${dateKey.parse(from)}T00:00:00.000Z`) : undefined;
    const toDate = to ? new Date(`${dateKey.parse(to)}T23:59:59.999Z`) : undefined;

    const logs = await prisma.stepLog.findMany({
      where: {
        userId: req.user.id,
        ...(fromDate || toDate
          ? {
              recordedAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: 2_000,
    });

    return res.json({
      logs: logs.map((l) => ({
        id: l.id,
        at: l.recordedAt.toISOString(),
        count: l.stepCount,
      })),
    });
  }),
);

healthMetricsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;

    const [dailyResult, stepsResult] = await Promise.all([
      prisma.healthMetricDaily.findMany({
        where: {
          userId: req.user.id,
          ...(from || to
            ? {
                date: {
                  ...(from ? { gte: from } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
        orderBy: { date: 'asc' },
        take: 400,
      }),
      prisma.stepLog.findMany({
        where: {
          userId: req.user.id,
          ...(from ? { recordedAt: { gte: new Date(`${from}T00:00:00.000Z`) } } : {}),
          ...(to ? { recordedAt: { lte: new Date(`${to}T23:59:59.999Z`) } } : {}),
        },
        orderBy: { recordedAt: 'desc' },
        take: 2_000,
      }),
    ]);

    return res.json({
      daily: dailyResult.map(publicDaily),
      stepLogs: stepsResult.map((l) => ({
        id: l.id,
        at: l.recordedAt.toISOString(),
        count: l.stepCount,
      })),
    });
  }),
);
