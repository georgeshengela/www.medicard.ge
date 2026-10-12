// Medi for one child (/api/family/members/:memberId/chat…). AI consent first, then the quota; the rule triage
// runs before the model and its level is stored with the answer. Conversations live in FamilyChat* only —
// never in ChatSession, so the parent's own consultations and AI context never see them.
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { bindAiLanguage, currentAiLanguage, requireAiConsent } from '../lib/aiConsent.js';
import { runTrackedAi } from '../lib/aiTelemetry.js';
import { t } from '../lib/i18n.js';
import { prisma } from '../lib/prisma.js';
import { enforceAiQuota } from '../middleware/aiLimiter.js';
import { asyncHandler } from '../middleware/error.js';
import { buildChildRecord } from '../lib/family/aiContext.js';
import { familyTodayYmd } from '../lib/family/age.js';
import { askPediatricAi } from '../lib/family/pediatricEngine.js';
import { levelCopy, ruleTriage } from '../lib/family/pediatricPolicy.js';
import * as store from '../lib/family/store.js';
import { sickDayView } from '../lib/family/view.js';
import { daysBetween, toYmd } from '../lib/family/age.js';

export const familyChatRouter = Router({ mergeParams: true });
familyChatRouter.use(bindAiLanguage);

const ID_RE = /^[0-9a-f-]{36}$/i;
const MESSAGE_MAX = 4000;
const querySchema = z.object({
  message: z.string().trim().min(1).max(MESSAGE_MAX),
  sessionId: z.string().regex(ID_RE).optional(),
  clientRequestId: z.string().regex(/^[\w-]{6,64}$/),
  stream: z.boolean().optional(),
});

async function memberOr404(req, res) {
  const memberId = String(req.params.memberId || '');
  const member = ID_RE.test(memberId) ? await store.findMember(req.user.id, memberId) : null;
  if (!member) res.status(404).json({ error: t(req, store.FAMILY_NOT_FOUND.error, store.FAMILY_NOT_FOUND.errorEn), code: 'FAMILY_NOT_FOUND' });
  return member;
}

function sessionTitle(message) {
  const clean = message.replace(/\s+/g, ' ').trim();
  return clean.length > 48 ? `${clean.slice(0, 47)}…` : clean;
}

function publicMessage(row) {
  const triage = row.triage ? { level: row.triage, text: levelCopy(row.triage, currentAiLanguage()) } : null;
  return { id: row.id, role: row.role, content: row.content, status: row.status, triage, createdAt: row.createdAt };
}

familyChatRouter.get('/chats', asyncHandler(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const rows = await prisma.$queryRaw`SELECT id, title, "createdAt", "updatedAt" FROM "FamilyChatSession"
    WHERE "memberId" = ${member.id} AND "userId" = ${req.user.id} ORDER BY "updatedAt" DESC LIMIT 50`;
  res.json({ sessions: rows });
}));

familyChatRouter.get('/chats/:sessionId', asyncHandler(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const [session] = await prisma.$queryRaw`SELECT * FROM "FamilyChatSession" WHERE id = ${String(req.params.sessionId)} AND "memberId" = ${member.id} AND "userId" = ${req.user.id}`;
  if (!session) return res.status(404).json({ error: t(req, 'საუბარი ვერ მოიძებნა.', 'Conversation not found.') });
  const rows = await prisma.$queryRaw`SELECT * FROM "FamilyChatMessage" WHERE "sessionId" = ${session.id} ORDER BY "createdAt" ASC`;
  res.json({ session: { id: session.id, title: session.title, updatedAt: session.updatedAt }, messages: rows.map(publicMessage) });
}));

familyChatRouter.delete('/chats/:sessionId', asyncHandler(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  await prisma.$executeRaw`DELETE FROM "FamilyChatSession" WHERE id = ${String(req.params.sessionId)} AND "memberId" = ${member.id} AND "userId" = ${req.user.id}`;
  res.json({ ok: true });
}));

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
}

