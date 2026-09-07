import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { publicPackage, buildPackageAssignment } from '../lib/packages.js';
import { renewSubscriptionDates } from '../lib/billing.js';
import { getAppSettings, publicAppSettings } from '../lib/settings.js';
import { getMobileAppVersion } from '../lib/mobileAppVersion.js';
import { getUsage, resetUsage } from '../lib/usage.js';
import { getPushStats, resolveSegmentTokens, sendExpoPush } from '../lib/push.js';
import {
  listPushEvents,
  listPushTemplates,
  logPushEvent,
  resetPushTemplate,
  savePushTemplate,
} from '../lib/pushTemplates.js';
import { toDateOnly, calculateAge } from '../lib/patient.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { getProviderBalances } from '../lib/providerBalances.js';
import { getAiQualityStats } from '../lib/aiTelemetry.js';
import { getEvalRun, listEvalRuns, runQualityScan } from '../lib/aiQuality.js';
import {
  getPharmacyAdminStats,
  isSyncRunning,
  listSyncRuns,
  syncAllPharmacySources,
  syncPharmacySource,
} from '../lib/pharmacy/sync.js';
import { getSmsBalance, normalizeSmsDestination, sendSms } from '../lib/sms.js';
import { deleteUserAccount } from '../lib/deleteUser.js';
import {
  getFeatureAnalytics,
  getMediAnalytics,
  getNotificationAnalytics,
  getOverviewAnalytics,
  getRetentionAnalytics,
  getSystemHealth,
  getUserActivityAnalytics,
  getVersionAnalytics,
  getDataQuality,
  getFeatureRetentionAnalytics,
  getPermissionAnalytics,
  getWeeklyInsightMedication,
} from '../lib/adminAnalytics.js';
import { getNotificationDecision, listNotificationDecisions } from '../lib/notificationDecisions.js';
import { listNotificationOutcomes } from '../lib/notificationOutcomes.js';
import { loadActiveUserIds, loadAppActivityRows, loadLatestActivityMap } from '../lib/appActivity.js';
import { getAppVersionPolicy } from '../lib/appVersionPolicy.js';
import { isAppVersionBelow } from '../lib/appVersion.js';
import { loadPermissionRows } from '../lib/notificationPermission.js';
import { parseAnalyticsRange } from '../lib/adminAnalyticsRange.js';
import { listAdminAudit, writeAdminAudit } from '../lib/adminAudit.js';
import { enrichDecisions } from '../lib/clientContext.js';
import { getUserInvestigation } from '../lib/adminUserInvestigation.js';
import { tbilisiYmd } from '../lib/checkIn.js';
import { addDaysYmd } from '../lib/adminAnalyticsRange.js';

function emptyDayMap(startToday, days = 14) {
  const map = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(startToday.getTime() - i * 86400000);
    map.set(day.toISOString().slice(0, 10), 0);
  }
  return map;
}

