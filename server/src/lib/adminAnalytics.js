import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { getAppSettings } from './settings.js';
import { getMobileAppVersion } from './mobileAppVersion.js';
import {
  addDaysYmd,
  createdAtToTbilisiYmd,
  dateOnlyYmd,
  deltaSafe,
  enumerateYmds,
  fillDaySeries,
  mondayOfWeek,
  parseAnalyticsRange,
  rateSafe,
  tbilisiYmd,
  METRIC_DEFINITIONS,
} from './adminAnalyticsRange.js';
import { loadDecisionRows } from './notificationDecisions.js';
import { loadAppActivityRows } from './appActivity.js';
import { loadProductEvents } from './productEvents.js';
import { loadOutcomeRows } from './notificationOutcomes.js';
import {
  buildNotificationFunnel,
  buildTypePerformance,
  getDataQuality,
  getFeatureRetentionAnalytics,
  getPermissionAnalytics,
  getVersionAnalytics,
  getWeeklyInsightMedication,
  outcomeLatency,
  RATE_DEFINITIONS,
  versionAttention,
} from './adminAnalyticsV21.js';

export { METRIC_DEFINITIONS, RATE_DEFINITIONS };
export { getVersionAnalytics, getDataQuality, getFeatureRetentionAnalytics, getPermissionAnalytics, getWeeklyInsightMedication };

const CACHE_MS = 8_000;
const cache = new Map();
let indexesReady = false;

async function ensureAnalyticsIndexes() {
  if (indexesReady) return;
  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DailyCheckIn_date_idx" ON "DailyCheckIn"("date")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_lastCheckInDate_idx" ON "User"("lastCheckInDate")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CycleLog_date_idx" ON "CycleLog"("date")`);
  } catch (error) {
    console.warn('[analytics] index ensure failed', error?.message);
  }
  indexesReady = true;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 80) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  return value;
}

export function clearAdminAnalyticsCache() {
  cache.clear();
}

function rangeKey(prefix, range) {
  return `${prefix}:${range.preset}:${range.fromYmd}:${range.toYmd}`;
}

function createdIn(range, previous = false) {
  return previous
    ? { gte: range.prevFromDt, lt: range.prevToExclusiveDt }
    : { gte: range.fromDt, lt: range.toExclusiveDt };
}

function dateOnlyIn(range, previous = false) {
  return previous
    ? { gte: range.prevFrom, lte: range.prevTo }
    : { gte: range.from, lte: range.to };
}

function stringDateIn(range, previous = false) {
  return previous
    ? { gte: range.prevFromYmd, lte: range.prevToYmd }
    : { gte: range.fromYmd, lte: range.toYmd };
}

function uniqueCount(rows, key = 'userId') {
  return new Set(rows.map((row) => row[key]).filter(Boolean)).size;
}

function activityYmd(row) {
  return dateOnlyYmd(row.date) || createdAtToTbilisiYmd(row.lastAt || row.firstAt);
}

function hourInTbilisi(value) {
  if (!value) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const weekdayIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday);
  return { hour, weekday: weekdayIndex < 0 ? 0 : weekdayIndex };
}

function tokenTotals(usage) {
  if (!usage || typeof usage !== 'object') return { prompt: 0, completion: 0, total: 0 };
  const prompt = Number(usage.prompt_tokens ?? usage.promptTokens ?? usage.input_tokens ?? 0) || 0;
  const completion = Number(usage.completion_tokens ?? usage.completionTokens ?? usage.output_tokens ?? 0) || 0;
  const total = Number(usage.total_tokens ?? usage.totalTokens ?? prompt + completion) || 0;
  return { prompt, completion, total };
}

async function meta(range) {
  const settings = await getAppSettings();
  return {
    range: {
      preset: range.preset,
      from: range.fromYmd,
      to: range.toYmd,
      previousFrom: range.prevFromYmd,
      previousTo: range.prevToYmd,
      timezone: range.timezone,
      label: range.label,
      days: range.dayCount,
    },
    environment: env.NODE_ENV,
    appVersion: getMobileAppVersion(),
    refreshedAt: new Date().toISOString(),
    today: range.today,
    settings: {
      maintenanceMode: settings.maintenanceMode,
      forceUpdate: settings.forceUpdate,
      allowRegistrations: settings.allowRegistrations,
      minAppVersion: settings.minAppVersion,
    },
  };
}

