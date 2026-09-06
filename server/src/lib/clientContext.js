import { prisma } from './prisma.js';
import { APP_VERSION_POLICY } from './appVersionPolicy.js';
import { isAppVersionBelow } from './appVersion.js';
import { ensureAppActivityTable } from './appActivity.js';
import { ensureNotificationOutcomeTable } from './notificationOutcomes.js';

export function telemetryCapability(appVersion, policy = APP_VERSION_POLICY) {
  const version = appVersion || null;
  if (!version) {
    return {
      appVersion: null,
      brainSync: null,
      outcomeSync: null,
    };
  }
  const belowBrain = isAppVersionBelow(version, policy.minimumBrainSyncVersion);
  const belowOutcome = isAppVersionBelow(version, policy.minimumOutcomeSyncVersion);
  return {
    appVersion: version,
    brainSync: belowBrain == null ? null : !belowBrain,
    outcomeSync: belowOutcome == null ? null : !belowOutcome,
    minimumBrainSyncVersion: policy.minimumBrainSyncVersion,
    minimumOutcomeSyncVersion: policy.minimumOutcomeSyncVersion,
  };
}

export function fatigueState(baseDailyCap, adaptiveDailyCap) {
  const base = Number(baseDailyCap);
  const adaptive = Number(adaptiveDailyCap);
  if (!Number.isFinite(base) || !Number.isFinite(adaptive)) return 'unknown';
  if (adaptive >= base) return 'normal';
  if (adaptive <= Math.max(1, Math.floor(base / 3))) return 'highly_reduced';
  return 'reduced';
}

function activityPoints(row) {
  const points = [];
  const first = row?.firstAt ? new Date(row.firstAt).getTime() : NaN;
  const last = row?.lastAt ? new Date(row.lastAt).getTime() : NaN;
  if (Number.isFinite(first)) points.push({ ...row, at: first });
  if (Number.isFinite(last) && last !== first) points.push({ ...row, at: last });
  if (!points.length && row?.occurredAt) {
    const at = new Date(row.occurredAt).getTime();
    if (Number.isFinite(at)) points.push({ ...row, at });
  }
  return points;
}

export function collectEnrichmentKeys(decisions) {
  const rows = decisions || [];
  return {
    decisionIds: [...new Set(rows.map((row) => row.decisionId).filter(Boolean))],
    userIds: [...new Set(rows.map((row) => row.userId).filter(Boolean))],
  };
}

/**
 * Resolve client platform/version without writing it onto the decision.
 * Precedence: outcome → nearest AppActivity → latest activity before decision → unknown.
 */
export function resolveClientContext(decision, { outcomes = [], activities = [] } = {}) {
  const target = new Date(decision.createdAt || decision.scheduledAt || 0).getTime();
  const outcome = (outcomes || []).find((row) => row.platform || row.appVersion);
  if (outcome && (outcome.platform || outcome.appVersion)) {
    return {
      platform: outcome.platform || null,
      appVersion: outcome.appVersion || null,
      contextSource: 'notification_outcome',
    };
  }

  const points = (activities || [])
    .filter((row) => !decision.userId || row.userId === decision.userId)
    .flatMap(activityPoints);

  if (!points.length || !Number.isFinite(target)) {
    return {
      platform: null,
      appVersion: null,
      contextSource: null,
    };
  }

  let nearest = null;
  let nearestGap = Infinity;
  for (const row of points) {
    const gap = Math.abs(row.at - target);
    if (gap < nearestGap) {
      nearest = row;
      nearestGap = gap;
    }
  }
  if (nearest && (nearest.platform || nearest.appVersion)) {
    return {
      platform: nearest.platform || null,
      appVersion: nearest.appVersion || null,
      contextSource: 'nearest_app_activity',
    };
  }

  const before = points
    .filter((row) => row.at <= target && (row.platform || row.appVersion))
    .sort((a, b) => b.at - a.at)[0];
  if (before) {
    return {
      platform: before.platform || null,
      appVersion: before.appVersion || null,
      contextSource: 'latest_app_activity_before',
    };
  }

  return {
    platform: null,
    appVersion: null,
    contextSource: null,
  };
}

export function classifyDecisionReason(reason) {
  const text = String(reason || '').toLowerCase();
  if (!text) return [];
  const tags = [];
  if (/quiet|22:00|night/.test(text)) tags.push('quiet_hours');
  if (/cooldown|already_sent|already_opened/.test(text)) tags.push('cooldown');
  if (/cap|fatigue|adaptive/.test(text)) tags.push('daily_cap');
  if (/opened|recent|just_opened|session/.test(text)) tags.push('recent_activity');
  if (/privacy|mask|discreet|cycle-masked/.test(text)) tags.push('privacy');
  return tags;
}