function bucketByDay(startToday, rows) {
  const map = emptyDayMap(startToday);
  for (const row of rows) {
    const key = new Date(row.createdAt).toISOString().slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([day, count]) => ({ day, count }));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Shared Users list + CSV export filter (same semantics). */
async function buildAdminUsersWhere(query = {}) {
  const q = String(query.q ?? '').trim();
  const status = String(query.status ?? '').trim().toUpperCase();
  const packageCode = String(query.package ?? '').trim().toUpperCase();
  const activity = String(query.activity ?? '').trim();
  const appVersion = String(query.appVersion ?? '').trim();
  const today = tbilisiYmd();
  const none = ['__none__'];

  const orIdentity = q
    ? [
        { email: { contains: q, mode: 'insensitive' } },
        { fullName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        ...(UUID_RE.test(q) ? [{ id: q }] : []),
        ...(!UUID_RE.test(q) && q.length >= 8 ? [{ id: { startsWith: q } }] : []),
      ]
    : null;

  const where = {
    AND: [
      orIdentity ? { OR: orIdentity } : {},
      status === 'ACTIVE' || status === 'BLOCKED' ? { status } : {},
      packageCode ? { package: { code: packageCode } } : {},
      activity === 'medi' ? { chats: { some: {} } } : {},
      activity === 'meds' ? { medications: { some: {} } } : {},
      activity === 'cycle' ? { cycleProfile: { is: {} } } : {},
      activity === 'ios' || activity === 'android'
        ? { pushTokens: { some: { active: true, platform: activity } } }
        : {},
    ],
  };

  if (activity === 'today') {
    const ids = await loadActiveUserIds(today, today);
    where.AND.push({ id: { in: ids.length ? ids : none } });
  } else if (activity === 'inactive7') {
    const ids = await loadActiveUserIds(addDaysYmd(today, -6), today);
    where.AND.push({ id: { notIn: ids } });
  } else if (activity === 'inactive30') {
    const ids = await loadActiveUserIds(addDaysYmd(today, -29), today);
    where.AND.push({ id: { notIn: ids } });
  } else if (activity === 'notif_disabled') {
    const perms = await loadPermissionRows();
    const ids = perms.filter((row) => row.status === 'disabled').map((row) => row.userId);
    where.AND.push({ id: { in: ids.length ? ids : none } });
  } else if (activity === 'outdated') {
    const policy = await getAppVersionPolicy();
    const rows = await loadAppActivityRows(addDaysYmd(today, -90), today);
    const latest = new Map();
    for (const row of rows) {
      const prev = latest.get(row.userId);
      if (!prev || new Date(row.lastAt) > new Date(prev.lastAt)) latest.set(row.userId, row);
    }
    const ids = [...latest.values()]
      .filter((row) => row.appVersion && policy.currentRecommendedVersion && isAppVersionBelow(row.appVersion, policy.currentRecommendedVersion))
      .map((row) => row.userId);
    where.AND.push({ id: { in: ids.length ? ids : none } });
  }

  if (appVersion) {
    const rows = await loadAppActivityRows(addDaysYmd(today, -90), today);
    const ids = [...new Set(rows.filter((row) => row.appVersion === appVersion).map((row) => row.userId))];
    where.AND.push({ id: { in: ids.length ? ids : none } });
  }

  return where;
}


export const adminRouter = Router();

function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, email: admin.email, role: 'admin' }, env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

function adminAppSettings(settings) {
  return {
    ...publicAppSettings(settings),
    qaOtpEnabled: Boolean(settings.qaOtpEnabled),
    mobileAppVersion: getMobileAppVersion(),
  };
}

function adminUserRow(user, usage) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    gender: user.gender,
    birthDate: toDateOnly(user.birthDate),
    age: calculateAge(user.birthDate),
    status: user.status,
    adminNote: user.adminNote,
    package: publicPackage(user.package),
    packageStartedAt: user.packageStartedAt,
    packageExpiresAt: user.packageExpiresAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastCheckInDate: toDateOnly(user.lastCheckInDate),
    lastActiveAt: user.lastActiveAt || toDateOnly(user.lastCheckInDate),
    appVersion: user.appVersion ?? null,
    notificationPermission: user.notificationPermission ?? null,
    platform: user.platform ?? null,
    hasCycle: Boolean(user.hasCycle),
    counts: {
      records: user._count?.records ?? 0,
      chats: user._count?.chats ?? 0,
      medications: user._count?.medications ?? 0,
    },
    usage: usage ?? null,
  };
}

adminRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(1),
      })
      .parse(req.body);

    const admin = await prisma.admin.findUnique({ where: { email: body.email } });
    const valid = admin ? await bcrypt.compare(body.password, admin.passwordHash) : false;
    if (!admin || !valid) {
      return res.status(401).json({ error: 'ელ-ფოსტა ან პაროლი არასწორია.' });
    }

    return res.json({
      token: signAdminToken(admin),
      admin: { id: admin.id, email: admin.email, fullName: admin.fullName },
    });
  }),
);

adminRouter.get(
  '/me',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({ admin: req.admin });
  }),
);

adminRouter.get(
  '/stats',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startWeek = new Date(startToday.getTime() - 6 * 86400000);
    const startMonth = new Date(startToday.getTime() - 29 * 86400000);
    const trendStart = new Date(startToday.getTime() - 13 * 86400000);

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [users, blocked, records, chats, medications, packages, newToday, newWeek, newMonth, withPhone, genderGroups, trendRows, aiTrendRows, chatTrendRows, recordTrendRows, aiTotal, aiLast24h, aiLast7d, aiErrors24h, smsTotal, smsLast24h, smsFailed, visits, cycleProfiles, pushTokens, catalogProducts, pushSentAgg, pushSent24hAgg] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'BLOCKED' } }),
      prisma.medicalRecord.count(),
      prisma.chatSession.count(),
      prisma.medicationSchedule.count(),
      prisma.package.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.user.count({ where: { createdAt: { gte: startToday } } }),
      prisma.user.count({ where: { createdAt: { gte: startWeek } } }),
      prisma.user.count({ where: { createdAt: { gte: startMonth } } }),
      prisma.user.count({ where: { phone: { not: null } } }),
      prisma.user.groupBy({ by: ['gender'], _count: { _all: true } }),
      prisma.user.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      prisma.aiInteraction.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      prisma.chatSession.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      prisma.medicalRecord.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
      prisma.aiInteraction.count(),
      prisma.aiInteraction.count({ where: { createdAt: { gte: since24h } } }),
      prisma.aiInteraction.count({ where: { createdAt: { gte: since7d } } }),
      prisma.aiInteraction.count({ where: { createdAt: { gte: since24h }, status: 'ERROR' } }),
      prisma.smsLog.count(),
      prisma.smsLog.count({ where: { createdAt: { gte: since24h } } }),
      prisma.smsLog.count({ where: { status: 'FAILED' } }),
      prisma.doctorVisit.count(),
      prisma.cycleProfile.count(),
      prisma.pushToken.count(),
      prisma.catalogProduct.count(),
      prisma.pushCampaign.aggregate({ _sum: { sentCount: true } }),
      prisma.pushCampaign.aggregate({
        where: { sentAt: { gte: since24h } },
        _sum: { sentCount: true },
      }),
    ]);

    const byPackage = await Promise.all(
      packages.map(async (pkg) => ({
        code: pkg.code,
        nameKa: pkg.nameKa,
        users: await prisma.user.count({ where: { packageId: pkg.id, status: 'ACTIVE' } }),
      })),
    );

    const gender = { male: 0, female: 0, other: 0, unknown: 0 };
    for (const row of genderGroups) {
      const n = row._count?._all ?? 0;
      const key = String(row.gender || '').toUpperCase();
      if (key === 'MALE') gender.male += n;
      else if (key === 'FEMALE') gender.female += n;
      else if (key === 'OTHER') gender.other += n;
      else gender.unknown += n;
    }

    const trend = bucketByDay(startToday, trendRows);
    const aiTrend = bucketByDay(startToday, aiTrendRows);
    const chatTrend = bucketByDay(startToday, chatTrendRows);
    const recordTrend = bucketByDay(startToday, recordTrendRows);

    res.json({
      users: {
        total: users,
        blocked,
        active: users - blocked,
        newToday,
        newWeek,
        newMonth,
        withPhone,
        gender,
        trend,
      },
      records,
      chats,
      medications,
      packages: byPackage,
      activity: {
        visits,
        cycleProfiles,
        pushTokens,
        pushSent: pushSentAgg._sum.sentCount ?? 0,
        pushLast24h: pushSent24hAgg._sum.sentCount ?? 0,
        catalogProducts,
        smsTotal,
        smsLast24h,
        smsFailed,
        aiTotal,
        aiLast24h,
        aiLast7d,
        aiErrors24h,
      },
      trends: {
        signups: trend,
        ai: aiTrend,
        chats: chatTrend,
        records: recordTrend,
      },
      settings: adminAppSettings(await getAppSettings()),
    });
  }),
);

