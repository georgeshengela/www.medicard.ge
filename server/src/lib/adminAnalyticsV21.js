import { prisma } from './prisma.js';
import { loadAppActivityRows } from './appActivity.js';
import { ensureNotificationOutcomeTable, medianMs, ACTION_KEYS, DIRECT_ACTION_KEYS } from './notificationOutcomes.js';
import { ensureNotificationDecisionTable, loadDecisionRows } from './notificationDecisions.js';
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
  delivery: 'მიწოდების წილი = ტელეფონმა დაადასტურა, რომ აჩვენა / დაგეგმილი, რომლის დროც დადგა.',
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

const DELIVERED_OUTCOMES = new Set(['delivered', 'opened', 'actioned', 'snoozed']);
const TBILISI_OFFSET_MS = 4 * 3_600_000;
/** Families that run several plans at once (mobile MULTI_PLAN_FAMILIES); every other family has one slot. */
const MULTI_PLAN_FAMILIES = new Set(['reengage', 'insight', 'achievement']);

function planSlotOf(row) {
  return MULTI_PLAN_FAMILIES.has(row.family) ? `${row.family}|${row.templateKey || ''}` : String(row.family || 'unknown');
}

function msOf(value) {
  if (value == null) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Brain decisions → plans. Phones before 1.0.0.21.39 sent every Brain run (up to one a minute) as fresh
 * rows with new ids: one water plan arrived dozens of times. A plan = person + template + result + reason
 * + planned time (or day, for a skip). A planned notification that a later run replaced before its time
 * is `superseded` — it never fired. `aliasOf` maps every row id to its plan's id so outcomes find it.
 */
export function collapseDecisionPlans(rows, now = Date.now()) {
  const plans = new Map();
  const aliasOf = new Map();
  for (const row of rows || []) {
    const scheduled = msOf(row.scheduledAt);
    const created = msOf(row.createdAt) ?? 0;
    // Tbilisi is UTC+4 all year (no DST since 2005): a cheap calendar day for 50 000 rows.
    const slotTime = scheduled ?? `d:${new Date(created + TBILISI_OFFSET_MS).toISOString().slice(0, 10)}`;
    const key = `${row.userId}|${row.family}|${row.templateKey || ''}|${row.result}|${row.reason || ''}|${slotTime}`;
    let plan = plans.get(key);
    if (!plan) {
      plan = { ...row, planKey: key, slot: `${row.userId}|${planSlotOf(row)}`, firstAt: created, lastAt: created, ids: [], superseded: false };
      plans.set(key, plan);
    }
    plan.ids.push(row.decisionId);
    if (created >= plan.lastAt) {
      plan.lastAt = created;
      plan.decisionId = row.decisionId;
    }
    plan.firstAt = Math.min(plan.firstAt, created);
  }
  // Old phones: a later run that touched the same slot before the planned time replaced the plan.
  const bySlot = new Map();
  for (const plan of plans.values()) {
    if (!bySlot.has(plan.slot)) bySlot.set(plan.slot, []);
    bySlot.get(plan.slot).push(plan);
  }
  for (const list of bySlot.values()) {
    if (list.length < 2) continue;
    const starts = list.map((plan) => plan.firstAt).sort((a, b) => a - b);
    for (const plan of list) {
      if (plan.result !== 'SEND') continue;
      const at = msOf(plan.scheduledAt);
      if (at == null) continue;
      // First plan in this slot that began after this one was last seen: did it come before the planned time?
      let lo = 0;
      let hi = starts.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (starts[mid] > plan.lastAt) hi = mid;
        else lo = mid + 1;
      }
      plan.superseded = lo < starts.length && starts[lo] < at;
    }
  }
  for (const plan of plans.values()) {
    for (const id of plan.ids) aliasOf.set(id, plan.decisionId);
    plan.pending = plan.result === 'SEND' && !plan.superseded && (msOf(plan.scheduledAt) ?? 0) > now;
  }
  return { plans: [...plans.values()], aliasOf };
}

function planOutcomeIndex(outcomes, aliasOf) {
  const byPlan = new Map();
  for (const row of outcomes || []) {
    const id = aliasOf.get(row.decisionId) || row.decisionId;
    if (!byPlan.has(id)) byPlan.set(id, new Set());
    byPlan.get(id).add(row.outcome === 'actioned' && DIRECT_ACTION_KEYS.has(row.actionKey) ? 'actioned_direct' : row.outcome);
    if (row.outcome === 'actioned') byPlan.get(id).add('actioned');
  }
  return byPlan;
}

