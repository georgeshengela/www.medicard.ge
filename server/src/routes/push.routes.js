import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { isExpoPushToken } from '../lib/push.js';
import { listPushTemplates, logPushEvent } from '../lib/pushTemplates.js';
import { upsertNotificationDecisions } from '../lib/notificationDecisions.js';
import { upsertNotificationOutcomes } from '../lib/notificationOutcomes.js';
import { upsertProductEvents } from '../lib/productEvents.js';
import { upsertMedicationDoseEvents } from '../lib/medicationDoseEvents.js';
import { upsertNotificationPermission } from '../lib/notificationPermission.js';
import { notifyBrainSync } from '../lib/adminRealtime.js';
import { clientMetaFromRequest } from '../lib/appVersion.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

export const pushRouter = Router();

pushRouter.post(
  '/register',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        token: z
          .string()
          .trim()
          .min(10)
          .refine(isExpoPushToken, { message: 'არასწორი Expo push token' }),
        platform: z.enum(['ios', 'android', 'web']).default('android'),
      })
      .parse(req.body);

    const record = await prisma.pushToken.upsert({
      where: { token: body.token },
      create: {
        userId: req.user.id,
        token: body.token,
        platform: body.platform,
        active: true,
      },
      update: {
        userId: req.user.id,
        platform: body.platform,
        active: true,
        lastSeenAt: new Date(),
      },
    });

    console.info('[push] registered', record.platform, record.userId);
    res.json({ ok: true, id: record.id });
  }),
);

pushRouter.delete(
  '/register',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({ token: z.string().trim().min(10) }).parse(req.body);
    await prisma.pushToken.updateMany({
      where: { token: body.token, userId: req.user.id },
      data: { active: false },
    });
    res.json({ ok: true });
  }),
);

pushRouter.get(
  '/templates',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({ templates: await listPushTemplates() });
  }),
);

pushRouter.post(
  '/events',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        source: z.enum(['local', 'qa', 'broadcast']).default('local'),
        key: z.string().trim().min(1).max(80),
        title: z.string().trim().max(160),
        body: z.string().trim().max(600),
      })
      .parse(req.body);

    const event = await logPushEvent({
      ...body,
      userId: req.user.id,
    });
    res.status(201).json({ ok: true, id: event?.id ?? null });
  }),
);

pushRouter.post(
  '/decisions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        decisions: z
          .array(
            z.object({
              id: z.string().optional(),
              decisionId: z.string().optional(),
              candidate: z.string().optional(),
              family: z.string().optional(),
              score: z.number().optional(),
              result: z.string().optional(),
              decision: z.string().optional(),
              reason: z.string().nullable().optional(),
              blocked: z.string().nullable().optional(),
              template: z.string().optional(),
              templateKey: z.string().optional(),
              route: z.string().optional(),
              createdAt: z.string().optional(),
              scheduledAt: z.string().nullable().optional(),
              fireAt: z.string().nullable().optional(),
              revalidatedAt: z.string().optional(),
            }),
          )
          .max(80),
        fatigue: z
          .object({
            selectedFrequency: z.string().optional(),
            baseDailyCap: z.number().optional(),
            adaptiveDailyCap: z.number().optional(),
            ewma: z.number().optional(),
          })
          .optional(),
      })
      .parse(req.body ?? {});

    const result = await upsertNotificationDecisions(req.user.id, body.decisions, body.fatigue);
    notifyBrainSync('decisions', body.decisions?.length || 0);
    res.json({ ok: true, ...result });
  }),
);

pushRouter.post(
  '/outcomes',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        outcomes: z
          .array(
            z.object({
              decisionId: z.string().optional(),
              id: z.string().optional(),
              outcome: z.string().optional(),
              actionKey: z.string().optional(),
              action: z.string().optional(),
              occurredAt: z.string().optional(),
              appVersion: z.string().optional(),
              platform: z.string().optional(),
            }),
          )
          .max(80),
      })
      .parse(req.body ?? {});
    const meta = clientMetaFromRequest(req, req.body || {});
    const result = await upsertNotificationOutcomes(req.user.id, body.outcomes, meta);
    notifyBrainSync('outcomes', body.outcomes?.length || 0);
    res.json({ ok: true, ...result });
  }),
);

pushRouter.post(
  '/permission',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        status: z.string(),
        platform: z.enum(['ios', 'android', 'web']).optional(),
      })
      .parse(req.body ?? {});
    const result = await upsertNotificationPermission(req.user.id, body, clientMetaFromRequest(req, body));
    res.json(result);
  }),
);

pushRouter.post(
  '/events/product',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        events: z
          .array(
            z.object({
              kind: z.string(),
              category: z.string().optional(),
              entityId: z.string().optional(),
              weekKey: z.string().optional(),
              insightId: z.string().optional(),
              source: z.string().optional(),
              occurredAt: z.string().optional(),
            }),
          )
          .max(40),
      })
      .parse(req.body ?? {});
    const result = await upsertProductEvents(req.user.id, body.events, clientMetaFromRequest(req, req.body || {}));
    res.json({ ok: true, ...result });
  }),
);

pushRouter.post(
  '/dose-events',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        events: z
          .array(
            z.object({
              medicationId: z.string(),
              date: z.string(),
              time: z.string(),
              status: z.enum(['taken', 'skipped']),
              source: z.enum(['app', 'notification']).optional(),
              occurredAt: z.string().optional(),
              updatedAt: z.string().optional(),
            }),
          )
          .max(40),
      })
      .parse(req.body ?? {});
    const result = await upsertMedicationDoseEvents(req.user.id, body.events);
    res.json({ ok: true, ...result });
  }),
);
