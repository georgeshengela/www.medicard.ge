import { prisma } from './prisma.js';
import {
  QUEST_ECONOMY,
  assertIssuableQuestReward,
  reconciliationHoursForProgressType,
  validateQuestRewardAmounts,
} from './questEconomy.js';
import { getLevelForXp } from './questLevels.js';
import { recordServerProductEvent } from './productEvents.js';
import {
  assertQuestRecordIsPrivate,
  publicQuest,
  publicRewardRow,
  questProgressPercent,
  sanitizeQuestJson,
} from './questPrivacy.js';
import { emitQuestCompleted, emitQuestRewardClaimed } from './questRealtime.js';
import {
  QUEST_TIMEZONE,
  QUEST_TIMEZONE_FALLBACK,
  addDaysYmd,
  canAssignNewDailyPeriod,
  dailyPeriodKey,
  daysInIsoWeek,
  endOfLocalDay,
  getEffectiveQuestTimezone,
  normalizeQuestTimezone,
  resolveQuestClock,
  expiresAtForPeriod,
  startOfLocalDay,
} from './questTime.js';
import { countsForDailyStreak, ensureQuestTemplates } from './questTemplates.js';
import { isUsableStepCapability, loadStepCapabilityStatus } from './stepCapability.js';

export { getLevelForXp, getLevelProgress, getXpThresholdForLevel, getLevelRankKey } from './questLevels.js';
export { QUEST_TIMEZONE, QUEST_TIMEZONE_FALLBACK, getEffectiveQuestTimezone, resolveQuestClock } from './questTime.js';
export { ensureQuestTemplates, INITIAL_QUEST_TEMPLATES, countsForDailyStreak } from './questTemplates.js';
export { QUEST_ECONOMY, validateQuestRewardAmounts, assertIssuableQuestReward, validateHydrationGoalMl } from './questEconomy.js';
export { QuestSignal, refreshQuestProgressForUser } from './questSignals.js';
export { publicQuest, publicRewardRow, sanitizeQuestJson, QUEST_FORBIDDEN_KEYS } from './questPrivacy.js';

/**
 * Medi Quest Phase 2 — server-authoritative progress engine.
 *
 * Mobile may request the dashboard or claim a reward.
 * Mobile must never submit progress, completed=true, XP, coins, level, streak, or target.
 *
 * Progress is recomputed from HealthMetricDaily / HydrationPreference / AiInteraction.
 * ACTIVE progress may decrease when the source-of-truth corrects.
 * COMPLETED is immutable — corrections do not revoke completion, streak, or later claims.
 * Rewards stay claimable; the ledger is authoritative for issuance.
 *
 * Expiration uses period end + reconciliationHours (steps 6h / weekly 12h / hydration 2h / medi 0h).
 * Streak uses the quest periodKey, not server receipt time.
 */
const ACTIVE = 'ACTIVE';
const COMPLETED = 'COMPLETED';
const CLAIMED = 'CLAIMED';
const EXPIRED = 'EXPIRED';

function dbOf(options = {}) {
  return options.db || prisma;
}

function canTransaction(client) {
  return typeof client?.$transaction === 'function';
}

async function withQuestTx(options, work) {
  const db = dbOf(options);
  if (!canTransaction(db)) return work(db);
  return db.$transaction((tx) => work(tx));
}

async function resolveClock(userId, options = {}) {
  const db = dbOf(options);
  let profileTimezone = options.profileTimezone;
  if (!options.timezone && !options.deviceTimezone && !profileTimezone && userId) {
    const profile = await db.userQuestProfile.findUnique({ where: { userId } }).catch(() => null);
    profileTimezone = profile?.timezone;
  }
  const timezone = getEffectiveQuestTimezone(
    { timezone: options.userTimezone, questProfile: { timezone: profileTimezone } },
    options,
  );
  return resolveQuestClock(options.now || new Date(), timezone);
}

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isPrismaMissing(error) {
  return error?.code === 'P2021' || /does not exist/i.test(error?.message || '');
}

function isUniqueViolation(error) {
  return error?.code === 'P2002';
}

function templateIsAssignable(template, now) {
  if (!template?.isActive) return false;
  if (template.startAt && new Date(template.startAt) > now) return false;
  if (template.endAt && new Date(template.endAt) < now) return false;
  return true;
}

export function reconciliationCutoffAt(quest) {
  const hours = reconciliationHoursForProgressType(quest.template?.progressType, quest.template?.cadence);
  const end = quest.expiresAt instanceof Date ? quest.expiresAt : new Date(quest.expiresAt);
  return new Date(end.getTime() + hours * 3_600_000);
}

function isWithinReconciliation(quest, now) {
  return now.getTime() <= reconciliationCutoffAt(quest).getTime();
}