adminRouter.get(
  '/balances',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const fresh = String(req.query.fresh ?? '') === '1';
    res.json(await getProviderBalances({ fresh }));
  }),
);

adminRouter.get(
  '/users',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const take = Math.min(Number(req.query.limit) || 50, 200);
    const skip = Math.max(Number(req.query.offset) || 0, 0);
    const where = await buildAdminUsersWhere(req.query);

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: {
          package: true,
          _count: { select: { records: true, chats: true, medications: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ]);

    const ids = users.map((user) => user.id);
    const [tokens, cycles, activityMap, permissions] = ids.length
      ? await Promise.all([
          prisma.pushToken.findMany({
            where: { userId: { in: ids }, active: true },
            select: { userId: true, platform: true, lastSeenAt: true },
            orderBy: { lastSeenAt: 'desc' },
          }),
          prisma.cycleProfile.findMany({
            where: { userId: { in: ids } },
            select: { userId: true },
          }),
          loadLatestActivityMap(ids),
          loadPermissionRows(),
        ])
      : [[], [], new Map(), []];
    const platformByUser = new Map();
    for (const token of tokens) {
      if (!platformByUser.has(token.userId)) platformByUser.set(token.userId, token.platform);
    }
    const cycleUsers = new Set(cycles.map((row) => row.userId));
    const permByUser = new Map(permissions.map((row) => [row.userId, row.status]));

    const rows = await Promise.all(
      users.map(async (user) => {
        const activity = activityMap.get(user.id);
        return adminUserRow(
          {
            ...user,
            platform: activity?.platform || platformByUser.get(user.id) || null,
            hasCycle: cycleUsers.has(user.id),
            lastActiveAt: activity?.lastAt || null,
            appVersion: activity?.appVersion || null,
            notificationPermission: permByUser.get(user.id) || 'unknown',
          },
          await getUsage(user.id),
        );
      }),
    );

    res.json({ total, users: rows });
  }),
);

adminRouter.get(
  '/users/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        package: true,
        _count: { select: { records: true, chats: true, medications: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა.' });
    const bounds = parseAnalyticsRange({
      range: req.query.range || '30d',
      from: req.query.from,
      to: req.query.to,
    });
    const investigation = await getUserInvestigation(user.id, bounds);
    res.json({
      user: adminUserRow(
        {
          ...user,
          platform: investigation.activity?.platform || investigation.overview?.platform || null,
          hasCycle: Boolean(investigation.product?.hasCycle),
        },
        await getUsage(user.id),
      ),
      activity: investigation.activity,
      product: investigation.product,
      notifications: {
        permission: investigation.notifications?.permission || 'unknown',
        selectedFrequency: investigation.notifications?.preference?.selectedFrequency || null,
        baseDailyCap: investigation.notifications?.brain?.baseDailyCap ?? null,
        adaptiveDailyCap: investigation.notifications?.brain?.adaptiveDailyCap ?? null,
        recentDecisionIds: (investigation.notifications?.recentDecisions || []).map((row) => row.decisionId),
        telemetry: investigation.notifications?.telemetry || null,
      },
      devices: investigation.devices,
      decisions: investigation.notifications?.recentDecisions || [],
      investigation,
    });
  }),
);

