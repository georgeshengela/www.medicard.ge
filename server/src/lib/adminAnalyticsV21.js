import { prisma } from './prisma.js';
import { loadAppActivityRows } from './appActivity.js';
import { loadOutcomeRows, medianMs, ACTION_KEYS, DIRECT_ACTION_KEYS } from './notificationOutcomes.js';
import { loadDecisionRows } from './notificationDecisions.js';
import { loadProductEvents } from './productEvents.js';
import { loadDoseEvents } from './medicationDoseEvents.js';
import { loadPermissionRows } from './notificationPermission.js';
import { compareAppVersions, isAppVersionBelow, parseAppVersion } from './appVersion.js';
import { getMobileAppVersion } from './mobileAppVersion.js';
import { getAppVersionPolicy } from './appVersionPolicy.js';
import { tbilisiYmd } from './checkIn.js';
import {
  addDaysYmd,
  createdAtToTbilisiYmd,
  deltaSafe,
  parseAnalyticsRange,
  rateSafe,
} from './adminAnalyticsRange.js';

export const RATE_MIN_DENOMINATOR = 5;

export function rateVisible(numerator, denominator, { min = RATE_MIN_DENOMINATOR } = {}) {
  const n = Number(numerator) || 0;
  const d = Number(denominator) || 0;
  if (d < min) return { value: null, hidden: true, numerator: n, denominator: d };
  return { value: rateSafe(n, d), hidden: false, numerator: n, denominator: d };
}

export const RATE_DEFINITIONS = {
  delivery: 'მიწოდების წილი = მიწოდებული / დაგეგმილი.',
  open: 'გახსნის წილი = გახსნილი / მიწოდებული.',
  action: 'ქმედების წილი = ქმედება / მიწოდებული.',
  directAction: 'პირდაპირი ქმედება / მიწოდებული. აპის გახსნა არ არის საჭირო.',
  suppression: 'დაბლოკვის წილი = დაბლოკილი / შეფასებული.',
  revalidationCancel: 'გაუქმება ხელახალი შემოწმებით / დაგეგმილი.',
  weeklyOpen: 'კვირის ანგარიშის გახსნა = გახსნილი / შექმნილი. Brain weekly SEND ცალკეა.',
};

export function countOrphanOutcomes(decisions, outcomes) {
  const ids = new Set((decisions || []).map((row) => row.decisionId));
  return (outcomes || []).filter((row) => row.decisionId && !ids.has(row.decisionId)).length;
}

export function weeklyReportMetrics(events, decisions) {
  const generated = (events || []).filter((row) => row.kind === 'weekly_report_generated').length;
  const opened = (events || []).filter((row) => row.kind === 'weekly_report_opened').length;
  const sent = (decisions || []).filter((row) => row.family === 'weekly' && row.result === 'SEND').length;
  return {
    generated,
    opened,
    sent,
    openRate: rateVisible(opened, generated),
    notificationOpenRate: rateVisible(opened, sent),
  };
}

function outcomeSet(rows, kind) {
  return new Set(rows.filter((row) => row.outcome === kind).map((row) => row.decisionId));
}

export function buildNotificationFunnel(decisions, outcomes) {
  const evaluated = decisions.length;
  const eligible = decisions.filter((d) => d.result !== 'BLOCKED').length;
  const scheduled = decisions.filter((d) => d.scheduledAt && d.result !== 'BLOCKED').length;
  const suppressed = decisions.filter((d) => d.result === 'BLOCKED').length;
  const cancelled = new Set([
    ...decisions.filter((d) => d.result === 'CANCELLED').map((d) => d.decisionId),
    ...outcomeSet(outcomes, 'cancelled_by_revalidation'),
  ]).size;
  const delivered = new Set(
    outcomes
      .filter((row) => ['delivered', 'opened', 'actioned', 'snoozed'].includes(row.outcome))
      .map((row) => row.decisionId),
  ).size;
  const opened = outcomeSet(outcomes, 'opened').size;
  const actioned = outcomeSet(outcomes, 'actioned').size;
  const directActioned = new Set(
    outcomes
      .filter((row) => row.outcome === 'actioned' && DIRECT_ACTION_KEYS.has(row.actionKey))
      .map((row) => row.decisionId),
  ).size;

  return {
    evaluated,
    eligible,
    scheduled,
    delivered,
    opened,
    actioned,
    directActioned,
    suppressed,
    cancelled,
    rates: {
      delivery: rateVisible(delivered, scheduled),
      open: rateVisible(opened, delivered),
      action: rateVisible(actioned, delivered),
      directAction: rateVisible(directActioned, delivered),
      suppression: rateVisible(suppressed, evaluated),
      revalidationCancel: rateVisible(cancelled, scheduled),
    },
    definitions: RATE_DEFINITIONS,
    note: 'პირდაპირი ქმედება შეიძლება დათვალოს გახსნის გარეშე.',
  };
}

