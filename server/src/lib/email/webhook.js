/**
 * Resend webhooks (Svix-signed) → EmailLog status + EmailSuppression.
 *
 * Resend dashboard → Webhooks → endpoint https://medicard.ge/api/email/webhook with events
 * email.sent, email.delivered, email.delivery_delayed, email.bounced, email.complained,
 * email.opened, email.clicked — and email.received for the support inbox (src/lib/support/).
 * Its signing secret goes to RESEND_WEBHOOK_SECRET. Without the secret the endpoint answers
 * 503 — unsigned events are never accepted.
 *
 * Signature (https://docs.svix.com/receiving/verifying-payloads/how-manual):
 *   signed = `${svix-id}.${svix-timestamp}.${raw body}`, key = base64(secret without "whsec_"),
 *   svix-signature = space-separated "v1,<base64 HMAC-SHA256>" entries; timestamp within 5 minutes.
 */
import crypto from 'node:crypto';
import { prisma } from '../prisma.js';
import { hashEmail } from './address.js';
import { applyInboundEmailEvent } from '../support/inbound.js';

export const WEBHOOK_TOLERANCE_SEC = 5 * 60;

export function signSvixPayload({ secret, id, timestamp, payload }) {
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  return crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64');
}

/** @returns {{ ok: true } | { ok: false, reason: string }} */
export function verifySvixSignature({ secret, headers, payload, now = Date.now(), toleranceSec = WEBHOOK_TOLERANCE_SEC }) {
  if (!secret) return { ok: false, reason: 'no_secret' };
  const get = (name) => {
    const v = typeof headers?.get === 'function' ? headers.get(name) : headers?.[name] ?? headers?.[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };
  const id = get('svix-id');
  const timestamp = get('svix-timestamp');
  const signature = get('svix-signature');
  if (!id || !timestamp || !signature) return { ok: false, reason: 'missing_headers' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > toleranceSec) return { ok: false, reason: 'stale' };
  let expected;
  try {
    expected = Buffer.from(signSvixPayload({ secret, id, timestamp, payload: Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload ?? '') }));
  } catch {
    return { ok: false, reason: 'bad_secret' };
  }
  for (const part of String(signature).split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    const given = Buffer.from(sig);
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: 'mismatch' };
}

/** Webhook event → EmailLog status. Later states never go backwards (clicked stays clicked). */
export const EVENT_STATUS = Object.freeze({
  'email.sent': 'sent',
  'email.delivery_delayed': 'delayed',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
});
const RANK = { queued: 0, failed: 0, suppressed: 0, sent: 1, delayed: 2, delivered: 3, opened: 4, clicked: 5, bounced: 6, complained: 7 };

export function shouldAdvance(current, next) {
  return (RANK[next] ?? -1) > (RANK[current] ?? -1);
}

/** Hard bounce (anything but an explicit Transient/soft one) or a complaint → suppress. */
export function suppressionReason(event) {
  if (event?.type === 'email.complained') return 'complaint';
  if (event?.type !== 'email.bounced') return null;
  const kind = String(event?.data?.bounce?.type || '').toLowerCase();
  if (kind === 'transient' || kind === 'soft') return null;
  return 'hard_bounce';
}

/** Applies one verified event. Unknown types are acknowledged and ignored. */
export async function applyEmailWebhookEvent(event, { db = prisma } = {}) {
  const status = EVENT_STATUS[event?.type];
  if (!status) return { ignored: true };
  const providerId = String(event?.data?.email_id || '');
  let updated = 0;
  let logHash = null;
  if (providerId) {
    const log = await db.emailLog.findFirst({ where: { providerId }, select: { id: true, status: true, toHash: true } });
    if (log) {
      logHash = log.toHash;
      const bounceNote = event.type === 'email.bounced' ? String(event?.data?.bounce?.message || event?.data?.bounce?.type || 'bounced').slice(0, 300) : null;
      if (shouldAdvance(log.status, status)) {
        await db.emailLog.update({ where: { id: log.id }, data: { status, ...(bounceNote ? { error: bounceNote } : {}), updatedAt: new Date() } });
        updated = 1;
      }
    }
  }
  const reason = suppressionReason(event);
  let suppressed = 0;
  if (reason) {
    const recipients = Array.isArray(event?.data?.to) ? event.data.to : event?.data?.to ? [event.data.to] : [];
    const hashes = new Set(recipients.map((addr) => hashEmail(addr)));
    if (logHash) hashes.add(logHash);
    for (const toHash of hashes) {
      await db.emailSuppression.upsert({ where: { toHash }, create: { toHash, reason }, update: {} });
      suppressed += 1;
    }
  }
  return { status, updated, suppressed };
}

/** One verified webhook event → inbound support mail or outbound delivery status. */
export async function dispatchEmailWebhookEvent(event, deps = {}) {
  if (event?.type === 'email.received') return applyInboundEmailEvent(event, deps);
  return applyEmailWebhookEvent(event, deps);
}