adminRouter.patch(
  '/users/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        fullName: z.string().trim().min(2).max(120).optional(),
        email: z.string().trim().toLowerCase().email().optional(),
        phone: z.string().trim().nullable().optional(),
        status: z.enum(['ACTIVE', 'BLOCKED']).optional(),
        adminNote: z.string().max(2000).nullable().optional(),
        packageCode: z.enum(['FREE', 'STANDARD', 'ULTIMATE']).optional(),
        packageStartedAt: z.string().datetime().nullable().optional(),
        packageExpiresAt: z.string().datetime().nullable().optional(),
      })
      .parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { package: true },
    });
    if (!existing) return res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა.' });

    const data = {};
    if (body.fullName !== undefined) data.fullName = body.fullName;
    if (body.email !== undefined) data.email = body.email;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.status !== undefined) data.status = body.status;
    if (body.adminNote !== undefined) data.adminNote = body.adminNote;

    if (body.packageCode) {
      const pkg = await prisma.package.findUnique({ where: { code: body.packageCode } });
      if (!pkg) return res.status(400).json({ error: 'პაკეტი ვერ მოიძებნა.' });
      data.packageId = pkg.id;
      Object.assign(
        data,
        buildPackageAssignment({
          packageCode: body.packageCode,
          packageStartedAt: body.packageStartedAt,
          packageExpiresAt: body.packageExpiresAt,
        }),
      );
    } else {
      if (body.packageStartedAt !== undefined) {
        data.packageStartedAt = body.packageStartedAt ? new Date(body.packageStartedAt) : null;
      }
      if (body.packageExpiresAt !== undefined) {
        data.packageExpiresAt = body.packageExpiresAt ? new Date(body.packageExpiresAt) : null;
      }
    }

    try {
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data,
        include: {
          package: true,
          _count: { select: { records: true, chats: true, medications: true } },
        },
      });
      if (body.status && body.status !== existing.status) {
        await writeAdminAudit({
          admin: req.admin,
          action: 'user.status',
          targetType: 'user',
          targetId: user.id,
          previousValue: { status: existing.status },
          newValue: { status: user.status },
        });
      }
      res.json({ user: adminUserRow(user, await getUsage(user.id)) });
    } catch (error) {
      if (error?.code === 'P2002') {
        return res.status(409).json({ error: 'ელ-ფოსტა ან ტელეფონი უკვე გამოყენებულია.' });
      }
      throw error;
    }
  }),
);

adminRouter.post(
  '/users/:id/block',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: 'BLOCKED' },
      include: { package: true, _count: { select: { records: true, chats: true, medications: true } } },
    });
    res.json({ user: adminUserRow(user, await getUsage(user.id)) });
  }),
);

adminRouter.post(
  '/users/:id/unblock',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' },
      include: { package: true, _count: { select: { records: true, chats: true, medications: true } } },
    });
    res.json({ user: adminUserRow(user, await getUsage(user.id)) });
  }),
);

adminRouter.delete(
  '/users/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await deleteUserAccount(req.params.id);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({ ok: true, deleted: result.deleted });
  }),
);

adminRouter.get(
  '/packages',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const packages = await prisma.package.findMany({ orderBy: { sortOrder: 'asc' } });
    const withCounts = await Promise.all(
      packages.map(async (pkg) => ({
        ...publicPackage(pkg),
        userCount: await prisma.user.count({ where: { packageId: pkg.id } }),
      })),
    );
    res.json({ packages: withCounts });
  }),
);

adminRouter.post(
  '/users/:id/renew',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { package: true },
    });
    if (!user) return res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა.' });
    if (!user.package || user.package.code === 'FREE') {
      return res.status(400).json({ error: 'განახლება მხოლოდ გადახდილი პაკეტისთვისაა.' });
    }

    const dates = renewSubscriptionDates(user);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: dates,
      include: {
        package: true,
        _count: { select: { records: true, chats: true, medications: true } },
      },
    });

    res.json({ user: adminUserRow(updated, await getUsage(updated.id)) });
  }),
);

adminRouter.post(
  '/users/:id/reset-usage',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        package: true,
        _count: { select: { records: true, chats: true, medications: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'მომხმარებელი ვერ მოიძებნა.' });
    const usage = await resetUsage(user.id);
    res.json({ user: adminUserRow(user, usage) });
  }),
);

adminRouter.patch(
  '/packages/:code',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const code = String(req.params.code).toUpperCase();
    const body = z
      .object({
        nameKa: z.string().min(1).max(80).optional(),
        nameEn: z.string().min(1).max(80).optional(),
        descriptionKa: z.string().min(1).max(500).optional(),
        monthlyAiLimit: z.number().int().min(-1).max(1_000_000).optional(),
        dailyAiLimit: z.number().int().min(-1).max(100_000).optional(),
        priceGel: z.number().min(0).max(10_000).optional(),
        features: z.record(z.string(), z.boolean()).optional(),
        active: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
      .parse(req.body);

    const pkg = await prisma.package.update({
      where: { code },
      data: body,
    });
    res.json({ package: publicPackage(pkg) });
  }),
);

