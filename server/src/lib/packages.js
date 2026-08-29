import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { buildSubscriptionDates } from './billing.js';

/**
 * Canonical monthly AI cap.
 * Some FREE rows stored the daily cap (3) in monthlyAiLimit — that made admin
 * show 11/3 at 100%. If monthly equals a small daily cap, expand to a month.
 */
export function resolvePackageAiLimit(pkg) {
  if (!pkg) {
    return env.FREE_MONTHLY_AI_LIMIT < 0 ? Number.POSITIVE_INFINITY : env.FREE_MONTHLY_AI_LIMIT;
  }
  const monthly = Number(pkg.monthlyAiLimit);
  const daily = Number(pkg.dailyAiLimit);
  if (monthly < 0 || daily < 0) return Number.POSITIVE_INFINITY;
  const monthlySet = Number.isFinite(monthly) && monthly > 0;
  const dailySet = Number.isFinite(daily) && daily > 0;
  if (monthlySet && dailySet && monthly === daily && monthly <= 10) {
    return daily * 30;
  }
  if (monthlySet) return monthly;
  if (dailySet) return daily * 30;
  return env.FREE_MONTHLY_AI_LIMIT;
}

/**
 * Cap the user actually spends against. FREE = 3/day, STANDARD = 50/day.
 * After they hit this number, the window resets 24h later — not at month end.
 */
export function resolveConsumeLimit(pkg) {
  if (!pkg) {
    return env.FREE_DAILY_AI_LIMIT < 0 ? Number.POSITIVE_INFINITY : env.FREE_DAILY_AI_LIMIT;
  }
  const monthly = Number(pkg.monthlyAiLimit);
  const daily = Number(pkg.dailyAiLimit);
  if (monthly < 0 || daily < 0) return Number.POSITIVE_INFINITY;
  if (Number.isFinite(daily) && daily > 0) return daily;
  if (Number.isFinite(monthly) && monthly > 0) return monthly;
  return env.FREE_DAILY_AI_LIMIT;
}

export function publicPackage(pkg) {
  if (!pkg) return null;
  const monthlyAiLimit = resolvePackageAiLimit(pkg);
  const unlimited = !Number.isFinite(monthlyAiLimit);
  return {
    id: pkg.id,
    code: pkg.code,
    nameKa: pkg.nameKa,
    nameEn: pkg.nameEn,
    descriptionKa: pkg.descriptionKa,
    monthlyAiLimit: unlimited ? -1 : monthlyAiLimit,
    dailyAiLimit: pkg.dailyAiLimit,
    unlimited,
    priceGel: pkg.priceGel,
    billingPeriod: 'monthly',
    features: pkg.features ?? {},
    active: pkg.active,
    sortOrder: pkg.sortOrder,
  };
}

export async function ensureFreePackageId() {
  const free = await prisma.package.findUnique({ where: { code: 'FREE' } });
  if (free) return free.id;
  const created = await prisma.package.create({
    data: {
      code: 'FREE',
      nameKa: 'უფასო',
      nameEn: 'Free',
      descriptionKa: '3 AI შეკითხვა დღეში. საბაზისო ჩატი და ძირითადი მოდულები.',
      monthlyAiLimit: env.FREE_MONTHLY_AI_LIMIT,
      dailyAiLimit: env.FREE_DAILY_AI_LIMIT,
      priceGel: 0,
      sortOrder: 1,
      features: {
        doctorChat: true,
        consilium: false,
        labAnalysis: true,
        imaging: false,
        skin: false,
        skincare: false,
        medicationReview: true,
      },
    },
  });
  return created.id;
}

export async function getUserPackage(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { package: true },
  });
  if (!user) return null;

  const expired = Boolean(user.packageExpiresAt && user.packageExpiresAt.getTime() < Date.now());
  if (expired && user.package?.code !== 'FREE') {
    const free = await prisma.package.findUnique({ where: { code: 'FREE' } });
    return { user, package: free, expired: true };
  }

  return { user, package: user.package, expired: false };
}

export async function resolveMonthlyLimit(userId) {
  const { package: pkg, expired } = (await getUserPackage(userId)) ?? {};
  if (!pkg || expired) {
    const free = await prisma.package.findUnique({ where: { code: 'FREE' } });
    return resolvePackageAiLimit(free);
  }
  return resolvePackageAiLimit(pkg);
}

export async function resolveUserConsumeLimit(userId) {
  const { package: pkg, expired } = (await getUserPackage(userId)) ?? {};
  if (!pkg || expired) {
    const free = await prisma.package.findUnique({ where: { code: 'FREE' } });
    return resolveConsumeLimit(free);
  }
  return resolveConsumeLimit(pkg);
}

/** @deprecated Use resolveUserConsumeLimit */
export async function resolveDailyLimit(userId) {
  return resolveUserConsumeLimit(userId);
}

/**
 * Builds Prisma update payload when an admin assigns a package.
 * Paid plans always get a fresh 30-day billing window unless explicit dates are passed.
 */
export function buildPackageAssignment({ packageCode, packageStartedAt, packageExpiresAt }) {
  if (packageCode === 'FREE') {
    return { packageStartedAt: null, packageExpiresAt: null };
  }
  if (packageStartedAt || packageExpiresAt) {
    const started = packageStartedAt ? new Date(packageStartedAt) : buildSubscriptionDates().packageStartedAt;
    const expires = packageExpiresAt
      ? new Date(packageExpiresAt)
      : buildSubscriptionDates(started).packageExpiresAt;
    return { packageStartedAt: started, packageExpiresAt: expires };
  }
  return buildSubscriptionDates();
}
