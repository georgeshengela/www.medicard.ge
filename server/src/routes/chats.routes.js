import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { bindAiLanguage, currentAiLanguage } from '../lib/aiConsent.js';
import { t } from '../lib/i18n.js';
import { asyncHandler } from '../middleware/error.js';

export const chatsRouter = Router();

chatsRouter.use(requireAuth);
chatsRouter.use(bindAiLanguage);

const idParam = z.object({ id: z.string().uuid({ error: () => t(currentAiLanguage(), 'არასწორი იდენტიფიკატორი', 'Invalid ID') }) });

/** Medi (assistant mode) conversations are kept like consultations so they reopen from "ჩემი ბარათი". */
export const ASSISTANT_CHAT_MODE = 'ASSISTANT';
export const ASSISTANT_MAX_MESSAGES = 200;
const assistantAppend = z.object({
  sessionId: z.string().uuid().optional(),
  turns: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(4000) }).strict()).min(1).max(6),
}).strict();

export function appendAssistantTurns(existing, turns, now = new Date()) {
  const stamped = turns.map((t) => ({ role: t.role, content: t.content, timestamp: now.toISOString() }));
  return [...(Array.isArray(existing) ? existing : []), ...stamped].slice(-ASSISTANT_MAX_MESSAGES);
}

export function assistantTitle(turns, lang = 'ka') {
  const first = turns.find((t) => t.role === 'user')?.content?.replace(/\s+/g, ' ').trim() || t(lang, 'საუბარი Medi-სთან', 'Conversation with Medi');
  return first.length <= 60 ? first : first.slice(0, 57) + '…';
}

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

chatsRouter.post(
  '/assistant',
  asyncHandler(async (req, res) => {
    const { sessionId, turns } = assistantAppend.parse(req.body);
    const saved = await prisma.$transaction(async (tx) => {
      const current = sessionId
        ? await tx.chatSession.findFirst({ where: { id: sessionId, userId: req.user.id, mode: ASSISTANT_CHAT_MODE } })
        : null;
      if (sessionId && !current) return null;
      if (!current) {
        return tx.chatSession.create({ data: { userId: req.user.id, mode: ASSISTANT_CHAT_MODE, title: assistantTitle(turns, req.lang), messages: appendAssistantTurns([], turns) } });
      }
      return tx.chatSession.update({ where: { id: current.id }, data: { messages: appendAssistantTurns(current.messages, turns), updatedAt: new Date() } });
    });
    if (!saved) return res.status(404).json({ error: t(req, 'საუბარი ვერ მოიძებნა.', 'Conversation not found.') });
    return res.json({ sessionId: saved.id });
  }),
);

chatsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const session = await prisma.chatSession.findFirst({ where: { id, userId: req.user.id } });

    if (!session) return res.status(404).json({ error: t(req, 'საუბარი ვერ მოიძებნა.', 'Conversation not found.') });
    return res.json({ session });
  }),
);

chatsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { count } = await prisma.chatSession.deleteMany({ where: { id, userId: req.user.id } });

    if (count === 0) return res.status(404).json({ error: t(req, 'საუბარი ვერ მოიძებნა.', 'Conversation not found.') });
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
