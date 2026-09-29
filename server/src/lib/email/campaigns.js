/**
 * Marketing email campaigns (admin #/email → კამპანიები) and email housekeeping.
 *
 * Recipients: User.emailMarketingOptIn = true (consent given before the campaign was queued),
 * not BLOCKED, a real mailbox (no synthetic phone logins), address not in EmailSuppression —
 * narrowed by segment. The worker re-checks consent/status/suppression per batch in JS too.
 *
 * Worker: JobLease "email-campaigns" (one sender across instances). Walks recipients in user-id
 * order, 100 per Resend batch call, ~1.6 calls/second (Resend default limit 2/s; 429 → back-off
 * in transport.js). Every recipient is claimed in EmailLog (campaign:<id>:<userId>, unique) before
 * the call, so a restart never mails anyone twice (a crash mid-call can drop that batch instead:
 * at-most-once is the right side for marketing). Progress (cursor) is saved after every batch;
 * cancel is honoured between batches; the `email` kill switch pauses sending until re-enabled.
 */
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../prisma.js';
import { acquireJobLease, withJobLease } from '../jobLease.js';
import { isFeatureEnabled } from '../featureFlags.js';
import { GOAL_BY_SEGMENT } from '../pushCampaigns.js';
import { SYNTHETIC_EMAIL_DOMAIN, hashEmail, isDeliverableEmail, maskEmail } from './address.js';
import { CAMPAIGN_VARS, renderEmail } from './templates.js';
import { EMAIL_FEATURE, commonVars, getDefaultTransport, suppressedHashes } from './mailer.js';
import { unsubscribeUrl } from './preferences.js';
import { getUserLanguages } from '../i18n.js';

export const EMAIL_SEGMENTS = Object.freeze([
  'ALL_OPTED_IN',
  'ACTIVE_30D',
  'GOAL_MEDICATIONS',
  'GOAL_NUTRITION',
  'GOAL_CYCLE',
  'GOAL_GENERAL',
  'PLATFORM_IOS',
  'PLATFORM_ANDROID',
]);
export const CAMPAIGN_STATUSES = Object.freeze(['draft', 'queued', 'sending', 'sent', 'failed', 'cancelled']);
export const EMAIL_CAMPAIGN_LEASE = 'email-campaigns';
export const EMAIL_PURGE_LEASE = 'email-log-purge';
export const LOG_RETENTION_DAYS = 180;
export const BATCH_SIZE = 100;
export const BATCH_PAUSE_MS = 600;
const LEASE_TTL_MS = 3 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/* ───────── Segments ───────── */
export function segmentWhereSql(segment, asOf) {
  const parts = [
    Prisma.sql`u."emailMarketingOptIn" = true`,
    Prisma.sql`u."emailMarketingOptInAt" <= ${asOf}`,
    Prisma.sql`u.status <> 'BLOCKED'`,
    Prisma.sql`u.email NOT LIKE ${`%@${SYNTHETIC_EMAIL_DOMAIN}`}`,
    Prisma.sql`NOT EXISTS (SELECT 1 FROM "EmailSuppression" s WHERE s."toHash" = encode(sha256(convert_to(lower(u.email), 'UTF8')), 'hex'))`,
  ];
  if (segment === 'ACTIVE_30D') {
    parts.push(Prisma.sql`EXISTS (SELECT 1 FROM "AppActivity" a WHERE a."userId" = u.id AND a."lastAt" >= ${new Date(asOf.getTime() - 30 * DAY)})`);
  } else if (segment === 'PLATFORM_IOS' || segment === 'PLATFORM_ANDROID') {
    parts.push(Prisma.sql`EXISTS (SELECT 1 FROM "PushToken" p WHERE p."userId" = u.id AND p.active = true AND lower(p.platform) = ${segment === 'PLATFORM_IOS' ? 'ios' : 'android'})`);
  } else if (GOAL_BY_SEGMENT[segment]) {
    parts.push(Prisma.sql`EXISTS (SELECT 1 FROM "HealthProfile" h WHERE h."userId" = u.id AND h."extraAnswers"->>'primaryGoal' = ${GOAL_BY_SEGMENT[segment]})`);
  }
  return Prisma.join(parts, ' AND ');
}