/**
 * The Brain funnel on plans: planned (scheduled on the phone, not replaced) → delivered (the phone
 * confirmed it was shown — since 1.0.0.21.39 also when it arrived while the app was closed) → opened →
 * acted on. Held back before planning (`blocked`) and cancelled after planning sit beside it.
 */
export function buildNotificationFunnel(decisions, outcomes, { now = Date.now() } = {}) {
  const { plans, aliasOf } = collapseDecisionPlans(decisions, now);
  const byPlan = planOutcomeIndex(outcomes, aliasOf);
  const has = (id, kind) => byPlan.get(id)?.has(kind) || false;
  const deliveredIds = new Set();
  const openedIds = new Set();
  const actionedIds = new Set();
  const directIds = new Set();
  const cancelledIds = new Set();
  for (const [id, kinds] of byPlan) {
    if ([...kinds].some((kind) => DELIVERED_OUTCOMES.has(kind))) deliveredIds.add(id);
    if (kinds.has('opened')) openedIds.add(id);
    if (kinds.has('actioned')) actionedIds.add(id);
    if (kinds.has('actioned_direct')) directIds.add(id);
    if (kinds.has('cancelled_by_revalidation')) cancelledIds.add(id);
  }
  let scheduled = 0;
  let due = 0;
  let pending = 0;
  let next24h = 0;
  let suppressed = 0;
  let superseded = 0;
  const people = new Set();
  for (const plan of plans) {
    if (plan.result === 'BLOCKED') suppressed += 1;
    if (plan.result === 'CANCELLED') cancelledIds.add(plan.decisionId);
    if (plan.superseded) superseded += 1;
    if ((plan.result === 'SEND' || plan.result === 'CANCELLED') && !plan.superseded) {
      scheduled += 1;
      people.add(plan.userId);
    }
    if (plan.pending) {
      pending += 1;
      if ((msOf(plan.scheduledAt) ?? Infinity) <= now + 86_400_000) next24h += 1;
    }
    if (plan.result === 'SEND' && !plan.superseded && !plan.pending && !has(plan.decisionId, 'cancelled_by_revalidation')) due += 1;
  }
  const evaluated = plans.length;
  return {
    evaluated,
    eligible: evaluated - suppressed,
    scheduled,
    pending,
    next24h,
    people: people.size,
    due,
    superseded,
    delivered: deliveredIds.size,
    opened: openedIds.size,
    actioned: actionedIds.size,
    directActioned: directIds.size,
    suppressed,
    cancelled: cancelledIds.size,
    rawRows: (decisions || []).length,
    rates: {
      delivery: rateVisible(deliveredIds.size, Math.max(due, deliveredIds.size)),
      open: rateVisible(openedIds.size, deliveredIds.size),
      action: rateVisible(actionedIds.size, deliveredIds.size),
      directAction: rateVisible(directIds.size, deliveredIds.size),
      suppression: rateVisible(suppressed, evaluated),
      revalidationCancel: rateVisible(cancelledIds.size, scheduled),
    },
    definitions: RATE_DEFINITIONS,
    note: 'პირდაპირი ქმედება (მაგ. „დავლიე“ შეტყობინებიდანვე) შეიძლება მოხდეს აპის გახსნის გარეშე.',
  };
}

export function buildTypePerformance(decisions, outcomes, prevDecisions, prevOutcomes, { now = Date.now(), familyById = null } = {}) {
  const families = new Map();
  const { plans, aliasOf } = collapseDecisionPlans(decisions, now);
  const familyOf = new Map(plans.map((plan) => [plan.decisionId, plan.family || 'unknown']));
  const byPlan = planOutcomeIndex(outcomes, aliasOf);

  function bucket(family) {
    if (!families.has(family)) {
      families.set(family, {
        family,
        evaluated: 0,
        scheduled: 0,
        suppressed: 0,
        cancelledIds: new Set(),
        deliveredIds: new Set(),
        openedIds: new Set(),
        actionedIds: new Set(),
        directIds: new Set(),
      });
    }
    return families.get(family);
  }

  for (const plan of plans) {
    const b = bucket(plan.family || 'unknown');
    b.evaluated += 1;
    if (plan.result === 'BLOCKED') b.suppressed += 1;
    if ((plan.result === 'SEND' || plan.result === 'CANCELLED') && !plan.superseded) b.scheduled += 1;
    if (plan.result === 'CANCELLED') b.cancelledIds.add(plan.decisionId);
  }
  for (const [id, kinds] of byPlan) {
    const b = bucket(familyOf.get(id) || familyById?.get(id) || 'unknown');
    if ([...kinds].some((kind) => DELIVERED_OUTCOMES.has(kind))) b.deliveredIds.add(id);
    if (kinds.has('opened')) b.openedIds.add(id);
    if (kinds.has('actioned')) b.actionedIds.add(id);
    if (kinds.has('actioned_direct')) b.directIds.add(id);
    if (kinds.has('cancelled_by_revalidation')) b.cancelledIds.add(id);
  }

  const prev = prevDecisions
    ? buildTypePerformance(prevDecisions, prevOutcomes || [], null, null, { now })
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
        eligible: row.evaluated - row.suppressed,
        scheduled: row.scheduled,
        delivered,
        opened,
        actioned,
        directActioned,
        suppressed: row.suppressed,
        cancelled: row.cancelledIds.size,
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
    }).sort((a, b) => b.scheduled - a.scheduled || b.evaluated - a.evaluated),
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

