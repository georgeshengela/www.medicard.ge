import { prisma } from './prisma.js';
import { getBillingPeriod } from './billing.js';
import { getUserPackage, resolveConsumeLimit } from './packages.js';

export const ROLLING_DAILY_KEY = 'roll:daily';
export const DAY_MS = 86_400_000;

export async function getUsage(userId) {
  const { user, package: pkg, expired } = (await getUserPackage(userId)) ?? {};
  if (!user) {
    return shapeUsage({
      used: 0,
      limit: 0,
      resetsInMs: 0,
      resetAt: null,
    });
  }

  const effectivePkg = expired ? await prisma.package.findUnique({ where: { code: 'FREE' } }) : pkg;
  const limit = resolveConsumeLimit(effectivePkg);

  if (!Number.isFinite(limit)) {
    return shapeUsage({
      used: 0,
      limit,
      resetsInMs: 0,
      resetAt: null,
    });
  }

  const row = await readWindow(userId, user, effectivePkg, limit);
  return shapeFromRow(row, limit);
}

/** Admin: wipe this user's period counters so the current quota starts at 0 used. */
export async function resetUsage(userId) {
  const { user } = (await getUserPackage(userId)) ?? {};
  if (!user) throw new Error('User not found');
  await prisma.periodUsage.deleteMany({ where: { userId } });
  return getUsage(userId);
}

export async function consumeUsage(userId) {
  const { user, package: pkg, expired } = (await getUserPackage(userId)) ?? {};
  if (!user) throw new Error('User not found');

  const effectivePkg = expired ? await prisma.package.findUnique({ where: { code: 'FREE' } }) : pkg;
  const limit = resolveConsumeLimit(effectivePkg);

  if (!Number.isFinite(limit)) {
    return shapeUsage({
      used: 0,
      limit,
      resetsInMs: 0,
      resetAt: null,
    });
  }

  const now = new Date();
  const current = await readWindow(userId, user, effectivePkg, limit);
  let count = current.count;
  let resetAt = current.resetAt;

  if (resetAt && resetAt.getTime() <= now.getTime()) {
    count = 0;
    resetAt = null;
  }

  count += 1;
  if (count >= limit && !resetAt) {
    resetAt = new Date(now.getTime() + DAY_MS);
  }

  const row = await persistWindow(userId, count, resetAt);
  return shapeFromRow(row, limit);
}

async function readWindow(userId, user, pkg, limit) {
  const now = new Date();
  let row = await prisma.periodUsage.findUnique({
    where: { userId_periodKey: { userId, periodKey: ROLLING_DAILY_KEY } },
    select: { count: true, resetAt: true },
  });

  if (row && row.resetAt && row.resetAt.getTime() <= now.getTime()) {
    row = await persistWindow(userId, 0, null);
  }

  if (!row) {
    const inherited = await tryInheritExhausted(userId, user, pkg, limit, now);
    if (inherited) row = inherited;
    else return { count: 0, resetAt: null };
  }

  if (row.count >= limit && !row.resetAt) {
    row = await persistWindow(userId, row.count, new Date(now.getTime() + DAY_MS));
  }

  return row;
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
        resetAt: new Date(now.getTime() + DAY_MS),
      },
      select: { count: true, resetAt: true },
    });
  } catch {
    return prisma.periodUsage.findUnique({
      where: { userId_periodKey: { userId, periodKey: ROLLING_DAILY_KEY } },
      select: { count: true, resetAt: true },
    });
  }
}

async function persistWindow(userId, count, resetAt) {
  return prisma.periodUsage.upsert({
    where: { userId_periodKey: { userId, periodKey: ROLLING_DAILY_KEY } },
    create: { userId, periodKey: ROLLING_DAILY_KEY, count, resetAt },
    update: { count, resetAt },
    select: { count: true, resetAt: true },
  });
}

function shapeFromRow(row, limit) {
  const resetAt = row.resetAt ?? null;
  const exceeded = row.count >= limit;
  const resetsInMs = exceeded && resetAt ? Math.max(0, resetAt.getTime() - Date.now()) : 0;
  const end = resetAt;
  const start = resetAt ? new Date(resetAt.getTime() - DAY_MS) : null;

  return shapeUsage({
    used: row.count,
    limit,
    resetsInMs,
    resetAt,
    periodStart: start,
    periodEnd: end,
  });
}

function shapeUsage({ used, limit, resetsInMs, resetAt, periodStart = null, periodEnd = null }) {
  const unlimited = !Number.isFinite(limit);
  const safeLimit = unlimited ? -1 : limit;
  const startIso = periodStart instanceof Date ? periodStart.toISOString() : periodStart;
  const endIso = periodEnd instanceof Date ? periodEnd.toISOString() : periodEnd;
  const resetIso = resetAt instanceof Date ? resetAt.toISOString() : resetAt;

  return {
    date: ROLLING_DAILY_KEY,
    periodKey: ROLLING_DAILY_KEY,
    periodType: 'rolling',
    periodLabel: '24 საათი',
    periodStart: startIso ?? null,
    periodEnd: endIso ?? null,
    used,
    limit: safeLimit,
    remaining: unlimited ? -1 : Math.max(0, limit - used),
    exceeded: unlimited ? false : used >= limit,
    unlimited,
    billingPeriod: 'daily',
    resetsInMs,
    resetAt: resetIso ?? null,
  };
}