export function buildTypePerformance(decisions, outcomes, prevDecisions, prevOutcomes) {
  const families = new Map();
  const familyOf = new Map(decisions.map((d) => [d.decisionId, d.family || 'unknown']));

  function bucket(family) {
    if (!families.has(family)) {
      families.set(family, {
        family,
        evaluated: 0,
        eligible: 0,
        suppressed: 0,
        cancelled: 0,
        deliveredIds: new Set(),
        openedIds: new Set(),
        actionedIds: new Set(),
        directIds: new Set(),
      });
    }
    return families.get(family);
  }

  for (const row of decisions) {
    const b = bucket(row.family || 'unknown');
    b.evaluated += 1;
    if (row.result !== 'BLOCKED') b.eligible += 1;
    if (row.result === 'BLOCKED') b.suppressed += 1;
    if (row.result === 'CANCELLED') b.cancelled += 1;
  }
  for (const row of outcomes) {
    const b = bucket(familyOf.get(row.decisionId) || 'unknown');
    if (['delivered', 'opened', 'actioned', 'snoozed'].includes(row.outcome)) b.deliveredIds.add(row.decisionId);
    if (row.outcome === 'opened') b.openedIds.add(row.decisionId);
    if (row.outcome === 'actioned') {
      b.actionedIds.add(row.decisionId);
      if (DIRECT_ACTION_KEYS.has(row.actionKey)) b.directIds.add(row.decisionId);
    }
    if (row.outcome === 'cancelled_by_revalidation') b.cancelled += 1;
  }

  const prev = prevDecisions
    ? buildTypePerformance(prevDecisions, prevOutcomes || [], null, null)
    : { types: [] };
  const prevMap = new Map(prev.types.map((row) => [row.family, row]));

  return {
    types: [...families.values()].map((row) => {
      const delivered = row.deliveredIds.size;
      const opened = row.openedIds.size;
      const actioned = row.actionedIds.size;
      const directActioned = row.directIds.size;
      const before = prevMap.get(row.family);
      return {
        family: row.family,
        evaluated: row.evaluated,
        eligible: row.eligible,
        delivered,
        opened,
        actioned,
        directActioned,
        suppressed: row.suppressed,
        cancelled: row.cancelled,
        openRate: rateVisible(opened, delivered),
        actionRate: rateVisible(actioned, delivered),
        directActionRate: rateVisible(directActioned, delivered),
        delta: before
          ? {
              delivered: deltaSafe(delivered, before.delivered),
              opened: deltaSafe(opened, before.opened),
              actioned: deltaSafe(actioned, before.actioned),
            }
          : null,
      };
    }).sort((a, b) => b.evaluated - a.evaluated),
  };
}

