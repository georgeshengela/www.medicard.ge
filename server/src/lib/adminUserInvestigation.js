import { prisma } from './prisma.js';
import { APP_VERSION_POLICY } from './appVersionPolicy.js';
import { ensureAppActivityTable } from './appActivity.js';
import { ensureProductEventTable } from './productEvents.js';
import { ensureMedicationDoseEventTable } from './medicationDoseEvents.js';
import { listNotificationDecisions } from './notificationDecisions.js';
import { listNotificationOutcomes } from './notificationOutcomes.js';
import { listAdminAudit } from './adminAudit.js';
import { loadPermissionForUser } from './notificationPermission.js';
import {
  enrichDecisions,
  fatigueState,
  telemetryCapability,
} from './clientContext.js';
import { loadUserLocationRow } from './userLocation.js';
import { publicPlaceSnapshot } from './geoPlace.js';

export const PRIVACY_FORBIDDEN_KEYS = [
  'messages',
  'userPrompt',
  'assistantReply',
  'medName',
  'dosage',
  'notes',
  'doctorFirstName',
  'doctorLastName',
  'doctorName',
  'symptoms',
  'moods',
  'flow',
  'bbt',
  'weightKg',
  'hydrationMl',
  'steps',
  'heartRate',
  'sleepHours',
  'lastPeriodStart',
  'dueDate',
  'aiInsights',
  'conditions',
  'title',
  'body',
];

export function assertNoPrivacyFields(payload) {
  const seen = [];
  const walk = (value, path) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      if (PRIVACY_FORBIDDEN_KEYS.includes(key)) seen.push(next);
      walk(item, next);
    }
  };
  walk(payload, '');
  return seen;
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function minDate(values) {
  const times = values.map((value) => new Date(value).getTime()).filter(Number.isFinite);
  return times.length ? new Date(Math.min(...times)).toISOString() : null;
}

function maxDate(values) {
  const times = values.map((value) => new Date(value).getTime()).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

function featureRow({ used, firstUsed, lastUsed, periodCount }) {
  return {
    used: Boolean(used),
    firstUsed: firstUsed || null,
    lastUsed: lastUsed || null,
    periodCount: Number(periodCount) || 0,
  };
}

function inRange(iso, fromDt, toExclusiveDt) {
  const at = new Date(iso).getTime();
  return Number.isFinite(at) && at >= fromDt.getTime() && at < toExclusiveDt.getTime();
}

async function ignoreMissing(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error?.code === 'P2010' || /does not exist/i.test(error?.message || '')) return null;
    throw error;
  }
}

function capAdaptedByMedi(selectedFrequency, adaptiveDailyCap) {
  return String(selectedFrequency || '') === 'often' && Number(adaptiveDailyCap) === 1;
}

export function buildSanitizedTimeline({
  activities = [],
  chats = [],
  weeklyOpened = [],
  medEvents = [],
  outcomes = [],
  permissionEvents = [],
} = {}) {
  const rows = [];
  for (const row of activities) {
    const screen = String(row.activityType || '').trim();
    rows.push({
      event: 'app_opened',
      label: screen && screen !== 'open' && screen !== 'heartbeat' ? `აქტივობა · ${screen}` : 'აპი გაიხსნა',
      at: safeDate(row.lastAt || row.firstAt),
      platform: row.platform || null,
      appVersion: row.appVersion || null,
      source: 'AppActivity',
      activityType: screen || null,
    });
  }
  for (const row of chats) {
    rows.push({
      event: 'medi_chat_started',
      label: 'Medi საუბარი დაიწყო',
      at: safeDate(row.createdAt),
      platform: null,
      appVersion: null,
      source: 'ChatSession',
    });
  }
  for (const row of weeklyOpened) {
    rows.push({
      event: 'weekly_report_opened',
      label: 'კვირის ანგარიში გაიხსნა',
      at: safeDate(row.occurredAt),
      platform: row.platform || null,
      appVersion: row.appVersion || null,
      source: 'ProductEvent',
    });
  }
  for (const row of medEvents) {
    rows.push({
      event: 'medications_used',
      label: 'მედიკამენტების ფუნქცია გამოიყენეს',
      at: safeDate(row.occurredAt || row.createdAt),
      platform: null,
      appVersion: null,
      source: row.source || 'MedicationDoseEvent',
    });
  }
  for (const row of outcomes) {
    if (row.outcome === 'opened') {
      rows.push({
        event: 'notification_opened',
        label: 'შეტყობინება გაიხსნა',
        at: safeDate(row.occurredAt),
        platform: row.platform || null,
        appVersion: row.appVersion || null,
        source: 'NotificationOutcome',
        decisionId: row.decisionId || null,
      });
    }
    if (row.outcome === 'actioned') {
      rows.push({
        event: 'notification_actioned',
        label: 'შეტყობინებაზე ქმედება შესრულდა',
        at: safeDate(row.occurredAt),
        platform: row.platform || null,
        appVersion: row.appVersion || null,
        source: 'NotificationOutcome',
        decisionId: row.decisionId || null,
      });
    }
  }
  for (const row of permissionEvents) {
    rows.push({
      event: 'notification_permission_changed',
      label: 'ნოტიფიკაციის ნებართვა შეიცვალა',
      at: safeDate(row.occurredAt),
      platform: row.platform || null,
      appVersion: row.appVersion || null,
      source: 'ProductEvent',
    });
  }
  return rows
    .filter((row) => row.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 80);
}

