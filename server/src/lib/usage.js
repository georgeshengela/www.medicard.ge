import { randomUUID } from 'node:crypto';
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

/** Concurrent provider starts per account. Cancel refunds the reservation; this bounds overlap. */
export const MAX_AI_IN_FLIGHT_PER_USER = 2;
/** Anti-abuse only. Does not bill. Replay/cancel/fail still do not consume. */
export const AI_START_WINDOW_MS = 10 * 60 * 1000;
export const AI_START_MAX = 30;

const aiStartTimes = new Map();
let quotaColumnsReady = false;

export async function ensureQuotaNotifyColumn() {
  return ensureQuotaColumns();
}

export const AI_RESERVED_STALE_MS = 20 * 60 * 1000;

export async function ensureQuotaColumns() {
  if (quotaColumnsReady) return;
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "PeriodUsage" ADD COLUMN IF NOT EXISTS "notifyAt" TIMESTAMP(3)`);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "PeriodUsage" ADD COLUMN IF NOT EXISTS "reserved" INTEGER NOT NULL DEFAULT 0`,
    );
    await prisma.$executeRawUnsafe(`ALTER TABLE "PeriodUsage" ADD COLUMN IF NOT EXISTS "reservedAt" TIMESTAMP(3)`);
    quotaColumnsReady = true;
  } catch (error) {
    console.warn('[quota] column ensure failed', error?.message);
  }
}

export async function sweepStaleAiReservations(userId, now = new Date()) {
  await ensureQuotaColumns();
  const cutoff = new Date(now.getTime() - AI_RESERVED_STALE_MS);
  await prisma.$executeRaw`
    UPDATE "PeriodUsage"
    SET "reserved" = 0, "reservedAt" = NULL
    WHERE "userId" = ${userId}
      AND "periodKey" = ${ROLLING_DAILY_KEY}
      AND "reserved" > 0
      AND COALESCE("reservedAt", "createdAt") < ${cutoff}
  `;
}

export function noteAiProviderStart(userId) {
  const now = Date.now();
  const prev = (aiStartTimes.get(userId) || []).filter((time) => now - time < AI_START_WINDOW_MS);
  if (prev.length >= AI_START_MAX) return false;
  prev.push(now);
  aiStartTimes.set(userId, prev);
  return true;
}

export function resetAiStartWindowForTests() {
  aiStartTimes.clear();
}

export async function getUsage(userId) {
  const synced = await syncWindow(userId);
  return synced.usage;
}

/** Admin registry only — no window sync, no writes. */
export function peekListUsage(pkg, periodRows = []) {
  const limit = resolveConsumeLimit(pkg);
  const rows = Array.isArray(periodRows) ? periodRows : [];
  const row = rows.find((item) => item.periodKey === ROLLING_DAILY_KEY) || rows[0] || { count: 0, resetAt: null };
  return shapeUsage({
    used: Number(row.count) || 0,
    limit: Number.isFinite(limit) ? limit : Number.POSITIVE_INFINITY,
    resetsInMs: 0,
    resetAt: row.resetAt ?? null,
  });
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
  await sweepStaleAiReservations(userId, now);
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
  await ensureQuotaColumns();
  return prisma.periodUsage.upsert({
    where: { userId_periodKey: { userId, periodKey: ROLLING_DAILY_KEY } },
    create: { userId, periodKey: ROLLING_DAILY_KEY, count, resetAt, notifyAt },
    update: { count, resetAt, notifyAt },
    select: { count: true, resetAt: true, notifyAt: true },
  });
}

async function ensureUsageRow(userId) {
  await ensureQuotaColumns();
  await prisma.$executeRaw`
    INSERT INTO "PeriodUsage" ("id", "userId", "periodKey", "count", "reserved", "createdAt")
    VALUES (${randomUUID()}, ${userId}, ${ROLLING_DAILY_KEY}, 0, 0, ${new Date()})
    ON CONFLICT ("userId", "periodKey") DO NOTHING
  `;
}

