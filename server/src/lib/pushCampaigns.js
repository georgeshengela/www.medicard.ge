import { prisma } from './prisma.js';
import { acquireJobLease } from './jobLease.js';
import { fetchExpoPushReceipts, isExpoPushToken, sendExpoChunk } from './push.js';
import { logPushEvent } from './pushTemplates.js';

/**
 * Admin broadcast campaigns (admin #/push → გაგზავნა).
 *
 * POST /api/admin/push/campaigns only queues (status QUEUED) and returns. A background worker,
 * held by the JobLease "push-campaigns" so only one instance sends, walks the segment's active
 * tokens in id order: waves of CONCURRENCY parallel Expo requests of CHUNK_SIZE tokens. After
 * every wave it saves sentCount/failedCount and the id cursor in `data.progress`, so a restart
 * resumes where it stopped (at-least-once: the wave in flight during a crash can repeat).
 * Tokens registered after queueing are left out (`createdAt <= asOf`), so targetCount holds.
 */

export const PUSH_SEGMENTS = [
  'ALL',
  'ACTIVE_7D',
  'ACTIVE_30D',
  'PLATFORM_IOS',
  'PLATFORM_ANDROID',
  'GOAL_MEDICATIONS',
  'GOAL_NUTRITION',
  'GOAL_CYCLE',
  'GOAL_GENERAL',
];

/** Retired package tiers (and the old status-only ACTIVE) still arrive from old clients/scripts. */
export const LEGACY_PUSH_SEGMENTS = { FREE: 'ALL', STANDARD: 'ALL', ULTIMATE: 'ALL', ACTIVE: 'ALL' };
export const ACCEPTED_PUSH_SEGMENTS = [...PUSH_SEGMENTS, ...Object.keys(LEGACY_PUSH_SEGMENTS)];

/** HealthProfile.extraAnswers.primaryGoal values written by onboarding (mobile PrimaryGoal). */
export const GOAL_BY_SEGMENT = {
  GOAL_MEDICATIONS: 'medications',
  GOAL_NUTRITION: 'nutrition',
  GOAL_CYCLE: 'cycle',
  GOAL_GENERAL: 'general',
};

export const CHUNK_SIZE = 100;
export const CONCURRENCY = 4;
export const CAMPAIGN_LEASE = 'push-campaigns';
const LEASE_TTL_MS = 3 * 60 * 1000;
const RECEIPT_BATCH = 1000;
/** A campaign still queued this long after creation (long outage) is not sent late. */
export const CAMPAIGN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DELIVERY_SAMPLE = 50;
const DAY = 24 * 60 * 60 * 1000;

export function normalizePushSegment(segment) {
  const value = String(segment || 'ALL').trim().toUpperCase();
  if (PUSH_SEGMENTS.includes(value)) return value;
  return LEGACY_PUSH_SEGMENTS[value] || null;
}

/** Prisma `where` for PushToken rows in a segment. Blocked accounts never receive broadcasts. */
export function segmentTokenWhere(segment, asOf = new Date()) {
  const seg = normalizePushSegment(segment) || 'ALL';
  const user = { status: { not: 'BLOCKED' } };
  const where = { active: true, createdAt: { lte: asOf }, user };
  if (seg === 'ACTIVE_7D' || seg === 'ACTIVE_30D') {
    const days = seg === 'ACTIVE_7D' ? 7 : 30;
    user.appActivities = { some: { lastAt: { gte: new Date(asOf.getTime() - days * DAY) } } };
  } else if (seg === 'PLATFORM_IOS') {
    where.platform = { equals: 'ios', mode: 'insensitive' };
  } else if (seg === 'PLATFORM_ANDROID') {
    where.platform = { equals: 'android', mode: 'insensitive' };
  } else if (GOAL_BY_SEGMENT[seg]) {
    user.healthProfile = { is: { extraAnswers: { path: ['primaryGoal'], equals: GOAL_BY_SEGMENT[seg] } } };
  }
  return where;
}

/** Device counts per selectable segment for the compose form (one COUNT each). */
export async function segmentRecipientCounts({ db = prisma, now = new Date() } = {}) {
  const counts = await Promise.all(PUSH_SEGMENTS.map((seg) => db.pushToken.count({ where: segmentTokenWhere(seg, now) })));
  return Object.fromEntries(PUSH_SEGMENTS.map((seg, index) => [seg, counts[index]]));
}