export async function getUserInvestigation(userId, range = {}, policy = APP_VERSION_POLICY) {
  const fromDt = range.fromDt || new Date(Date.now() - 30 * 86_400_000);
  const toExclusiveDt = range.toExclusiveDt || new Date(Date.now() + 86_400_000);
  const fromYmd = fromDt.toISOString().slice(0, 10);
  const toYmd = toExclusiveDt.toISOString().slice(0, 10);

  await Promise.all([
    ensureAppActivityTable().catch(() => {}),
    ensureProductEventTable().catch(() => {}),
    ensureMedicationDoseEventTable().catch(() => {}),
  ]);

  const [
    activities,
    chats,
    mediAgg,
    medSchedules,
    doseEvents,
    cycleProfile,
    cycleLogs,
    healthFlags,
    visits,
    productEvents,
    permission,
    tokens,
    listed,
    outcomesListed,
    audit,
    mediPeriodCount,
    locationRow,
  ] = await Promise.all([
    ignoreMissing(() => prisma.$queryRaw`
      SELECT "firstAt", "lastAt", "platform", "appVersion", "activityType", "date"
      FROM "AppActivity"
      WHERE "userId" = ${userId}
      ORDER BY "lastAt" DESC
      LIMIT 90
    `).then((rows) => rows || []),
    ignoreMissing(() => prisma.chatSession.findMany({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 80,
    })).then((rows) => rows || []),
    ignoreMissing(() => prisma.aiInteraction.aggregate({
      where: { userId },
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    })),
    ignoreMissing(() => prisma.medicationSchedule.findMany({
      where: { userId },
      select: { createdAt: true },
    })).then((rows) => rows || []),
    ignoreMissing(() => prisma.$queryRaw`
      SELECT "occurredAt", "status", "source"
      FROM "MedicationDoseEvent"
      WHERE "userId" = ${userId}
      ORDER BY "occurredAt" DESC
      LIMIT 80
    `).then((rows) => rows || []),
    ignoreMissing(() => prisma.cycleProfile.findUnique({
      where: { userId },
      select: { createdAt: true, updatedAt: true },
    })),
    ignoreMissing(() => prisma.cycleLog.findMany({
      where: { userId },
      select: { date: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 80,
    })).then((rows) => rows || []),
    ignoreMissing(() => prisma.$queryRaw`
      SELECT
        MIN(CASE WHEN "hydrationMl" IS NOT NULL AND "hydrationMl" > 0 THEN "date" END) AS hydration_first,
        MAX(CASE WHEN "hydrationMl" IS NOT NULL AND "hydrationMl" > 0 THEN "date" END) AS hydration_last,
        COUNT(*) FILTER (WHERE "hydrationMl" IS NOT NULL AND "hydrationMl" > 0)::int AS hydration_all,
        COUNT(*) FILTER (WHERE "hydrationMl" IS NOT NULL AND "hydrationMl" > 0 AND "date" >= ${fromYmd} AND "date" < ${toYmd})::int AS hydration_period,
        MIN(CASE WHEN steps IS NOT NULL AND steps > 0 THEN "date" END) AS steps_first,
        MAX(CASE WHEN steps IS NOT NULL AND steps > 0 THEN "date" END) AS steps_last,
        COUNT(*) FILTER (WHERE steps IS NOT NULL AND steps > 0)::int AS steps_all,
        COUNT(*) FILTER (WHERE steps IS NOT NULL AND steps > 0 AND "date" >= ${fromYmd} AND "date" < ${toYmd})::int AS steps_period,
        MIN(CASE WHEN "weightKg" IS NOT NULL THEN "date" END) AS weight_first,
        MAX(CASE WHEN "weightKg" IS NOT NULL THEN "date" END) AS weight_last,
        COUNT(*) FILTER (WHERE "weightKg" IS NOT NULL)::int AS weight_all,
        COUNT(*) FILTER (WHERE "weightKg" IS NOT NULL AND "date" >= ${fromYmd} AND "date" < ${toYmd})::int AS weight_period
      FROM "HealthMetricDaily"
      WHERE "userId" = ${userId}
    `).then((rows) => rows?.[0] || {}),
    ignoreMissing(() => prisma.doctorVisit.findMany({
      where: { userId },
      select: { createdAt: true, visitDate: true },
    })).then((rows) => rows || []),
    ignoreMissing(() => prisma.$queryRaw`
      SELECT "kind", "category", "source", "occurredAt", "platform", "appVersion"
      FROM "ProductEvent"
      WHERE "userId" = ${userId}
      ORDER BY "occurredAt" DESC
      LIMIT 80
    `).then((rows) => rows || []),
    loadPermissionForUser(userId).catch(() => null),
    prisma.pushToken.findMany({
      where: { userId, active: true },
      select: { platform: true, lastSeenAt: true, createdAt: true },
      orderBy: { lastSeenAt: 'desc' },
    }).catch(() => []),
    listNotificationDecisions({
      fromDt,
      toExclusiveDt,
      userId,
      limit: 40,
      offset: 0,
    }).catch(() => ({ decisions: [] })),
    listNotificationOutcomes({
      fromDt,
      toExclusiveDt,
      userId,
      limit: 40,
      offset: 0,
    }).catch(() => ({ outcomes: [] })),
    listAdminAudit({ targetId: userId, limit: 40, offset: 0 }).catch(() => ({ entries: [] })),
    countMediInRange(userId, fromDt, toExclusiveDt),
    loadUserLocationRow(userId).catch(() => null),
  ]);

  const decisions = await enrichDecisions(listed.decisions || [], policy);
  const outcomes = (outcomesListed.outcomes || []).map((row) => ({
    decisionId: row.decisionId,
    outcome: row.outcome,
    actionKey: row.actionKey || '',
    occurredAt: row.occurredAt,
    platform: row.platform || null,
    appVersion: row.appVersion || null,
  }));

  const weeklyOpened = productEvents.filter((row) => row.kind === 'weekly_report_opened');
  const permissionEvents = productEvents.filter((row) => row.kind === 'notification_permission');
  const latestActivity = activities[0] || null;
  const latestDecision = decisions[0] || null;
  const selectedFrequency = latestDecision?.selectedFrequency || null;
  const baseDailyCap = latestDecision?.baseDailyCap ?? null;
  const adaptiveDailyCap = latestDecision?.adaptiveDailyCap ?? null;
  const latestVersion = latestActivity?.appVersion || null;
  const telemetry = telemetryCapability(latestVersion, policy);
  const adapted = capAdaptedByMedi(selectedFrequency, adaptiveDailyCap);

  const mediFirst = mediAgg?._min?.createdAt || chats.at(-1)?.createdAt || null;
  const mediLast = mediAgg?._max?.createdAt || chats[0]?.createdAt || null;
  const mediPeriod = Number(mediPeriodCount) || 0;

  const medFirst = minDate([
    ...medSchedules.map((row) => row.createdAt),
    ...doseEvents.map((row) => row.occurredAt),
  ]);
  const medLast = maxDate([
    ...medSchedules.map((row) => row.createdAt),
    ...doseEvents.map((row) => row.occurredAt),
  ]);
  const medPeriod = [
    ...medSchedules.map((row) => row.createdAt),
    ...doseEvents.map((row) => row.occurredAt),
  ].filter((at) => inRange(at, fromDt, toExclusiveDt)).length;

  const cycleFirst = minDate([
    cycleProfile?.createdAt,
    ...cycleLogs.map((row) => row.createdAt || row.date),
  ].filter(Boolean));
  const cycleLast = maxDate([
    cycleProfile?.updatedAt || cycleProfile?.createdAt,
    ...cycleLogs.map((row) => row.createdAt || row.date),
  ].filter(Boolean));
  const cyclePeriod = cycleLogs.filter((row) => inRange(row.createdAt || row.date, fromDt, toExclusiveDt)).length;

  const visitFirst = minDate(visits.map((row) => row.createdAt));
  const visitLast = maxDate(visits.map((row) => row.createdAt));
  const visitPeriod = visits.filter((row) => inRange(row.createdAt, fromDt, toExclusiveDt)).length;

  const weeklyFirst = minDate(weeklyOpened.map((row) => row.occurredAt));
  const weeklyLast = maxDate(weeklyOpened.map((row) => row.occurredAt));
  const weeklyPeriod = weeklyOpened.filter((row) => inRange(row.occurredAt, fromDt, toExclusiveDt)).length;

  const productUsage = {
    medi: featureRow({
      used: Boolean(mediAgg?._count?._all || chats.length),
      firstUsed: safeDate(mediFirst),
      lastUsed: safeDate(mediLast),
      periodCount: mediPeriod,
    }),
    medications: featureRow({
      used: Boolean(medSchedules.length || doseEvents.length),
      firstUsed: medFirst,
      lastUsed: medLast,
      periodCount: medPeriod,
    }),
    cycle: featureRow({
      used: Boolean(cycleProfile || cycleLogs.length),
      firstUsed: cycleFirst,
      lastUsed: cycleLast,
      periodCount: cyclePeriod,
    }),
    hydration: featureRow({
      used: Number(healthFlags.hydration_all) > 0,
      firstUsed: healthFlags.hydration_first || null,
      lastUsed: healthFlags.hydration_last || null,
      periodCount: healthFlags.hydration_period || 0,
    }),
    steps: featureRow({
      used: Number(healthFlags.steps_all) > 0,
      firstUsed: healthFlags.steps_first || null,
      lastUsed: healthFlags.steps_last || null,
      periodCount: healthFlags.steps_period || 0,
    }),
    weight: featureRow({
      used: Number(healthFlags.weight_all) > 0,
      firstUsed: healthFlags.weight_first || null,
      lastUsed: healthFlags.weight_last || null,
      periodCount: healthFlags.weight_period || 0,
    }),
    visits: featureRow({
      used: Boolean(visits.length),
      firstUsed: visitFirst,
      lastUsed: visitLast,
      periodCount: visitPeriod,
    }),
    weekly_report: featureRow({
      used: Boolean(weeklyOpened.length),
      firstUsed: weeklyFirst,
      lastUsed: weeklyLast,
      periodCount: weeklyPeriod,
    }),
  };

  const healthKeys = ['medications', 'cycle', 'hydration', 'steps', 'weight', 'visits', 'weekly_report'];
  const healthUsed = healthKeys.filter((key) => productUsage[key].used);

  const suppressionReasons = {};
  for (const row of decisions) {
    if (row.result !== 'BLOCKED' || !row.reason) continue;
    suppressionReasons[row.reason] = (suppressionReasons[row.reason] || 0) + 1;
  }

  const opened = outcomes.filter((row) => row.outcome === 'opened').length;
  const actioned = outcomes.filter((row) => row.outcome === 'actioned').length;

  const devices = buildDevices({ tokens, activities, permission, policy });

  const timeline = buildSanitizedTimeline({
    activities: activities.filter((row) => inRange(row.lastAt || row.firstAt, fromDt, toExclusiveDt)),
    chats: chats.filter((row) => inRange(row.createdAt, fromDt, toExclusiveDt)),
    weeklyOpened: weeklyOpened.filter((row) => inRange(row.occurredAt, fromDt, toExclusiveDt)),
    medEvents: [
      ...doseEvents.filter((row) => inRange(row.occurredAt, fromDt, toExclusiveDt)),
      ...medSchedules
        .filter((row) => inRange(row.createdAt, fromDt, toExclusiveDt))
        .map((row) => ({ createdAt: row.createdAt, source: 'MedicationSchedule' })),
    ],
    outcomes,
    permissionEvents: permissionEvents.filter((row) => inRange(row.occurredAt, fromDt, toExclusiveDt)),
  });

  const payload = {
    overview: {
      userId,
      lastActiveAt: safeDate(latestActivity?.lastAt),
      platform: latestActivity?.platform || tokens[0]?.platform || null,
      appVersion: latestVersion,
      notificationPermission: permission?.status || 'unknown',
      medi: {
        used: productUsage.medi.used,
        requests: mediAgg?._count?._all || 0,
        chats: chats.length,
        lastUsed: productUsage.medi.lastUsed,
      },
      healthAdoption: {
        used: healthUsed,
        unused: healthKeys.filter((key) => !productUsage[key].used),
        usedCount: healthUsed.length,
        total: healthKeys.length,
      },
      selectedFrequency,
      baseDailyCap,
      adaptiveDailyCap,
      fatigueState: fatigueState(baseDailyCap, adaptiveDailyCap),
      capAdaptedByMedi: adapted,
      capAdaptedNote: adapted
        ? 'selectedFrequency = ხშირად, adaptiveDailyCap = 1. Medi-მ შეზღუდა დღიური ლიმიტი. მომხმარებელმა სიხშირე არ შეცვალა.'
        : null,
      preferredEngagementWindow: null,
      telemetry,
      location: publicPlaceSnapshot(locationRow),
    },
    timeline,
    productUsage,
    notifications: {
      preference: { selectedFrequency },
      brain: {
        baseDailyCap,
        adaptiveDailyCap,
        fatigueState: fatigueState(baseDailyCap, adaptiveDailyCap),
        preferredEngagementWindow: null,
      },
      permission: permission?.status || 'unknown',
      telemetry,
      recentDecisions: decisions,
      recentOutcomes: outcomes,
      opened,
      actioned,
      suppressionReasons: Object.entries(suppressionReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    },
    devices,
    audit: (audit.entries || []).map((row) => ({
      admin: row.adminEmail,
      action: row.action,
      time: row.createdAt,
      previous: row.previousValue,
      next: row.newValue,
    })),
    activity: latestActivity
      ? {
          lastActiveAt: latestActivity.lastAt,
          date: latestActivity.date,
          platform: latestActivity.platform,
          appVersion: latestActivity.appVersion,
        }
      : { lastActiveAt: null, date: null, platform: tokens[0]?.platform || null, appVersion: null },
    product: {
      mediRequests: mediAgg?._count?._all || 0,
      chats: chats.length,
      medications: medSchedules.length,
      hasCycle: Boolean(cycleProfile),
    },
  };

  const leaked = assertNoPrivacyFields(payload);
  if (leaked.length) {
    console.warn('[admin-investigation] privacy keys stripped', leaked);
    return JSON.parse(JSON.stringify(payload, (key, value) => (
      PRIVACY_FORBIDDEN_KEYS.includes(key) ? undefined : value
    )));
  }
  return payload;
}

async function countMediInRange(userId, fromDt, toExclusiveDt) {
  try {
    return await prisma.aiInteraction.count({
      where: { userId, createdAt: { gte: fromDt, lt: toExclusiveDt } },
    });
  } catch {
    return 0;
  }
}

function buildDevices({ tokens, activities, permission, policy }) {
  const byPlatform = new Map();
  for (const row of activities) {
    const key = row.platform || 'unknown';
    const cur = byPlatform.get(key) || {
      platform: row.platform || null,
      appVersion: null,
      firstSeen: null,
      lastSeen: null,
    };
    const first = row.firstAt ? new Date(row.firstAt).getTime() : NaN;
    const last = row.lastAt ? new Date(row.lastAt).getTime() : NaN;
    if (Number.isFinite(first) && (!cur.firstSeen || first < new Date(cur.firstSeen).getTime())) {
      cur.firstSeen = new Date(first).toISOString();
    }
    if (Number.isFinite(last) && (!cur.lastSeen || last > new Date(cur.lastSeen).getTime())) {
      cur.lastSeen = new Date(last).toISOString();
      cur.appVersion = row.appVersion || cur.appVersion;
    }
    byPlatform.set(key, cur);
  }
  for (const token of tokens) {
    const key = token.platform || 'unknown';
    const cur = byPlatform.get(key) || {
      platform: token.platform || null,
      appVersion: null,
      firstSeen: null,
      lastSeen: null,
    };
    if (token.createdAt && (!cur.firstSeen || new Date(token.createdAt) < new Date(cur.firstSeen))) {
      cur.firstSeen = new Date(token.createdAt).toISOString();
    }
    if (token.lastSeenAt && (!cur.lastSeen || new Date(token.lastSeenAt) > new Date(cur.lastSeen))) {
      cur.lastSeen = new Date(token.lastSeenAt).toISOString();
    }
    if (!cur.platform) cur.platform = token.platform || null;
    byPlatform.set(key, cur);
  }
  return [...byPlatform.values()]
    .filter((row) => row.platform || row.appVersion || row.lastSeen)
    .map((row) => ({
      platform: row.platform,
      appVersion: row.appVersion,
      firstSeen: row.firstSeen,
      lastSeen: row.lastSeen,
      notificationPermission: permission?.status || 'unknown',
      telemetry: telemetryCapability(row.appVersion, policy),
    }));
}

export function userDecisionNav(from, payload = {}) {
  if (from === 'user_to_decision') {
    return { view: 'decision', decisionId: payload.decisionId || null };
  }
  if (from === 'decision_to_user') {
    return {
      view: 'user',
      userId: payload.userId || null,
      profileTab: payload.profileTab || 'notifications',
    };
  }
  return { view: null };
}