export function outcomeLatency(outcomes) {
  const deliveredAt = new Map();
  const openedAt = new Map();
  const actionedAt = new Map();
  for (const row of outcomes) {
    const at = new Date(row.occurredAt).getTime();
    if (!Number.isFinite(at)) continue;
    if (['delivered', 'opened', 'actioned', 'snoozed'].includes(row.outcome)) {
      const prev = deliveredAt.get(row.decisionId);
      if (prev == null || at < prev) deliveredAt.set(row.decisionId, at);
    }
    if (row.outcome === 'opened' && (openedAt.get(row.decisionId) == null || at < openedAt.get(row.decisionId))) {
      openedAt.set(row.decisionId, at);
    }
    if (row.outcome === 'actioned' && (actionedAt.get(row.decisionId) == null || at < actionedAt.get(row.decisionId))) {
      actionedAt.set(row.decisionId, at);
    }
  }
  const openMs = [];
  const actionMs = [];
  for (const [id, opened] of openedAt) {
    const delivered = deliveredAt.get(id);
    if (delivered != null && opened >= delivered) openMs.push(opened - delivered);
  }
  for (const [id, actioned] of actionedAt) {
    const delivered = deliveredAt.get(id);
    if (delivered != null && actioned >= delivered) actionMs.push(actioned - delivered);
  }
  return {
    deliveredToOpenedMedianMs: medianMs(openMs),
    deliveredToActionedMedianMs: medianMs(actionMs),
    samples: { opened: openMs.length, actioned: actionMs.length },
  };
}

export async function getVersionAnalytics(query) {
  const range = parseAnalyticsRange(query);
  const [rows, policy] = await Promise.all([
    loadAppActivityRows(range.fromYmd, range.toYmd),
    getAppVersionPolicy(),
  ]);
  const current = policy.currentRecommendedVersion || getMobileAppVersion();
  const byVersion = new Map();
  const users = new Map();
  for (const row of rows) {
    const version = parseAppVersion(row.appVersion)?.raw || 'unknown';
    if (!byVersion.has(version)) byVersion.set(version, { version, users: new Set(), ios: 0, android: 0, web: 0 });
    const bucket = byVersion.get(version);
    bucket.users.add(row.userId);
    if (row.platform === 'ios') bucket.ios += 1;
    else if (row.platform === 'android') bucket.android += 1;
    else if (row.platform === 'web') bucket.web += 1;
    users.set(row.userId, { version, platform: row.platform || null });
  }
  const activeUsers = users.size;
  const values = [...users.values()];
  const belowBrain = values.filter((u) => u.version !== 'unknown' && isAppVersionBelow(u.version, policy.minimumBrainSyncVersion)).length;
  const belowOutcomes = values.filter((u) => u.version !== 'unknown' && isAppVersionBelow(u.version, policy.minimumOutcomeSyncVersion)).length;
  return {
    policy,
    current,
    activeUsers,
    versions: [...byVersion.values()]
      .map((row) => ({
        version: row.version,
        users: row.users.size,
        ios: row.ios,
        android: row.android,
        web: row.web,
        outdated: row.version !== 'unknown' && current ? isAppVersionBelow(row.version, current) : null,
      }))
      .sort((a, b) => (compareAppVersions(b.version, a.version) ?? String(b.version).localeCompare(a.version))),
    platformUsers: {
      ios: values.filter((u) => u.platform === 'ios').length,
      android: values.filter((u) => u.platform === 'android').length,
      web: values.filter((u) => u.platform === 'web').length,
      unknown: values.filter((u) => !u.platform).length,
    },
    belowBrainSync: { users: belowBrain, rate: rateVisible(belowBrain, activeUsers), minimum: policy.minimumBrainSyncVersion },
    belowOutcomeSync: { users: belowOutcomes, rate: rateVisible(belowOutcomes, activeUsers), minimum: policy.minimumOutcomeSyncVersion },
    missingVersion: values.filter((u) => u.version === 'unknown').length,
    definition: 'ვერსია AppActivity-დან, თბილისის დღე.',
  };
}

