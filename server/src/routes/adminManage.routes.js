/**
 * Admin management endpoints added with the V4 console:
 *   module kill switches, MEDIQUEST templates, per-user Medi Coins and
 *   consent history, AI-consent rollout, and a per-user data export.
 * Every write is audited (AdminAuditLog).
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/error.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { writeAdminAudit } from '../lib/adminAudit.js';
import { listFeatureFlags, setFeatureFlag } from '../lib/featureFlags.js';
import { validateQuestRewardAmounts } from '../lib/questEconomy.js';
import { lockedQuestTemplateFields } from '../lib/questTemplates.js';
import { getLevelForXp } from '../lib/questLevels.js';
import { adjustCoins, ledgerBalance } from '../lib/adminCoins.js';

export const adminManageRouter = Router();
adminManageRouter.use(requireAdmin);

const httpError = (message, status = 400, code) => Object.assign(new Error(message), { status, code });

/* ───────── Module kill switches ───────── */
adminManageRouter.get('/features', asyncHandler(async (_req, res) => {
  res.json({ features: await listFeatureFlags() });
}));

const featureBody = z.object({ enabled: z.boolean(), message: z.string().max(240).optional().nullable() });
adminManageRouter.put('/features/:key', asyncHandler(async (req, res) => {
  const body = featureBody.parse(req.body);
  const before = (await listFeatureFlags()).find((f) => f.key === req.params.key);
  const feature = await setFeatureFlag(req.params.key, body, { admin: req.admin });
  await writeAdminAudit({
    admin: req.admin,
    action: 'feature.toggle',
    targetType: 'featureFlag',
    targetId: req.params.key,
    previousValue: before ? { enabled: before.enabled, message: before.message } : null,
    newValue: { enabled: feature.enabled, message: feature.message },
  });
  res.json({ feature });
}));

/* ───────── MEDIQUEST templates ───────── */
const QUEST_LABELS = {
  daily_steps: 'დღიური ნაბიჯები',
  daily_hydration: 'დღიური წყალი',
  daily_medi: 'Medi-სთან საუბარი (ძველი, დღიური)',
  weekly_steps: 'კვირის ნაბიჯები',
  weekly_medi: 'Medi-სთან საუბარი (კვირაში ერთხელ)',
};

adminManageRouter.get('/quests/templates', asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [templates, assigned, completed] = await Promise.all([
    prisma.questTemplate.findMany({ orderBy: [{ cadence: 'asc' }, { priority: 'asc' }] }),
    prisma.userQuest.groupBy({ by: ['templateId'], where: { assignedAt: { gte: since } }, _count: { _all: true } }).catch(() => []),
    prisma.userQuest.groupBy({ by: ['templateId'], where: { completedAt: { gte: since } }, _count: { _all: true } }).catch(() => []),
  ]);
  const count = (rows, id) => rows.find((r) => r.templateId === id)?._count._all ?? 0;
  res.json({
    templates: templates.map((t) => ({
      key: t.key,
      label: QUEST_LABELS[t.key] || t.key,
      category: t.category,
      cadence: t.cadence,
      progressType: t.progressType,
      defaultTarget: t.defaultTarget,
      rewardCoins: t.rewardCoins,
      rewardXp: t.rewardXp,
      priority: t.priority,
      isActive: t.isActive,
      adminManaged: t.config?.adminManaged === true,
      // Owner rules the console cannot change (the Medi mission pays no coins; daily_medi is retired).
      locked: lockedQuestTemplateFields(t.key),
      updatedAt: t.updatedAt,
      stats7d: { assigned: count(assigned, t.id), completed: count(completed, t.id) },
    })),
    ceilings: { dailyCoins: 250, weeklyCoins: 1000, dailyXp: 250, weeklyXp: 1000 },
  });
}));

const questBody = z.object({
  defaultTarget: z.number().int().min(1).max(1_000_000).optional(),
  rewardCoins: z.number().int().min(0).max(1000).optional(),
  rewardXp: z.number().int().min(0).max(1000).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});