adminRouter.get(
  '/settings',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json({ settings: adminAppSettings(await getAppSettings()) });
  }),
);

adminRouter.patch(
  '/settings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        maintenanceMode: z.boolean().optional(),
        maintenanceMessage: z.string().min(3).max(500).optional(),
        minAppVersion: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
        forceUpdate: z.boolean().optional(),
        allowRegistrations: z.boolean().optional(),
        qaOtpEnabled: z.boolean().optional(),
        supportEmail: z.string().email().optional(),
      })
      .parse(req.body);

    const before = await getAppSettings();
    const settings = await prisma.appSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...body },
      update: body,
    });
    await writeAdminAudit({
      admin: req.admin,
      action: 'settings.update',
      targetType: 'settings',
      targetId: 'default',
      previousValue: {
        maintenanceMode: before.maintenanceMode,
        forceUpdate: before.forceUpdate,
        allowRegistrations: before.allowRegistrations,
        minAppVersion: before.minAppVersion,
        qaOtpEnabled: before.qaOtpEnabled,
      },
      newValue: body,
    });
    res.json({ settings: adminAppSettings(settings) });
  }),
);

adminRouter.get(
  '/push/stats',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getPushStats());
  }),
);

adminRouter.get(
  '/push/campaigns',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const campaigns = await prisma.pushCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { createdBy: { select: { email: true, fullName: true } } },
    });
    res.json({ campaigns });
  }),
);

adminRouter.post(
  '/push/campaigns',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(500),
        segment: z.enum(['ALL', 'ACTIVE', 'FREE', 'STANDARD', 'ULTIMATE']).default('ALL'),
        data: z.record(z.string(), z.string()).optional(),
      })
      .parse(req.body);

    const tokens = await resolveSegmentTokens(body.segment);
    const campaign = await prisma.pushCampaign.create({
      data: {
        title: body.title,
        body: body.body,
        data: body.data ?? {},
        segment: body.segment,
        status: 'SENDING',
        targetCount: tokens.length,
        createdById: req.admin.id,
      },
    });

    if (!tokens.length) {
      const failed = await prisma.pushCampaign.update({
        where: { id: campaign.id },
        data: { status: 'FAILED', failedCount: 0, sentAt: new Date() },
      });
      return res.status(422).json({
        error: 'ამ სეგმენტში აქტიური push მოწყობილობა არ მოიძებნა.',
        campaign: failed,
      });
    }

    const result = await sendExpoPush(tokens, {
      title: body.title,
      body: body.body,
      data: { ...(body.data ?? {}), campaignId: campaign.id },
    });

    const saved = await prisma.pushCampaign.update({
      where: { id: campaign.id },
      data: {
        status: result.failed && !result.sent ? 'FAILED' : 'SENT',
        sentCount: result.sent,
        failedCount: result.failed,
        sentAt: new Date(),
        data: {
          ...(body.data ?? {}),
          tickets: result.tickets,
          deliveries: result.deliveries,
        },
      },
    });

    void logPushEvent({
      source: 'broadcast',
      key: 'admin-push',
      title: saved.title,
      body: saved.body,
    });

    res.status(201).json({ campaign: saved, delivery: result });
  }),
);

adminRouter.get(
  '/push/templates',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json({ templates: await listPushTemplates() });
  }),
);

adminRouter.put(
  '/push/templates/:key',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { key } = z.object({ key: z.string().trim().min(1).max(80) }).parse(req.params);
    const body = z
      .object({
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(500),
      })
      .parse(req.body);
    try {
      const previous = (await listPushTemplates()).find((row) => row.key === key);
      await savePushTemplate(key, body);
      await writeAdminAudit({
        admin: req.admin,
        action: 'push.template.save',
        targetType: 'pushTemplate',
        targetId: key,
        previousValue: previous ? { title: previous.title, body: previous.body } : null,
        newValue: body,
      });
    } catch (error) {
      if (error?.message === 'unknown_template') {
        return res.status(404).json({ error: 'შაბლონი ვერ მოიძებნა.' });
      }
      if (error?.code === 'invalid_template') {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
    res.json({ templates: await listPushTemplates() });
  }),
);

adminRouter.delete(
  '/push/templates/:key',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { key } = z.object({ key: z.string().trim().min(1).max(80) }).parse(req.params);
    await resetPushTemplate(key);
    await writeAdminAudit({
      admin: req.admin,
      action: 'push.template.reset',
      targetType: 'pushTemplate',
      targetId: key,
    });
    res.json({ templates: await listPushTemplates() });
  }),
);

adminRouter.get(
  '/push/events',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json({ events: await listPushEvents(80) });
  }),
);

adminRouter.get(
  '/ai/stats',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getAiQualityStats());
  }),
);

