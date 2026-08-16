import { env } from '../config/env.js';
import { prisma } from './prisma.js';

/** The free tier resets at local midnight in Tbilisi, not UTC. */
const TIMEZONE = 'Asia/Tbilisi';

export function todayKey(now = new Date()) {
  // en-CA formats as YYYY-MM-DD, which is exactly the schema's `date` format.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Milliseconds until the counter resets, for the client-side countdown. */
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

export async function getUsage(userId) {
  const date = todayKey();
  const row = await prisma.dailyUsage.findUnique({
    where: { userId_date: { userId, date } },
    select: { count: true },
  });

  const used = row?.count ?? 0;
  const limit = env.FREE_DAILY_AI_LIMIT;

  return {
    date,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    exceeded: used >= limit,
    resetsInMs: msUntilReset(),
  };
}

/** Atomically records one consumed AI generation and returns the refreshed quota. */
export async function consumeUsage(userId) {
  const date = todayKey();
  const row = await prisma.dailyUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  const limit = env.FREE_DAILY_AI_LIMIT;
  return {
    date,
    used: row.count,
    limit,
    remaining: Math.max(0, limit - row.count),
    exceeded: row.count >= limit,
    resetsInMs: msUntilReset(),
  };
}
