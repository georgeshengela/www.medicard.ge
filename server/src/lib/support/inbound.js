/**
 * Support inbox — inbound side.
 *
 *   webhook `email.received`  → applyInboundEmailEvent: idempotent by Resend id; stores metadata
 *                               (sender, recipients, subject, Message-ID, attachment names) at once
 *                               and threads it (References/In-Reply-To once known, else normalized
 *                               subject + sender within 90 days).
 *   worker (JobLease "support-inbound", every 60 s)
 *                             → fetches bodies/headers from Resend (GET /emails/receiving/{id}),
 *                               sanitizes, detects auto-replies, re-threads by References; retries
 *                               with back-off (8 attempts); 401/403 = "restricted" (Sending-access
 *                               key) → metadata-only until RESEND_INBOUND_API_KEY is set.
 *                             → owner notice to SUPPORT_NOTIFY_EMAIL: subject only, one digest per
 *                               10 minutes at most, never for auto/own-domain mail.
 *   daily (JobLease "support-retention") → deletes closed threads whose last message is > 2 years old.
 */
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../prisma.js';
import { withJobLease } from '../jobLease.js';
import { isDeliverableEmail, SYNTHETIC_EMAIL_DOMAIN } from '../email/address.js';
import { sendEmail } from '../email/mailer.js';
import { capText, htmlToText, sanitizeEmailHtml } from './sanitize.js';
import { createInboundClient } from './resendInbound.js';
import {
  headerValue,
  isAutoMessage,
  isOwnDomain,
  parseAddress,
  parseAddressList,
  parseMessageIds,
  pickMailbox,
  subjectKey,
} from './threading.js';

export const SUPPORT_STATUSES = Object.freeze(['new', 'open', 'waiting', 'closed']);
export const THREAD_MATCH_DAYS = 90;
export const SUPPORT_RETENTION_DAYS = 730;
export const BODY_MAX_ATTEMPTS = 8;
export const NOTIFY_INTERVAL_MS = 10 * 60 * 1000;
export const SUPPORT_INBOUND_LEASE = 'support-inbound';
export const SUPPORT_RETENTION_LEASE = 'support-retention';
export const ADMIN_URL = 'https://medicard.ge/admin/#/support';
const DAY = 24 * 60 * 60 * 1000;
const BACKOFF_MIN = [1, 5, 15, 60, 180, 360, 720, 1440];
const AUTO_NOTIFIED = new Date(0); // "decided, no notice" — ignored by the rate-limit lookup

const hasInboundKey = () => Boolean(env.RESEND_INBOUND_API_KEY);

export const isMissingSupportTable = (error) => /Support(Thread|Message|Snippet)|42P01|P2021|does not exist/i.test(String(error?.message || error?.code || ''));

/** Owner-notice address: a real mailbox outside our own domain (a notice to support@ would loop). */
export function notifyAddress(value = env.SUPPORT_NOTIFY_EMAIL) {
  const email = String(value || '').trim().toLowerCase();
  return isDeliverableEmail(email) && !isOwnDomain(email) ? email : '';
}

export function supportConfig() {
  return {
    inboundKeyConfigured: Boolean(env.RESEND_INBOUND_API_KEY),
    sendKeyConfigured: Boolean(env.RESEND_API_KEY),
    webhookConfigured: Boolean(env.RESEND_WEBHOOK_SECRET),
    notifyConfigured: Boolean(notifyAddress()),
    from: env.SUPPORT_FROM,
  };
}

export function normalizeAttachments(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 50).map((a) => ({
    id: String(a?.id || '').slice(0, 100),
    filename: String(a?.filename || 'attachment').replace(/[\r\n"\\/]+/g, '_').slice(0, 200),
    contentType: String(a?.content_type || a?.contentType || 'application/octet-stream').slice(0, 120),
    size: Number.isFinite(Number(a?.size)) ? Number(a.size) : null,
    disposition: String(a?.content_disposition || a?.disposition || '').slice(0, 20) || null,
  })).filter((a) => a.id);
}

export async function linkUserId(db, email) {
  if (!email || email.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)) return null;
  try {
    const user = await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } });
    return user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Existing thread for this message, or null. References/In-Reply-To win, but only inside threads
 * with the same counterpart — a third party who knows a Message-ID cannot inject into another
 * person's conversation. Fallback: same counterpart + normalized subject within 90 days.
 */
