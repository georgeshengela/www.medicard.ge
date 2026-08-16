import { prisma } from './prisma.js';
import { env } from '../config/env.js';

export function publicPackage(pkg) {
  if (!pkg) return null;
  return {
    id: pkg.id,
    code: pkg.code,
    nameKa: pkg.nameKa,
    nameEn: pkg.nameEn,
    descriptionKa: pkg.descriptionKa,
    dailyAiLimit: pkg.dailyAiLimit,
    unlimited: pkg.dailyAiLimit < 0,
    priceGel: pkg.priceGel,
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
      descriptionKa: '3 AI შეკითხვა დღეში.',
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

  // Expired paid plan → fall back to FREE limits for metering.
  if (user.packageExpiresAt && user.packageExpiresAt.getTime() < Date.now()) {
    const free = await prisma.package.findUnique({ where: { code: 'FREE' } });
    return {
      user,
      package: free,
      expired: true,
    };
  }

  return { user, package: user.package, expired: false };
}

export async function resolveDailyLimit(userId) {
  const { package: pkg } = (await getUserPackage(userId)) ?? {};
  if (!pkg) return env.FREE_DAILY_AI_LIMIT;
  if (pkg.dailyAiLimit < 0) return Number.POSITIVE_INFINITY;
  return pkg.dailyAiLimit;
}
