import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { isExpoPushToken } from '../lib/push.js';
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