export async function getWeeklyInsightMedication(query) {
  const range = parseAnalyticsRange(query);
  const [events, doses, schedules, decisions] = await Promise.all([
    loadProductEvents(range.fromDt, range.toExclusiveDt),
    loadDoseEvents(range.fromYmd, range.toYmd),
    prisma.medicationSchedule.findMany({
      where: { active: true },
      select: { userId: true },
    }),
    loadDecisionRows(range.fromDt, range.toExclusiveDt),
  ]);
  const weekly = weeklyReportMetrics(events, decisions);
  const insights = {
    generated: events.filter((e) => e.kind === 'insight_generated').length,
    opened: events.filter((e) => e.kind === 'insight_opened').length,
    actioned: events.filter((e) => e.kind === 'insight_actioned').length,
    dismissed: events.filter((e) => e.kind === 'insight_dismissed').length,
  };
  const taken = doses.filter((d) => d.status === 'taken');
  return {
    weekly,
    insights: {
      ...insights,
      openRate: rateVisible(insights.opened, insights.generated),
      actionRate: rateVisible(insights.actioned, insights.generated),
      dismissRate: rateVisible(insights.dismissed, insights.generated),
    },
    medications: {
      activeSchedules: schedules.length,
      recordedTaken: taken.length,
      recordedSkipped: doses.filter((d) => d.status === 'skipped').length,
      takenViaNotification: taken.filter((d) => d.source === 'notification').length,
      takenInApp: taken.filter((d) => d.source === 'app').length,
    },
  };
}

export async function getFeatureRetentionAnalytics(query) {
  const range = parseAnalyticsRange(query);
  const from30 = addDaysYmd(range.toYmd, -30);
  const [ai, meds, doses, cycle, hydro, weight, visits] = await Promise.all([
    prisma.aiInteraction.findMany({
      where: { createdAt: { gte: new Date(`${from30}T00:00:00.000Z`) } },
      select: { userId: true, createdAt: true },
    }),
    prisma.medicationSchedule.findMany({ select: { userId: true, createdAt: true } }),
    loadDoseEvents(from30, range.toYmd),
    prisma.cycleLog.findMany({ where: { date: { gte: from30 } }, select: { userId: true, date: true } }),
    prisma.healthMetricDaily.findMany({
      where: { date: { gte: from30 }, hydrationMl: { gt: 0 } },
      select: { userId: true, date: true },
    }),
    prisma.healthMetricDaily.findMany({
      where: { date: { gte: from30 }, weightKg: { not: null } },
      select: { userId: true, date: true },
    }),
    prisma.doctorVisit.findMany({
      where: { createdAt: { gte: new Date(`${from30}T00:00:00.000Z`) } },
      select: { userId: true, createdAt: true },
    }),
  ]);
  const medRows = doses.length
    ? doses.map((row) => ({ userId: row.userId, date: row.date }))
    : meds;

  function retain(rows, dayFn) {
    const byUser = new Map();
    for (const row of rows) {
      const day = dayFn(row);
      if (!day) continue;
      if (!byUser.has(row.userId)) byUser.set(row.userId, []);
      byUser.get(row.userId).push(day);
    }
    let once = 0;
    let back7 = 0;
    let back30 = 0;
    for (const days of byUser.values()) {
      const uniq = [...new Set(days)].sort();
      if (!uniq.length) continue;
      once += 1;
      const first = uniq[0];
      if (uniq.some((day) => day > first && day <= addDaysYmd(first, 7))) back7 += 1;
      if (uniq.some((day) => day > first && day <= addDaysYmd(first, 30))) back30 += 1;
    }
    return {
      once,
      returned7: back7,
      returned30: back30,
      return7Rate: rateVisible(back7, once),
      return30Rate: rateVisible(back30, once),
    };
  }

  return {
    range: { from: from30, to: range.toYmd, timezone: 'Asia/Tbilisi' },
    features: {
      medi: { key: 'medi', label: 'Medi', ...retain(ai, (row) => createdAtToTbilisiYmd(row.createdAt)) },
      medications: {
        key: 'medications',
        label: 'მედიკამენტები',
        ...retain(medRows, (row) => row.date || createdAtToTbilisiYmd(row.createdAt)),
      },
      cycle: { key: 'cycle', label: 'ციკლი', ...retain(cycle, (row) => row.date) },
      hydration: { key: 'hydration', label: 'ჰიდრატაცია', ...retain(hydro, (row) => row.date) },
      weight: { key: 'weight', label: 'წონა', ...retain(weight, (row) => row.date) },
      visits: { key: 'visits', label: 'ვიზიტები', ...retain(visits, (row) => createdAtToTbilisiYmd(row.createdAt)) },
    },
  };
}