/** The custom `data` the admin attached; older rows stored it at the top level next to tickets. */
export function campaignPayload(campaign) {
  const data = campaign?.data && typeof campaign.data === 'object' ? campaign.data : {};
  if (data.payload && typeof data.payload === 'object') return data.payload;
  const { tickets, deliveries, progress, ...rest } = data;
  return rest;
}

export function campaignProgress(campaign) {
  const progress = campaign?.data?.progress;
  return progress && typeof progress === 'object' && progress.v === 2 ? progress : null;
}

export async function queuePushCampaign({ title, body, segment, data, adminId }, { db = prisma, now = new Date(), kick = kickPushCampaigns } = {}) {
  const seg = normalizePushSegment(segment);
  if (!seg) throw Object.assign(new Error('Unknown segment'), { status: 400 });
  const targetCount = await db.pushToken.count({ where: segmentTokenWhere(seg, now) });
  const campaign = await db.pushCampaign.create({
    data: {
      title,
      body,
      segment: seg,
      status: targetCount ? 'QUEUED' : 'FAILED',
      targetCount,
      createdById: adminId ?? null,
      ...(targetCount ? {} : { sentAt: now }),
      data: {
        payload: data ?? {},
        progress: { v: 2, asOf: now.toISOString(), cursor: null, ...(targetCount ? {} : { done: true, reason: 'NO_DEVICES' }) },
      },
    },
  });
  if (targetCount) kick();
  return campaign;
}

function finalStatus(sent) {
  return sent > 0 ? 'SENT' : 'FAILED';
}

/**
 * Sends (or resumes) one campaign. `keepLease` is called before every wave; returning false
 * stops quietly so another instance can continue from the saved cursor.
 */
