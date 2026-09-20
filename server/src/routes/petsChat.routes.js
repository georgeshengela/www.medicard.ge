import { requireAiConsent } from '../lib/aiConsent.js';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/error.js';
import { enforceAiQuota } from '../middleware/aiLimiter.js';
import { runTrackedAi } from '../lib/aiTelemetry.js';
import { AiEngineError } from '../lib/evidencemd.js';
import { petTodayYmd } from '../lib/petsAge.js';
import { loadPetAiContext } from '../lib/petsAiContext.js';
import {
  PET_NOT_FOUND,
  isPetsChatSchemaMissing,
  isPetsSchemaMissing,
  petsChatSchemaUnavailable,
  petsSchemaUnavailable,
} from '../lib/petsOwnership.js';
import {
  VET_CONCURRENT_PER_PET,
  VET_HISTORY_PAGE,
  VET_HISTORY_PAGE_MAX,
  buildSessionTitle,
  publicChatMessage,
  publicChatSession,
  rejectClientConversationPayload,
  requireClientRequestId,
  requireVetMessage,
  shouldConsumeVetCredit,
} from '../lib/petsChat.js';
import { askVetAi, trustedVetHistory } from '../lib/petsVetEngine.js';
import { validateCareDraft } from '../lib/petsVetDraft.js';
import { commitAiCredit } from '../lib/usage.js';

export function setVetSettleBeforeCommitForTests(fn) {
  globalThis.__medicardVetSettleBeforeCommit = typeof fn === 'function' ? fn : null;
}

async function persistVetComplete({ tx = prisma, assistantRow, session, message, answer }) {
  await tx.petChatMessage.update({
    where: { id: assistantRow.id },
    data: {
      content: answer.content,
      status: 'COMPLETE',
      citations: answer.citations || [],
      draft: answer.draft || undefined,
      grounding: answer.grounding || undefined,
    },
  });
  await tx.petChatSession.update({
    where: { id: session.id },
    data: {
      updatedAt: new Date(),
      title: session.title === 'ახალი საუბარი' ? buildSessionTitle(message) : session.title,
    },
  });
}

async function persistAndSettleVetComplete(req, args) {
  const billed = await req.settleAiOperation(() => prisma.$transaction(async (tx) => {
    await persistVetComplete({ ...args, tx });
    if (typeof globalThis.__medicardVetSettleBeforeCommit === 'function') {
      await globalThis.__medicardVetSettleBeforeCommit(tx);
    }
    if (!shouldConsumeVetCredit({ replayed: false, assistantStatus: 'COMPLETE' })) {
      return req.usage;
    }
    return commitAiCredit(req.user.id, tx);
  }));
  if (typeof req.markAiCreditSettled === 'function') req.markAiCreditSettled();
  req.usage = billed || req.usage;
  return req.usage;
}

async function releaseReservedCredit(req) {
  if (typeof req.releaseAiCredit === 'function') {
    await req.releaseAiCredit();
  }
}

const petParam = z.object({ petId: z.string().uuid('არასწორი იდენტიფიკატორი') });
const sessionParam = petParam.extend({ sessionId: z.string().uuid('არასწორი იდენტიფიკატორი') });

const querySchema = z.object({
  message: z.string(),
  sessionId: z.string().uuid().optional(),
  clientRequestId: z.string(),
  stream: z.boolean().optional(),
});

function sendSchemaError(res, error) {
  if (isPetsChatSchemaMissing(error)) {
    const unavailable = petsChatSchemaUnavailable();
    return res.status(unavailable.status).json(unavailable.body);
  }
  if (isPetsSchemaMissing(error)) {
    const unavailable = petsSchemaUnavailable();
    return res.status(unavailable.status).json(unavailable.body);
  }
  throw error;
}

function sendValidation(res, error) {
  if (error.status === 400) return res.status(400).json({ error: error.message, code: error.code || 'UNSUPPORTED_INPUT' });
  throw error;
}

async function findOwnedActivePet(userId, petId) {
  const row = await prisma.pet.findFirst({ where: { id: petId, userId } });
  if (!row || row.archivedAt) return null;
  return row;
}

async function requireActivePet(req, res) {
  const { petId } = petParam.parse(req.params);
  const pet = await findOwnedActivePet(req.user.id, petId);
  if (!pet) {
    res.status(404).json(PET_NOT_FOUND);
    return null;
  }
  return pet;
}

async function findOwnedSession(userId, petId, sessionId) {
  return prisma.petChatSession.findFirst({ where: { id: sessionId, userId, petId } });
}

function wantsChatStream(req) {
  if (req.body?.stream === true) return true;
  return String(req.headers.accept || '').includes('text/event-stream');
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
}

function logVetOp(fields) {
  console.info('[pets-vet]', JSON.stringify(fields));
}

