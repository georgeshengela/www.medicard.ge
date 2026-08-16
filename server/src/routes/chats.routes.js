import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

export const chatsRouter = Router();

chatsRouter.use(requireAuth);

const idParam = z.object({ id: z.string().uuid('არასწორი იდენტიფიკატორი') });

chatsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, mode: true, messages: true, createdAt: true, updatedAt: true },
    });

    return res.json({
      sessions: sessions.map(({ messages, ...rest }) => ({
        ...rest,
        messageCount: Array.isArray(messages) ? messages.length : 0,
        preview: lastAssistantPreview(messages),
      })),
    });
  }),
);

chatsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const session = await prisma.chatSession.findFirst({ where: { id, userId: req.user.id } });

    if (!session) return res.status(404).json({ error: 'საუბარი ვერ მოიძებნა.' });
    return res.json({ session });
  }),
);

chatsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { count } = await prisma.chatSession.deleteMany({ where: { id, userId: req.user.id } });

    if (count === 0) return res.status(404).json({ error: 'საუბარი ვერ მოიძებნა.' });
    return res.json({ deleted: true });
  }),
);

function lastAssistantPreview(messages) {
  if (!Array.isArray(messages)) return '';
  const last = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!last?.content) return '';
  const clean = last.content.replace(/[#*`>\-\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length <= 100 ? clean : `${clean.slice(0, 97)}…`;
}
