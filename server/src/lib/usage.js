import { prisma } from './prisma.js';
import { getBillingPeriod } from './billing.js';
import { getUserPackage, resolveMonthlyLimit } from './packages.js';

export async function getUsage(userId) {
  const { user, package: pkg, expired } = (await getUserPackage(userId)) ?? {};
  if (!user) {
    return shapeUsage({
      periodKey: 'unknown',
      periodType: 'calendar',
      periodLabel: 'თვე',
      periodStart: null,
      periodEnd: null,
      used: 0,
      limit: 0,
      resetsInMs: 0,
    });
  }

  const effectivePkg = expired ? await prisma.package.findUnique({ where: { code: 'FREE' } }) : pkg;
  const period = getBillingPeriod(user, effectivePkg);
  const row = await prisma.periodUsage.findUnique({
    where: { userId_periodKey: { userId, periodKey: period.key } },
    select: { count: true },
  });
  const used = row?.count ?? 0;
  const limit = await resolveMonthlyLimit(userId);

  return shapeUsage({
    periodKey: period.key,
    periodType: period.type,
    periodLabel: period.label,
    periodStart: period.start?.toISOString() ?? null,
    periodEnd: period.end?.toISOString() ?? null,
    used,
    limit,
    resetsInMs: period.resetsInMs,
  });
}

export async function consumeUsage(userId) {
  const { user, package: pkg, expired } = (await getUserPackage(userId)) ?? {};
  if (!user) throw new Error('User not found');

  const effectivePkg = expired ? await prisma.package.findUnique({ where: { code: 'FREE' } }) : pkg;
  const period = getBillingPeriod(user, effectivePkg);
  const row = await prisma.periodUsage.upsert({
    where: { userId_periodKey: { userId, periodKey: period.key } },
    create: { userId, periodKey: period.key, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  const limit = await resolveMonthlyLimit(userId);

  return shapeUsage({
    periodKey: period.key,
    periodType: period.type,
    periodLabel: period.label,
    periodStart: period.start?.toISOString() ?? null,
    periodEnd: period.end?.toISOString() ?? null,
    used: row.count,
    limit,
    resetsInMs: period.resetsInMs,
  });
}

function shapeUsage({ periodKey, periodType, periodLabel, periodStart, periodEnd, used, limit, resetsInMs }) {
  const unlimited = !Number.isFinite(limit);
  const safeLimit = unlimited ? -1 : limit;
  return {
    date: periodKey,
    periodKey,
    periodType,
    periodLabel,
    periodStart,
    periodEnd,
    used,
    limit: safeLimit,
    remaining: unlimited ? -1 : Math.max(0, limit - used),
    exceeded: unlimited ? false : used >= limit,
    unlimited,
    billingPeriod: 'monthly',
    resetsInMs,
  };
}