adminManageRouter.patch('/quests/templates/:key', asyncHandler(async (req, res) => {
  const body = questBody.parse(req.body);
  const current = await prisma.questTemplate.findUnique({ where: { key: req.params.key } });
  if (!current) throw httpError('შაბლონი ვერ მოიძებნა.', 404);
  const locked = lockedQuestTemplateFields(current.key);
  if (locked && Object.entries(body).some(([field, value]) => field in locked && locked[field] !== value)) {
    throw httpError('ეს მნიშვნელობა მფლობელის წესით ფიქსირებულია: Medi-სთან საუბარი Medi Coins-ს არ იძლევა, დღიური Medi მისია კი კვირის მისიით შეიცვალა.', 400, 'QUEST_TEMPLATE_LOCKED');
  }
  const next = { ...current, ...body };
  try {
    validateQuestRewardAmounts({ cadence: next.cadence, rewardXp: next.rewardXp, rewardCoins: next.rewardCoins });
  } catch (error) {
    const max = next.cadence === 'WEEKLY' ? '1000' : '250';
    throw httpError(`ჯილდო ლიმიტს აჭარბებს: ${next.cadence === 'WEEKLY' ? 'კვირის' : 'დღიური'} მისიისთვის მაქსიმუმ ${max} coin და ${max} XP.`, 400, error.code);
  }
  const updated = await prisma.questTemplate.update({
    where: { key: current.key },
    data: { ...body, config: { ...(current.config || {}), adminManaged: true } },
  });
  const pick = (t) => ({ defaultTarget: t.defaultTarget, rewardCoins: t.rewardCoins, rewardXp: t.rewardXp, priority: t.priority, isActive: t.isActive });
  await writeAdminAudit({ admin: req.admin, action: 'quest.template.update', targetType: 'questTemplate', targetId: current.key, previousValue: pick(current), newValue: pick(updated) });
  res.json({ ok: true, template: { key: updated.key, ...pick(updated) } });
}));

/* ───────── Per-user economy, quests and consent ───────── */

adminManageRouter.get('/users/:id/insights', asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw httpError('მომხმარებელი ვერ მოიძებნა.', 404);
  const [balance, ledger, profile, quests, consent, consentEvents, redemptions, achievements] = await Promise.all([
    ledgerBalance(prisma, userId),
    prisma.rewardLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 25 }),
    prisma.userQuestProfile.findUnique({ where: { userId } }),
    prisma.userQuest.findMany({ where: { userId }, orderBy: { assignedAt: 'desc' }, take: 12, include: { template: { select: { key: true } } } }),
    prisma.userAiConsent.findUnique({ where: { userId } }).catch(() => null),
    prisma.aiConsentEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }).catch(() => []),
    prisma.rewardRedemption.count({ where: { userId } }).catch(() => 0),
    prisma.userAchievement.count({ where: { userId } }).catch(() => 0),
  ]);
  res.json({
    economy: {
      coins: balance.coins,
      xp: balance.xp,
      level: getLevelForXp(balance.xp).level,
      streak: profile?.currentStreak ?? 0,
      longestStreak: profile?.longestStreak ?? 0,
      redemptions,
      achievements,
      ledger: ledger.map((r) => ({
        id: r.id, currency: r.currency, amount: r.amount, type: r.transactionType, source: r.sourceType,
        sourceId: r.sourceId, reason: r.metadata?.reason || null, adminEmail: r.metadata?.adminEmail || null, createdAt: r.createdAt,
      })),
    },
    quests: quests.map((q) => ({
      key: q.template?.key, label: QUEST_LABELS[q.template?.key] || q.template?.key, periodKey: q.periodKey,
      progress: q.progress, target: q.target, status: q.status, assignedAt: q.assignedAt, completedAt: q.completedAt,
    })),
    consent: {
      current: consent ? { version: consent.version, decision: consent.decision, updatedAt: consent.updatedAt } : null,
      events: consentEvents.map((e) => ({ version: e.version, decision: e.decision, createdAt: e.createdAt })),
    },
  });
}));

