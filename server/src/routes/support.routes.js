/**
 * Support inbox admin API — /api/admin/support (admin #/support).
 * Reading needs SUPPORT_VIEW, every change SUPPORT_MANAGE (legacy admins without a capability
 * list have both). Replies, status/assignment changes, notes, snippet edits and attachment
 * downloads are audited — without message text. Inbound bodies are sanitized before storage and
 * the admin renders HTML only inside a sandboxed iframe. No health data is exposed: a linked
 * account shows name, status and sign-up date plus a link to #/users/:id.
 */
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { writeAdminAudit } from '../lib/adminAudit.js';
import { isFeatureEnabled } from '../lib/featureFlags.js';
import { EMAIL_FEATURE } from '../lib/email/mailer.js';
import { hashEmail, isSuppressed } from '../lib/email/index.js';
import { ATTACHMENT_MAX_BYTES, createInboundClient } from '../lib/support/resendInbound.js';
import { SUPPORT_STATUSES, inboundHealth, isMissingSupportTable, kickSupportInbound, supportConfig, SUPPORT_RETENTION_DAYS } from '../lib/support/inbound.js';
import { addSupportNote, noteSchema, renderSupportReply, replySchema, sendSupportReply, snippetSchema, supportSender, threadPatchSchema } from '../lib/support/reply.js';

export const adminSupportRouter = Router();
adminSupportRouter.use(requireAdmin);
const view = requireAdminCapability('SUPPORT_VIEW');
const manage = requireAdminCapability('SUPPORT_MANAGE');

const httpError = (message, status = 400, code) => Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
const guarded = (fn) => asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    await fn(req, res);
  } catch (error) {
    if (isMissingSupportTable(error)) throw httpError('მხარდაჭერის ცხრილები ჯერ არ არის დაყენებული (შემდეგი დეპლოი).', 503, 'SUPPORT_NOT_INSTALLED');
    throw error;
  }
});

async function adminDirectory() {
  const rows = await prisma.admin.findMany({ select: { id: true, fullName: true, email: true }, orderBy: { createdAt: 'asc' }, take: 100 });
  return rows.map((a) => ({ id: a.id, name: a.fullName || a.email, email: a.email }));
}

const threadView = (t) => ({
  id: t.id,
  subject: t.subject,
  counterpartEmail: t.counterpartEmail,
  counterpartName: t.counterpartName,
  mailbox: t.mailbox,
  status: t.status,
  assignedAdminId: t.assignedAdminId,
  userId: t.userId,
  unread: t.unread,
  messageCount: t.messageCount,
  lastMessageAt: t.lastMessageAt,
  lastInboundAt: t.lastInboundAt,
  closedAt: t.closedAt,
  createdAt: t.createdAt,
});

const messageView = (m, admins) => ({
  id: m.id,
  direction: m.direction,
  fromEmail: m.fromEmail,
  fromName: m.fromName,
  toEmails: m.toEmails,
  ccEmails: m.ccEmails,
  subject: m.subject,
  textBody: m.textBody,
  htmlBody: m.htmlBody,
  bodyStatus: m.bodyStatus,
  bodyError: m.bodyError,
  attachments: Array.isArray(m.attachments) ? m.attachments : [],
  isAuto: m.isAuto,
  author: m.authorAdminId ? admins.find((a) => a.id === m.authorAdminId)?.name || 'ადმინი' : null,
  sendStatus: m.sendStatus,
  createdAt: m.createdAt,
});

/* ───────── Summary (sidebar badge, polled every 60 s) ───────── */
adminSupportRouter.get('/summary', view, asyncHandler(async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const [unread, fresh] = await Promise.all([
      prisma.supportThread.count({ where: { unread: true, status: { not: 'closed' } } }),
      prisma.supportThread.count({ where: { status: 'new' } }),
    ]);
    res.json({ installed: true, unread, new: fresh });
  } catch (error) {
    if (!isMissingSupportTable(error)) throw error;
    res.json({ installed: false, unread: 0, new: 0 });
  }
}));

