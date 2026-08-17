import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { buildSubscriptionDates } from './billing.js';

export function publicPackage(pkg) {
  if (!pkg) return null;
  const monthlyAiLimit = pkg.monthlyAiLimit ?? pkg.dailyAiLimit * 30;
  return {
    id: pkg.id,
    code: pkg.code,
    nameKa: pkg.nameKa,
    nameEn: pkg.nameEn,
    descriptionKa: pkg.descriptionKa,
    monthlyAiLimit,
    dailyAiLimit: pkg.dailyAiLimit,
    unlimited: monthlyAiLimit < 0,
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
      descriptionKa: '90 AI შეკითხვა თვეში. საბაზისო ჩატი და ძირითადი მოდულები.',
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
    const limit = free?.monthlyAiLimit ?? (free?.dailyAiLimit ?? env.FREE_DAILY_AI_LIMIT) * 30;
    return limit < 0 ? Number.POSITIVE_INFINITY : limit;
  }
  const limit = pkg.monthlyAiLimit ?? pkg.dailyAiLimit * 30;
  if (limit < 0) return Number.POSITIVE_INFINITY;
  return limit;
}

/** @deprecated Use resolveMonthlyLimit */
export async function resolveDailyLimit(userId) {
  const monthly = await resolveMonthlyLimit(userId);
  if (!Number.isFinite(monthly)) return Number.POSITIVE_INFINITY;
  return Math.max(1, Math.ceil(monthly / 30));
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