export async function loadHydrationGoalMl(db, userId) {
  if (typeof db?.hydrationPreference?.findUnique !== 'function') return null;
  const row = await db.hydrationPreference.findUnique({ where: { userId } });
  const goal = Number(row?.goalMl);
  if (!Number.isFinite(goal) || goal < QUEST_ECONOMY.hydrationGoalMlMin || goal > QUEST_ECONOMY.hydrationGoalMlMax) {
    return null;
  }
  return goal;
}

async function isTemplateEligible(db, userId, template) {
  try {
    validateQuestRewardAmounts({
      cadence: template.cadence,
      rewardXp: template.rewardXp,
      rewardCoins: template.rewardCoins,
    });
  } catch (error) {
    console.warn('[quest] skipped invalid reward config at assignment', template.key, error?.code);
    return false;
  }
  if (template.progressType === 'HYDRATION_GOAL_PERCENT') {
    return (await loadHydrationGoalMl(db, userId)) != null;
  }
  if (template.progressType === 'STEPS') {
    const status = await loadStepCapabilityStatus(db, userId);
    return isUsableStepCapability(status);
  }
  return true;
}

export async function computeQuestProgress(userId, templateOrQuest, periodKey, options = {}) {
  const db = dbOf(options);
  const quest = templateOrQuest?.template ? templateOrQuest : null;
  const template = quest?.template || templateOrQuest;
  const key = quest?.periodKey || periodKey;
  const type = template?.progressType;
  const cadence = template?.cadence;
  const metricByDate = options.metricByDate;

  async function dailyRow(date) {
    if (metricByDate?.has(date)) return metricByDate.get(date);
    return findDailyMetric(db, userId, date);
  }

  if (type === 'STEPS' && cadence === 'WEEKLY') {
    const days = daysInIsoWeek(key);
    if (metricByDate) {
      return days.reduce((sum, date) => sum + (Number(metricByDate.get(date)?.steps) || 0), 0);
    }
    const rows = await db.healthMetricDaily.findMany({
      where: { userId, date: { in: days } },
    });
    return rows.reduce((sum, row) => sum + (Number(row.steps) || 0), 0);
  }

  if (type === 'STEPS') {
    return Math.max(0, Number((await dailyRow(key))?.steps) || 0);
  }

  if (type === 'HYDRATION_GOAL_PERCENT') {
    const basis =
      Number(quest?.metadata?.goalBasisMl) ||
      Number(options.hydrationGoalMl) ||
      (await loadHydrationGoalMl(db, userId));
    if (!Number.isFinite(basis) || basis <= 0) return 0;
    const ml = Math.max(0, Number((await dailyRow(key))?.hydrationMl) || 0);
    return Math.min(100, Math.max(0, Math.floor((ml / basis) * 100)));
  }

  if (type === 'MEDI_DAILY_USE') {
    if (options.mediUsedByPeriod?.has(key)) return options.mediUsedByPeriod.get(key) ? 1 : 0;
    if (Number(options.mediDailyUse) === 1) return 1;
    const tz = quest?.metadata?.assignedTimezone || options.timezone || QUEST_TIMEZONE_FALLBACK;
    const start = startOfLocalDay(key, tz);
    const end = endOfLocalDay(key, tz);
    if (typeof db.aiInteraction?.findMany !== 'function') return 0;
    const rows = await db.aiInteraction.findMany({
      where: {
        userId,
        status: 'OK',
        mode: { in: ['DOCTOR', 'CONSILIUM'] },
        createdAt: { gte: start, lte: end },
      },
      take: 1,
    });
    return rows.length ? 1 : 0;
  }

  console.warn('[quest] unknown progress type', type);
  return 0;
}

async function loadProgressContext(db, userId, quests, options = {}) {
  const dates = new Set();
  const mediWindows = [];
  for (const quest of quests) {
    const type = quest.template?.progressType;
    if (type === 'STEPS' && quest.template?.cadence === 'WEEKLY') {
      daysInIsoWeek(quest.periodKey).forEach((date) => dates.add(date));
    } else if (type === 'STEPS' || type === 'HYDRATION_GOAL_PERCENT') {
      dates.add(quest.periodKey);
    } else if (type === 'MEDI_DAILY_USE') {
      const tz = quest.metadata?.assignedTimezone || options.timezone || QUEST_TIMEZONE_FALLBACK;
      mediWindows.push({
        periodKey: quest.periodKey,
        start: startOfLocalDay(quest.periodKey, tz),
        end: endOfLocalDay(quest.periodKey, tz),
      });
    }
  }

  const metricByDate = new Map();
  if (dates.size) {
    const rows = await db.healthMetricDaily.findMany({
      where: { userId, date: { in: [...dates] } },
    });
    for (const row of rows) metricByDate.set(row.date, row);
  }

  const mediUsedByPeriod = new Map();
  if (mediWindows.length && typeof db.aiInteraction?.findMany === 'function') {
    const from = new Date(Math.min(...mediWindows.map((window) => window.start.getTime())));
    const to = new Date(Math.max(...mediWindows.map((window) => window.end.getTime())));
    const rows = await db.aiInteraction.findMany({
      where: {
        userId,
        status: 'OK',
        mode: { in: ['DOCTOR', 'CONSILIUM'] },
        createdAt: { gte: from, lte: to },
      },
    });
    for (const window of mediWindows) {
      mediUsedByPeriod.set(
        window.periodKey,
        rows.some((row) => {
          const at = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
          return at >= window.start && at <= window.end;
        }),
      );
    }
  }

  return { metricByDate, mediUsedByPeriod };
}