familyChatRouter.post('/chat/query', requireAiConsent, enforceAiQuota, asyncHandler(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) { await req.releaseAiCredit?.(); return; }
  let input;
  try {
    input = querySchema.parse(req.body || {});
  } catch {
    await req.releaseAiCredit?.();
    return res.status(400).json({ error: t(req, 'შეტყობინება ცარიელია ან ძალიან გრძელია.', 'The message is empty or too long.'), code: 'INVALID_INPUT' });
  }
  const lang = currentAiLanguage();

  let session = null;
  if (input.sessionId) {
    [session] = await prisma.$queryRaw`SELECT * FROM "FamilyChatSession" WHERE id = ${input.sessionId} AND "memberId" = ${member.id} AND "userId" = ${req.user.id}`;
    if (!session) { await req.releaseAiCredit?.(); return res.status(404).json({ error: t(req, 'საუბარი ვერ მოიძებნა.', 'Conversation not found.') }); }
    // Replay of the same request (a retry after a dropped connection): answer with what is stored.
    const [replayed] = await prisma.$queryRaw`SELECT * FROM "FamilyChatMessage" WHERE "sessionId" = ${session.id} AND "clientRequestId" = ${input.clientRequestId}`;
    if (replayed) {
      const [answer] = await prisma.$queryRaw`SELECT * FROM "FamilyChatMessage" WHERE "sessionId" = ${session.id} AND role = 'assistant' AND "createdAt" > ${replayed.createdAt} ORDER BY "createdAt" ASC LIMIT 1`;
      await req.releaseAiCredit?.();
      return res.json({ replayed: true, sessionId: session.id, answer: answer ? publicMessage(answer) : null });
    }
    const [busy] = await prisma.$queryRaw`SELECT 1 AS x FROM "FamilyChatMessage" WHERE "sessionId" = ${session.id} AND role = 'assistant' AND status = 'PENDING' AND "createdAt" > now() - interval '3 minutes' LIMIT 1`;
    if (busy) { await req.releaseAiCredit?.(); return res.status(429).json({ error: t(req, 'წინა პასუხი ჯერ მიმდინარეობს.', 'The previous reply is still in progress.'), code: 'CONCURRENT_LIMIT' }); }
  } else {
    const id = randomUUID();
    [session] = await prisma.$queryRaw`INSERT INTO "FamilyChatSession" (id, "memberId", "userId", title) VALUES (${id}, ${member.id}, ${req.user.id}, ${sessionTitle(input.message)}) RETURNING *`;
  }

  const history = await prisma.$queryRaw`SELECT role, content, status FROM "FamilyChatMessage" WHERE "sessionId" = ${session.id} ORDER BY "createdAt" ASC`;
  const now = new Date();
  await prisma.$executeRaw`INSERT INTO "FamilyChatMessage" (id, "sessionId", "memberId", "userId", role, content, status, "clientRequestId", "createdAt")
    VALUES (${randomUUID()}, ${session.id}, ${member.id}, ${req.user.id}, 'user', ${input.message}, 'COMPLETE', ${input.clientRequestId}, ${now})`;
  const assistantId = randomUUID();
  await prisma.$executeRaw`INSERT INTO "FamilyChatMessage" (id, "sessionId", "memberId", "userId", role, content, status, "createdAt")
    VALUES (${assistantId}, ${session.id}, ${member.id}, ${req.user.id}, 'assistant', '', 'PENDING', ${new Date(now.getTime() + 1)})`;

  // The child's record and the rule triage (the floor the model can only raise).
  const today = familyTodayYmd(req);
  const nowMs = Date.now();
  const [doses, measurements, logs, health, foods, milestones] = await Promise.all([
    store.listDoses(member.id), store.listMeasurements(member.id), store.listLogs(member.id, { from: new Date(nowMs - 7 * 86400000) }),
    store.listHealthItems(member.id), store.listFoods(member.id), store.listMilestones(member.id),
  ]);
  const recordText = buildChildRecord({ member, doses, measurements, logs, health, foods, milestones, todayYmd: today, nowMs });
  const sick = sickDayView(logs, nowMs);
  const triage = ruleTriage({
    text: input.message,
    ageDays: daysBetween(toYmd(member.birthDate), today),
    loggedTemps: sick.temps.filter((x) => nowMs - new Date(x.at).getTime() <= 24 * 3600000),
    feverDays: sick.feverDays,
    conditions: health.filter((h) => h.kind === 'CONDITION' && h.active).map((h) => h.name),
  });

  const stream = req.body?.stream === true || String(req.headers.accept || '').includes('text/event-stream');
  const abort = new AbortController();
  const run = (onDelta) => runTrackedAi({
    userId: req.user.id,
    mode: 'PEDIATRIC',
    chatSessionId: session.id,
    userPrompt: input.message,
    cancelled: () => abort.signal.aborted,
    fn: () => askPediatricAi({ user: req.user, recordText, triage, history, userMessage: input.message, onDelta, signal: abort.signal, lang }),
  });
  const finish = async (answer) => {
    await prisma.$executeRaw`UPDATE "FamilyChatMessage" SET content = ${answer.content}, status = 'COMPLETE', triage = ${answer.level} WHERE id = ${assistantId}`;
    await prisma.$executeRaw`UPDATE "FamilyChatSession" SET "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${session.id}`;
    await req.consumeAiCredit?.();
    console.info('[family-medi]', JSON.stringify({ level: answer.level, rule: triage.level, reasons: triage.reasons, modelLevel: answer.modelLevel, doseGuard: answer.doseGuard }));
  };
  const failed = async () => {
    await prisma.$executeRaw`UPDATE "FamilyChatMessage" SET status = 'ERROR' WHERE id = ${assistantId}`.catch(() => undefined);
    await req.releaseAiCredit?.();
  };
  const triageOut = (level) => (level && level !== 'INFO' ? { level, text: levelCopy(level, lang) } : null);

  if (!stream) {
    try {
      const answer = await run(undefined);
      await finish(answer);
      return res.json({ sessionId: session.id, answer: { id: assistantId, role: 'assistant', content: answer.content, status: 'COMPLETE', triage: triageOut(answer.level) }, usage: req.usage });
    } catch (error) {
      await failed();
      return res.status(error?.status && error.status < 600 ? error.status : 502).json({ error: t(req, error?.message || 'Medi-მ ვერ უპასუხა.', error?.messageEn || 'Medi could not answer.'), code: 'AI_FAILED' });
    }
  }

  req.setTimeout(0);
  res.setTimeout(0);
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (req.socket) req.socket.setNoDelay(true);
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  const onClose = () => { if (!res.writableEnded) abort.abort(); };
  req.on('close', onClose);
  // The rule floor is known before a word is written: an emergency card shows at once.
  writeSse(res, { type: 'start', sessionId: session.id, messageId: assistantId, triage: triageOut(triage.level) });
  try {
    const answer = await run((text) => { if (!abort.signal.aborted && !res.writableEnded) writeSse(res, { type: 'delta', text }); });
    if (abort.signal.aborted) {
      await prisma.$executeRaw`UPDATE "FamilyChatMessage" SET status = 'CANCELLED', content = ${answer?.content || ''} WHERE id = ${assistantId}`;
      await req.releaseAiCredit?.();
      if (!res.writableEnded) res.end();
      return;
    }
    await finish(answer);
    writeSse(res, { type: 'done', sessionId: session.id, messageId: assistantId, content: answer.content, triage: triageOut(answer.level), usage: req.usage });
  } catch (error) {
    await failed();
    if (!res.writableEnded) writeSse(res, { type: 'error', error: t(req, error?.message || 'Medi-მ ვერ უპასუხა.', error?.messageEn || 'Medi could not answer.') });
  } finally {
    if (!res.writableEnded) res.end();
  }
}));
