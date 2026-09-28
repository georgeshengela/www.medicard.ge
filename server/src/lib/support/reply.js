/**
 * Support inbox — outbound side. An admin's answer is rendered with the branded transactional
 * layout (category 'support': no marketing / account footer), sent from SUPPORT_FROM through the
 * shared mailer (kill switch `email`, EmailSuppression, masked EmailLog, idempotency) with
 * In-Reply-To / References / "Re:" so it threads in Gmail and Outlook, then stored as an
 * outbound SupportMessage. Internal notes are stored only and never emailed.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../prisma.js';
import { isDeliverableEmail } from '../email/address.js';
import { commonVars, sendEmail } from '../email/mailer.js';
import { renderEmail } from '../email/templates.js';
import { buildReplyHeaders, isOwnDomain, parseAddress, replySubject } from './threading.js';
import { SUPPORT_STATUSES } from './inbound.js';

export const REPLY_MAX_CHARS = 20_000;
export const NOTE_MAX_CHARS = 5_000;

export const replySchema = z.object({
  body: z.string().trim().min(1, 'პასუხი ცარიელია.').max(REPLY_MAX_CHARS),
  status: z.enum(SUPPORT_STATUSES).default('waiting'),
});
export const noteSchema = z.object({ body: z.string().trim().min(1, 'შენიშვნა ცარიელია.').max(NOTE_MAX_CHARS) });
export const snippetSchema = z.object({
  title: z.string().trim().min(1, 'სათაური აუცილებელია.').max(80),
  body: z.string().trim().min(1, 'ტექსტი აუცილებელია.').max(REPLY_MAX_CHARS),
});
export const threadPatchSchema = z.object({
  status: z.enum(SUPPORT_STATUSES).optional(),
  assignedAdminId: z.string().trim().max(80).nullable().optional(),
  unread: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'ცვლილება არ არის.' });

const httpError = (message, status = 400, code) => Object.assign(new Error(message), { status, ...(code ? { code } : {}) });

export function supportSender() {
  const parsed = parseAddress(env.SUPPORT_FROM);
  return { from: env.SUPPORT_FROM, email: parsed.email || 'support@medicard.ge', name: parsed.name || 'MEDICARD მხარდაჭერა' };
}

export function replyContent(thread, body) {
  return { subject: replySubject(thread.subject), preheader: '', heading: '', body, ctaLabel: '', ctaUrl: '' };
}

/** Same render the mailer performs — for the composer preview. */
export function renderSupportReply(thread, body) {
  return renderEmail({ content: replyContent(thread, body), vars: { ...commonVars(), supportEmail: supportSender().email }, allowed: [], category: 'support' });
}

const REASONS = {
  disabled: 'ელფოსტა გამორთულია (კილ-სვიჩი).',
  not_configured: 'RESEND_API_KEY არ არის დაყენებული.',
  suppressed: 'ეს მისამართი დაბლოკილია (bounce ან საჩივარი) — პასუხი არ გაიგზავნა.',
  undeliverable: 'მისამართი არასწორია.',
};

export async function sendSupportReply({ threadId, body, status = 'waiting', admin }, { db = prisma, send = sendEmail, now = new Date() } = {}) {
  const thread = await db.supportThread.findUnique({ where: { id: threadId } });
  if (!thread) throw httpError('საუბარი ვერ მოიძებნა.', 404);
  const to = thread.counterpartEmail;
  if (!isDeliverableEmail(to)) throw httpError(REASONS.undeliverable, 422, 'UNDELIVERABLE');
  // Loop protection: never answer our own domain (noreply bounces, notices, test mail from support@).
  if (isOwnDomain(to)) throw httpError('საკუთარ დომენზე (@medicard.ge) პასუხი არ იგზავნება.', 422, 'OWN_DOMAIN');

  const lastInbound = await db.supportMessage.findFirst({ where: { threadId, direction: 'inbound' }, orderBy: { createdAt: 'desc' } });
  const headers = buildReplyHeaders(lastInbound);
  const sender = supportSender();
  const id = randomUUID();
  const content = replyContent(thread, body);
  const result = await send({
    to,
    templateKey: 'support_reply',
    content,
    allowedVars: [],
    vars: { supportEmail: sender.email },
    category: 'support',
    userId: thread.userId || null,
    idempotencyKey: `support:${id}`,
    from: sender.from,
    replyTo: sender.email,
    extraHeaders: headers,
  }, { db });
  if (result?.status !== 'sent') {
    throw httpError(REASONS[result?.reason] || `გაგზავნა ვერ მოხერხდა: ${result?.reason || ''}`, result?.reason === 'disabled' ? 503 : 422, 'REPLY_NOT_SENT');
  }
  const message = await db.supportMessage.create({
    data: {
      id,
      threadId,
      direction: 'outbound',
      inReplyTo: headers['In-Reply-To'] || null,
      references: headers.References || null,
      fromEmail: sender.email,
      fromName: sender.name,
      toEmails: [to],
      ccEmails: [],
      subject: content.subject,
      textBody: body,
      bodyStatus: 'none',
      authorAdminId: admin?.id || null,
      providerId: result.providerId || null,
      sendStatus: 'sent',
      createdAt: now,
    },
  });
  await db.supportThread.update({
    where: { id: threadId },
    data: { status, unread: false, lastMessageAt: now, messageCount: (thread.messageCount || 0) + 1, closedAt: status === 'closed' ? now : null, updatedAt: now },
  });
  return { message, headers, subject: content.subject, providerId: result.providerId || null };
}

export async function addSupportNote({ threadId, body, admin }, { db = prisma, now = new Date() } = {}) {
  const thread = await db.supportThread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!thread) throw httpError('საუბარი ვერ მოიძებნა.', 404);
  const note = await db.supportMessage.create({
    data: { id: randomUUID(), threadId, direction: 'note', textBody: body, bodyStatus: 'none', authorAdminId: admin?.id || null, fromName: admin?.fullName || admin?.email || null, toEmails: [], ccEmails: [], createdAt: now },
  });
  await db.supportThread.update({ where: { id: threadId }, data: { updatedAt: now } });
  return note;
}