adminRouter.get(
  '/ai/interactions',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(30),
        offset: z.coerce.number().int().min(0).default(0),
        mode: z.string().optional(),
        status: z.enum(['OK', 'ERROR']).optional(),
      })
      .parse(req.query);

    const where = {
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, interactions] = await Promise.all([
      prisma.aiInteraction.count({ where }),
      prisma.aiInteraction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          feedback: { select: { rating: true, comment: true } },
        },
      }),
    ]);

    res.json({ total, interactions, limit: query.limit, offset: query.offset });
  }),
);

adminRouter.get(
  '/ai/interactions/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const interaction = await prisma.aiInteraction.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, fullName: true, email: true, gender: true, birthDate: true } },
        feedback: true,
        evalResults: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!interaction) return res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
    res.json({ interaction });
  }),
);

adminRouter.post(
  '/ai/scan',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({ sampleSize: z.number().int().min(5).max(40).default(20) })
      .parse(req.body ?? {});

    const { run, results } = await runQualityScan({
      sampleSize: body.sampleSize,
      adminId: req.admin.id,
    });
    res.status(201).json({ run, results });
  }),
);

adminRouter.get(
  '/ai/eval-runs',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const runs = await listEvalRuns(20);
    res.json({ runs });
  }),
);

adminRouter.get(
  '/ai/eval-runs/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const run = await getEvalRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'სკანი ვერ მოიძებნა.' });
    res.json({ run });
  }),
);

adminRouter.get(
  '/pharmacy/stats',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const stats = await getPharmacyAdminStats();
    res.json(stats);
  }),
);

adminRouter.get(
  '/pharmacy/sync-runs',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(req.query);

    const data = await listSyncRuns(query);
    res.json(data);
  }),
);

adminRouter.post(
  '/pharmacy/sync',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        source: z.enum(['ALL', 'PHARMADEPOT', 'AVERSI', 'PSP']).default('ALL'),
        maxPages: z.number().int().min(1).max(500).optional(),
      })
      .parse(req.body ?? {});

    if (await isSyncRunning()) {
      return res.status(409).json({ error: 'სინქრონიზაცია უკვე მიმდინარეობს.' });
    }

    const opts = {};
    if (body.maxPages) opts.maxPages = body.maxPages;

    res.status(202).json({ ok: true, message: 'სინქრონიზაცია დაიწყო', source: body.source });

    setImmediate(async () => {
      try {
        if (body.source === 'ALL') {
          await syncAllPharmacySources(opts);
        } else {
          await syncPharmacySource(body.source, opts);
        }
      } catch (err) {
        console.error('[admin pharmacy sync]', err);
      }
    });
  }),
);

adminRouter.get(
  '/sms/balance',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const balance = await getSmsBalance();
    res.json(balance);
  }),
);

adminRouter.get(
  '/sms/stats',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [total, sent, failed, otp, admin, last24h] = await Promise.all([
      prisma.smsLog.count(),
      prisma.smsLog.count({ where: { status: 'SENT' } }),
      prisma.smsLog.count({ where: { status: 'FAILED' } }),
      prisma.smsLog.count({ where: { purpose: 'OTP' } }),
      prisma.smsLog.count({ where: { purpose: 'ADMIN' } }),
      prisma.smsLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);
    res.json({ total, sent, failed, otp, admin, last24h });
  }),
);

adminRouter.get(
  '/sms/logs',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        status: z.enum(['ALL', 'SENT', 'FAILED', 'QUEUED']).default('ALL'),
        purpose: z.enum(['ALL', 'OTP', 'ADMIN', 'MARKETING', 'TEST']).default('ALL'),
        q: z.string().trim().optional(),
      })
      .parse(req.query);

    const where = {};
    if (query.status !== 'ALL') where.status = query.status;
    if (query.purpose !== 'ALL') where.purpose = query.purpose;
    if (query.q) {
      where.OR = [
        { destination: { contains: query.q.replace(/\D/g, '') } },
        { content: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.smsLog.count({ where }),
    ]);

    res.json({ logs, total, limit: query.limit, offset: query.offset });
  }),
);

adminRouter.post(
  '/sms/send',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        destination: z.string().trim().min(9, 'მიუთითეთ მობილური ნომერი'),
        content: z.string().trim().min(1, 'შეიყვანეთ ტექსტი').max(1000),
        userId: z.string().uuid().optional(),
        purpose: z.enum(['ADMIN', 'MARKETING', 'TEST']).default('ADMIN'),
        urgent: z.boolean().default(false),
      })
      .parse(req.body);

    let destination = body.destination;
    if (body.userId) {
      const user = await prisma.user.findUnique({ where: { id: body.userId } });
      if (!user?.phone) {
        return res.status(400).json({ error: 'ამ მომხმარებელს ტელეფონი არ აქვს მითითებული.' });
      }
      destination = user.phone;
    }

    const normalized = normalizeSmsDestination(destination);
    if (!/^9955\d{8}$/.test(normalized)) {
      return res.status(400).json({ error: 'ნომერი უნდა იყოს ფორმატში 9955XXXXXXXX.' });
    }

    const result = await sendSms({
      destination: normalized,
      content: body.content,
      purpose: body.purpose,
      userId: body.userId ?? null,
      adminId: req.admin.id,
      urgent: body.urgent,
    });

    if (!result.ok) {
      return res.status(502).json({
        error: result.message || 'SMS გაგზავნა ვერ მოხერხდა.',
        errorCode: result.errorCode,
      });
    }

    res.status(201).json({ ok: true, reference: result.reference, message: result.message });
  }),
);