export async function getOverviewAnalytics(query) {
  const range = parseAnalyticsRange(query);
  await ensureAnalyticsIndexes();
  const key = rangeKey('overview', range);
  const cached = cacheGet(key);
  if (cached) return cached;

  const today = range.today;
  const wauFrom = addDaysYmd(today, -6);
  const mauFrom = addDaysYmd(today, -29);

  const [
    totalUsers,
    newUsers,
    prevNewUsers,
    checkinsInRange,
    checkinsPrev,
    checkinsWau,
    checkinsMau,
    usersBeforeRange,
    chats,
    prevChats,
    aiInRange,
    hydrationDays,
    weightDays,
    cycleLogs,
    visitsCreated,
    medsCreated,
    prevHydrationDays,
    prevWeightDays,
    prevCycleLogs,
    prevVisitsCreated,
    prevMedsCreated,
    pushEvents,
    prevPushEvents,
    campaigns,
    prevCampaigns,
    settings,
    aiErrors24h,
    aiLast24h,
    smsFailed24h,
    lastSync,
    failedCampaigns24h,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: createdIn(range) } }),
    prisma.user.count({ where: { createdAt: createdIn(range, true) } }),
    loadAppActivityRows(range.fromYmd, range.toYmd),
    loadAppActivityRows(range.prevFromYmd, range.prevToYmd),
    loadAppActivityRows(wauFrom, today),
    loadAppActivityRows(mauFrom, today),
    prisma.user.count({ where: { createdAt: { lt: range.fromDt } } }),
    prisma.chatSession.count({ where: { createdAt: createdIn(range) } }),
    prisma.chatSession.count({ where: { createdAt: createdIn(range, true) } }),
    prisma.aiInteraction.count({ where: { createdAt: createdIn(range) } }),
    prisma.healthMetricDaily.count({
      where: { date: stringDateIn(range), hydrationMl: { gt: 0 } },
    }),
    prisma.healthMetricDaily.count({
      where: { date: stringDateIn(range), weightKg: { not: null } },
    }),
    prisma.cycleLog.count({ where: { date: stringDateIn(range) } }),
    prisma.doctorVisit.count({ where: { createdAt: createdIn(range) } }),
    prisma.medicationSchedule.count({ where: { createdAt: createdIn(range) } }),
    prisma.healthMetricDaily.count({
      where: { date: stringDateIn(range, true), hydrationMl: { gt: 0 } },
    }),
    prisma.healthMetricDaily.count({
      where: { date: stringDateIn(range, true), weightKg: { not: null } },
    }),
    prisma.cycleLog.count({ where: { date: stringDateIn(range, true) } }),
    prisma.doctorVisit.count({ where: { createdAt: createdIn(range, true) } }),
    prisma.medicationSchedule.count({ where: { createdAt: createdIn(range, true) } }),
    prisma.pushEvent.count({ where: { createdAt: createdIn(range) } }),
    prisma.pushEvent.count({ where: { createdAt: createdIn(range, true) } }),
    prisma.pushCampaign.aggregate({
      where: { sentAt: createdIn(range) },
      _sum: { sentCount: true },
    }),
    prisma.pushCampaign.aggregate({
      where: { sentAt: createdIn(range, true) },
      _sum: { sentCount: true },
    }),
    getAppSettings(),
    prisma.aiInteraction.count({
      where: { createdAt: { gte: new Date(Date.now() - 86_400_000) }, status: 'ERROR' },
    }),
    prisma.aiInteraction.count({
      where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    }),
    prisma.smsLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 86_400_000) }, status: 'FAILED' },
    }),
    prisma.syncRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.pushCampaign.count({
      where: { status: 'FAILED', createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    }),
  ]);

  const activeToday = uniqueCount(checkinsWau.filter((row) => activityYmd(row) === today));

  const newUserRows = await prisma.user.findMany({
    where: { createdAt: { gte: range.fromDt, lt: range.toExclusiveDt } },
    select: { createdAt: true },
  });

  const healthLogs = hydrationDays + weightDays + cycleLogs + visitsCreated + medsCreated;
  const prevHealthLogs = prevHydrationDays + prevWeightDays + prevCycleLogs + prevVisitsCreated + prevMedsCreated;
  const delivered = pushEvents + (campaigns._sum.sentCount ?? 0);
  const prevDelivered = prevPushEvents + (prevCampaigns._sum.sentCount ?? 0);

  const dauMap = new Map();
  for (const row of checkinsInRange) {
    const day = activityYmd(row);
    if (!day) continue;
    if (!dauMap.has(day)) dauMap.set(day, new Set());
    dauMap.get(day).add(row.userId);
  }
  const dauSeries = range.days.map((day) => ({ day, count: dauMap.get(day)?.size ?? 0 }));

  const newSeries = fillDaySeries(range.days, newUserRows, (row) => createdAtToTbilisiYmd(row.createdAt));
  let running = usersBeforeRange;
  const cumulative = newSeries.map((row) => {
    running += row.count;
    return { day: row.day, count: running };
  });

  const [versionStats, quality, permissions, notifNow, notifPrev] = await Promise.all([
    getVersionAnalytics(query).catch(() => null),
    getDataQuality().catch(() => null),
    getPermissionAnalytics().catch(() => null),
    Promise.all([
      loadDecisionRows(range.fromDt, range.toExclusiveDt),
      loadOutcomeRows(range.fromDt, range.toExclusiveDt),
    ]).then(([rows, outs]) => buildNotificationFunnel(rows, outs)).catch(() => null),
    Promise.all([
      loadDecisionRows(range.prevFromDt, range.prevToExclusiveDt),
      loadOutcomeRows(range.prevFromDt, range.prevToExclusiveDt),
    ]).then(([rows, outs]) => buildNotificationFunnel(rows, outs)).catch(() => null),
  ]);
  const attention = [
    ...buildAttention({
      settings,
      aiErrors24h,
      aiLast24h,
      smsFailed24h,
      lastSync,
      failedCampaigns24h,
      versionStats,
      quality,
      permissions,
    }),
    ...(versionStats ? versionAttention(versionStats) : []),
  ];
  const curDelivery = notifNow?.rates?.delivery;
  const prevDelivery = notifPrev?.rates?.delivery;
  if (
    curDelivery &&
    prevDelivery &&
    !curDelivery.hidden &&
    !prevDelivery.hidden &&
    prevDelivery.denominator >= 20 &&
    prevDelivery.value - curDelivery.value >= 20
  ) {
    attention.push({
      severity: 'warning',
      title: 'შეტყობინების მიწოდების წილი დაეცა',
      detail: `${prevDelivery.value}% → ${curDelivery.value}% წინა პერიოდთან შედარებით.`,
      href: '#/push',
      metric: { previous: prevDelivery, current: curDelivery },
    });
  }

  const payload = {
    ...(await meta(range)),
    kpis: {
      totalUsers: { value: totalUsers, definition: METRIC_DEFINITIONS.totalUsers, delta: null },
      activeToday: { value: activeToday, definition: METRIC_DEFINITIONS.activeToday, delta: null },
      wau: { value: uniqueCount(checkinsWau), definition: METRIC_DEFINITIONS.wau, delta: null },
      mau: { value: uniqueCount(checkinsMau), definition: METRIC_DEFINITIONS.mau, delta: null },
      newUsers: {
        value: newUsers,
        definition: METRIC_DEFINITIONS.newUsers,
        delta: deltaSafe(newUsers, prevNewUsers),
        spark: newSeries,
      },
      mediConversations: {
        value: chats,
        definition: METRIC_DEFINITIONS.mediConversations,
        delta: deltaSafe(chats, prevChats),
      },
      mediRequests: { value: aiInRange, definition: 'AiInteraction ჩანაწერები არჩეულ პერიოდში.' },
      healthLogs: {
        value: healthLogs,
        definition: METRIC_DEFINITIONS.healthLogs,
        delta: deltaSafe(healthLogs, prevHealthLogs),
      },
      notificationsDelivered: {
        value: delivered,
        definition: METRIC_DEFINITIONS.notificationsDelivered,
        delta: deltaSafe(delivered, prevDelivered),
      },
    },
    charts: {
      dau: { series: dauSeries, previousActiveUsers: uniqueCount(checkinsPrev), definition: METRIC_DEFINITIONS.dauSeries },
      growth: { newUsers: newSeries, cumulative },
    },
    attention,
    definitions: METRIC_DEFINITIONS,
  };

  return cacheSet(key, payload);
}