export async function countSegment(segment, { db = prisma, asOf = new Date() } = {}) {
  const rows = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "User" u WHERE ${segmentWhereSql(segment, asOf)}`;
  return rows[0]?.n ?? 0;
}

export async function segmentCounts({ db = prisma, now = new Date() } = {}) {
  const counts = await Promise.all(EMAIL_SEGMENTS.map((s) => countSegment(s, { db, asOf: now }).catch(() => 0)));
  return Object.fromEntries(EMAIL_SEGMENTS.map((s, i) => [s, counts[i]]));
}

export async function loadCampaignRecipients({ segment, asOf, cursor, limit }, { db = prisma } = {}) {
  const after = cursor ? Prisma.sql`AND u.id > ${cursor}` : Prisma.empty;
  return db.$queryRaw`SELECT u.id, u.email, u."fullName", u.status, u."emailMarketingOptIn" AS "optIn"
    FROM "User" u WHERE ${segmentWhereSql(segment, asOf)} ${after} ORDER BY u.id ASC LIMIT ${limit}`;
}

/** Defence in depth: the SQL already filters, the worker checks again before mailing anyone. */
export function isSendableRecipient(row) {
  return Boolean(row && row.optIn === true && row.status !== 'BLOCKED' && isDeliverableEmail(row.email));
}

/* ───────── Campaign content ───────── */
export function campaignContent(c) {
  return { subject: c.subject, preheader: c.preheader || '', heading: c.heading || '', body: c.body || '', ctaLabel: c.ctaLabel || '', ctaUrl: c.ctaUrl || '' };
}

/**
 * The admin's campaign text is sent as written; the layout (footer, unsubscribe, generic name) and
 * the unsubscribe page follow the recipient's language (`recipient.lang`, default Georgian).
 */
export function renderCampaignFor(campaign, recipient) {
  const lang = recipient.lang === 'en' ? 'en' : 'ka';
  const unsub = unsubscribeUrl(recipient.id, { lang });
  const rendered = renderEmail({
    content: campaignContent(campaign),
    vars: commonVars({ fullName: recipient.fullName, lang }),
    allowed: CAMPAIGN_VARS,
    category: 'marketing',
    unsubscribeUrl: unsub,
    lang,
  });
  return { ...rendered, unsub };
}

export function campaignProgress(campaign) {
  const p = campaign?.data?.progress;
  return p && typeof p === 'object' && p.v === 1 ? p : null;
}

/** draft → queued. Returns the updated row; throws 422 when nobody would receive it. */
export async function queueEmailCampaign(id, { db = prisma, now = new Date(), kick = kickEmailCampaigns, count = countSegment } = {}) {
  const campaign = await db.emailCampaign.findUnique({ where: { id } });
  if (!campaign) throw Object.assign(new Error('კამპანია ვერ მოიძებნა.'), { status: 404 });
  if (campaign.status !== 'draft') throw Object.assign(new Error('მხოლოდ მონახაზის გაგზავნაა შესაძლებელი.'), { status: 409 });
  const targetCount = await count(campaign.segment, { db, asOf: now });
  if (!targetCount) throw Object.assign(new Error('ამ სეგმენტში თანხმობით გამოწერილი მიმღები არ არის.'), { status: 422, code: 'NO_RECIPIENTS' });
  const updated = await db.emailCampaign.update({
    where: { id },
    data: {
      status: 'queued',
      targetCount,
      sentCount: 0,
      failedCount: 0,
      updatedAt: now,
      data: { ...(campaign.data || {}), progress: { v: 1, asOf: now.toISOString(), cursor: null, done: false } },
    },
  });
  kick();
  return updated;
}

export async function cancelEmailCampaign(id, { db = prisma, now = new Date() } = {}) {
  const campaign = await db.emailCampaign.findUnique({ where: { id } });
  if (!campaign) throw Object.assign(new Error('კამპანია ვერ მოიძებნა.'), { status: 404 });
  if (!['draft', 'queued', 'sending'].includes(campaign.status)) throw Object.assign(new Error('ეს კამპანია უკვე დასრულებულია.'), { status: 409 });
  return db.emailCampaign.update({ where: { id }, data: { status: 'cancelled', updatedAt: now, sentAt: campaign.sentCount ? now : null } });
}

/* ───────── Worker ───────── */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shortError = (e) => String(e?.message || e).slice(0, 300);

/**
 * Sends (or resumes) one campaign. Returns { done } | { cancelled } | { paused }.
 */
export async function runEmailCampaign(campaign, {
  db = prisma,
  transport = getDefaultTransport(),
  loadRecipients = (args) => loadCampaignRecipients(args, { db }),
  keepLease = async () => true,
  featureEnabled = (key) => isFeatureEnabled(key),
  sleep = defaultSleep,
  batchSize = BATCH_SIZE,
  pauseMs = BATCH_PAUSE_MS,
  now = () => new Date(),
  languages = (ids) => (db === prisma ? getUserLanguages(ids) : Promise.resolve(new Map())),
} = {}) {
  const progress = campaignProgress(campaign);
  if (!progress) return { skipped: 'no_progress' };
  if (!transport?.configured) return { paused: 'not_configured' };
  const asOf = new Date(progress.asOf || campaign.createdAt);
  let cursor = progress.cursor || null;
  let sent = campaign.sentCount || 0;
  let failed = campaign.failedCount || 0;
  let skipped = Number(progress.skipped || 0);

  const save = (extra = {}) => db.emailCampaign.update({
    where: { id: campaign.id },
    data: { sentCount: sent, failedCount: failed, updatedAt: now(), data: { ...(campaign.data || {}), progress: { ...progress, v: 1, cursor, skipped } }, ...extra },
  });

  if (campaign.status !== 'sending') await db.emailCampaign.update({ where: { id: campaign.id }, data: { status: 'sending', updatedAt: now() } });

  for (;;) {
    if (!(await keepLease())) return { paused: 'lease', sent, failed };
    if (!(await featureEnabled(EMAIL_FEATURE))) return { paused: 'disabled', sent, failed };
    const current = await db.emailCampaign.findUnique({ where: { id: campaign.id }, select: { status: true } });
    if (!current || current.status === 'cancelled') return { cancelled: true, sent, failed };

    const rows = await loadRecipients({ segment: campaign.segment, asOf, cursor, limit: batchSize });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    const eligible = rows.filter(isSendableRecipient).map((r) => ({ ...r, toHash: hashEmail(r.email) }));
    const blocked = await suppressedHashes(eligible.map((r) => r.toHash), { db });
    const candidates = eligible.filter((r) => !blocked.has(r.toHash));
    skipped += rows.length - candidates.length;

    const langs = candidates.length ? await languages(candidates.map((r) => r.id)).catch(() => new Map()) : new Map();
    const rendered = new Map(candidates.map((r) => [r.id, renderCampaignFor(campaign, { ...r, lang: langs.get(String(r.id)) })]));
    const claimed = candidates.length
      ? await db.emailLog.createManyAndReturn({
        data: candidates.map((r) => ({
          id: randomUUID(),
          userId: r.id,
          toHash: r.toHash,
          toMasked: maskEmail(r.email),
          templateKey: 'campaign',
          category: 'marketing',
          subject: rendered.get(r.id).subject.slice(0, 200),
          status: 'queued',
          campaignId: campaign.id,
          idempotencyKey: `campaign:${campaign.id}:${r.id}`,
        })),
        skipDuplicates: true,
        select: { id: true, userId: true },
      })
      : [];
    const logByUser = new Map(claimed.map((l) => [l.userId, l.id]));
    const batch = candidates.filter((r) => logByUser.has(r.id));

    if (batch.length) {
      const messages = batch.map((r) => {
        const m = rendered.get(r.id);
        return {
          from: env.RESEND_FROM,
          to: String(r.email).trim().toLowerCase(),
          subject: m.subject,
          html: m.html,
          text: m.text,
          replyTo: env.EMAIL_REPLY_TO || undefined,
          headers: {
            'List-Unsubscribe': `<${m.unsub}>, <mailto:${env.EMAIL_REPLY_TO || 'support@medicard.ge'}?subject=unsubscribe>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          tags: [{ name: 'campaign', value: String(campaign.id).replace(/[^A-Za-z0-9_-]/g, '_') }],
        };
      });
      try {
        const ids = await transport.sendBatch(messages, { idempotencyKey: `campaign:${campaign.id}:${batch[0].id}:${batch[batch.length - 1].id}:${batch.length}` });
        await Promise.all(batch.map((r, i) => db.emailLog.update({
          where: { id: logByUser.get(r.id) },
          data: { status: 'sent', providerId: ids[i] || null, updatedAt: now() },
        })));
        sent += batch.length;
      } catch (error) {
        await db.emailLog.updateMany({ where: { id: { in: batch.map((r) => logByUser.get(r.id)) } }, data: { status: 'failed', error: shortError(error), updatedAt: now() } });
        failed += batch.length;
        console.warn('[email-campaigns] batch failed', campaign.id, shortError(error));
      }
    }
    await save();
    if (pauseMs > 0) await sleep(pauseMs);
  }

  progress.done = true;
  const saved = await save({ status: sent > 0 || failed === 0 ? 'sent' : 'failed', sentAt: now() });
  return { done: true, sent, failed, skipped, campaign: saved };
}