/**
 * Holds one in-flight slot. COMPLETE later converts it into count.
 * Replay/cancel/fail must release. User-facing used stays `count` until commit.
 */
export async function reserveAiCredit(userId) {
  const ctx = await loadLimit(userId);
  if (!ctx.user) throw new Error('User not found');
  if (!Number.isFinite(ctx.limit)) {
    return { ok: true, reserved: false, unlimited: true, usage: unlimitedUsage(), reason: null };
  }

  if (!noteAiProviderStart(userId)) {
    const usage = await getUsage(userId);
    return { ok: false, reserved: false, unlimited: false, usage, reason: 'RATE_LIMITED' };
  }

  const now = new Date();
  await readWindow(userId, ctx.user, ctx.pkg, ctx.limit, now);
  await ensureUsageRow(userId);

  const rows = await prisma.$queryRaw`
    UPDATE "PeriodUsage"
    SET "reserved" = "reserved" + 1,
        "reservedAt" = ${now}
    WHERE "userId" = ${userId}
      AND "periodKey" = ${ROLLING_DAILY_KEY}
      AND "count" + "reserved" < ${ctx.limit}
      AND "reserved" < ${MAX_AI_IN_FLIGHT_PER_USER}
    RETURNING "count", "reserved", "resetAt", "notifyAt"
  `;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    const usage = await getUsage(userId);
    return { ok: false, reserved: false, unlimited: false, usage, reason: 'DAILY_LIMIT_REACHED' };
  }
  return {
    ok: true,
    reserved: true,
    unlimited: false,
    usage: shapeFromRow(row, ctx.limit, now),
    reason: null,
  };
}

export async function commitAiCredit(userId, db = prisma) {
  const ctx = await loadLimit(userId);
  if (!ctx.user) throw new Error('User not found');
  if (!Number.isFinite(ctx.limit)) return unlimitedUsage();
  const now = new Date();
  const rows = await db.$queryRaw`
    UPDATE "PeriodUsage"
    SET "count" = "count" + 1,
        "reserved" = GREATEST("reserved" - 1, 0),
        "reservedAt" = CASE WHEN GREATEST("reserved" - 1, 0) = 0 THEN NULL ELSE "reservedAt" END
    WHERE "userId" = ${userId}
      AND "periodKey" = ${ROLLING_DAILY_KEY}
      AND "reserved" > 0
    RETURNING "count", "reserved", "resetAt", "notifyAt"
  `;
  let row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    if (db !== prisma) {
      throw new Error('AI_CREDIT_COMMIT_WITHOUT_RESERVATION');
    }
    return consumeUsage(userId);
  }
  const next = applyConsume({ count: Number(row.count) - 1, resetAt: row.resetAt, notifyAt: row.notifyAt }, ctx.limit, now);
  const saved = await db.periodUsage.upsert({
    where: { userId_periodKey: { userId, periodKey: ROLLING_DAILY_KEY } },
    create: { userId, periodKey: ROLLING_DAILY_KEY, count: next.count, resetAt: next.resetAt, notifyAt: next.notifyAt },
    update: { count: next.count, resetAt: next.resetAt, notifyAt: next.notifyAt },
    select: { count: true, resetAt: true, notifyAt: true },
  });
  return shapeFromRow({ ...saved, reserved: row.reserved }, ctx.limit, now);
}

export async function releaseAiCredit(userId) {
  const ctx = await loadLimit(userId);
  if (!ctx.user || !Number.isFinite(ctx.limit)) return;
  await prisma.$executeRaw`
    UPDATE "PeriodUsage"
    SET "reserved" = GREATEST("reserved" - 1, 0),
        "reservedAt" = CASE WHEN GREATEST("reserved" - 1, 0) = 0 THEN NULL ELSE "reservedAt" END
    WHERE "userId" = ${userId}
      AND "periodKey" = ${ROLLING_DAILY_KEY}
      AND "reserved" > 0
  `;
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
