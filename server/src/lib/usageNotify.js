import { prisma } from './prisma.js';
import { sendExpoPush } from './push.js';
import { applyPushTemplate, logPushEvent, templateByKey } from './pushTemplates.js';
import { getRealtimeIo } from './adminRealtime.js';
import { userSocketRoom } from './socketAuth.js';
import { markQuotaNotified, syncWindow, ensureQuotaNotifyColumn } from './usage.js';
import { ROLLING_DAILY_KEY } from './usageWindow.js';

const SWEEP_MS = 30_000;
let timer = null;
let running = false;

export function startQuotaResetSweeper() {
  if (timer) return;
  void ensureQuotaNotifyColumn().then(() => sweepQuotaResets());
  timer = setInterval(() => {
    void sweepQuotaResets();
  }, SWEEP_MS);
  timer.unref?.();
}

export function stopQuotaResetSweeper() {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function sweepQuotaResets(now = new Date()) {
  if (running) return { scanned: 0, notified: 0 };
  running = true;
  try {
    const due = await prisma.periodUsage.findMany({
      where: {
        periodKey: ROLLING_DAILY_KEY,
        OR: [{ AND: [{ resetAt: { lte: now } }, { count: { gt: 0 } }] }, { notifyAt: { lte: now } }],
      },
      select: { userId: true },
      take: 200,
    });

    let notified = 0;
    for (const row of due) {
      try {
        const sent = await processQuotaReset(row.userId, now);
        if (sent) notified += 1;
      } catch (error) {
        console.warn('[quota] reset sweep failed', row.userId, error?.message);
      }
    }
    return { scanned: due.length, notified };
  } finally {
    running = false;
  }
}

export async function processQuotaReset(userId, now = new Date()) {
  const synced = await syncWindow(userId, now);
  if (!synced.notifyDue || synced.usage.unlimited) return false;

  const sent = await notifyQuotaReset(userId, {
    limit: synced.usage.limit,
    remaining: synced.usage.remaining,
    resetKind: synced.resetKind === 'lock' ? 'lock' : 'calendar',
    resetKey: synced.resetKey,
  });
  await markQuotaNotified(userId);
  return sent;
}

export function quotaResetCopy(kind, limit) {
  const key = kind === 'lock' ? 'quota-reset-lock' : 'quota-reset';
  const template = templateByKey([], key) ?? {
    title: 'Medi ისევ შენთანაა ✨',
    body: 'შენი AI ლიმიტი განახლდა — დღეს {limit} შეკითხვა გაქვს. ჰკითხე რაც გინდა 💬',
  };
  return applyPushTemplate(template, { limit: String(limit) });
}

export async function notifyQuotaReset(userId, { limit, remaining, resetKind, resetKey }) {
  const tokens = await prisma.pushToken.findMany({
    where: { userId, active: true },
    select: { token: true },
  });
  const copy = quotaResetCopy(resetKind, limit);
  const data = {
    type: 'quota_reset',
    family: 'quotaReset',
    templateKey: resetKind === 'lock' ? 'quota-reset-lock' : 'quota-reset',
    route: '/chat/DOCTOR',
    resetKey: resetKey || `quota:${Date.now()}`,
    limit,
    remaining,
  };

  const io = getRealtimeIo();
  if (io) {
    io.to(userSocketRoom(userId)).emit('usage:reset', {
      resetKey: data.resetKey,
      resetKind,
      remaining,
      limit,
    });
  }

  if (!tokens.length) return false;

  const result = await sendExpoPush(
    tokens.map((row) => row.token),
    { title: copy.title, body: copy.body, data },
  );

  void logPushEvent({
    source: 'quota',
    key: data.templateKey,
    title: copy.title,
    body: copy.body,
    userId,
  });

  return result.sent > 0;
}