function buildAttention({ settings, aiErrors24h, aiLast24h, smsFailed24h, lastSync, failedCampaigns24h, quality, permissions }) {
  const items = [];
  if (settings.maintenanceMode) {
    items.push({
      severity: 'critical',
      title: 'ტექნიკური რეჟიმი ჩართულია',
      detail: settings.maintenanceMessage || 'API უარყოფს არაადმინურ ტრაფიკს.',
      when: settings.updatedAt,
      href: '#/settings',
    });
  }
  if (settings.forceUpdate) {
    items.push({
      severity: 'warning',
      title: 'იძულებითი განახლება ჩართულია',
      detail: `აპის ვერსია ${settings.minAppVersion}-ზე დაბლა API-ს ვერ გამოიყენებს.`,
      href: '#/settings',
    });
  }
  if (!settings.allowRegistrations) {
    items.push({
      severity: 'info',
      title: 'რეგისტრაცია დახურულია',
      detail: 'ახალი ანგარიშები ახლა დაბლოკილია.',
      href: '#/settings',
    });
  }
  const aiRate = rateSafe(aiErrors24h, aiLast24h);
  if (aiLast24h >= 5 && aiRate != null && aiRate >= 20) {
    items.push({
      severity: 'warning',
      title: 'AI შეცდომის წილი მომატებულია',
      detail: `${aiErrors24h} შეცდომა ${aiLast24h} მოთხოვნიდან ბოლო 24 საათში (${aiRate}%).`,
      href: '#/ai',
      metric: { errors: aiErrors24h, requests: aiLast24h, rate: aiRate },
    });
  }
  if (smsFailed24h >= 3) {
    items.push({
      severity: 'warning',
      title: 'SMS შეცდომები ბოლო 24 საათში',
      detail: `${smsFailed24h} SMS ვერ გაიგზავნა.`,
      href: '#/sms',
      metric: { failed: smsFailed24h },
    });
  }
  if (lastSync?.status === 'FAILED') {
    items.push({
      severity: 'warning',
      title: 'ფარმაციის ბოლო სინქი ჩაიშალა',
      detail: lastSync.error || `${lastSync.source} სინქი ჩაიშალა.`,
      when: lastSync.finishedAt || lastSync.startedAt,
      href: '#/pharmacy',
    });
  }
  if (failedCampaigns24h > 0) {
    items.push({
      severity: 'warning',
      title: 'Push კამპანია ჩაიშალა',
      detail: `${failedCampaigns24h} კამპანია მონიშნულია FAILED-ად ბოლო 24 საათში.`,
      href: '#/push',
    });
  }
  if (quality?.orphanOutcomes >= 10) {
    items.push({
      severity: 'warning',
      title: 'შედეგები გადაწყვეტილების გარეშე',
      detail: `${quality.orphanOutcomes} outcome-ს არ აქვს NotificationDecision.`,
      href: '#/quality',
      metric: { orphanOutcomes: quality.orphanOutcomes },
    });
  }
  if (permissions?.total >= 5 && permissions.disabledRate?.value != null && permissions.disabledRate.value >= 40) {
    items.push({
      severity: 'info',
      title: 'შეტყობინების ნებართვა გამორთულია',
      detail: `${permissions.disabled} / ${permissions.total} (${permissions.disabledRate.value}%).`,
      href: '#/quality',
      metric: permissions.disabledRate,
    });
  }
  return items;
}