adminRouter.get(
  '/orders',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const today = tbilisiYmd();
    const weekEnd = addDaysYmd(today, 7);
    const horizon = addDaysYmd(today, 21);
    const startToday = new Date(`${today}T00:00:00+04:00`);

    const [visitsToday, visitsWeek, activeMeds, newUsersToday, visits, medications, signups, jobs] =
      await Promise.all([
        prisma.doctorVisit.count({ where: { active: true, visitDate: today } }),
        prisma.doctorVisit.count({
          where: { active: true, visitDate: { gte: today, lt: weekEnd } },
        }),
        prisma.medicationSchedule.count({ where: { active: true } }),
        prisma.user.count({ where: { createdAt: { gte: startToday } } }),
        prisma.doctorVisit.findMany({
          where: { active: true, visitDate: { gte: today, lte: horizon } },
          orderBy: [{ visitDate: 'asc' }, { visitTime: 'asc' }],
          take: 80,
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
          },
        }),
        prisma.medicationSchedule.findMany({
          where: { active: true },
          orderBy: { createdAt: 'desc' },
          take: 24,
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        }),
        prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            createdAt: true,
            package: { select: { code: true, nameKa: true } },
          },
        }),
        prisma.syncRun.findMany({
          where: { status: 'RUNNING' },
          orderBy: { startedAt: 'desc' },
          take: 6,
        }),
      ]);

    res.json({
      today,
      kpis: { visitsToday, visitsWeek, activeMeds, newUsersToday },
      visits: visits.map((v) => ({
        id: v.id,
        visitDate: v.visitDate,
        visitTime: v.visitTime,
        doctorType: v.doctorType,
        doctorFirstName: v.doctorFirstName,
        doctorLastName: v.doctorLastName,
        addressLabel: v.addressLabel,
        address: v.address,
        user: v.user,
      })),
      medications: medications.map((m) => ({
        id: m.id,
        medName: m.medName,
        dosage: m.dosage,
        frequency: m.frequency,
        createdAt: m.createdAt,
        user: m.user,
      })),
      signups: signups.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        createdAt: u.createdAt,
        package: u.package,
      })),
      jobs: jobs.map((j) => ({
        id: j.id,
        source: j.source,
        startedAt: j.startedAt,
        itemsFetched: j.itemsFetched,
      })),
    });
  }),
);

function analyticsQuery(req) {
  return {
    range: req.query.range,
    from: req.query.from,
    to: req.query.to,
    grain: req.query.grain,
  };
}

function sendAnalyticsError(res, error) {
  if (error?.status === 400) return res.status(400).json({ error: error.message });
  throw error;
}

adminRouter.get(
  '/analytics/overview',
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      res.json(await getOverviewAnalytics(analyticsQuery(req)));
    } catch (error) {
      sendAnalyticsError(res, error);
    }
  }),
);

adminRouter.get(
  '/analytics/users',
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      res.json(await getUserActivityAnalytics(analyticsQuery(req)));
    } catch (error) {
      sendAnalyticsError(res, error);
    }
  }),
);

adminRouter.get(
  '/analytics/features',
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      res.json(await getFeatureAnalytics(analyticsQuery(req)));
    } catch (error) {
      sendAnalyticsError(res, error);
    }
  }),
);

adminRouter.get(
  '/analytics/medi',
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      res.json(await getMediAnalytics(analyticsQuery(req)));
    } catch (error) {
      sendAnalyticsError(res, error);
    }
  }),
);

adminRouter.get(
  '/analytics/notifications',
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      res.json(await getNotificationAnalytics(analyticsQuery(req)));
    } catch (error) {
      sendAnalyticsError(res, error);
    }
  }),
);

adminRouter.get(
  '/analytics/retention',
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      res.json(await getRetentionAnalytics(analyticsQuery(req)));
    } catch (error) {
      sendAnalyticsError(res, error);
    }
  }),
);

adminRouter.get(
  '/system/health',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await getSystemHealth());
  }),
);

adminRouter.get(
  '/notifications/decisions',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const range = {
      range: req.query.range || '30d',
      from: req.query.from,
      to: req.query.to,
    };
    const { parseAnalyticsRange } = await import('../lib/adminAnalyticsRange.js');
    const bounds = parseAnalyticsRange(range);
    const result = req.query.result ? String(req.query.result).toUpperCase() : '';
    const listed = await listNotificationDecisions({
      fromDt: bounds.fromDt,
      toExclusiveDt: bounds.toExclusiveDt,
      result: result || undefined,
      family: req.query.family ? String(req.query.family) : undefined,
      reason: req.query.reason ? String(req.query.reason) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      userId: req.query.userId ? String(req.query.userId) : undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    listed.decisions = await enrichDecisions(listed.decisions);
    res.json(listed);
  }),
);