export const petsChatRouter = Router();

petsChatRouter.get(
  '/:petId/chats',
  asyncHandler(async (req, res) => {
    const pet = await requireActivePet(req, res);
    if (!pet) return;
    try {
      const sessions = await prisma.petChatSession.findMany({
        where: { userId: req.user.id, petId: pet.id },
        orderBy: { updatedAt: 'desc' },
        take: 30,
      });
      return res.json({ schemaReady: true, chatSchemaReady: true, sessions: sessions.map(publicChatSession) });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsChatRouter.post(
  '/:petId/chats',
  asyncHandler(async (req, res) => {
    const pet = await requireActivePet(req, res);
    if (!pet) return;
    try {
      const session = await prisma.petChatSession.create({
        data: { userId: req.user.id, petId: pet.id, title: 'ახალი საუბარი' },
      });
      return res.status(201).json({ schemaReady: true, chatSchemaReady: true, session: publicChatSession(session) });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsChatRouter.get(
  '/:petId/chats/:sessionId',
  asyncHandler(async (req, res) => {
    const pet = await requireActivePet(req, res);
    if (!pet) return;
    const { sessionId } = sessionParam.parse(req.params);
    try {
      const session = await findOwnedSession(req.user.id, pet.id, sessionId);
      if (!session) return res.status(404).json({ error: 'საუბარი ვერ მოიძებნა.' });
      return res.json({ schemaReady: true, chatSchemaReady: true, session: publicChatSession(session) });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsChatRouter.get(
  '/:petId/chats/:sessionId/messages',
  asyncHandler(async (req, res) => {
    const pet = await requireActivePet(req, res);
    if (!pet) return;
    const { sessionId } = sessionParam.parse(req.params);
    const limitRaw = Number(req.query.limit);
    const before = typeof req.query.before === 'string' ? req.query.before : null;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), VET_HISTORY_PAGE_MAX) : VET_HISTORY_PAGE;
    try {
      const session = await findOwnedSession(req.user.id, pet.id, sessionId);
      if (!session) return res.status(404).json({ error: 'საუბარი ვერ მოიძებნა.' });
      const rows = await prisma.petChatMessage.findMany({
        where: {
          sessionId: session.id,
          petId: pet.id,
          userId: req.user.id,
          ...(before ? { createdAt: { lt: new Date(before) } } : {}),
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      return res.json({
        schemaReady: true,
        chatSchemaReady: true,
        messages: rows.map(publicChatMessage),
      });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsChatRouter.delete(
  '/:petId/chats/:sessionId',
  asyncHandler(async (req, res) => {
    const pet = await requireActivePet(req, res);
    if (!pet) return;
    const { sessionId } = sessionParam.parse(req.params);
    try {
      const session = await findOwnedSession(req.user.id, pet.id, sessionId);
      if (!session) return res.status(404).json({ error: 'საუბარი ვერ მოიძებნა.' });
      await prisma.petChatMessage.deleteMany({ where: { sessionId: session.id, userId: req.user.id, petId: pet.id } });
      await prisma.petChatSession.delete({ where: { id: session.id } });
      return res.json({ schemaReady: true, chatSchemaReady: true, deleted: true });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsChatRouter.post(
  '/:petId/chat/drafts/validate',
  asyncHandler(async (req, res) => {
    const pet = await requireActivePet(req, res);
    if (!pet) return;
    try {
      const products = await prisma.petProduct.findMany({
        where: { petId: pet.id, userId: req.user.id, archivedAt: null },
        select: { id: true },
      });
      const draft = validateCareDraft(req.body?.draft || req.body, {
        petId: pet.id,
        todayYmd: petTodayYmd(req),
        ownedProductIds: new Set(products.map((row) => row.id)),
      });
      return res.json({ schemaReady: true, chatSchemaReady: true, draft });
    } catch (error) {
      if (error.status === 400) return sendValidation(res, error);
      return sendSchemaError(res, error);
    }
  }),
);

petsChatRouter.post(
  '/:petId/chat/query',
  requireAiConsent,
  enforceAiQuota,
  asyncHandler(async (req, res) => {
    const pet = await requireActivePet(req, res);
    if (!pet) return;
    try {
      rejectClientConversationPayload(req.body);
      const parsed = querySchema.parse(req.body);
      const message = requireVetMessage(parsed.message);
      const clientRequestId = requireClientRequestId(parsed.clientRequestId);
      const todayYmd = petTodayYmd(req);

      let session = parsed.sessionId
        ? await findOwnedSession(req.user.id, pet.id, parsed.sessionId)
        : null;
      if (parsed.sessionId && !session) {
        return res.status(404).json({ error: 'საუბარი ვერ მოიძებნა.' });
      }

      const replay = await prisma.petChatMessage.findFirst({
        where: { petId: pet.id, userId: req.user.id, clientRequestId, role: 'user' },
        orderBy: { createdAt: 'asc' },
      });
      if (replay) {
        if (parsed.sessionId && replay.sessionId !== parsed.sessionId) {
          return res.status(409).json({ error: 'იგივე მოთხოვნა სხვა საუბარშია.', code: 'VET_IDEMPOTENCY_CONFLICT' });
        }
        session = session || (await findOwnedSession(req.user.id, pet.id, replay.sessionId));
        const assistant = await prisma.petChatMessage.findFirst({
          where: { sessionId: replay.sessionId, petId: pet.id, role: 'assistant', createdAt: { gt: replay.createdAt } },
          orderBy: { createdAt: 'asc' },
        });
        logVetOp({ requestId: clientRequestId, petId: pet.id, userId: req.user.id, replayed: true });
        await releaseReservedCredit(req);
        return res.json({
          schemaReady: true,
          chatSchemaReady: true,
          replayed: true,
          sessionId: replay.sessionId,
          answer: assistant?.content || '',
          status: assistant?.status || replay.status,
          citations: assistant?.citations || [],
          draft: assistant?.draft || null,
          grounding: assistant?.grounding || null,
          usage: req.usage,
        });
      }

      const inFlight = await prisma.petChatMessage.count({
        where: {
          userId: req.user.id,
          petId: pet.id,
          role: 'assistant',
          status: { in: ['PENDING', 'PARTIAL'] },
        },
      });
      if (inFlight >= VET_CONCURRENT_PER_PET) {
        return res.status(429).json({ error: 'წინა პასუხი ჯერ მიმდინარეობს.', code: 'CONCURRENT_LIMIT' });
      }

      if (!session) {
        session = await prisma.petChatSession.create({
          data: { userId: req.user.id, petId: pet.id, title: buildSessionTitle(message) },
        });
      }

      const historyRows = await prisma.petChatMessage.findMany({
        where: { sessionId: session.id, petId: pet.id, userId: req.user.id },
        orderBy: { createdAt: 'asc' },
      });

      const userRow = await prisma.petChatMessage
        .create({
          data: {
            userId: req.user.id,
            petId: pet.id,
            sessionId: session.id,
            role: 'user',
            content: message,
            status: 'COMPLETE',
            clientRequestId,
          },
        })
        .catch(async (error) => {
          if (error?.code !== 'P2002') throw error;
          return prisma.petChatMessage.findFirst({
            where: { sessionId: session.id, petId: pet.id, clientRequestId },
          });
        });
      if (userRow && userRow.content === message) {
        const existingAssistant = await prisma.petChatMessage.findFirst({
          where: { sessionId: session.id, petId: pet.id, role: 'assistant', createdAt: { gt: userRow.createdAt } },
          orderBy: { createdAt: 'asc' },
        });
        if (existingAssistant?.status === 'COMPLETE') {
          await releaseReservedCredit(req);
          return res.json({
            schemaReady: true,
            chatSchemaReady: true,
            replayed: true,
            sessionId: session.id,
            answer: existingAssistant.content,
            status: 'COMPLETE',
            citations: existingAssistant.citations || [],
            draft: existingAssistant.draft || null,
            grounding: existingAssistant.grounding || null,
            usage: req.usage,
          });
        }
      }

      const assistantRow = await prisma.petChatMessage
        .create({
          data: {
            userId: req.user.id,
            petId: pet.id,
            sessionId: session.id,
            role: 'assistant',
            content: '',
            status: 'PENDING',
          },
        })
        .catch((error) => {
          if (error?.code === 'P2002') {
            const conflict = new Error('წინა პასუხი ჯერ მიმდინარეობს.');
            conflict.status = 429;
            conflict.code = 'CONCURRENT_LIMIT';
            throw conflict;
          }
          throw error;
        });

      const packed = await loadPetAiContext(req.user.id, pet.id, { todayYmd });
      if (!packed) return res.status(404).json(PET_NOT_FOUND);
      const stream = wantsChatStream(req);

      const run = async ({ onDelta, signal }) =>
        runTrackedAi({
          userId: req.user.id,
          mode: 'VET',
          chatSessionId: session.id,
          userPrompt: message,
          fn: () =>
            askVetAi({
              user: req.user,
              recordText: packed.text,
              history: trustedVetHistory(historyRows),
              userMessage: message,
              speciesId: packed.snapshot.speciesId,
              onDelta,
              signal,
            }),
        });

      if (stream) {
        req.setTimeout(0);
        res.setTimeout(0);
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        if (req.socket) req.socket.setNoDelay(true);
        if (typeof res.flushHeaders === 'function') res.flushHeaders();

        const abort = new AbortController();
        const onClose = () => {
          if (!res.writableEnded) abort.abort();
        };
        req.on('close', onClose);
        req.on('aborted', onClose);
        req.socket?.on('close', onClose);

        try {
          await prisma.petChatMessage.update({
            where: { id: assistantRow.id },
            data: { status: 'PARTIAL' },
          });
          const answer = await run({
            onDelta: (text) => {
              if (abort.signal.aborted || res.writableEnded) return;
              writeSse(res, { type: 'delta', text });
            },
            signal: abort.signal,
          });
          if (abort.signal.aborted) {
            await prisma.petChatMessage.update({
              where: { id: assistantRow.id },
              data: { status: 'CANCELLED', content: answer?.content || '' },
            });
            if (!res.writableEnded) res.end();
            return;
          }
          await persistAndSettleVetComplete(req, { assistantRow, session, message, answer });
          const usage = req.usage;
          logVetOp({
            requestId: clientRequestId,
            petId: pet.id,
            userId: req.user.id,
            model: answer.model,
            status: 'COMPLETE',
            grounding: answer.grounding?.status,
            contextVersion: packed.provenance.version,
          });
          writeSse(res, {
            type: 'done',
            sessionId: session.id,
            messageId: assistantRow.id,
            userMessageId: userRow.id,
            answer: answer.content,
            status: 'COMPLETE',
            model: answer.model,
            engine: 'openrouter',
            citations: answer.citations || [],
            draft: answer.draft,
            grounding: answer.grounding,
            interactionId: answer.interactionId,
            usage,
          });
          res.end();
        } catch (error) {
          const cancelled = error?.status === 499 || abort.signal.aborted;
          const current = await prisma.petChatMessage.findFirst({
            where: { id: assistantRow.id },
            select: { status: true },
          });
          if (current?.status !== 'COMPLETE') {
            await prisma.petChatMessage.update({
              where: { id: assistantRow.id },
              data: { status: cancelled ? 'CANCELLED' : 'FAILED' },
            });
          }
          logVetOp({
            requestId: clientRequestId,
            petId: pet.id,
            userId: req.user.id,
            status: cancelled ? 'CANCELLED' : 'FAILED',
          });
          if (abort.signal.aborted || res.writableEnded) return;
          const status = error instanceof AiEngineError ? error.status : error?.status;
          writeSse(res, {
            type: 'error',
            error: error?.message || 'Medi Vet-თან დაკავშირება ვერ მოხერხდა.',
            status: status && status >= 400 && status < 600 ? status : 502,
            code: cancelled ? 'CANCELLED' : 'PROVIDER_UNAVAILABLE',
          });
          res.end();
        } finally {
          req.removeListener('close', onClose);
          req.removeListener('aborted', onClose);
          req.socket?.removeListener('close', onClose);
        }
        return;
      }

      try {
        const answer = await run({});
        const usage = await persistAndSettleVetComplete(req, { assistantRow, session, message, answer });
        logVetOp({
          requestId: clientRequestId,
          petId: pet.id,
          userId: req.user.id,
          model: answer.model,
          status: 'COMPLETE',
          grounding: answer.grounding?.status,
          contextVersion: packed.provenance.version,
        });
        return res.json({
          schemaReady: true,
          chatSchemaReady: true,
          sessionId: session.id,
          messageId: assistantRow.id,
          userMessageId: userRow.id,
          answer: answer.content,
          status: 'COMPLETE',
          model: answer.model,
          engine: 'openrouter',
          citations: answer.citations || [],
          draft: answer.draft,
          grounding: answer.grounding,
          interactionId: answer.interactionId,
          usage,
        });
      } catch (error) {
        const cancelled = error?.status === 499;
        const current = await prisma.petChatMessage.findFirst({
          where: { id: assistantRow.id },
          select: { status: true },
        });
        if (current?.status !== 'COMPLETE') {
          await prisma.petChatMessage.update({
            where: { id: assistantRow.id },
            data: { status: cancelled ? 'CANCELLED' : 'FAILED' },
          });
        }
        const status = error instanceof AiEngineError ? error.status : error?.status || 502;
        logVetOp({ requestId: clientRequestId, petId: pet.id, userId: req.user.id, status: cancelled ? 'CANCELLED' : 'FAILED' });
        return res.status(status >= 400 && status < 600 ? status : 502).json({
          error: error?.message || 'Medi Vet-თან დაკავშირება ვერ მოხერხდა.',
          code: cancelled ? 'CANCELLED' : 'PROVIDER_UNAVAILABLE',
          chatSchemaReady: true,
        });
      }
    } catch (error) {
      if (error.status === 400) return sendValidation(res, error);
      return sendSchemaError(res, error);
    }
  }),
);
