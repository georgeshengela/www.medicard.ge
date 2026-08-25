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
import { getUsage } from '../lib/usage.js';
import { getPushStats, resolveSegmentTokens, sendExpoPush } from '../lib/push.js';
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

export const adminRouter = Router();

function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, email: admin.email, role: 'admin' }, env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

function adminAppSettings(settings) {
  return {
    ...publicAppSettings(settings),
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
    const [users, blocked, records, chats, packages] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'BLOCKED' } }),
      prisma.medicalRecord.count(),
      prisma.chatSession.count(),
      prisma.package.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);

    const byPackage = await Promise.all(
      packages.map(async (pkg) => ({
        code: pkg.code,
        nameKa: pkg.nameKa,
        users: await prisma.user.count({ where: { packageId: pkg.id, status: 'ACTIVE' } }),
      })),
    );

    res.json({
      users: { total: users, blocked, active: users - blocked },
      records,
      chats,
      packages: byPackage,
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
    const q = String(req.query.q ?? '').trim();
    const status = String(req.query.status ?? '').trim().toUpperCase();
    const packageCode = String(req.query.package ?? '').trim().toUpperCase();
    const take = Math.min(Number(req.query.limit) || 50, 200);
    const skip = Math.max(Number(req.query.offset) || 0, 0);

    const where = {
      AND: [
        q
          ? {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { fullName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            }
          : {},
        status === 'ACTIVE' || status === 'BLOCKED' ? { status } : {},
        packageCode
          ? { package: { code: packageCode } }
          : {},
      ],
    };

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

    const rows = await Promise.all(
      users.map(async (user) => adminUserRow(user, await getUsage(user.id))),
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
    res.json({ user: adminUserRow(user, await getUsage(user.id)) });
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
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
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
        supportEmail: z.string().email().optional(),
      })
      .parse(req.body);

    const settings = await prisma.appSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...body },
      update: body,
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
      },
    });

    res.status(201).json({ campaign: saved, delivery: result });
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
