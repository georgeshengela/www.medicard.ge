/**
 * Support inbox — the Message-ID our sent mail really carries.
 *
 * Resend delivers through Amazon SES, which replaces the Message-ID we set (a letter's own
 * `<uuid@medicard.ge>`) with `<…@eu-west-1.amazonses.com>`; answers point at that one in
 * In-Reply-To / References. It is stored on the outbound SupportMessage as `smtpMessageId`:
 *   webhook email.sent / email.delivered → data.message_id, found by data.email_id = providerId;
 *   GET /emails/{providerId}             → message_id, asked only when an answer from the same
 *                                          counterpart matches nothing (inbound.js rethreadMessage).
 * Found 2026-10-12: Tasso's answer to the owner's letter from ceo@ opened a second thread.
 */
import { prisma } from '../prisma.js';
import { messageIdOf } from './threading.js';

const ID_EVENTS = new Set(['email.sent', 'email.delivered']);

/** Webhook event → smtpMessageId of the outbound support message it belongs to (0 for other mail). */
export async function recordSentMessageId(event, { db = prisma } = {}) {
  if (!ID_EVENTS.has(event?.type)) return 0;
  const providerId = String(event?.data?.email_id || '').trim();
  const smtpMessageId = messageIdOf(event?.data?.message_id);
  if (!providerId || !smtpMessageId) return 0;
  const { count } = await db.supportMessage.updateMany({ where: { providerId, direction: 'outbound', smtpMessageId: null }, data: { smtpMessageId } });
  return count;
}

/**
 * Asks Resend for the Message-ID of this counterpart's recent outbound support mail that has none
 * yet (webhook lost, late or before this column existed). Only that counterpart's own threads, at
 * most `limit` lookups; a failed lookup just leaves the answer where it is. Returns ids stored.
 */
export async function resolveSentMessageIds(db, { counterpart, since, client, limit = 5, pause = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!counterpart || typeof client?.getSent !== 'function') return 0;
  const rows = await db.supportMessage.findMany({
    where: { direction: 'outbound', providerId: { not: null }, smtpMessageId: null, createdAt: { gte: since }, thread: { counterpartEmail: counterpart } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, providerId: true },
  });
  let stored = 0;
  for (const [i, row] of rows.entries()) {
    if (i) await pause(600); // Resend default limit ~2 requests/second
    try {
      const smtpMessageId = messageIdOf((await client.getSent(row.providerId))?.message_id);
      if (!smtpMessageId) continue;
      await db.supportMessage.update({ where: { id: row.id }, data: { smtpMessageId } });
      stored += 1;
    } catch (error) {
      if (error?.code !== 'NOT_FOUND') console.warn('[support] sent Message-ID lookup failed', error?.code || error?.message);
    }
  }
  return stored;
}