adminRouter.get(
  '/notifications/decisions/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const decision = await getNotificationDecision(req.params.id);
    if (!decision) return res.status(404).json({ error: 'გადაწყვეტილება ვერ მოიძებნა.' });
    const [enriched] = await enrichDecisions([decision]);
    res.json({ decision: enriched });
  }),
);

adminRouter.get(
  '/analytics/versions',
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      res.json(await getVersionAnalytics(analyticsQuery(req)));
    } catch (error) {
      sendAnalyticsError(res, error);
    }
  }),
);

adminRouter.get(
  '/analytics/quality',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getDataQuality());
  }),
);

adminRouter.get(
  '/analytics/feature-retention',
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      res.json(await getFeatureRetentionAnalytics(analyticsQuery(req)));
    } catch (error) {
      sendAnalyticsError(res, error);
    }
  }),
);

adminRouter.get(
  '/analytics/permissions',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getPermissionAnalytics());
  }),
);

adminRouter.get(
  '/analytics/outcomes-extra',
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      res.json(await getWeeklyInsightMedication(analyticsQuery(req)));
    } catch (error) {
      sendAnalyticsError(res, error);
    }
  }),
);

adminRouter.get(
  '/notifications/outcomes',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const bounds = parseAnalyticsRange({
      range: req.query.range || '30d',
      from: req.query.from,
      to: req.query.to,
    });
    res.json(
      await listNotificationOutcomes({
        fromDt: bounds.fromDt,
        toExclusiveDt: bounds.toExclusiveDt,
        outcome: req.query.outcome ? String(req.query.outcome) : undefined,
        actionKey: req.query.actionKey ? String(req.query.actionKey) : undefined,
        decisionId: req.query.decisionId ? String(req.query.decisionId) : undefined,
        q: req.query.q ? String(req.query.q) : undefined,
        limit: req.query.limit,
        offset: req.query.offset,
      }),
    );
  }),
);

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function sendCsv(res, filename, headers, rows) {
  const body = [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${body}`);
}

adminRouter.get(
  '/export/users',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const where = await buildAdminUsersWhere(req.query);
    const users = await prisma.user.findMany({
      where,
      include: { package: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    sendCsv(
      res,
      'users.csv',
      ['id', 'email', 'fullName', 'status', 'package', 'createdAt', 'lastCheckInDate'],
      users.map((u) => [u.id, u.email, u.fullName, u.status, u.package?.code || '', u.createdAt.toISOString(), u.lastCheckInDate || '']),
    );
  }),
);

adminRouter.get(
  '/export/decisions',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const bounds = parseAnalyticsRange({
      range: req.query.range || '30d',
      from: req.query.from,
      to: req.query.to,
    });
    const { decisions } = await listNotificationDecisions({
      fromDt: bounds.fromDt,
      toExclusiveDt: bounds.toExclusiveDt,
      family: req.query.family ? String(req.query.family) : undefined,
      result: req.query.result ? String(req.query.result).toUpperCase() : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      limit: 2000,
      offset: 0,
    });
    sendCsv(
      res,
      'decisions.csv',
      ['decisionId', 'userId', 'family', 'result', 'reason', 'score', 'createdAt'],
      decisions.map((d) => [d.decisionId, d.userId, d.family, d.result, d.reason, d.score, d.createdAt]),
    );
  }),
);

adminRouter.get(
  '/export/outcomes',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const bounds = parseAnalyticsRange({
      range: req.query.range || '30d',
      from: req.query.from,
      to: req.query.to,
    });
    const { outcomes } = await listNotificationOutcomes({
      fromDt: bounds.fromDt,
      toExclusiveDt: bounds.toExclusiveDt,
      outcome: req.query.outcome ? String(req.query.outcome) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      limit: 2000,
      offset: 0,
    });
    sendCsv(
      res,
      'outcomes.csv',
      ['decisionId', 'userId', 'outcome', 'actionKey', 'occurredAt'],
      outcomes.map((o) => [o.decisionId, o.userId, o.outcome, o.actionKey, o.occurredAt]),
    );
  }),
);

adminRouter.get(
  '/export/audit',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = await listAdminAudit({
      limit: 2000,
      offset: 0,
      q: req.query.q,
    });
    sendCsv(
      res,
      'audit.csv',
      ['createdAt', 'adminEmail', 'action', 'targetType', 'targetId'],
      (data.entries || []).map((row) => [row.createdAt, row.adminEmail, row.action, row.targetType, row.targetId]),
    );
  }),
);

adminRouter.get(
  '/audit',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(
      await listAdminAudit({
        limit: req.query.limit,
        offset: req.query.offset,
        action: req.query.action,
        q: req.query.q,
      }),
    );
  }),
);