export async function runPushCampaign(campaign, {
  db = prisma,
  fetchImpl = fetch,
  sleep,
  keepLease = async () => true,
  concurrency = CONCURRENCY,
  chunkSize = CHUNK_SIZE,
  receiptWaitMs = 5000,
  now = () => new Date(),
  logEvent = logPushEvent,
} = {}) {
  const progress = campaignProgress(campaign);
  if (!progress) return { skipped: 'legacy' };
  const asOf = new Date(progress.asOf || campaign.createdAt);
  const payload = campaignPayload(campaign);
  const where = segmentTokenWhere(campaign.segment, asOf);
  const message = {
    title: campaign.title,
    body: campaign.body,
    data: { ...payload, campaignId: campaign.id, type: 'admin_broadcast', source: 'broadcast', family: 'adminBroadcast' },
  };
  const sendOpts = sleep ? { fetchImpl, sleep } : { fetchImpl };

  let cursor = progress.cursor || null;
  let sent = campaign.sentCount || 0;
  let failed = campaign.failedCount || 0;
  const sample = Array.isArray(campaign.data?.deliveries) ? campaign.data.deliveries.slice(0, DELIVERY_SAMPLE) : [];
  const ticketTokens = new Map();

  const save = (extra = {}) => db.pushCampaign.update({
    where: { id: campaign.id },
    data: {
      sentCount: sent,
      failedCount: failed,
      data: { payload, deliveries: sample, progress: { ...progress, v: 2, asOf: asOf.toISOString(), cursor } },
      ...extra,
    },
  });

  await db.pushCampaign.update({ where: { id: campaign.id }, data: { status: 'SENDING' } });

  for (;;) {
    if (!(await keepLease())) return { paused: true, sent, failed };
    const rows = await db.pushToken.findMany({
      where: cursor ? { ...where, id: { gt: cursor } } : where,
      orderBy: { id: 'asc' },
      take: chunkSize * concurrency,
      select: { id: true, token: true },
    });
    if (!rows.length) break;

    const valid = rows.map((row) => row.token).filter((token) => isExpoPushToken(token));
    failed += rows.length - valid.length;
    const chunks = [];
    for (let i = 0; i < valid.length; i += chunkSize) chunks.push(valid.slice(i, i + chunkSize));
    const results = await Promise.all(chunks.map((chunk) => sendExpoChunk(chunk, message, sendOpts)));

    const stale = [];
    for (const result of results) {
      sent += result.sent;
      failed += result.failed;
      stale.push(...result.stale);
      for (const [ticketId, token] of result.ticketTokens) ticketTokens.set(ticketId, token);
      for (const row of result.deliveries) if (sample.length < DELIVERY_SAMPLE) sample.push(row);
    }
    if (stale.length) await db.pushToken.updateMany({ where: { token: { in: stale } }, data: { active: false } });
    cursor = rows[rows.length - 1].id;
    await save();
  }

  // Receipts surface DeviceNotRegistered / delivery errors that tickets accepted.
  if (ticketTokens.size && receiptWaitMs > 0) {
    await (sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(receiptWaitMs);
    const ids = [...ticketTokens.keys()];
    const staleFromReceipts = [];
    for (let i = 0; i < ids.length; i += RECEIPT_BATCH) {
      try {
        const receipts = await fetchExpoPushReceipts(ids.slice(i, i + RECEIPT_BATCH), { fetchImpl });
        for (const [ticketId, receipt] of Object.entries(receipts)) {
          if (String(receipt?.status || '').toLowerCase() !== 'error') continue;
          sent = Math.max(0, sent - 1);
          failed += 1;
          const reason = receipt.details?.error || receipt.message || '';
          if (/DeviceNotRegistered/i.test(reason) && ticketTokens.get(ticketId)) staleFromReceipts.push(ticketTokens.get(ticketId));
          const row = sample.find((d) => d.ticketId === ticketId);
          if (row) Object.assign(row, { status: 'error', receiptStatus: 'error', error: receipt.message || reason || row.error });
        }
      } catch (error) {
        console.warn('[push-campaigns] receipts', error?.message);
      }
    }
    if (staleFromReceipts.length) {
      await db.pushToken.updateMany({ where: { token: { in: staleFromReceipts } }, data: { active: false } });
    }
  }

  progress.done = true;
  const saved = await save({ status: finalStatus(sent), sentAt: now() });
  if (sent > 0) Promise.resolve(logEvent({ source: 'broadcast', key: 'admin-push', title: campaign.title, body: campaign.body })).catch(() => null);
  return { done: true, sent, failed, campaign: saved };
}

/** Oldest QUEUED/SENDING campaign first; expires ones that waited past CAMPAIGN_MAX_AGE_MS. */
export async function nextPushCampaign({ db = prisma, now = new Date() } = {}) {
  const rows = await db.pushCampaign.findMany({
    where: { status: { in: ['QUEUED', 'SENDING'] } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  for (const row of rows) {
    const progress = campaignProgress(row);
    // Rows from the old synchronous sender have no progress marker: never resend them blindly.
    if (!progress) continue;
    if (now.getTime() - new Date(row.createdAt).getTime() > CAMPAIGN_MAX_AGE_MS) {
      await db.pushCampaign.update({
        where: { id: row.id },
        data: {
          status: row.sentCount > 0 ? 'SENT' : 'FAILED',
          sentAt: now,
          data: { payload: campaignPayload(row), deliveries: row.data?.deliveries || [], progress: { ...progress, done: true, reason: 'EXPIRED' } },
        },
      });
      continue;
    }
    return row;
  }
  return null;
}

let running = false;

/** Drains every pending campaign while this instance holds the lease. */
export async function processPushCampaigns({ db = prisma, fetchImpl = fetch, sleep, receiptWaitMs, logEvent = logPushEvent, lease = (ttl) => acquireJobLease(CAMPAIGN_LEASE, ttl) } = {}) {
  if (running) return { skipped: 'busy' };
  running = true;
  try {
    if (!(await lease(LEASE_TTL_MS))) return { skipped: 'lease' };
    let processed = 0;
    for (;;) {
      const campaign = await nextPushCampaign({ db });
      if (!campaign) break;
      const result = await runPushCampaign(campaign, {
        db,
        fetchImpl,
        sleep,
        logEvent,
        ...(receiptWaitMs != null ? { receiptWaitMs } : {}),
        keepLease: () => lease(LEASE_TTL_MS),
      });
      if (result.paused || result.skipped) break;
      processed += 1;
    }
    return { processed };
  } finally {
    running = false;
  }
}

export function kickPushCampaigns() {
  if (process.env.NODE_ENV === 'test' || process.env.PUSH_CAMPAIGNS_DISABLED === 'true') return;
  setImmediate(() => {
    processPushCampaigns().catch((error) => console.warn('[push-campaigns] run failed', error?.message));
  });
}

/** Resumes queued/interrupted campaigns after a restart and picks up ones queued on another instance. */
export function startPushCampaignWorker({ intervalMs = 30 * 1000 } = {}) {
  if (process.env.NODE_ENV === 'test' || process.env.PUSH_CAMPAIGNS_DISABLED === 'true') return null;
  const tick = () => processPushCampaigns().catch((error) => console.warn('[push-campaigns] run failed', error?.message));
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 15 * 1000).unref?.();
  return timer;
}