export async function getPermissionAnalytics() {
  const rows = await loadPermissionRows();
  const counts = { enabled: 0, disabled: 0, provisional: 0, unknown: 0 };
  for (const row of rows) {
    if (counts[row.status] != null) counts[row.status] += 1;
    else counts.unknown += 1;
  }
  const total = rows.length;
  return {
    ...counts,
    total,
    enabledRate: rateVisible(counts.enabled, total),
    disabledRate: rateVisible(counts.disabled, total),
  };
}

export async function getDataQuality() {
  const today = tbilisiYmd();
  const from = addDaysYmd(today, -90);
  const [users, decisions, outcomes, activity] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    loadDecisionRows(new Date(Date.now() - 90 * 86_400_000), new Date(Date.now() + 86_400_000)),
    loadOutcomeRows(new Date(Date.now() - 90 * 86_400_000), new Date(Date.now() + 86_400_000)),
    loadAppActivityRows(from, today),
  ]);
  const seen = new Set();
  let duplicateDecisions = 0;
  for (const row of decisions) {
    if (seen.has(row.decisionId)) duplicateDecisions += 1;
    seen.add(row.decisionId);
  }
  const activityUsers = new Set(activity.map((row) => row.userId));
  const latestByUser = new Map();
  for (const row of activity) {
    const prev = latestByUser.get(row.userId);
    if (!prev || new Date(row.lastAt) > new Date(prev.lastAt)) latestByUser.set(row.userId, row);
  }
  let usersMissingAppVersion = 0;
  let usersMissingPlatform = 0;
  for (const row of latestByUser.values()) {
    if (!row.appVersion) usersMissingAppVersion += 1;
    if (!row.platform) usersMissingPlatform += 1;
  }
  return {
    usersMissingPlatform,
    usersMissingAppVersion,
    activeUsersSampled: latestByUser.size,
    versionCoverageRate:
      latestByUser.size > 0
        ? Math.round((100 * (latestByUser.size - usersMissingAppVersion)) / latestByUser.size)
        : null,
    usersWithoutRecentActivity: users.filter((u) => !activityUsers.has(u.id)).length,
    decisionsMissingRevalidation: decisions.filter((d) => d.result === 'SEND' && d.scheduledAt && !d.revalidatedAt).length,
    unknownActionKeys: outcomes.filter((row) => row.actionKey && !ACTION_KEYS.has(row.actionKey)).length,
    orphanOutcomes: countOrphanOutcomes(decisions, outcomes),
    duplicateDecisionIds: duplicateDecisions,
    futureTimestamps: [
      ...outcomes.filter((row) => new Date(row.occurredAt).getTime() > Date.now() + 60_000),
      ...decisions.filter((row) => new Date(row.createdAt).getTime() > Date.now() + 60_000),
    ].length,
    invalidRoutes: decisions.filter((d) => d.route && !String(d.route).startsWith('/')).length,
    sampleWindowDays: 90,
  };
}

export function versionAttention(versionStats) {
  const items = [];
  const below = versionStats.belowOutcomeSync;
  if (below.rate.value != null && below.rate.value >= 15) {
    items.push({
      severity: 'warning',
      title: `აქტიური მომხმარებლების ${below.rate.value}% ${below.minimum}-ზე დაბლაა`,
      detail: `${below.users} / ${versionStats.activeUsers} აქტიური. ზღვარი 15%. შედეგების სინქი ${below.minimum}+.`,
      href: '#/quality',
      period: 'არჩეული პერიოდი',
      threshold: '15%',
      n: versionStats.activeUsers,
      metric: below,
    });
  }
  const brain = versionStats.belowBrainSync;
  if (brain.rate.value != null && brain.rate.value >= 15) {
    items.push({
      severity: 'warning',
      title: `აქტიური მომხმარებლების ${brain.rate.value}% ${brain.minimum}-ზე დაბლაა`,
      detail: `${brain.users} / ${versionStats.activeUsers} აქტიური. ზღვარი 15%. Brain გადაწყვეტილება ${brain.minimum}+.`,
      href: '#/quality',
      period: 'არჩეული პერიოდი',
      threshold: '15%',
      n: versionStats.activeUsers,
      metric: brain,
    });
  }
  return items;
}