function isMissingTableError(error) {
  return error?.code === 'P2010' || /does not exist/i.test(error?.message || '');
}

/**
 * The decision/outcome checks of getDataQuality, counted in Postgres. Loading 90 days of Brain rows to
 * count them (46 580 decisions on 2026-10-12, ~4 000 more a day) froze the server for seconds on every
 * admin home load. Same rules as before: an outcome is an orphan when its decision is not in the same
 * window, `futureTimestamps` is anything more than a minute ahead.
 */
export async function loadDecisionQualityCounts(fromDt, toExclusiveDt, now = new Date()) {
  const future = new Date(now.getTime() + 60_000);
  const emptyDecisions = { duplicateDecisionIds: 0, decisionsMissingRevalidation: 0, futureDecisions: 0, invalidRoutes: 0 };
  const emptyOutcomes = { unknownActionKeys: 0, orphanOutcomes: 0, futureOutcomes: 0 };
  const decisionCounts = (async () => {
    await ensureNotificationDecisionTable();
    const [row] = await prisma.$queryRaw`
      SELECT (COUNT(*) - COUNT(DISTINCT "decisionId"))::int AS "duplicateDecisionIds",
             COUNT(*) FILTER (WHERE "result" = 'SEND' AND "scheduledAt" IS NOT NULL AND "revalidatedAt" IS NULL)::int AS "decisionsMissingRevalidation",
             COUNT(*) FILTER (WHERE "createdAt" > ${future})::int AS "futureDecisions",
             COUNT(*) FILTER (WHERE COALESCE("route", '') <> '' AND LEFT("route", 1) <> '/')::int AS "invalidRoutes"
      FROM "NotificationDecision"
      WHERE "createdAt" >= ${fromDt} AND "createdAt" < ${toExclusiveDt}
    `;
    return row || emptyDecisions;
  })().catch((error) => {
    if (isMissingTableError(error)) return emptyDecisions;
    throw error;
  });
  const outcomeCounts = (async () => {
    await ensureNotificationOutcomeTable();
    const [row] = await prisma.$queryRaw`
      SELECT COUNT(*) FILTER (WHERE COALESCE(o."actionKey", '') <> '' AND NOT (o."actionKey" = ANY(${[...ACTION_KEYS]})))::int AS "unknownActionKeys",
             COUNT(*) FILTER (WHERE COALESCE(o."decisionId", '') <> '' AND NOT EXISTS (
               SELECT 1 FROM "NotificationDecision" d
               WHERE d."decisionId" = o."decisionId" AND d."createdAt" >= ${fromDt} AND d."createdAt" < ${toExclusiveDt}
             ))::int AS "orphanOutcomes",
             COUNT(*) FILTER (WHERE o."occurredAt" > ${future})::int AS "futureOutcomes"
      FROM "NotificationOutcome" o
      WHERE o."occurredAt" >= ${fromDt} AND o."occurredAt" < ${toExclusiveDt}
    `;
    return row || emptyOutcomes;
  })().catch((error) => {
    if (isMissingTableError(error)) return emptyOutcomes;
    throw error;
  });
  const [decisions, outcomes] = await Promise.all([decisionCounts, outcomeCounts]);
  return { ...decisions, ...outcomes };
}

export async function getDataQuality() {
  const today = tbilisiYmd();
  const from = addDaysYmd(today, -90);
  const now = new Date();
  const [users, counts, activity] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    loadDecisionQualityCounts(new Date(now.getTime() - 90 * 86_400_000), new Date(now.getTime() + 86_400_000), now),
    loadAppActivityRows(from, today),
  ]);
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
    decisionsMissingRevalidation: counts.decisionsMissingRevalidation,
    unknownActionKeys: counts.unknownActionKeys,
    orphanOutcomes: counts.orphanOutcomes,
    duplicateDecisionIds: counts.duplicateDecisionIds,
    futureTimestamps: counts.futureOutcomes + counts.futureDecisions,
    invalidRoutes: counts.invalidRoutes,
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