adminSupportRouter.get('/config', view, guarded(async (_req, res) => {
  const [health, emailEnabled] = await Promise.all([inboundHealth(), isFeatureEnabled(EMAIL_FEATURE)]);
  res.json({ ...supportConfig(), sender: supportSender().email, health, emailEnabled, retentionDays: SUPPORT_RETENTION_DAYS });
}));

/* ───────── Threads ───────── */
const listQuery = z.object({
  status: z.enum(['active', 'all', ...SUPPORT_STATUSES]).default('active'),
  mine: z.enum(['0', '1']).optional(),
  unread: z.enum(['0', '1']).optional(),
  q: z.string().trim().max(120).optional(),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

adminSupportRouter.get('/threads', view, guarded(async (req, res) => {
  const q = listQuery.parse(req.query ?? {});
  const where = {
    ...(q.status === 'active' ? { status: { in: ['new', 'open', 'waiting'] } } : q.status === 'all' ? {} : { status: q.status }),
    ...(q.mine === '1' ? { assignedAdminId: req.admin.id } : {}),
    ...(q.unread === '1' ? { unread: true } : {}),
    ...(q.q ? { OR: [
      { counterpartEmail: { contains: q.q, mode: 'insensitive' } },
      { counterpartName: { contains: q.q, mode: 'insensitive' } },
      { subject: { contains: q.q, mode: 'insensitive' } },
    ] } : {}),
  };
  const [total, rows, grouped, admins] = await Promise.all([
    prisma.supportThread.count({ where }),
    prisma.supportThread.findMany({ where, orderBy: { lastMessageAt: 'desc' }, skip: q.offset, take: q.limit }),
    prisma.supportThread.groupBy({ by: ['status'], _count: { _all: true } }),
    adminDirectory(),
  ]);
  const counts = Object.fromEntries(SUPPORT_STATUSES.map((s) => [s, 0]));
  for (const g of grouped) counts[g.status] = g._count._all;
  // One-line preview of each thread's latest mail or reply (internal notes are not previews).
  const latest = rows.length
    ? await prisma.supportMessage.findMany({
      where: { threadId: { in: rows.map((r) => r.id) }, direction: { in: ['inbound', 'outbound'] } },
      orderBy: { createdAt: 'desc' },
      distinct: ['threadId'],
      select: { threadId: true, direction: true, textBody: true, bodyStatus: true },
    })
    : [];
  const previewOf = Object.fromEntries(latest.map((m) => [m.threadId, {
    direction: m.direction,
    text: String(m.textBody || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    pending: !m.textBody && m.bodyStatus !== 'ok',
  }]));
  res.json({ total, threads: rows.map((r) => ({ ...threadView(r), preview: previewOf[r.id] || null })), counts, admins, me: req.admin.id });
}));

async function loadThread(id) {
  const thread = await prisma.supportThread.findUnique({ where: { id } });
  if (!thread) throw httpError('საუბარი ვერ მოიძებნა.', 404);
  return thread;
}

adminSupportRouter.get('/threads/:id', view, guarded(async (req, res) => {
  const thread = await loadThread(req.params.id);
  const [messages, admins, user, suppressed, history] = await Promise.all([
    prisma.supportMessage.findMany({ where: { threadId: thread.id }, orderBy: { createdAt: 'asc' }, take: 500 }),
    adminDirectory(),
    // Basic account facts only — never health data.
    thread.userId ? prisma.user.findUnique({ where: { id: thread.userId }, select: { id: true, fullName: true, status: true, createdAt: true } }) : null,
    isSuppressed(hashEmail(thread.counterpartEmail)).catch(() => false),
    // Earlier conversations with the same person (subject/status only).
    prisma.supportThread.findMany({
      where: { counterpartEmail: thread.counterpartEmail, id: { not: thread.id } },
      orderBy: { lastMessageAt: 'desc' },
      take: 10,
      select: { id: true, subject: true, status: true, lastMessageAt: true, messageCount: true },
    }),
  ]);
  if (thread.unread) await prisma.supportThread.update({ where: { id: thread.id }, data: { unread: false } });
  res.json({ thread: { ...threadView(thread), unread: false }, messages: messages.map((m) => messageView(m, admins)), user, admins, suppressed, history, me: req.admin.id });
}));

adminSupportRouter.patch('/threads/:id', manage, guarded(async (req, res) => {
  const body = threadPatchSchema.parse(req.body ?? {});
  const before = await loadThread(req.params.id);
  const data = { updatedAt: new Date() };
  if (body.status) {
    data.status = body.status;
    data.closedAt = body.status === 'closed' ? new Date() : null;
  }
  if (body.assignedAdminId !== undefined) {
    const id = body.assignedAdminId === 'me' ? req.admin.id : body.assignedAdminId;
    if (id && !(await prisma.admin.findUnique({ where: { id }, select: { id: true } }))) throw httpError('ადმინი ვერ მოიძებნა.', 400);
    data.assignedAdminId = id || null;
  }
  if (body.unread !== undefined) data.unread = body.unread;
  const after = await prisma.supportThread.update({ where: { id: before.id }, data });
  const changed = ['status', 'assignedAdminId'].filter((k) => before[k] !== after[k]);
  if (changed.length) {
    await writeAdminAudit({
      admin: req.admin,
      action: changed.includes('status') ? 'support.thread.status' : 'support.thread.assign',
      targetType: 'supportThread',
      targetId: before.id,
      previousValue: Object.fromEntries(changed.map((k) => [k, before[k]])),
      newValue: Object.fromEntries(changed.map((k) => [k, after[k]])),
    });
  }
  res.json({ thread: threadView(after) });
}));

adminSupportRouter.post('/threads/:id/preview', manage, guarded(async (req, res) => {
  const body = z.object({ body: z.string().max(20_000).default('') }).parse(req.body ?? {});
  const thread = await loadThread(req.params.id);
  const rendered = renderSupportReply(thread, body.body);
  res.json({ ...rendered, to: thread.counterpartEmail, from: supportSender().email });
}));

adminSupportRouter.post('/threads/:id/reply', manage, guarded(async (req, res) => {
  const body = replySchema.parse(req.body ?? {});
  const out = await sendSupportReply({ threadId: req.params.id, body: body.body, status: body.status, admin: req.admin });
  await writeAdminAudit({
    admin: req.admin,
    action: 'support.reply',
    targetType: 'supportThread',
    targetId: req.params.id,
    newValue: { messageId: out.message.id, status: body.status, chars: body.body.length, providerId: out.providerId },
  });
  res.status(201).json({ ok: true, messageId: out.message.id });
}));

adminSupportRouter.post('/threads/:id/notes', manage, guarded(async (req, res) => {
  const body = noteSchema.parse(req.body ?? {});
  const note = await addSupportNote({ threadId: req.params.id, body: body.body, admin: req.admin });
  await writeAdminAudit({ admin: req.admin, action: 'support.note', targetType: 'supportThread', targetId: req.params.id, newValue: { noteId: note.id, chars: body.body.length } });
  res.status(201).json({ ok: true, id: note.id });
}));

/* ───────── Messages ───────── */
adminSupportRouter.post('/messages/:id/refetch', manage, guarded(async (req, res) => {
  const msg = await prisma.supportMessage.findUnique({ where: { id: req.params.id }, select: { id: true, direction: true } });
  if (!msg || msg.direction !== 'inbound') throw httpError('წერილი ვერ მოიძებნა.', 404);
  await prisma.supportMessage.update({ where: { id: msg.id }, data: { bodyStatus: 'pending', bodyAttempts: 0, bodyNextAt: new Date(), bodyError: null } });
  kickSupportInbound();
  res.json({ ok: true });
}));

/** Attachment proxy: Resend → admin, streamed with a size cap; never stored on our disk. */
adminSupportRouter.get('/messages/:id/attachments/:attachmentId', view, guarded(async (req, res) => {
  const msg = await prisma.supportMessage.findUnique({ where: { id: req.params.id }, select: { id: true, threadId: true, resendId: true, attachments: true } });
  const att = Array.isArray(msg?.attachments) ? msg.attachments.find((a) => a.id === req.params.attachmentId) : null;
  if (!msg?.resendId || !att) throw httpError('მიმაგრებული ფაილი ვერ მოიძებნა.', 404);
  if (Number(att.size) > ATTACHMENT_MAX_BYTES) throw httpError('ფაილი 25 MB-ზე დიდია — გახსენი Resend-ის პანელში.', 413, 'TOO_LARGE');
  const client = createInboundClient();
  let buffer;
  try {
    const meta = await client.getAttachment(msg.resendId, att.id);
    buffer = await client.download(meta?.download_url);
  } catch (error) {
    if (error?.code === 'RESTRICTED' || error?.code === 'NO_KEY') throw httpError('ფაილის წასაკითხად საჭიროა RESEND_INBOUND_API_KEY (Full access გასაღები).', 422, 'INBOUND_KEY_REQUIRED');
    if (error?.code === 'TOO_LARGE') throw httpError('ფაილი 25 MB-ზე დიდია.', 413, 'TOO_LARGE');
    throw httpError(`ფაილი ვერ ჩამოიტვირთა: ${error?.message || ''}`.trim(), 502, 'DOWNLOAD_FAILED');
  }
  await writeAdminAudit({ admin: req.admin, action: 'support.attachment.download', targetType: 'supportThread', targetId: msg.threadId, newValue: { messageId: msg.id, attachmentId: att.id, size: buffer.length } });
  const name = String(att.filename || 'attachment').replace(/[^\p{L}\p{N}._ -]+/gu, '_').slice(0, 150) || 'attachment';
  res.set({
    // Always a download, never rendered by the browser (an HTML attachment must not run in our origin).
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Content-Length': String(buffer.length),
  });
  res.end(buffer);
}));

/* ───────── Snippets ───────── */
const snippetView = (s) => ({ id: s.id, title: s.title, body: s.body, updatedAt: s.updatedAt });

adminSupportRouter.get('/snippets', view, guarded(async (_req, res) => {
  const rows = await prisma.supportSnippet.findMany({ orderBy: { title: 'asc' }, take: 200 });
  res.json({ snippets: rows.map(snippetView) });
}));

adminSupportRouter.post('/snippets', manage, guarded(async (req, res) => {
  const body = snippetSchema.parse(req.body ?? {});
  const row = await prisma.supportSnippet.create({ data: { id: randomUUID(), ...body, createdById: req.admin.id } });
  await writeAdminAudit({ admin: req.admin, action: 'support.snippet.create', targetType: 'supportSnippet', targetId: row.id, newValue: { title: row.title } });
  res.status(201).json({ snippet: snippetView(row) });
}));

adminSupportRouter.put('/snippets/:id', manage, guarded(async (req, res) => {
  const body = snippetSchema.parse(req.body ?? {});
  const before = await prisma.supportSnippet.findUnique({ where: { id: req.params.id } });
  if (!before) throw httpError('შაბლონი ვერ მოიძებნა.', 404);
  const row = await prisma.supportSnippet.update({ where: { id: before.id }, data: { ...body, updatedAt: new Date() } });
  await writeAdminAudit({ admin: req.admin, action: 'support.snippet.update', targetType: 'supportSnippet', targetId: row.id, previousValue: { title: before.title }, newValue: { title: row.title } });
  res.json({ snippet: snippetView(row) });
}));

adminSupportRouter.delete('/snippets/:id', manage, guarded(async (req, res) => {
  const before = await prisma.supportSnippet.findUnique({ where: { id: req.params.id } });
  if (!before) throw httpError('შაბლონი ვერ მოიძებნა.', 404);
  await prisma.supportSnippet.delete({ where: { id: before.id } });
  await writeAdminAudit({ admin: req.admin, action: 'support.snippet.delete', targetType: 'supportSnippet', targetId: before.id, previousValue: { title: before.title } });
  res.json({ ok: true });
}));