export async function getUserActivityAnalytics(query) {
  const range = parseAnalyticsRange(query);
  const key = rangeKey(`users:${query.grain || 'dau'}`, range);
  const cached = cacheGet(key);
  if (cached) return cached;

  const lookbackDays = query.grain === 'mau' ? 29 : query.grain === 'wau' ? 6 : 0;
  const loadFrom = addDaysYmd(range.prevFromYmd, -lookbackDays);
  const rows = await loadAppActivityRows(loadFrom, range.toYmd);

  const byDay = new Map();
  for (const row of rows) {
    const day = activityYmd(row);
    if (!day) continue;
    if (!byDay.has(day)) byDay.set(day, new Set());
    byDay.get(day).add(row.userId);
  }

  const grain = ['dau', 'wau', 'mau'].includes(query.grain) ? query.grain : 'dau';
  const window = grain === 'mau' ? 30 : grain === 'wau' ? 7 : 1;
  const series = range.days.map((day) => {
    if (window === 1) return { day, count: byDay.get(day)?.size ?? 0 };
    const users = new Set();
    const start = addDaysYmd(day, -(window - 1));
    for (const ymd of enumerateYmds(start, day)) {
      const set = byDay.get(ymd);
      if (set) for (const id of set) users.add(id);
    }
    return { day, count: users.size };
  });

  const prevDays = enumerateYmds(range.prevFromYmd, range.prevToYmd);
  const previousSeries = prevDays.map((day) => {
    if (window === 1) return { day, count: byDay.get(day)?.size ?? 0 };
    const users = new Set();
    const start = addDaysYmd(day, -(window - 1));
    for (const ymd of enumerateYmds(start, day)) {
      const set = byDay.get(ymd);
      if (set) for (const id of set) users.add(id);
    }
    return { day, count: users.size };
  });
  const peak = series.reduce((best, row) => (row.count > (best?.count ?? -1) ? row : best), null);
  const lowest = series.reduce((best, row) => (row.count < (best?.count ?? Infinity) ? row : best), null);
  const average = series.length
    ? Math.round(series.reduce((sum, row) => sum + row.count, 0) / series.length)
    : 0;

  return cacheSet(key, {
    ...(await meta(range)),
    grain,
    series,
    previousSeries,
    summary: {
      peak: peak && series.some((row) => row.count > 0) ? peak : null,
      lowest: lowest && series.some((row) => row.count > 0) ? lowest : null,
      average: series.some((row) => row.count > 0) ? average : null,
    },
    definition:
      grain === 'dau'
        ? METRIC_DEFINITIONS.dauSeries
        : grain === 'wau'
          ? 'უნიკალური AppActivity 7-დღიან ფანჯარაში.'
          : 'უნიკალური AppActivity 30-დღიან ფანჯარაში.',
  });
}