function notifyQuestCompleted(userId, quest, options = {}) {
  const completedAt = quest.completedAt instanceof Date ? quest.completedAt.toISOString() : quest.completedAt;
  emitQuestCompleted(userId, {
    questId: quest.id,
    userQuestId: quest.id,
    templateKey: quest.template?.key,
    key: quest.template?.key,
    category: quest.template?.category,
    completedAt,
    periodKey: quest.periodKey,
    rewardCoins: quest.template?.rewardCoins,
    rewardXp: quest.template?.rewardXp,
    progress: quest.progress,
    target: quest.target,
    progressPercent: questProgressPercent(quest.progress, quest.target),
  });
  emitQuestAnalytics(userId, 'quest_completed', quest, options);
}

function emitQuestAnalytics(userId, kind, quest, options = {}) {
  if (options.db && options.db !== prisma) return;
  recordServerProductEvent({
    userId,
    kind,
    category: quest?.template?.category || quest?.template?.cadence || 'quest',
    entityId: quest?.id || kind,
    source: 'quest',
  }).catch((error) => {
    console.warn('[quest] analytics event failed', kind, error?.message);
  });
}

async function findDailyMetric(db, userId, date) {
  if (typeof db.healthMetricDaily?.findUnique === 'function') {
    const byCompound = await db.healthMetricDaily.findUnique({
      where: { userId_date: { userId, date } },
    });
    if (byCompound) return byCompound;
  }
  const rows = await db.healthMetricDaily.findMany({
    where: { userId, date },
    take: 1,
  });
  return rows[0] || null;
}

async function loadAssignableTemplates(db, cadence, now) {
  const rows = await db.questTemplate.findMany({
    where: { cadence, isActive: true },
    orderBy: [{ priority: 'asc' }, { key: 'asc' }],
  });
  return rows.filter((template) => templateIsAssignable(template, now));
}

