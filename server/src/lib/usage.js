import { prisma } from './prisma.js';
import { getBillingPeriod } from './billing.js';
import { getUserPackage, resolveConsumeLimit } from './packages.js';
import {
  applyConsume,
  applyExpiration,
  bumpOutOfQuietTbilisi,
  inferResetKind,
  publicResetAt,
  ROLLING_DAILY_KEY,
} from './usageWindow.js';

export { DAY_MS, ROLLING_DAILY_KEY } from './usageWindow.js';

let notifyColumnReady = false;

export async function ensureQuotaNotifyColumn() {
  if (notifyColumnReady) return;
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "PeriodUsage" ADD COLUMN IF NOT EXISTS "notifyAt" TIMESTAMP(3)`);
    notifyColumnReady = true;
  } catch (error) {
    console.warn('[quota] notifyAt column ensure failed', error?.message);
  }
}

export async function getUsage(userId) {
  const synced = await syncWindow(userId);
  return synced.usage;
}

/** Register/login must still return a JWT if quota rows are slow. */
export async function getUsageSafe(userId) {
  try {
    return await getUsage(userId);
  } catch (error) {
    console.warn('[quota] getUsageSafe failed', error?.message);
    return emptyUsage();
  }
}

/** Admin: wipe this user's period counters so the current quota starts at 0 used. */
export async function resetUsage(userId) {
  const { user } = (await getUserPackage(userId)) ?? {};
  if (!user) throw new Error('User not found');
  await prisma.periodUsage.deleteMany({ where: { userId } });
  return getUsage(userId);
}

export async function consumeUsage(userId) {
  const ctx = await loadLimit(userId);
  if (!ctx.user) throw new Error('User not found');
  if (!Number.isFinite(ctx.limit)) return unlimitedUsage();

  const now = new Date();
  const current = await readWindow(userId, ctx.user, ctx.pkg, ctx.limit, now);
  const next = applyConsume(current, ctx.limit, now);
  const row = await persistWindow(userId, next.count, next.resetAt, next.notifyAt);
  return shapeFromRow(row, ctx.limit, now);
}

/**
 * Expire due windows (and return enough context for the refill ping).
 * Safe to call from GET /usage, auth/me, and the background sweeper.
 */
export async function syncWindow(userId, now = new Date()) {
  const ctx = await loadLimit(userId);
  if (!ctx.user) {
    return { usage: emptyUsage(), notifyDue: false, resetKey: null, resetKind: null, userId };
  }
  if (!Number.isFinite(ctx.limit)) {
    return { usage: unlimitedUsage(), notifyDue: false, resetKey: null, resetKind: null, userId };
  }

  const row = await readWindow(userId, ctx.user, ctx.pkg, ctx.limit, now);
  const usage = shapeFromRow(row, ctx.limit, now);
  const notifyAt = row.notifyAt ?? null;
  const notifyDue = Boolean(notifyAt && notifyAt.getTime() <= now.getTime());
  const kind = inferResetKind(row.resetAt) || row.resetKind || (usage.exceeded ? 'lock' : 'calendar');

  return {
    usage,
    notifyDue,
    resetKey: row.resetKey ?? null,
    resetKind: notifyDue ? kind : row.resetKind ?? null,
    limit: ctx.limit,
    userId,
    row,
  };
}

export async function markQuotaNotified(userId) {
  const now = new Date();
  const row = await prisma.periodUsage.findUnique({
    where: { userId_periodKey: { userId, periodKey: ROLLING_DAILY_KEY } },
    select: { count: true, resetAt: true, notifyAt: true },
  });
  if (!row) return;
  const resetAt = row.count > 0 ? row.resetAt : null;
  await persistWindow(userId, row.count, resetAt, null);
  return { clearedAt: now };
}

async function loadLimit(userId) {
  const { user, package: pkg, expired } = (await getUserPackage(userId)) ?? {};
  if (!user) return { user: null, pkg: null, limit: 0 };
  const effectivePkg = expired ? await prisma.package.findUnique({ where: { code: 'FREE' } }) : pkg;
  return { user, pkg: effectivePkg, limit: resolveConsumeLimit(effectivePkg) };
}

async function readWindow(userId, user, pkg, limit, now) {
  await ensureQuotaNotifyColumn();
  let row = await prisma.periodUsage.findUnique({
    where: { userId_periodKey: { userId, periodKey: ROLLING_DAILY_KEY } },
    select: { count: true, resetAt: true, notifyAt: true },
  });

  if (!row) {
    const inherited = await tryInheritExhausted(userId, user, pkg, limit, now);
    if (inherited) row = inherited;
    else return { count: 0, resetAt: null, notifyAt: null, resetKey: null, resetKind: null };
  }

  const next = applyExpiration(row, limit, now);
  if (
    next.count !== row.count ||
    dateMs(next.resetAt) !== dateMs(row.resetAt) ||
    dateMs(next.notifyAt) !== dateMs(row.notifyAt)
  ) {
    const saved = await persistWindow(userId, next.count, next.resetAt, next.notifyAt);
    return { ...saved, resetKey: next.resetKey, resetKind: next.resetKind, expired: next.expired, stale: next.stale };
  }

  return { ...row, resetKey: next.resetKey, resetKind: next.resetKind, expired: false, stale: false };
}

/**
 * Users already stuck on the old calendar-month counter start a 24h lock from now
 * instead of waiting until the 1st.
 */
async function tryInheritExhausted(userId, user, pkg, limit, now) {
  if (!Number.isFinite(limit) || limit <= 0) return null;
  const period = getBillingPeriod(user, pkg);
  const old = await prisma.periodUsage.findUnique({
    where: { userId_periodKey: { userId, periodKey: period.key } },
    select: { count: true },
  });
  if (!old || old.count < limit) return null;

  try {
    return await prisma.periodUsage.create({
      data: {
        userId,
        periodKey: ROLLING_DAILY_KEY,
        count: limit,
        resetAt: new Date(now.getTime() + 86_400_000),
        notifyAt: bumpOutOfQuietTbilisi(new Date(now.getTime() + 86_400_000)),
      },
      select: { count: true, resetAt: true, notifyAt: true },
    });
  } catch {
    return prisma.periodUsage.findUnique({
      where: { userId_periodKey: { userId, periodKey: ROLLING_DAILY_KEY } },
      select: { count: true, resetAt: true, notifyAt: true },
    });
  }
}

async function persistWindow(userId, count, resetAt, notifyAt) {
  await ensureQuotaNotifyColumn();
  return prisma.periodUsage.upsert({
    where: { userId_periodKey: { userId, periodKey: ROLLING_DAILY_KEY } },
    create: { userId, periodKey: ROLLING_DAILY_KEY, count, resetAt, notifyAt },
    update: { count, resetAt, notifyAt },
    select: { count: true, resetAt: true, notifyAt: true },
  });
}

function dateMs(value) {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function shapeFromRow(row, limit, now = new Date()) {
  const resetAt = publicResetAt(row, limit);
  const exceeded = row.count >= limit;
  const resetsInMs = exceeded && resetAt ? Math.max(0, resetAt.getTime() - now.getTime()) : 0;
  const end = resetAt;
  const start = exceeded && resetAt ? new Date(resetAt.getTime() - 86_400_000) : resetAt;

  return shapeUsage({
    used: row.count,
    limit,
    resetsInMs,
    resetAt,
    periodStart: start,
    periodEnd: end,
    resetKind: exceeded ? 'lock' : resetAt ? 'calendar' : null,
    refilled: Boolean(row.expired),
    refilledKey: row.resetKey ?? null,
  });
}

function unlimitedUsage() {
  return shapeUsage({
    used: 0,
    limit: Number.POSITIVE_INFINITY,
    resetsInMs: 0,
    resetAt: null,
    resetKind: null,
  });
}

function emptyUsage() {
  return shapeUsage({
    used: 0,
    limit: 0,
    resetsInMs: 0,
    resetAt: null,
    resetKind: null,
  });
}

function shapeUsage({ used, limit, resetsInMs, resetAt, periodStart = null, periodEnd = null, resetKind = null, refilled = false, refilledKey = null }) {
  const unlimited = !Number.isFinite(limit);
  const safeLimit = unlimited ? -1 : limit;
  const startIso = periodStart instanceof Date ? periodStart.toISOString() : periodStart;
  const endIso = periodEnd instanceof Date ? periodEnd.toISOString() : periodEnd;
  const resetIso = resetAt instanceof Date ? resetAt.toISOString() : resetAt;
  const exceeded = unlimited ? false : used >= limit;

  return {
    date: ROLLING_DAILY_KEY,
    periodKey: ROLLING_DAILY_KEY,
    periodType: exceeded ? 'rolling' : 'calendar',
    periodLabel: exceeded ? '24 საათი' : 'დღე',
    periodStart: startIso ?? null,
    periodEnd: endIso ?? null,
    used,
    limit: safeLimit,
    remaining: unlimited ? -1 : Math.max(0, limit - used),
    exceeded,
    unlimited,
    billingPeriod: 'daily',
    resetsInMs,
    resetAt: resetIso ?? null,
    resetKind: exceeded ? 'lock' : resetKind,
    refilled: Boolean(refilled),
    refilledKey: refilledKey ?? null,
  };
}