export function decisionLifecycle(decision, outcomes = []) {
  const steps = [];
  if (decision.createdAt) steps.push({ key: 'created', at: decision.createdAt });
  if (decision.result === 'BLOCKED') {
    steps.push({ key: 'evaluated', at: decision.createdAt });
    steps.push({ key: 'blocked', at: decision.createdAt, reason: decision.reason || null });
    return steps;
  }
  if (decision.scheduledAt) steps.push({ key: 'scheduled', at: decision.scheduledAt });
  if (decision.revalidatedAt) steps.push({ key: 'revalidated', at: decision.revalidatedAt });
  if (decision.result === 'CANCELLED') {
    steps.push({ key: 'cancelled', at: decision.revalidatedAt || decision.createdAt, reason: decision.reason || null });
    return steps;
  }
  const kinds = ['delivered', 'opened', 'actioned', 'snoozed', 'cancelled_by_revalidation'];
  for (const kind of kinds) {
    const hit = outcomes.find((row) => row.outcome === kind);
    if (hit) steps.push({ key: kind, at: hit.occurredAt, actionKey: hit.actionKey || null });
  }
  return steps;
}

export async function loadOutcomesForDecisionIds(decisionIds) {
  if (!decisionIds?.length) return [];
  await ensureNotificationOutcomeTable();
  try {
    return await prisma.$queryRaw`
      SELECT "decisionId", "userId", "outcome", "actionKey", "occurredAt", "platform", "appVersion"
      FROM "NotificationOutcome"
      WHERE "decisionId" = ANY(${decisionIds})
    `;
  } catch (error) {
    if (error?.code === 'P2010' || /does not exist/i.test(error?.message || '')) return [];
    throw error;
  }
}

export async function loadActivitiesForUsers(userIds, fromDt, toDt) {
  if (!userIds?.length) return [];
  await ensureAppActivityTable();
  try {
    return await prisma.$queryRaw`
      SELECT "userId", "date", "firstAt", "lastAt", "platform", "appVersion"
      FROM "AppActivity"
      WHERE "userId" = ANY(${userIds})
        AND "lastAt" >= ${fromDt}
        AND "firstAt" <= ${toDt}
    `;
  } catch (error) {
    if (error?.code === 'P2010' || /does not exist/i.test(error?.message || '')) return [];
    throw error;
  }
}

/** One outcomes query + one activity query for a page of decisions. */
export async function enrichDecisions(decisions, policy = APP_VERSION_POLICY, loaders = {}) {
  const rows = decisions || [];
  if (!rows.length) return [];
  const { decisionIds: ids, userIds } = collectEnrichmentKeys(rows);
  const times = rows.map((row) => new Date(row.createdAt).getTime()).filter(Number.isFinite);
  const fromDt = new Date((Math.min(...times) || Date.now()) - 2 * 86_400_000);
  const toDt = new Date((Math.max(...times) || Date.now()) + 2 * 86_400_000);
  const loadOutcomes = loaders.loadOutcomes || loadOutcomesForDecisionIds;
  const loadActivities = loaders.loadActivities || loadActivitiesForUsers;
  const [outcomes, activities] = await Promise.all([
    loadOutcomes(ids),
    loadActivities(userIds, fromDt, toDt),
  ]);
  const outcomesByDecision = new Map();
  for (const row of outcomes) {
    if (!outcomesByDecision.has(row.decisionId)) outcomesByDecision.set(row.decisionId, []);
    outcomesByDecision.get(row.decisionId).push(row);
  }
  const activitiesByUser = new Map();
  for (const row of activities) {
    if (!activitiesByUser.has(row.userId)) activitiesByUser.set(row.userId, []);
    activitiesByUser.get(row.userId).push(row);
  }
  return rows.map((decision) => {
    const related = outcomesByDecision.get(decision.decisionId) || [];
    const client = resolveClientContext(decision, {
      outcomes: related,
      activities: activitiesByUser.get(decision.userId) || [],
    });
    return {
      ...decision,
      client,
      telemetry: telemetryCapability(client.appVersion, policy),
      outcomes: related.map((row) => ({
        outcome: row.outcome,
        actionKey: row.actionKey || '',
        occurredAt: row.occurredAt,
      })),
      lifecycle: decisionLifecycle(decision, related),
      filters: classifyDecisionReason(decision.reason),
    };
  });
}