async function createAssignment(tx, { userId, template, periodKey, now, timezone }) {
  const existing = await tx.userQuest.findUnique({
    where: { userId_templateId_periodKey: { userId, templateId: template.id, periodKey } },
    include: { template: true },
  });
  if (existing) return { quest: existing, created: false };

  const target = template.defaultTarget;
  const metadata = sanitizeQuestJson({
    source: template.config?.source || template.config?.metric || template.progressType,
    cadence: template.cadence,
    assignedTimezone: timezone,
  });
  if (template.progressType === 'HYDRATION_GOAL_PERCENT') {
    const goal = await loadHydrationGoalMl(tx, userId);
    if (!goal) return { quest: null, created: false };
    metadata.goalBasisMl = goal;
  }
  assertQuestRecordIsPrivate(metadata);

  try {
    const quest = await tx.userQuest.create({
      data: {
        userId,
        templateId: template.id,
        periodKey,
        target,
        progress: 0,
        status: ACTIVE,
        assignedAt: now,
        expiresAt: expiresAtForPeriod(template.cadence, periodKey, timezone),
        metadata,
      },
      include: { template: true },
    });
    return { quest, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const quest = await tx.userQuest.findUnique({
      where: { userId_templateId_periodKey: { userId, templateId: template.id, periodKey } },
      include: { template: true },
    });
    return { quest, created: false };
  }
}

export async function expireStaleQuests(userId, options = {}) {
  const db = dbOf(options);
  const clock = await resolveClock(userId, options);
  const rows = await db.userQuest.findMany({
    where: { userId, status: ACTIVE },
    include: { template: true },
  });
  let count = 0;
  for (const row of rows) {
    if (isWithinReconciliation(row, clock.now)) continue;
    await db.userQuest.update({
      where: { id: row.id },
      data: { status: EXPIRED },
    });
    count += 1;
  }
  return count;
}

async function markDailyAssign(tx, userId, periodKey, now, timezone, createdAny) {
  const profile = await ensureProfile(tx, userId, timezone);
  if (profile.lastDailyAssignPeriodKey === periodKey || !createdAny) {
    if (!profile.timezone && timezone) {
      await tx.userQuestProfile.update({ where: { userId }, data: { timezone } });
    }
    return;
  }
  await tx.userQuestProfile.update({
    where: { userId },
    data: {
      lastDailyAssignPeriodKey: periodKey,
      lastDailyAssignAt: now,
      timezone,
    },
  });
}

export async function assignDailyQuests(userId, date, options = {}) {
  const db = dbOf(options);
  const clock = await resolveClock(userId, options);
  const periodKey = date || clock.today;
  await ensureQuestTemplates(db);

  return db.$transaction(async (tx) => {
    const profile = await ensureProfile(tx, userId, clock.timezone);
    if (!canAssignNewDailyPeriod(profile, periodKey, clock.now, clock.timezone)) {
      const existing = await tx.userQuest.findMany({
        where: { userId, periodKey: profile.lastDailyAssignPeriodKey || periodKey },
        include: { template: true },
      });
      return existing
        .filter((row) => row.template?.cadence === 'DAILY')
        .map((quest) => ({ ...quest, created: false, hopBlocked: true }));
    }

    const templates = await loadAssignableTemplates(tx, 'DAILY', clock.now);
    const assigned = [];
    let createdAny = false;
    for (const template of templates) {
      if (!(await isTemplateEligible(tx, userId, template))) continue;
      const { quest, created } = await createAssignment(tx, {
        userId,
        template,
        periodKey,
        now: clock.now,
        timezone: clock.timezone,
      });
      if (created) createdAny = true;
      if (quest) assigned.push({ ...quest, created });
    }
    await markDailyAssign(tx, userId, periodKey, clock.now, clock.timezone, createdAny || !profile.lastDailyAssignPeriodKey);
    return assigned;
  }).then((assigned) => {
    for (const row of assigned.filter((item) => item.created)) {
      emitQuestAnalytics(userId, 'quest_assigned', row, options);
    }
    return assigned;
  });
}

export async function assignWeeklyQuests(userId, week, options = {}) {
  const db = dbOf(options);
  const clock = await resolveClock(userId, options);
  const periodKey = week || clock.week;
  await ensureQuestTemplates(db);
  const templates = await loadAssignableTemplates(db, 'WEEKLY', clock.now);

  return db.$transaction(async (tx) => {
    const assigned = [];
    for (const template of templates) {
      if (!(await isTemplateEligible(tx, userId, template))) continue;
      const { quest, created } = await createAssignment(tx, {
        userId,
        template,
        periodKey,
        now: clock.now,
        timezone: clock.timezone,
      });
      if (quest) assigned.push({ ...quest, created });
    }
    return assigned;
  }).then((assigned) => {
    for (const row of assigned.filter((item) => item.created)) {
      emitQuestAnalytics(userId, 'quest_assigned', row, options);
    }
    return assigned;
  });
}

async function applyQuestStreak(tx, userId, quest) {
  if (!countsForDailyStreak(quest.template)) return null;
  const day = quest.periodKey;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const profile = await ensureProfile(tx, userId);
  if (profile.lastActiveQuestDate === day) return profile;

  const yesterday = addDaysYmd(day, -1);
  const currentStreak = profile.lastActiveQuestDate === yesterday ? (profile.currentStreak || 0) + 1 : 1;
  const longestStreak = Math.max(profile.longestStreak || 0, currentStreak);

  return tx.userQuestProfile.update({
    where: { userId },
    data: { currentStreak, longestStreak, lastActiveQuestDate: day },
  });
}

async function ensureProfile(tx, userId, timezone) {
  const existing = await tx.userQuestProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    return await tx.userQuestProfile.create({
      data: {
        userId,
        currentLevel: 1,
        totalXp: 0,
        cachedCoinBalance: 0,
        timezone: normalizeQuestTimezone(timezone) || undefined,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return tx.userQuestProfile.findUnique({ where: { userId } });
  }
}

export async function setQuestTimezone(userId, timezone, options = {}) {
  const tz = normalizeQuestTimezone(timezone);
  if (!tz) {
    throw httpError('არასწორი დროის სარტყელი.', 400);
  }
  const db = dbOf(options);
  await ensureProfile(db, userId, tz);
  return db.userQuestProfile.update({
    where: { userId },
    data: { timezone: tz },
  });
}

async function loadQuestForUser(db, userId, userQuestId) {
  const quest = await db.userQuest.findUnique({
    where: { id: userQuestId },
    include: { template: true, completions: true },
  });
  if (!quest || quest.userId !== userId) {
    throw httpError('ქვესტი ვერ მოიძებნა.', 404);
  }
  return quest;
}

export async function updateQuestProgress(userId, spec = {}, options = {}) {
  if (spec && typeof spec === 'object' && spec.progress != null) {
    throw httpError('ქვესტის პროგრესს სერვერი ანგარიშობს.', 400);
  }

  const db = dbOf(options);
  const clock = await resolveClock(userId, options);
  await expireStaleQuests(userId, { ...options, db });

  const where = { userId, status: ACTIVE };
  if (spec.userQuestId) where.id = spec.userQuestId;
  if (spec.templateId) where.templateId = spec.templateId;
  if (spec.periodKey) where.periodKey = spec.periodKey;

  const quests = await db.userQuest.findMany({
    where,
    include: { template: true },
  });

  const signals = options.signals;
  const relevant = quests.filter((quest) => {
    if (spec.templateKey && quest.template?.key !== spec.templateKey) return false;
    if (Array.isArray(signals) && signals.length && !signals.includes(quest.template?.progressType)) {
      return false;
    }
    return true;
  });

  const context = await loadProgressContext(db, userId, relevant.filter((quest) => quest.status === ACTIVE), {
    ...options,
    timezone: clock.timezone,
  });

  const updated = [];
  for (const quest of relevant) {
    if (quest.status !== ACTIVE) {
      updated.push(quest);
      continue;
    }
    const computed = await computeQuestProgress(userId, quest, quest.periodKey, {
      ...options,
      db,
      timezone: clock.timezone,
      metricByDate: context.metricByDate,
      mediUsedByPeriod: context.mediUsedByPeriod,
    });
    const progress = Math.max(0, computed);
    let next = quest;
    if (progress !== quest.progress) {
      next = await db.userQuest.update({
        where: { id: quest.id },
        data: { progress },
        include: { template: true },
      });
    }
    if (next.status === ACTIVE && progress >= next.target && isWithinReconciliation(next, clock.now)) {
      const completed = await completeQuest(userId, next.id, {
        ...options,
        db,
        source: options.source || 'sync',
      });
      next = completed.quest || next;
    }
    updated.push(next);
  }
  return updated;
}

async function completeQuestInTx(tx, userId, userQuestId, options = {}) {
  const clock = await resolveClock(userId, options);
  const source = options.source || 'system';
  if (options.beforeWrite) await options.beforeWrite();
  const quest = await loadQuestForUser(tx, userId, userQuestId);

  if (quest.status === COMPLETED || quest.status === CLAIMED) {
    return { completed: false, alreadyCompleted: true, quest };
  }

  if (quest.status === EXPIRED || (quest.status === ACTIVE && !isWithinReconciliation(quest, clock.now))) {
    if (quest.status === ACTIVE) {
      await tx.userQuest.update({
        where: { id: quest.id },
        data: { status: EXPIRED },
      });
    }
    throw httpError('ქვესტის ვადა ამოიწურა.', 409);
  }

  if (quest.status !== ACTIVE) {
    throw httpError('ქვესტის დასრულება შეუძლებელია.', 409);
  }

  if ((quest.progress || 0) < quest.target) {
    throw httpError('ქვესტი ჯერ არ დასრულებულა.', 400);
  }

  await tx.questCompletion.create({
    data: {
      userQuestId: quest.id,
      userId,
      completedAt: clock.now,
      progressAtCompletion: quest.progress,
      source,
    },
  });

  const updated = await tx.userQuest.update({
    where: { id: quest.id },
    data: { status: COMPLETED, completedAt: clock.now },
    include: { template: true, completions: true },
  });

  await applyQuestStreak(tx, userId, updated);
  return { completed: true, alreadyCompleted: false, quest: updated };
}

export async function completeQuest(userId, userQuestId, options = {}) {
  try {
    const result = await withQuestTx(options, (tx) => completeQuestInTx(tx, userId, userQuestId, options));
    if (result.completed) notifyQuestCompleted(userId, result.quest, options);
    return result;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const quest = await loadQuestForUser(dbOf(options), userId, userQuestId);
    return { completed: false, alreadyCompleted: true, quest };
  }
}

async function writeReward(tx, { userId, currency, amount, sourceId, now }) {
  if (!amount) return { created: false, amount: 0 };
  try {
    await tx.rewardLedger.create({
      data: {
        userId,
        currency,
        amount,
        transactionType: 'EARN',
        sourceType: 'QUEST',
        sourceId,
        createdAt: now,
      },
    });
    return { created: true, amount };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { created: false, amount: 0 };
  }
}

function claimPayload(quest, rewards, profile, extras = {}) {
  return {
    claimed: extras.claimed,
    alreadyClaimed: extras.alreadyClaimed,
    rewards,
    reward: {
      coinsAwarded: rewards.coins,
      xpAwarded: rewards.xp,
    },
    quest,
    profile,
  };
}

async function claimQuestInTx(tx, userId, userQuestId, options = {}) {
  const clock = await resolveClock(userId, options);
  if (options.beforeWrite) await options.beforeWrite();
  let quest = await loadQuestForUser(tx, userId, userQuestId);
  const previousLevel = (await publicProfile(userId, { ...options, db: tx })).currentLevel;

  if (quest.status === CLAIMED) {
    const profile = await publicClaimProfile(userId, previousLevel, { ...options, db: tx });
    return claimPayload(quest, { xp: 0, coins: 0 }, profile, { claimed: false, alreadyClaimed: true });
  }

  if (quest.status === 'CANCELLED') {
    throw httpError('ქვესტის ვადა ამოიწურა.', 409);
  }

  if (quest.status === EXPIRED) {
    throw httpError('ქვესტის ვადა ამოიწურა.', 409);
  }

  const issued = assertIssuableQuestReward(quest.template);
  let justCompleted = false;

  if (quest.status === ACTIVE) {
    if ((quest.progress || 0) < quest.target) {
      throw httpError('ქვესტი ჯერ არ დასრულებულა.', 400);
    }
    if (!isWithinReconciliation(quest, clock.now)) {
      await tx.userQuest.update({ where: { id: quest.id }, data: { status: EXPIRED } });
      throw httpError('ქვესტის ვადა ამოიწურა.', 409);
    }
    const completion = await completeQuestInTx(tx, userId, quest.id, {
      ...options,
      source: 'claim',
      beforeWrite: undefined,
    });
    quest = completion.quest;
    justCompleted = completion.completed;
  }
  const xpWrite = await writeReward(tx, {
    userId,
    currency: 'XP',
    amount: issued.xp,
    sourceId: quest.id,
    now: clock.now,
  });
  const coinWrite = await writeReward(tx, {
    userId,
    currency: 'COIN',
    amount: issued.coins,
    sourceId: quest.id,
    now: clock.now,
  });

  if (xpWrite.created || coinWrite.created) {
    const profile = await ensureProfile(tx, userId);
    const totalXp = (profile.totalXp || 0) + (xpWrite.created ? xpWrite.amount : 0);
    const cachedCoinBalance = (profile.cachedCoinBalance || 0) + (coinWrite.created ? coinWrite.amount : 0);
    const level = getLevelForXp(totalXp).level;
    await tx.userQuestProfile.update({
      where: { userId },
      data: { totalXp, cachedCoinBalance, currentLevel: level },
    });
  }

  const updated = await tx.userQuest.update({
    where: { id: quest.id },
    data: { status: CLAIMED, claimedAt: quest.claimedAt || clock.now },
    include: { template: true, completions: true },
  });

  const rewards = {
    xp: xpWrite.created ? xpWrite.amount : 0,
    coins: coinWrite.created ? coinWrite.amount : 0,
  };
  const profile = await publicClaimProfile(userId, previousLevel, { ...options, db: tx });
  return {
    ...claimPayload(updated, rewards, profile, {
      claimed: xpWrite.created || coinWrite.created,
      alreadyClaimed: !xpWrite.created && !coinWrite.created,
    }),
    justCompleted,
  };
}

export async function claimQuest(userId, userQuestId, options = {}) {
  try {
    const result = await withQuestTx(options, (tx) => claimQuestInTx(tx, userId, userQuestId, options));
    if (result.justCompleted) notifyQuestCompleted(userId, result.quest, options);
    if (result.claimed) {
      emitQuestAnalytics(userId, 'quest_claimed', result.quest, options);
      emitQuestRewardClaimed(userId, {
        questId: result.quest.id,
        coinsAwarded: result.reward.coinsAwarded,
        xpAwarded: result.reward.xpAwarded,
        coinBalance: result.profile.coinBalance,
        totalXp: result.profile.totalXp,
        previousLevel: result.profile.previousLevel,
        currentLevel: result.profile.currentLevel,
        leveledUp: result.profile.leveledUp,
        levelProgress: result.profile.levelProgress,
        currentStreak: result.profile.currentStreak,
        longestStreak: result.profile.longestStreak,
      });
    }
    return result;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const quest = await loadQuestForUser(dbOf(options), userId, userQuestId);
    const profile = await publicClaimProfile(userId, null, options);
    return claimPayload(quest, { xp: 0, coins: 0 }, profile, { claimed: false, alreadyClaimed: true });
  }
}

export async function getRewardBalance(userId, options = {}) {
  const db = dbOf(options);
  const rows = await db.rewardLedger.findMany({ where: { userId } });
  let xp = 0;
  let coins = 0;
  for (const row of rows) {
    if (row.currency === 'XP') xp += row.amount;
    if (row.currency === 'COIN') coins += row.amount;
  }
  return { xp, coins };
}

export async function getRewardLedger(userId, options = {}) {
  const db = dbOf(options);
  const take = Math.min(200, Number(options.take) || 50);
  const rows = await db.rewardLedger.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return rows.map(publicRewardRow);
}

export async function reconcileQuestProfile(userId, options = {}) {
  const db = dbOf(options);
  const profile = await ensureProfile(db, userId);
  const ledger = await getRewardBalance(userId, { ...options, db });
  const level = getLevelForXp(ledger.xp);
  const drifted =
    (profile.totalXp || 0) !== ledger.xp ||
    (profile.cachedCoinBalance || 0) !== ledger.coins ||
    (profile.currentLevel || 1) !== level.level;
  if (drifted) {
    console.warn('[quest] profile/ledger drift', { userId, repaired: Boolean(options.repair) });
  }
  if (drifted && options.repair) {
    await db.userQuestProfile.update({
      where: { userId },
      data: { totalXp: ledger.xp, cachedCoinBalance: ledger.coins, currentLevel: level.level },
    });
  }
  return {
    drifted,
    repaired: Boolean(drifted && options.repair),
    ledger,
    cached: {
      totalXp: profile.totalXp,
      cachedCoinBalance: profile.cachedCoinBalance,
      currentLevel: profile.currentLevel,
    },
  };
}

async function publicProfile(userId, options = {}) {
  const db = dbOf(options);
  const clock = await resolveClock(userId, options);
  const profile = await ensureProfile(db, userId, clock.timezone);
  const balance = await getRewardBalance(userId, { ...options, db });
  const level = getLevelForXp(balance.xp);
  if ((profile.totalXp || 0) !== balance.xp || (profile.cachedCoinBalance || 0) !== balance.coins) {
    console.warn('[quest] profile/ledger drift', { userId });
  }
  return {
    userId,
    currentLevel: level.level,
    totalXp: balance.xp,
    cachedCoinBalance: profile.cachedCoinBalance,
    coinBalance: balance.coins,
    currentStreak: profile.currentStreak || 0,
    longestStreak: profile.longestStreak || 0,
    lastActiveQuestDate: profile.lastActiveQuestDate,
    level,
    levelProgress: level,
    rankKey: level.rankKey,
    timezone: profile.timezone || clock.timezone,
    updatedAt: profile.updatedAt instanceof Date ? profile.updatedAt.toISOString() : profile.updatedAt,
  };
}

async function publicClaimProfile(userId, previousLevel, options = {}) {
  const profile = await publicProfile(userId, options);
  const prev = previousLevel == null ? profile.currentLevel : previousLevel;
  return {
    coinBalance: profile.coinBalance,
    totalXp: profile.totalXp,
    previousLevel: prev,
    currentLevel: profile.currentLevel,
    leveledUp: profile.currentLevel > prev,
    levelProgress: profile.level,
    currentStreak: profile.currentStreak,
    longestStreak: profile.longestStreak,
    timezone: profile.timezone,
    rankKey: profile.rankKey,
  };
}

export async function getQuestProfile(userId, options = {}) {
  const db = dbOf(options);
  await ensureProfile(db, userId);
  return publicProfile(userId, options);
}

export async function getUserQuestDashboard(userId, options = {}) {
  const db = dbOf(options);
  if (options.deviceTimezone || options.timezone) {
    const tz = normalizeQuestTimezone(options.deviceTimezone || options.timezone);
    if (tz) await setQuestTimezone(userId, tz, options).catch(() => null);
  }
  const clock = await resolveClock(userId, options);

  try {
    await expireStaleQuests(userId, { ...options, db });
    await assignDailyQuests(userId, clock.today, options);
    await assignWeeklyQuests(userId, clock.week, options);
    await updateQuestProgress(userId, {}, { ...options, source: 'sync' });
  } catch (error) {
    if (!isPrismaMissing(error)) throw error;
    const profile = await getQuestProfile(userId, options).catch(() => null);
    return emptyQuestDashboard(clock, profile);
  }

  const quests = await db.userQuest.findMany({
    where: {
      userId,
      periodKey: { in: [clock.today, clock.week] },
    },
    include: { template: true },
    orderBy: [{ assignedAt: 'asc' }],
  });

  const claimedSourceIds = await loadClaimedQuestIds(db, userId, quests.map((row) => row.id));
  const extras = { claimedSourceIds };
  const daily = quests.filter((row) => row.template?.cadence === 'DAILY').map((row) => publicQuest(row, extras));
  const weekly = quests.filter((row) => row.template?.cadence === 'WEEKLY').map((row) => publicQuest(row, extras));
  daily.forEach(assertQuestRecordIsPrivate);
  weekly.forEach(assertQuestRecordIsPrivate);

  const profile = await publicProfile(userId, options);
  return {
    profile: {
      level: profile.currentLevel,
      rankKey: profile.rankKey,
      totalXp: profile.totalXp,
      coinBalance: profile.coinBalance,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      levelProgress: profile.levelProgress,
      timezone: profile.timezone,
    },
    daily: {
      periodKey: clock.today,
      timezone: clock.timezone,
      quests: daily,
    },
    weekly: {
      periodKey: clock.week,
      quests: weekly,
    },
    summary: {
      dailyCompleted: daily.filter((quest) => quest.status === COMPLETED || quest.status === CLAIMED).length,
      dailyTotal: daily.length,
      dailyClaimable: daily.filter((quest) => quest.claimable).length,
      weeklyCompleted: weekly.filter((quest) => quest.status === COMPLETED || quest.status === CLAIMED).length,
      unclaimedRewards: [...daily, ...weekly].filter((quest) => quest.claimable).length,
    },
  };
}

function emptyQuestDashboard(clock, profile) {
  return {
    profile: profile
      ? {
          level: profile.currentLevel,
          rankKey: profile.rankKey,
          totalXp: profile.totalXp,
          coinBalance: profile.coinBalance,
          currentStreak: profile.currentStreak,
          longestStreak: profile.longestStreak,
          levelProgress: profile.levelProgress,
          timezone: profile.timezone,
        }
      : null,
    daily: { periodKey: clock.today, timezone: clock.timezone, quests: [] },
    weekly: { periodKey: clock.week, quests: [] },
    summary: {
      dailyCompleted: 0,
      dailyTotal: 0,
      dailyClaimable: 0,
      weeklyCompleted: 0,
      unclaimedRewards: 0,
    },
    unavailable: true,
  };
}

async function loadClaimedQuestIds(db, userId, questIds) {
  const ids = questIds.filter(Boolean);
  if (!ids.length) return new Set();
  const rows = await db.rewardLedger.findMany({
    where: { userId, sourceType: 'QUEST', sourceId: { in: ids } },
  });
  return new Set(rows.map((row) => row.sourceId));
}

export async function getQuestHistory(userId, options = {}) {
  const db = dbOf(options);
  const clock = await resolveClock(userId, options);
  const from = options.from || addDaysYmd(clock.today, -30);
  const take = Math.min(80, Math.max(1, Number(options.take) || 40));
  const where = {
    userId,
    status: { in: [COMPLETED, CLAIMED, EXPIRED] },
    periodKey: { gte: from },
  };
  if (options.before) {
    where.assignedAt = { lt: new Date(options.before) };
  }
  const rows = await db.userQuest.findMany({
    where,
    include: { template: true },
    orderBy: { assignedAt: 'desc' },
    take: take + 1,
  });
  const page = rows.slice(0, take);
  const claimedSourceIds = await loadClaimedQuestIds(db, userId, page.map((row) => row.id));
  const items = page.map((row) => publicQuest(row, { claimedSourceIds }));
  const next = rows[take];
  return {
    timezone: clock.timezone,
    today: clock.today,
    items,
    nextCursor: next?.assignedAt
      ? (next.assignedAt instanceof Date ? next.assignedAt.toISOString() : next.assignedAt)
      : null,
  };
}

export async function getQuestRewards(userId, options = {}) {
  const db = dbOf(options);
  const take = Math.min(200, Number(options.take) || 50);
  const rows = await db.rewardLedger.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  let coins = 0;
  let xp = 0;
  let coinsEarned = 0;
  let coinsSpent = 0;
  let xpEarned = 0;
  let xpSpent = 0;
  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    if (row.currency === 'COIN') {
      coins += amount;
      if (amount >= 0) coinsEarned += amount;
      else coinsSpent += Math.abs(amount);
    }
    if (row.currency === 'XP') {
      xp += amount;
      if (amount >= 0) xpEarned += amount;
      else xpSpent += Math.abs(amount);
    }
  }
  return {
    balance: { coins, xp },
    totalEarned: { coins: coinsEarned, xp: xpEarned },
    totalSpent: { coins: coinsSpent, xp: xpSpent },
    transactions: rows.slice(0, take).map(publicRewardRow),
  };
}

/** Best-effort progress refresh. `signals` limits work to matching progressType values. */
export async function syncUserQuestProgress(userId, options = {}) {
  try {
    const clock = await resolveClock(userId, options);
    await assignDailyQuests(userId, clock.today, options);
    await assignWeeklyQuests(userId, clock.week, options);
    return await updateQuestProgress(userId, {}, { ...options, source: 'sync' });
  } catch (error) {
    if (isPrismaMissing(error)) return [];
    console.warn('[quest] progress sync failed', error?.message);
    return [];
  }
}

export { dailyPeriodKey };