export async function findThread(db, { counterpart, key, refs = [], now = new Date(), excludeThreadId = null }) {
  if (refs.length) {
    const hit = await db.supportMessage.findFirst({
      where: { messageId: { in: refs }, thread: { counterpartEmail: counterpart }, ...(excludeThreadId ? { threadId: { not: excludeThreadId } } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { threadId: true },
    });
    if (hit) return db.supportThread.findUnique({ where: { id: hit.threadId } });
  }
  if (!key) return null;
  return db.supportThread.findFirst({
    where: {
      counterpartEmail: counterpart,
      subjectKey: key,
      lastMessageAt: { gte: new Date(now.getTime() - THREAD_MATCH_DAYS * DAY) },
      ...(excludeThreadId ? { id: { not: excludeThreadId } } : {}),
    },
    orderBy: { lastMessageAt: 'desc' },
  });
}

/** Thread fields after an inbound message: a closed or waiting conversation re-opens. */
export function threadAfterInbound(thread, at) {
  const later = !thread.lastMessageAt || at > thread.lastMessageAt;
  return {
    messageCount: (thread.messageCount || 0) + 1,
    ...(later ? { lastMessageAt: at } : {}),
    lastInboundAt: !thread.lastInboundAt || at > thread.lastInboundAt ? at : thread.lastInboundAt,
    unread: true,
    status: thread.status === 'new' ? 'new' : 'open',
    closedAt: null,
    updatedAt: new Date(),
  };
}

const inTx = (db, fn) => (typeof db.$transaction === 'function' ? db.$transaction(fn) : fn(db));

/** Webhook `email.received`. Returns { duplicate } for a replay; never throws on bad input. */
export async function applyInboundEmailEvent(event, { db = prisma, now = new Date(), kick = kickSupportInbound } = {}) {
  const d = event?.data || {};
  const resendId = String(d.email_id || d.id || '').trim().slice(0, 100);
  if (!resendId) return { ignored: true, reason: 'no_id' };
  const existing = await db.supportMessage.findUnique({ where: { resendId }, select: { id: true, threadId: true } });
  if (existing) return { duplicate: true, threadId: existing.threadId, messageId: existing.id };

  const from = parseAddress(d.from);
  if (!from.email) return { ignored: true, reason: 'no_from' };
  const to = parseAddressList(d.to);
  const cc = parseAddressList(d.cc);
  const receivedFor = parseAddressList(d.received_for);
  const subject = String(d.subject ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 300);
  const createdAt = d.created_at && !Number.isNaN(Date.parse(d.created_at)) ? new Date(d.created_at) : now;
  const at = createdAt > now ? now : createdAt;
  const key = subjectKey(subject);
  const messageId = parseMessageIds(d.message_id)[0] || null;

  let result;
  try {
    result = await inTx(db, async (tx) => {
      let thread = await findThread(tx, { counterpart: from.email, key, now });
      let newThread = false;
      if (!thread) {
        newThread = true;
        thread = await tx.supportThread.create({
          data: {
            id: randomUUID(),
            subject,
            subjectKey: key,
            counterpartEmail: from.email,
            counterpartName: from.name || null,
            mailbox: pickMailbox(to, cc, receivedFor),
            status: 'new',
            userId: await linkUserId(tx, from.email),
            unread: true,
            messageCount: 0,
            lastMessageAt: at,
            createdAt: now,
          },
        });
      }
      const message = await tx.supportMessage.create({
        data: {
          id: randomUUID(),
          threadId: thread.id,
          direction: 'inbound',
          resendId,
          messageId,
          fromEmail: from.email,
          fromName: from.name || null,
          toEmails: to.map((a) => a.email),
          ccEmails: cc.map((a) => a.email),
          subject,
          bodyStatus: 'pending',
          bodyAttempts: 0,
          bodyNextAt: now,
          attachments: normalizeAttachments(d.attachments),
          isAuto: isOwnDomain(from.email),
          createdAt: at,
        },
      });
      await tx.supportThread.update({ where: { id: thread.id }, data: threadAfterInbound(thread, at) });
      return { stored: true, newThread, threadId: thread.id, messageId: message.id };
    });
  } catch (error) {
    if (error?.code === 'P2002') return { duplicate: true };
    throw error;
  }
  kick?.();
  return result;
}

/* ───────── Body fetch ───────── */
export function nextAttemptAt(attempts, now = new Date()) {
  const minutes = BACKOFF_MIN[Math.min(attempts, BACKOFF_MIN.length - 1)];
  return new Date(now.getTime() + minutes * 60 * 1000);
}

/** Maps Resend's received email onto SupportMessage fields. */
export function bodyFieldsFromResend(data, message) {
  const headers = data?.headers && typeof data.headers === 'object' ? data.headers : {};
  const inReplyTo = parseMessageIds(headerValue(headers, 'in-reply-to'))[0] || null;
  const references = parseMessageIds(headerValue(headers, 'references'));
  const clean = sanitizeEmailHtml(data?.html);
  let text = capText(data?.text);
  if (!text && clean.html) text = htmlToText(clean.html);
  const attachments = normalizeAttachments(data?.attachments);
  const messageId = message.messageId || parseMessageIds(data?.message_id || headerValue(headers, 'message-id'))[0] || null;
  return {
    messageId,
    inReplyTo,
    references: references.length ? references.join(' ') : null,
    textBody: text || null,
    htmlBody: clean.html,
    attachments: attachments.length ? attachments : message.attachments,
    isAuto: isAutoMessage({ headers, fromEmail: message.fromEmail }),
    bodyStatus: 'ok',
    bodyError: clean.truncated ? 'HTML_TRUNCATED' : null,
    bodyNextAt: null,
  };
}

/**
 * Once headers are known: if References/In-Reply-To point into another thread with the same
 * counterpart and this message sits alone in a thread created for it, move it there.
 */
export async function rethreadMessage(db, message, { now = new Date() } = {}) {
  const refs = [...parseMessageIds(message.references), ...parseMessageIds(message.inReplyTo)];
  if (!refs.length) return null;
  const current = await db.supportThread.findUnique({ where: { id: message.threadId } });
  if (!current || current.messageCount > 1) return null;
  const target = await findThread(db, { counterpart: current.counterpartEmail, key: null, refs, now, excludeThreadId: current.id });
  if (!target) return null;
  await inTx(db, async (tx) => {
    await tx.supportMessage.update({ where: { id: message.id }, data: { threadId: target.id } });
    await tx.supportThread.update({ where: { id: target.id }, data: threadAfterInbound(target, message.createdAt) });
    await tx.supportThread.delete({ where: { id: current.id } });
  });
  return target.id;
}

export async function fetchMessageBody(message, { db = prisma, client = createInboundClient(), now = new Date() } = {}) {
  try {
    const data = await client.getReceived(message.resendId);
    const fields = bodyFieldsFromResend(data, message);
    const updated = await db.supportMessage.update({ where: { id: message.id }, data: { ...fields, bodyAttempts: (message.bodyAttempts || 0) + 1 } });
    await rethreadMessage(db, { ...message, ...updated }, { now });
    return 'ok';
  } catch (error) {
    if (error?.code === 'RESTRICTED' || error?.code === 'NO_KEY') {
      // A refusal of the dedicated inbound key is recorded apart, so it is not retried every tick.
      const bodyError = hasInboundKey() && error.code === 'RESTRICTED' ? 'RESTRICTED_INBOUND_KEY' : error.code;
      await db.supportMessage.update({ where: { id: message.id }, data: { bodyStatus: 'restricted', bodyError, bodyNextAt: null } });
      return 'restricted';
    }
    const attempts = (message.bodyAttempts || 0) + 1;
    const final = attempts >= BODY_MAX_ATTEMPTS || error?.code === 'NOT_FOUND';
    await db.supportMessage.update({
      where: { id: message.id },
      data: { bodyAttempts: attempts, bodyStatus: final ? 'failed' : 'pending', bodyNextAt: final ? null : nextAttemptAt(attempts, now), bodyError: String(error?.code || error?.message || 'error').slice(0, 200) },
    });
    return final ? 'failed' : 'retry';
  }
}

/** Pending bodies (and, once a reading key exists, earlier "restricted" ones from the last 30 days). */
export async function processInboundBodies({ db = prisma, client = createInboundClient(), now = new Date(), limit = 20, pause = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  if (hasInboundKey()) {
    // Only rows refused under the sending key (or no key) — not ones the inbound key itself refused.
    await db.supportMessage.updateMany({
      where: { direction: 'inbound', bodyStatus: 'restricted', bodyError: { in: ['RESTRICTED', 'NO_KEY'] }, createdAt: { gte: new Date(now.getTime() - 30 * DAY) } },
      data: { bodyStatus: 'pending', bodyNextAt: now },
    });
  }
  const rows = await db.supportMessage.findMany({
    where: { direction: 'inbound', bodyStatus: 'pending', OR: [{ bodyNextAt: null }, { bodyNextAt: { lte: now } }] },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  const counts = { ok: 0, restricted: 0, failed: 0, retry: 0 };
  for (const [i, row] of rows.entries()) {
    if (!row.resendId) continue;
    counts[await fetchMessageBody(row, { db, client, now })] += 1;
    if (i < rows.length - 1) await pause(600); // Resend default limit ~2 requests/second
  }
  return counts;
}

/* ───────── Owner notice ───────── */
const plainSubject = (s) => String(s || '').replace(/[[\]*_`{}<>\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 120) || '(უსათაურო)';

export function noticeContent(threads) {
  const one = threads.length === 1;
  const list = threads.slice(0, 5).map((t) => `- ${plainSubject(t.subject)}`).join('\n');
  const more = threads.length > 5 ? `\n\nდა კიდევ ${threads.length - 5}.` : '';
  return {
    subject: one ? `ახალი წერილი მხარდაჭერაზე: ${plainSubject(threads[0].subject)}` : `ახალი წერილები მხარდაჭერაზე (${threads.length})`,
    preheader: 'გახსენი ადმინი და უპასუხე.',
    heading: one ? 'ახალი წერილი მხარდაჭერაზე' : `ახალი წერილები მხარდაჭერაზე: ${threads.length}`,
    body: `${list}${more}\n\nწერილის ტექსტი აქ არ იგზავნება — გახსენი ადმინი.`,
    ctaLabel: 'ადმინის გახსნა',
    ctaUrl: ADMIN_URL,
  };
}

/**
 * One digest per NOTIFY_INTERVAL_MS at most. A thread is decided once its first inbound body is
 * fetched (or 10 minutes passed): auto/own-domain threads are marked without a notice.
 */
export async function processSupportNotice({ db = prisma, now = new Date(), to = notifyAddress(), send = sendEmail } = {}) {
  if (!to) return { skipped: 'off' };
  const last = await db.supportThread.findFirst({ where: { notifiedAt: { gt: AUTO_NOTIFIED } }, orderBy: { notifiedAt: 'desc' }, select: { notifiedAt: true } });
  if (last?.notifiedAt && now.getTime() - new Date(last.notifiedAt).getTime() < NOTIFY_INTERVAL_MS) return { skipped: 'rate' };
  const candidates = await db.supportThread.findMany({
    where: { notifiedAt: null, createdAt: { gte: new Date(now.getTime() - 2 * DAY) } },
    orderBy: { createdAt: 'asc' },
    take: 50,
    include: { messages: { where: { direction: 'inbound' }, select: { isAuto: true, bodyStatus: true, createdAt: true } } },
  });
  const ready = candidates.filter((t) => t.messages.length && t.messages.every((m) => m.bodyStatus !== 'pending' || now.getTime() - new Date(m.createdAt).getTime() > NOTIFY_INTERVAL_MS));
  const quiet = ready.filter((t) => isOwnDomain(t.counterpartEmail) || t.messages.every((m) => m.isAuto));
  const loud = ready.filter((t) => !quiet.includes(t));
  if (quiet.length) await db.supportThread.updateMany({ where: { id: { in: quiet.map((t) => t.id) } }, data: { notifiedAt: AUTO_NOTIFIED } });
  if (!loud.length) return { sent: 0, quiet: quiet.length };
  const result = await send({ to, templateKey: 'support_notice', content: noticeContent(loud), allowedVars: [], category: 'transactional', idempotencyKey: `support_notice:${loud[0].id}` });
  await db.supportThread.updateMany({ where: { id: { in: loud.map((t) => t.id) } }, data: { notifiedAt: now } });
  if (result?.status !== 'sent') console.warn('[support] owner notice not sent', result?.reason);
  return { sent: loud.length, quiet: quiet.length, status: result?.status };
}

/* ───────── Retention ───────── */
export async function purgeOldSupportThreads({ db = prisma, now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - SUPPORT_RETENTION_DAYS * DAY);
  const { count } = await db.supportThread.deleteMany({ where: { status: 'closed', lastMessageAt: { lt: cutoff } } });
  return count;
}

/* ───────── Health (admin overview; booleans and counts only) ───────── */
export async function inboundHealth({ db = prisma, now = new Date() } = {}) {
  const config = supportConfig();
  try {
    const since7 = new Date(now.getTime() - 7 * DAY);
    const since30 = new Date(now.getTime() - 30 * DAY);
    const [last, count7, count30, restricted30, failed30, unread] = await Promise.all([
      db.supportMessage.findFirst({ where: { direction: 'inbound' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      db.supportMessage.count({ where: { direction: 'inbound', createdAt: { gte: since7 } } }),
      db.supportMessage.count({ where: { direction: 'inbound', createdAt: { gte: since30 } } }),
      db.supportMessage.count({ where: { direction: 'inbound', bodyStatus: 'restricted', createdAt: { gte: since30 } } }),
      db.supportMessage.count({ where: { direction: 'inbound', bodyStatus: 'failed', createdAt: { gte: since30 } } }),
      db.supportThread.count({ where: { unread: true, status: { not: 'closed' } } }),
    ]);
    return {
      installed: true,
      lastReceivedAt: last?.createdAt || null,
      count7,
      count30,
      eventsArriving: count30 > 0,
      restricted30,
      failed30,
      unread,
      inboundKeyConfigured: config.inboundKeyConfigured,
      // Needed when no dedicated key is set and the sending key was refused (or nothing proves it can read).
      inboundKeyNeeded: !config.inboundKeyConfigured && (restricted30 > 0 || count30 === 0),
      notifyConfigured: config.notifyConfigured,
    };
  } catch (error) {
    if (!isMissingSupportTable(error)) throw error;
    return { installed: false, inboundKeyConfigured: config.inboundKeyConfigured, inboundKeyNeeded: !config.inboundKeyConfigured, notifyConfigured: config.notifyConfigured };
  }
}

/* ───────── Workers ───────── */
const workersOff = () => process.env.NODE_ENV === 'test' || process.env.EMAIL_WORKERS_DISABLED === 'true' || process.env.SUPPORT_WORKERS_DISABLED === 'true';
let running = false;

export async function runSupportInboundTick() {
  if (running) return { skipped: 'running' };
  running = true;
  try {
    return await withJobLease(SUPPORT_INBOUND_LEASE, 2 * 60 * 1000, async () => {
      const bodies = await processInboundBodies();
      const notice = await processSupportNotice();
      return { bodies, notice };
    });
  } catch (error) {
    if (!isMissingSupportTable(error)) console.warn('[support] inbound run failed', error?.message);
    return { error: true };
  } finally {
    running = false;
  }
}

export function kickSupportInbound() {
  if (workersOff()) return;
  setTimeout(() => { void runSupportInboundTick(); }, 1500).unref?.();
}

export function startSupportWorkers({ intervalMs = 60 * 1000 } = {}) {
  if (workersOff()) return null;
  const timer = setInterval(() => { void runSupportInboundTick(); }, intervalMs);
  timer.unref?.();
  setTimeout(() => { void runSupportInboundTick(); }, 25 * 1000).unref?.();
  const purge = () => withJobLease(SUPPORT_RETENTION_LEASE, 23 * 60 * 60 * 1000, () => purgeOldSupportThreads())
    .then((n) => { if (typeof n === 'number' && n) console.log(`[support] purged ${n} closed threads older than ${SUPPORT_RETENTION_DAYS} days`); })
    .catch((error) => { if (!isMissingSupportTable(error)) console.warn('[support] purge failed', error?.message); });
  setInterval(purge, DAY).unref?.();
  setTimeout(purge, 7 * 60 * 1000).unref?.();
  return timer;
}