export async function getFeatureAnalytics(query) {
  const range = parseAnalyticsRange(query);
  const key = rangeKey('features', range);
  const cached = cacheGet(key);
  if (cached) return cached;

  const activeUsers = uniqueCount(await loadAppActivityRows(range.fromYmd, range.toYmd));

  const [
    mediUsers,
    mediEvents,
    medUsers,
    medEvents,
    cycleUsers,
    cycleEvents,
    hydration,
    steps,
    weight,
    visitUsers,
    visitEvents,
    activeMedUsers,
    cycleProfiles,
    weeklyEvents,
    prevWeeklyEvents,
    prevMediUsers,
    prevMedUsers,
    prevCycleUsers,
    prevHydration,
    prevSteps,
    prevWeight,
    prevVisitUsers,
  ] = await Promise.all([
    prisma.aiInteraction.findMany({
      where: { createdAt: createdIn(range) },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.aiInteraction.count({ where: { createdAt: createdIn(range) } }),
    prisma.medicationSchedule.findMany({
      where: { createdAt: createdIn(range) },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.medicationSchedule.count({ where: { createdAt: createdIn(range) } }),
    prisma.cycleLog.findMany({
      where: { date: stringDateIn(range) },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.cycleLog.count({ where: { date: stringDateIn(range) } }),
    prisma.healthMetricDaily.findMany({
      where: { date: stringDateIn(range), hydrationMl: { gt: 0 } },
      select: { userId: true },
    }),
    prisma.healthMetricDaily.findMany({
      where: { date: stringDateIn(range), steps: { gt: 0 } },
      select: { userId: true },
    }),
    prisma.healthMetricDaily.findMany({
      where: { date: stringDateIn(range), weightKg: { not: null } },
      select: { userId: true },
    }),
    prisma.doctorVisit.findMany({
      where: { createdAt: createdIn(range) },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.doctorVisit.count({ where: { createdAt: createdIn(range) } }),
    prisma.medicationSchedule.findMany({
      where: { active: true },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.cycleProfile.count(),
    loadProductEvents(range.fromDt, range.toExclusiveDt, ['weekly_report_opened', 'weekly_report_generated']),
    loadProductEvents(range.prevFromDt, range.prevToExclusiveDt, ['weekly_report_opened']),
    prisma.aiInteraction.findMany({
      where: { createdAt: createdIn(range, true) },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.medicationSchedule.findMany({
      where: { createdAt: createdIn(range, true) },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.cycleLog.findMany({
      where: { date: stringDateIn(range, true) },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.healthMetricDaily.findMany({
      where: { date: stringDateIn(range, true), hydrationMl: { gt: 0 } },
      select: { userId: true },
    }),
    prisma.healthMetricDaily.findMany({
      where: { date: stringDateIn(range, true), steps: { gt: 0 } },
      select: { userId: true },
    }),
    prisma.healthMetricDaily.findMany({
      where: { date: stringDateIn(range, true), weightKg: { not: null } },
      select: { userId: true },
    }),
    prisma.doctorVisit.findMany({
      where: { createdAt: createdIn(range, true) },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  const features = [
    {
      key: 'medi',
      label: 'Medi',
      action: 'AI მოთხოვნა (AiInteraction)',
      users: mediUsers.length,
      events: mediEvents,
      href: '#/ai',
    },
    {
      key: 'medications',
      label: 'მედიკამენტები',
      action: 'მედიკამენტის გრაფიკი შეიქმნა',
      users: medUsers.length,
      events: medEvents,
      adoption: activeMedUsers.length,
      note: 'მიღების ფაქტი ტელეფონზე რჩება. აქ ითვლება დაყენებული გრაფიკები.',
      href: '#/health',
    },
    {
      key: 'cycle',
      label: 'ციკლი',
      action: 'ციკლის ჩანაწერი შეიქმნა',
      users: cycleUsers.length,
      events: cycleEvents,
      adoption: cycleProfiles,
      note: 'მხოლოდ რაოდენობა. ნაკადი, სიმპტომები და შენიშვნები არ ჩანს.',
      href: '#/health',
    },
    {
      key: 'hydration',
      label: 'ჰიდრატაცია',
      action: 'დღე, სადაც hydrationMl > 0',
      users: uniqueCount(hydration),
      events: hydration.length,
      href: '#/health',
    },
    {
      key: 'steps',
      label: 'ნაბიჯები',
      action: 'დღე, სადაც ნაბიჯები > 0',
      users: uniqueCount(steps),
      events: steps.length,
      href: '#/health',
    },
    {
      key: 'weight',
      label: 'წონა',
      action: 'დღე წონის გაზომვით',
      users: uniqueCount(weight),
      events: weight.length,
      href: '#/health',
    },
    {
      key: 'visits',
      label: 'ვიზიტები',
      action: 'ექიმთან ვიზიტი შეიქმნა',
      users: visitUsers.length,
      events: visitEvents,
      href: '#/health',
    },
    {
      key: 'weekly_report',
      label: 'ყოველკვირეული ანგარიში',
      action: 'ანგარიშის ეკრანი გაიხსნა',
      users: uniqueCount(weeklyEvents.filter((row) => row.kind === 'weekly_report_opened')),
      events: weeklyEvents.filter((row) => row.kind === 'weekly_report_opened').length,
      href: '#/health?feature=weekly_report',
      prevUsers: uniqueCount(prevWeeklyEvents),
    },
  ].map((row) => {
    const prevUsers = row.prevUsers
      ?? (row.key === 'medi' ? prevMediUsers.length
        : row.key === 'medications' ? prevMedUsers.length
          : row.key === 'cycle' ? prevCycleUsers.length
            : row.key === 'hydration' ? uniqueCount(prevHydration)
              : row.key === 'steps' ? uniqueCount(prevSteps)
                : row.key === 'weight' ? uniqueCount(prevWeight)
                  : row.key === 'visits' ? prevVisitUsers.length
                    : null);
    return {
      ...row,
      prevUsers,
      pctOfActive: row.users == null ? null : rateSafe(row.users, activeUsers),
      delta: row.users == null ? null : deltaSafe(row.users, prevUsers || 0),
    };
  });

  return cacheSet(key, {
    ...(await meta(range)),
    activeUsers,
    features,
  });
}

export async function getRetentionAnalytics(query) {
  const range = parseAnalyticsRange({ range: query.range || '90d', from: query.from, to: query.to });
  const key = rangeKey('retention', range);
  const cached = cacheGet(key);
  if (cached) return cached;

  const today = range.today;
  const [users, checkins, activity] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { lt: range.toExclusiveDt } },
      select: { id: true, createdAt: true },
    }),
    prisma.dailyCheckIn.findMany({
      select: { userId: true, date: true },
    }),
    loadAppActivityRows(addDaysYmd(range.today, -400), range.today),
  ]);

  const checkinByUser = new Map();
  for (const row of [...checkins, ...activity]) {
    const day = activityYmd(row) || dateOnlyYmd(row.date);
    if (!day) continue;
    if (!checkinByUser.has(row.userId)) checkinByUser.set(row.userId, new Set());
    checkinByUser.get(row.userId).add(day);
  }

  function retained(offset) {
    const eligible = users.filter((user) => {
      const signup = createdAtToTbilisiYmd(user.createdAt);
      return signup && signup <= addDaysYmd(today, -offset);
    });
    if (eligible.length < 5) {
      return { available: false, eligible: eligible.length, retained: 0, rate: null };
    }
    let kept = 0;
    for (const user of eligible) {
      const signup = createdAtToTbilisiYmd(user.createdAt);
      const days = checkinByUser.get(user.id);
      if (days?.has(addDaysYmd(signup, offset))) kept += 1;
    }
    return {
      available: true,
      eligible: eligible.length,
      retained: kept,
      rate: rateSafe(kept, eligible.length),
    };
  }

  const d1 = retained(1);
  const d7 = retained(7);
  const d30 = retained(30);

  const cohortWeeks = [];
  let weekStart = mondayOfWeek(addDaysYmd(today, -7 * 7));
  for (let i = 0; i < 8; i += 1) {
    const weekEnd = addDaysYmd(weekStart, 6);
    const cohort = users.filter((user) => {
      const signup = createdAtToTbilisiYmd(user.createdAt);
      return signup && signup >= weekStart && signup <= weekEnd;
    });
    const cells = [];
    for (let w = 0; w <= 4; w += 1) {
      const windowStart = addDaysYmd(weekStart, w * 7);
      const windowEnd = addDaysYmd(windowStart, 6);
      if (windowStart > today) {
        cells.push({ week: w, rate: null, retained: 0, eligible: cohort.length });
        continue;
      }
      let kept = 0;
      for (const user of cohort) {
        const days = checkinByUser.get(user.id);
        if (!days) continue;
        let hit = false;
        for (const day of days) {
          if (day >= windowStart && day <= windowEnd) {
            hit = true;
            break;
          }
        }
        if (hit) kept += 1;
      }
      cells.push({
        week: w,
        retained: kept,
        eligible: cohort.length,
        rate: cohort.length >= 3 ? rateSafe(kept, cohort.length) : null,
      });
    }
    cohortWeeks.push({ weekStart, size: cohort.length, cells });
    weekStart = addDaysYmd(weekStart, 7);
  }

  const available = d1.available || d7.available || d30.available;
  return cacheSet(key, {
    ...(await meta(range)),
    available,
    reason: available ? null : 'D1-ისთვის საკმარისი არ არის 5 მომხმარებელი, ან აქტივობის ისტორია ცარიელია.',
    d1,
    d7,
    d30,
    cohorts: cohortWeeks,
    definition: METRIC_DEFINITIONS.retentionD1,
  });
}

export async function getMediAnalytics(query) {
  const range = parseAnalyticsRange(query);
  const key = rangeKey('medi', range);
  const cached = cacheGet(key);
  if (cached) return cached;

  const [rows, prevRows, sessions, prevSessions, usersBefore] = await Promise.all([
    prisma.aiInteraction.findMany({
      where: { createdAt: createdIn(range) },
      select: {
        userId: true,
        status: true,
        mode: true,
        latencyMs: true,
        tokenUsage: true,
        reasoningModel: true,
        visionModel: true,
        createdAt: true,
        chatSessionId: true,
      },
    }),
    prisma.aiInteraction.findMany({
      where: { createdAt: createdIn(range, true) },
      select: { userId: true, status: true },
    }),
    prisma.chatSession.findMany({
      where: { createdAt: createdIn(range) },
      select: { id: true, userId: true, createdAt: true },
    }),
    prisma.chatSession.count({ where: { createdAt: createdIn(range, true) } }),
    prisma.aiInteraction.findMany({
      where: { createdAt: { lt: range.fromDt } },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ]);

  const prior = new Set(usersBefore.map((row) => row.userId));
  const mediUsers = uniqueCount(rows);
  const returning = [...new Set(rows.map((r) => r.userId))].filter((id) => prior.has(id)).length;
  const errors = rows.filter((r) => r.status === 'ERROR').length;
  const latencies = rows.map((r) => r.latencyMs).filter((n) => Number.isFinite(n));
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((sum, n) => sum + n, 0) / latencies.length)
    : null;

  let tokens = { prompt: 0, completion: 0, total: 0 };
  const byModel = new Map();
  const byMode = new Map();
  for (const row of rows) {
    const t = tokenTotals(row.tokenUsage);
    tokens = {
      prompt: tokens.prompt + t.prompt,
      completion: tokens.completion + t.completion,
      total: tokens.total + t.total,
    };
    const model = row.reasoningModel || row.visionModel || 'unknown';
    byModel.set(model, (byModel.get(model) || 0) + 1);
    byMode.set(row.mode || 'UNKNOWN', (byMode.get(row.mode || 'UNKNOWN') || 0) + 1);
  }

  const conversations = fillDaySeries(range.days, sessions, (row) => createdAtToTbilisiYmd(row.createdAt));
  const messages = fillDaySeries(range.days, rows, (row) => createdAtToTbilisiYmd(row.createdAt));
  const usersByDay = new Map();
  for (const row of rows) {
    const day = createdAtToTbilisiYmd(row.createdAt);
    if (!day) continue;
    if (!usersByDay.has(day)) usersByDay.set(day, new Set());
    usersByDay.get(day).add(row.userId);
  }
  const usersSeries = range.days.map((day) => ({ day, count: usersByDay.get(day)?.size ?? 0 }));
  const errorSeries = fillDaySeries(
    range.days,
    rows.filter((r) => r.status === 'ERROR'),
    (row) => createdAtToTbilisiYmd(row.createdAt),
  );

  return cacheSet(key, {
    ...(await meta(range)),
    kpis: {
      mediUsers: { value: mediUsers, delta: deltaSafe(mediUsers, uniqueCount(prevRows)) },
      conversations: { value: sessions.length, delta: deltaSafe(sessions.length, prevSessions) },
      messages: { value: rows.length, delta: deltaSafe(rows.length, prevRows.length) },
      avgMessagesPerConversation: {
        value: sessions.length ? Math.round((rows.length / sessions.length) * 10) / 10 : null,
        note: 'AiInteraction / ChatSession რაოდენობა პერიოდში. საუბრის ტექსტი არ არის.',
      },
      returningUsers: { value: returning },
      errors: { value: errors, delta: deltaSafe(errors, prevRows.filter((r) => r.status === 'ERROR').length) },
      errorRate: { value: rateSafe(errors, rows.length) },
      avgLatencyMs: { value: avgLatency },
      tokens,
      estimatedCostUsd: null,
      estimatedCostNote: 'მოდელის ფასი საიმედოდ არ ინახება. ნაჩვენებია ტოკენები, არა გამოგონილი USD.',
    },
    charts: {
      conversations,
      messages,
      users: usersSeries,
      errors: errorSeries,
    },
    byModel: [...byModel.entries()].map(([model, count]) => ({ model, count })).sort((a, b) => b.count - a.count),
    byMode: [...byMode.entries()].map(([mode, count]) => ({ mode, count })).sort((a, b) => b.count - a.count),
    privacy: 'პირადი საუბრის ტექსტი აქედან არ ბრუნდება.',
  });
}

export async function getNotificationAnalytics(query) {
  const range = parseAnalyticsRange(query);
  const key = rangeKey('notifications', range);
  const cached = cacheGet(key);
  if (cached) return cached;

  const [events, prevEvents, campaigns, decisions, prevDecisions, checkins, outcomes, prevOutcomes] = await Promise.all([
    prisma.pushEvent.findMany({
      where: { createdAt: createdIn(range) },
      select: { key: true, createdAt: true, source: true },
    }),
    prisma.pushEvent.count({ where: { createdAt: createdIn(range, true) } }),
    prisma.pushCampaign.findMany({
      where: { sentAt: createdIn(range) },
      select: { sentCount: true, failedCount: true, sentAt: true, status: true },
    }),
    loadDecisionRows(range.fromDt, range.toExclusiveDt),
    loadDecisionRows(range.prevFromDt, range.prevToExclusiveDt),
    loadAppActivityRows(range.fromYmd, range.toYmd),
    loadOutcomeRows(range.fromDt, range.toExclusiveDt),
    loadOutcomeRows(range.prevFromDt, range.prevToExclusiveDt),
  ]);

  const deliveredEvents = events.length + campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
  const funnel = buildNotificationFunnel(decisions, outcomes);

  const reasons = new Map();
  const latestFatigue = new Map();
  for (const row of decisions) {
    if (row.result === 'BLOCKED') {
      const reason = row.reason || 'unspecified';
      reasons.set(reason, (reasons.get(reason) || 0) + 1);
    }
    if (row.selectedFrequency || row.baseDailyCap != null) {
      latestFatigue.set(row.userId, {
        selectedFrequency: row.selectedFrequency,
        baseDailyCap: row.baseDailyCap,
        adaptiveDailyCap: row.adaptiveDailyCap,
        ewma: row.ewma,
      });
    }
  }

  const types = buildTypePerformance(decisions, outcomes, prevDecisions, prevOutcomes).types;

  const fatigueDist = { normal: 0, reduced: 0, highlyReduced: 0, unknown: 0 };
  for (const row of latestFatigue.values()) {
    const base = Number(row.baseDailyCap);
    const adaptive = Number(row.adaptiveDailyCap);
    if (!Number.isFinite(base) || !Number.isFinite(adaptive)) {
      fatigueDist.unknown += 1;
    } else if (adaptive >= base) {
      fatigueDist.normal += 1;
    } else if (adaptive <= Math.max(1, Math.floor(base / 3))) {
      fatigueDist.highlyReduced += 1;
    } else {
      fatigueDist.reduced += 1;
    }
  }

  const hours = Array.from({ length: 24 }, () => ({ hour: 0, appOpens: 0, notifications: 0 }));
  hours.forEach((row, i) => { row.hour = i; });
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const row of checkins) {
    const stamp = hourInTbilisi(row.lastAt || row.firstAt);
    if (!stamp) continue;
    hours[stamp.hour].appOpens += 1;
    heatmap[stamp.weekday][stamp.hour] += 1;
  }
  for (const row of events) {
    const stamp = hourInTbilisi(row.createdAt);
    if (!stamp) continue;
    hours[stamp.hour].notifications += 1;
  }

  const peakHour = hours.reduce((best, row) => (row.appOpens > best.appOpens ? row : best), hours[0]);

  return cacheSet(key, {
    ...(await meta(range)),
    kpis: {
      delivered: { value: deliveredEvents, delta: deltaSafe(deliveredEvents, prevEvents) },
      evaluated: { value: funnel.evaluated, delta: deltaSafe(funnel.evaluated, prevDecisions.length) },
      suppressed: { value: funnel.suppressed },
      cancelled: { value: funnel.cancelled },
      openRate: funnel.rates.open,
      actionRate: funnel.rates.action,
      directActionRate: funnel.rates.directAction,
      deliveryRate: funnel.rates.delivery,
    },
    funnel,
    latency: outcomeLatency(outcomes),
    rateDefinitions: RATE_DEFINITIONS,
    funnelNote: funnel.note,
    charts: {
      delivered: fillDaySeries(range.days, events, (row) => createdAtToTbilisiYmd(row.createdAt)),
      observedDelivery: fillDaySeries(
        range.days,
        outcomes.filter((row) => ['delivered', 'opened', 'actioned', 'snoozed'].includes(row.outcome)),
        (row) => createdAtToTbilisiYmd(row.occurredAt),
      ),
      opened: fillDaySeries(
        range.days,
        outcomes.filter((row) => row.outcome === 'opened'),
        (row) => createdAtToTbilisiYmd(row.occurredAt),
      ),
      actioned: fillDaySeries(
        range.days,
        outcomes.filter((row) => row.outcome === 'actioned'),
        (row) => createdAtToTbilisiYmd(row.occurredAt),
      ),
      suppressed: fillDaySeries(
        range.days,
        decisions.filter((d) => d.result === 'BLOCKED'),
        (row) => createdAtToTbilisiYmd(row.createdAt),
      ),
      cancelled: fillDaySeries(
        range.days,
        decisions.filter((d) => d.result === 'CANCELLED'),
        (row) => createdAtToTbilisiYmd(row.createdAt),
      ),
    },
    highlights: {
      topFamily: types.filter((row) => (row.delivered || 0) >= 5).sort((a, b) => (b.actionRate?.value ?? -1) - (a.actionRate?.value ?? -1))[0] || null,
      mostSuppressed: types.filter((row) => (row.evaluated || 0) >= 5).sort((a, b) => (b.suppressed || 0) - (a.suppressed || 0))[0] || null,
      topReason: [...reasons.entries()].sort((a, b) => b[1] - a[1])[0]
        ? { reason: [...reasons.entries()].sort((a, b) => b[1] - a[1])[0][0], count: [...reasons.entries()].sort((a, b) => b[1] - a[1])[0][1] }
        : null,
    },
    types,
    suppressions: [...reasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    fatigue: {
      sampleUsers: latestFatigue.size,
      distribution: fatigueDist,
      note: 'selectedFrequency არის მომხმარებლის არჩევანი. adaptiveDailyCap არის Brain EWMA. ეს ერთი და იგივე არ არის.',
    },
    engagement: {
      hours,
      heatmap,
      bestHour: peakHour.appOpens ? peakHour.hour : null,
      source: 'აპის გახსნა AppActivity.lastAt-ით, თბილისის კალენდრით. ეს არ არის შეტყობინების სასურველი საათი.',
      preferredWindow: null,
    },
    syncedDecisions: decisions.length,
    syncedOutcomes: outcomes.length,
  });
}

export async function getSystemHealth() {
  const key = 'system:health';
  const cached = cacheGet(key);
  if (cached) return cached;

  const since24h = new Date(Date.now() - 86_400_000);
  const since7d = new Date(Date.now() - 7 * 86_400_000);
  let dbOk = false;
  let dbMs = null;
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbMs = Date.now() - start;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const [settings, ai24, aiErr24, ai7, aiErr7, sms24, smsFail24, pushFail24, lastSync, runningSync] = await Promise.all([
    getAppSettings(),
    prisma.aiInteraction.count({ where: { createdAt: { gte: since24h } } }),
    prisma.aiInteraction.count({ where: { createdAt: { gte: since24h }, status: 'ERROR' } }),
    prisma.aiInteraction.findMany({
      where: { createdAt: { gte: since7d }, status: 'ERROR' },
      select: { createdAt: true },
    }),
    prisma.aiInteraction.count({ where: { createdAt: { gte: since7d }, status: 'ERROR' } }),
    prisma.smsLog.count({ where: { createdAt: { gte: since24h } } }),
    prisma.smsLog.count({ where: { createdAt: { gte: since24h }, status: 'FAILED' } }),
    prisma.pushCampaign.aggregate({
      where: { sentAt: { gte: since24h } },
      _sum: { failedCount: true, sentCount: true },
    }),
    prisma.syncRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.syncRun.findFirst({ where: { status: 'RUNNING' }, orderBy: { startedAt: 'desc' } }),
  ]);

  const days = enumerateYmds(addDaysYmd(tbilisiYmd(), -6), tbilisiYmd());
  const aiErrorSeries = fillDaySeries(days, ai7, (row) => createdAtToTbilisiYmd(row.createdAt));

  return cacheSet(key, {
    environment: env.NODE_ENV,
    appVersion: getMobileAppVersion(),
    refreshedAt: new Date().toISOString(),
    database: { ok: dbOk, latencyMs: dbMs },
    api: { ok: true, note: 'ეს პასუხი თვითონ არის API-ის სიცოცხლის შემოწმება.' },
    settings: {
      maintenanceMode: settings.maintenanceMode,
      forceUpdate: settings.forceUpdate,
      allowRegistrations: settings.allowRegistrations,
      minAppVersion: settings.minAppVersion,
    },
    ai: {
      last24h: ai24,
      errors24h: aiErr24,
      errorRate24h: rateSafe(aiErr24, ai24),
      errors7d: aiErr7,
      series: aiErrorSeries,
    },
    push: {
      sent24h: pushFail24._sum.sentCount ?? 0,
      failed24h: pushFail24._sum.failedCount ?? 0,
    },
    sms: { last24h: sms24, failed24h: smsFail24 },
    jobs: {
      lastSync: lastSync
        ? {
            id: lastSync.id,
            source: lastSync.source,
            status: lastSync.status,
            startedAt: lastSync.startedAt,
            finishedAt: lastSync.finishedAt,
            itemsFetched: lastSync.itemsFetched,
            error: lastSync.error,
          }
        : null,
      running: Boolean(runningSync),
    },
    attention: buildAttention({
      settings,
      aiErrors24h: aiErr24,
      aiLast24h: ai24,
      smsFailed24h: smsFail24,
      lastSync,
      failedCampaigns24h: 0,
    }),
  });
}

export function parseRangeOrThrow(query) {
  try {
    return parseAnalyticsRange(query);
  } catch (error) {
    throw error;
  }
}
