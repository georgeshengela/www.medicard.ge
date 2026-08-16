import { prisma } from './prisma.js';
import { resolveDailyLimit } from './packages.js';

/** The free tier resets at local midnight in Tbilisi, not UTC. */
const TIMEZONE = 'Asia/Tbilisi';

export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function msUntilReset(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);

  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hour = get('hour') % 24;
  const elapsed = ((hour * 60 + get('minute')) * 60 + get('second')) * 1000;
  return 24 * 60 * 60 * 1000 - elapsed;
}

function shapeUsage(date, used, limit) {
  const unlimited = !Number.isFinite(limit);
  const safeLimit = unlimited ? -1 : limit;
  return {
    date,
    used,
    limit: safeLimit,
    remaining: unlimited ? -1 : Math.max(0, limit - used),
    exceeded: unlimited ? false : used >= limit,
    unlimited,
    resetsInMs: msUntilReset(),
  };
}

export async function getUsage(userId) {
  const date = todayKey();
  const row = await prisma.dailyUsage.findUnique({
    where: { userId_date: { userId, date } },
    select: { count: true },
  });
  const used = row?.count ?? 0;
  const limit = await resolveDailyLimit(userId);
  return shapeUsage(date, used, limit);
}

export async function consumeUsage(userId) {
  const date = todayKey();
  const row = await prisma.dailyUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  const limit = await resolveDailyLimit(userId);
  return shapeUsage(date, row.count, limit);
}