const coinsBody = z.object({
  amount: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 5000, 'თანხა უნდა იყოს ±1…5000.'),
  reason: z.string().trim().min(3).max(200),
});
adminManageRouter.post('/users/:id/coins', asyncHandler(async (req, res) => {
  const { amount, reason } = coinsBody.parse(req.body);
  const userId = req.params.id;
  const result = await adjustCoins({ userId, amount, reason, adminEmail: req.admin?.email });
  await writeAdminAudit({
    admin: req.admin, action: amount > 0 ? 'coins.grant' : 'coins.revoke', targetType: 'user', targetId: userId,
    previousValue: { coins: result.before }, newValue: { coins: result.after, amount, reason },
  });
  res.json({ ok: true, balance: result.after });
}));

/* ───────── AI consent rollout ───────── */
adminManageRouter.get('/ai-consent/summary', asyncHandler(async (_req, res) => {
  const [byDecision, recent] = await Promise.all([
    prisma.userAiConsent.groupBy({ by: ['version', 'decision'], _count: { _all: true } }).catch(() => []),
    prisma.aiConsentEvent.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } } }).catch(() => 0),
  ]);
  res.json({
    rows: byDecision.map((r) => ({ version: r.version, decision: r.decision, users: r._count._all })),
    events7d: recent,
  });
}));

/* ───────── Per-user data export (right of access) ───────── */
adminManageRouter.get('/users/:id/export', asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const take = 2000;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, fullName: true, phone: true, gender: true, birthDate: true, status: true,
      createdAt: true, updatedAt: true, lastCheckInDate: true, currentStreak: true, longestStreak: true,
    },
  });
  if (user) {
    // One query per table, each optional: a table missing on this database never breaks the export.
    const where = { userId };
    const sections = {
      healthProfile: (m) => m.healthProfile?.findUnique({ where }),
      cycleProfile: (m) => m.cycleProfile?.findUnique({ where }),
      aiConsent: (m) => m.userAiConsent?.findUnique({ where }),
      aiConsentEvents: (m) => m.aiConsentEvent?.findMany({ where, orderBy: { createdAt: 'asc' }, take }),
      medications: (m) => m.medicationSchedule?.findMany({ where, take }),
      doctorVisits: (m) => m.doctorVisit?.findMany({ where, take }),
      records: (m) => m.medicalRecord?.findMany({ where, take }),
      checkIns: (m) => m.dailyCheckIn?.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
      cycleLogs: (m) => m.cycleLog?.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
      nutritionMeals: (m) => m.nutritionMeal?.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
      pets: (m) => m.pet?.findMany({ where, take }),
      rewardLedger: (m) => m.rewardLedger?.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
      rewardRedemptions: (m) => m.rewardRedemption?.findMany({ where, take }),
      quests: (m) => m.userQuest?.findMany({ where, orderBy: { assignedAt: 'desc' }, take }),
      achievements: (m) => m.userAchievement?.findMany({ where, take }),
      chats: (m) => m.chatSession?.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 }),
    };
    const entries = await Promise.all(Object.entries(sections).map(async ([key, load]) => {
      try { return [key, (await load(prisma)) ?? null]; } catch (error) { return [key, { unavailable: String(error?.code || 'error') }]; }
    }));
    Object.assign(user, Object.fromEntries(entries));
  }
  if (!user) throw httpError('მომხმარებელი ვერ მოიძებნა.', 404);
  await writeAdminAudit({ admin: req.admin, action: 'user.export', targetType: 'user', targetId: userId, previousValue: null, newValue: { exportedAt: new Date().toISOString() } });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="medicard-user-${userId.slice(0, 8)}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify({ exportedAt: new Date().toISOString(), note: 'Medicard — მომხმარებლის მონაცემების ექსპორტი (ადმინისტრატორის მიერ).', user }, null, 2));
}));