export async function nextEmailCampaign({ db = prisma } = {}) {
  const rows = await db.emailCampaign.findMany({ where: { status: { in: ['queued', 'sending'] } }, orderBy: { createdAt: 'asc' }, take: 20 });
  return rows.find((row) => campaignProgress(row)) || null;
}

let running = false;

export async function processEmailCampaigns({ db = prisma, lease = (ttl) => acquireJobLease(EMAIL_CAMPAIGN_LEASE, ttl), ...opts } = {}) {
  if (running) return { skipped: 'busy' };
  running = true;
  try {
    if (!(await lease(LEASE_TTL_MS))) return { skipped: 'lease' };
    let processed = 0;
    for (;;) {
      const campaign = await nextEmailCampaign({ db });
      if (!campaign) break;
      const result = await runEmailCampaign(campaign, { db, keepLease: () => lease(LEASE_TTL_MS), ...opts });
      if (!result.done && !result.cancelled) break;
      processed += 1;
    }
    return { processed };
  } finally {
    running = false;
  }
}

const workersOff = () => process.env.NODE_ENV === 'test' || process.env.EMAIL_WORKERS_DISABLED === 'true';

export function kickEmailCampaigns() {
  if (workersOff()) return;
  setImmediate(() => {
    processEmailCampaigns().catch((error) => console.warn('[email-campaigns] run failed', error?.message));
  });
}

/* ───────── Retention ───────── */
/** EmailLog rows older than 180 days are deleted (daily, under the email-log-purge lease). */
export async function purgeOldEmailLogs({ db = prisma, now = new Date(), days = LOG_RETENTION_DAYS } = {}) {
  const { count } = await db.emailLog.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - days * DAY) } } });
  return count;
}

export function startEmailWorkers({ intervalMs = 30 * 1000 } = {}) {
  if (workersOff()) return null;
  const tick = () => processEmailCampaigns().catch((error) => console.warn('[email-campaigns] run failed', error?.message));
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 20 * 1000).unref?.();

  const purge = () => withJobLease(EMAIL_PURGE_LEASE, 23 * 60 * 60 * 1000, () => purgeOldEmailLogs())
    .then((n) => { if (typeof n === 'number' && n) console.log(`[email] purged ${n} log rows older than ${LOG_RETENTION_DAYS} days`); })
    .catch((error) => { if (!/EmailLog|does not exist/.test(String(error?.message))) console.warn('[email] purge failed', error?.message); });
  const purgeTimer = setInterval(purge, DAY);
  purgeTimer.unref?.();
  setTimeout(purge, 5 * 60 * 1000).unref?.();
  return timer;
}
