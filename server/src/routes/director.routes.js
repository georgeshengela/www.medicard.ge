/**
 * MEDICARD Director (owner stand-in).
 *   /api/admin/director/*       admin #/director — shift switch, Telegram pairing, approval queue, journal
 *   /api/director/telegram      Telegram webhook (secret header, paired owner chat only)
 *   /api/director/brain/*       the brain (Claude Code routine), Bearer DIRECTOR_API_TOKEN;
 *                               aggregate data only, writes only messages/proposals/memory/journal
 */
import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { requireAdmin } from '../middleware/adminAuth.js';
import { asyncHandler } from '../middleware/error.js';
import { writeAdminAudit } from '../lib/adminAudit.js';
import * as store from '../lib/director/store.js';
import * as tg from '../lib/director/telegram.js';
import { buildDirectorSnapshot } from '../lib/director/snapshot.js';
import { routineConfigured, wakeBrain } from '../lib/director/trigger.js';
import { decideFromAdmin, handleTelegramUpdate, notifyOwner, ownerWroteFromAdmin, sendProposal } from '../lib/director/service.js';
import { DIRECTOR_MODEL, llmConfigured, usageToday } from '../lib/director/llm.js';

const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };

// ── admin ────────────────────────────────────────────────────────────────────

export const adminDirectorRouter = Router();
adminDirectorRouter.use(requireAdmin, noStore, (req, res, next) => {
  // The Director acts for the owner: full-access admins only (capabilities == null).
  if (req.admin?.capabilities != null) return res.status(403).json({ error: 'დირექტორი მხოლოდ სრული წვდომის ადმინისთვისაა.' });
  return next();
});

async function overview() {
  const [state, messages, proposals, journal, memory] = await Promise.all([
    store.getState(),
    store.listMessages({ limit: 60 }),
    store.listProposals({ limit: 60 }),
    store.listJournal({ limit: 40 }),
    store.readMemory(),
  ]);
  let bot = null;
  let webhook = null;
  if (tg.telegramConfigured()) {
    [bot, webhook] = await Promise.all([
      tg.getMe().then((me) => ({ username: me.username })).catch(() => ({ error: true })),
      tg.getWebhookInfo().then((w) => ({ set: /\/api\/director\/telegram$/.test(w.url || ''), lastError: w.last_error_message || null })).catch(() => null),
    ]);
  }
  return {
    state: {
      active: state.active,
      activatedAt: state.activatedAt,
      activatedBy: state.activatedBy,
      paired: Boolean(state.ownerChatId),
      lastBrainAt: state.lastBrainAt,
      lastTriggerAt: state.lastTriggerAt,
    },
    config: {
      telegram: tg.telegramConfigured(),
      bot,
      webhook,
      brainToken: Boolean(process.env.DIRECTOR_API_TOKEN),
      routine: routineConfigured(),
      live: llmConfigured() ? { model: DIRECTOR_MODEL(), ...(await usageToday().catch(() => ({}))) } : null,
    },
    messages, proposals, journal, memory,
  };
}

adminDirectorRouter.get('/', asyncHandler(async (_req, res) => res.json(await overview())));

adminDirectorRouter.put('/shift', asyncHandler(async (req, res) => {
  const active = Boolean(req.body?.active);
  const before = await store.getState();
  await store.setActive(active, req.admin.email);
  await writeAdminAudit({ admin: req.admin, action: active ? 'director.shift_on' : 'director.shift_off', targetType: 'director', targetId: 'shift', previousValue: { active: before.active }, newValue: { active } });
  if (active) {
    await notifyOwner('🟢 ცვლა ჩავიბარე ადმინიდან. ვიწყებ მიმოხილვას და მალე მოგწერ.', { direction: 'system' }).catch(() => {});
    await wakeBrain('shift started from admin', { immediate: true });
  } else {
    await notifyOwner('⚪ ცვლა დაბრუნდა ადმინიდან. ვჩერდები.', { direction: 'system' }).catch(() => {});
  }
  res.json(await overview());
}));

adminDirectorRouter.post('/telegram/pair', asyncHandler(async (req, res) => {
  if (!tg.telegramConfigured()) return res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN არ არის დაყენებული.' });
  const me = await tg.getMe();
  const { code, expiresAt } = await store.createPairingCode();
  await writeAdminAudit({ admin: req.admin, action: 'director.telegram_pair', targetType: 'director', targetId: 'telegram' });
  res.json({ code, expiresAt, link: `https://t.me/${me.username}?start=${code}` });
}));

adminDirectorRouter.post('/telegram/unpair', asyncHandler(async (req, res) => {
  await store.unpairOwner();
  await writeAdminAudit({ admin: req.admin, action: 'director.telegram_unpair', targetType: 'director', targetId: 'telegram' });
  res.json(await overview());
}));

/** Points the bot's webhook at this server (idempotent). */
adminDirectorRouter.post('/telegram/webhook', asyncHandler(async (req, res) => {
  if (!tg.telegramConfigured()) return res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN არ არის დაყენებული.' });
  const base = (process.env.DIRECTOR_PUBLIC_URL || `https://${req.get('host')}`).replace(/\/+$/, '');
  if (!/^https:\/\//.test(base)) return res.status(400).json({ error: 'webhook-ს https მისამართი სჭირდება.' });
  await tg.setWebhook(`${base}/api/director/telegram`);
  const info = await tg.getWebhookInfo();
  await writeAdminAudit({ admin: req.admin, action: 'director.telegram_webhook', targetType: 'director', targetId: 'telegram', newValue: { url: info.url } });
  res.json({ ok: true, url: info.url, pending: info.pending_update_count, lastError: info.last_error_message || null });
}));

adminDirectorRouter.post('/proposals/:id/decide', asyncHandler(async (req, res) => {
  const approve = req.body?.approve === true;
  const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 2000) : null;
  const p = await decideFromAdmin(req.params.id, approve, req.admin.email, note);
  if (!p) return res.status(409).json({ error: 'შეთავაზება უკვე გადაწყვეტილია ან არ არსებობს.' });
  await writeAdminAudit({ admin: req.admin, action: approve ? 'director.approve' : 'director.reject', targetType: 'director_proposal', targetId: p.id, newValue: { title: p.title } });
  res.json(await overview());
}));

/** The owner can also write to the Director from the admin page (same inbox as Telegram). */
adminDirectorRouter.post('/message', asyncHandler(async (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, 4000);
  if (!text) return res.status(400).json({ error: 'ტექსტი ცარიელია.' });
  await ownerWroteFromAdmin(text);
  res.json(await overview());
}));

// ── Telegram webhook + brain API ─────────────────────────────────────────────

export const directorRouter = Router();
directorRouter.use(noStore);

directorRouter.post('/telegram', (req, res) => {
  if (!tg.isValidWebhookSecret(req.get('x-telegram-bot-api-secret-token'))) return res.status(401).end();
  // Answer Telegram at once; a slow handler would make it retry the same update.
  res.status(200).json({ ok: true });
  handleTelegramUpdate(req.body || {}).catch((error) => console.warn('[director] telegram update failed', error?.message));
});

function requireBrain(req, res, next) {
  const expected = process.env.DIRECTOR_API_TOKEN || '';
  const header = req.get('authorization') || '';
  const got = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const ok = expected.length >= 32 && got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: 'unauthorized' });
  return next();
}

async function requireOnShift(_req, res, next) {
  const state = await store.getState();
  if (!state.active) return res.status(409).json({ error: 'OFF_SHIFT', message: 'The owner has not handed over the shift. Do not act.' });
  return next();
}

const brain = Router();
directorRouter.use('/brain', requireBrain, brain);

/** Everything the brain needs for one run, in one call. */
brain.get('/context', asyncHandler(async (_req, res) => {
  await store.touchState('lastBrainAt');
  const [state, inbox, decisions, pending, memory, journal, recent, snapshot] = await Promise.all([
    store.getState(),
    store.unhandledOwnerMessages(),
    store.openDecisions(),
    store.listProposals({ status: 'pending', limit: 30 }),
    store.readMemory(),
    store.listJournal({ limit: 30 }),
    store.listMessages({ limit: 30 }),
    buildDirectorSnapshot(),
  ]);
  res.json({
    now: new Date().toISOString(),
    shift: { active: state.active, since: state.activatedAt, telegramPaired: Boolean(state.ownerChatId) },
    inbox: inbox.map((m) => ({ id: m.id, text: m.text, at: m.createdAt })),
    decisions: decisions.map((p) => ({ id: p.id, kind: p.kind, title: p.title, body: p.body, payload: p.payload, status: p.status, ownerNote: p.ownerNote, decidedAt: p.decidedAt })),
    pendingProposals: pending.map((p) => ({ id: p.id, kind: p.kind, title: p.title, createdAt: p.createdAt, ownerNote: p.ownerNote })),
    memory: Object.fromEntries(memory.map((m) => [m.key, m.value])),
    journal: journal.map((j) => ({ kind: j.kind, summary: j.summary, at: j.createdAt })),
    conversation: recent.map((m) => ({ from: m.direction, text: m.text.slice(0, 1500), at: m.createdAt })),
    metrics: snapshot,
  });
}));

const sayBody = z.object({ text: z.string().trim().min(1).max(8000), handled: z.array(z.string()).max(100).optional() });
brain.post('/say', requireOnShift, asyncHandler(async (req, res) => {
  const body = sayBody.parse(req.body);
  const result = await notifyOwner(body.text);
  if (body.handled?.length) await store.markMessagesHandled(body.handled);
  res.json({ ok: true, ...result });
}));

/** Marks owner messages as read without replying (e.g. answered inside a proposal). */
brain.post('/handled', asyncHandler(async (req, res) => {
  const ids = z.array(z.string()).max(100).parse(req.body?.ids);
  res.json({ ok: true, count: await store.markMessagesHandled(ids) });
}));

const proposeBody = z.object({
  kind: z.enum(['decision', 'post', 'email', 'task', 'team', 'change']),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(7000),
  payload: z.unknown().optional(),
});
brain.post('/propose', requireOnShift, asyncHandler(async (req, res) => {
  const body = proposeBody.parse(req.body);
  const p = await store.createProposal(body);
  const sent = await sendProposal(p);
  await store.addJournal({ kind: 'note', summary: `შეთავაზება: ${p.title}`, data: { proposalId: p.id } });
  res.status(201).json({ ok: true, id: p.id, delivered: sent.delivered });
}));

const completeBody = z.object({ result: z.string().trim().min(1).max(4000), status: z.enum(['done', 'expired']).default('done') });
brain.post('/proposals/:id/complete', asyncHandler(async (req, res) => {
  const body = completeBody.parse(req.body);
  const p = await store.completeProposal(req.params.id, body);
  if (!p) return res.status(409).json({ error: 'not approved/pending or unknown id' });
  res.json({ ok: true });
}));

brain.put('/memory/:key', asyncHandler(async (req, res) => {
  const value = req.body?.value == null ? null : String(req.body.value);
  await store.writeMemory(req.params.key, value);
  res.json({ ok: true });
}));

const journalBody = z.object({ kind: z.enum(store.JOURNAL_KINDS), summary: z.string().trim().min(1).max(4000), data: z.unknown().optional() });
brain.post('/journal', asyncHandler(async (req, res) => {
  const body = journalBody.parse(req.body);
  await store.addJournal(body);
  res.status(201).json({ ok: true });
}));
