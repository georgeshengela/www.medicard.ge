import { addDaysYmd, mondayOfIsoWeek } from './questTime.js';

/**
 * Phase 5 — Smart Quest Engine.
 *
 * Deterministic, server-authoritative personalization for movement Quests.
 * ALL personalization math lives here — routes and quest.js only call
 * `resolveSmartQuestAssignment` at assignment time and persist the returned
 * safe metadata. The engine works with zero AI availability; no LLM ever
 * decides eligibility, target, difficulty, reward, or suppression.
 *
 * Approved signals (nothing else):
 *   - HealthMetricDaily.steps history (authoritative synced daily totals)
 *   - movement Quest assignment/completion history (UserQuest rows)
 *   - UserQuestProfile.lastActiveQuestDate (comeback detection)
 *   - step capability / hydration goal (existing eligibility, resolved by caller)
 *
 * Explicitly NOT used: diagnoses, labs, medications, adherence, pregnancy,
 * cycle, weight targets, calories, doctor notes, AI chat content, documents,
 * GPS, weather. Weather stays a mobile presentation concern (Weather Wellness
 * owns retrieval/cache); it never reaches target or reward math.
 *
 * Personalization principle: achievable stretch over maximum activity.
 * Rewards are untouched — daily_steps stays 50 XP / 30 Coins at any target.
 */

export const SMART_QUEST_ENGINE_VERSION = 1;

export const SMART_TARGET_SOURCES = Object.freeze(['DEFAULT', 'PERSONALIZED', 'COMEBACK']);
export const SMART_DIFFICULTIES = Object.freeze(['EASY', 'NORMAL', 'STRETCH']);
export const SMART_PERFORMANCE_BUCKETS = Object.freeze(['NEUTRAL', 'STABLE_HIGH', 'STABLE', 'STRUGGLING']);
export const SMART_REASON_KEYS = Object.freeze([
  'PERSONAL_BASELINE',
  'COMEBACK_EASY',
  'STRUGGLING_ADJUSTED',
  'DEFAULT_TARGET',
]);

/** Baseline window: the 14 local calendar days immediately before the assignment day. */
export const BASELINE_WINDOW_DAYS = 14;
/** Fewer than 3 valid days → default/onboarding target, no personalization. */
export const BASELINE_MIN_VALID_DAYS = 3;
/** Hard sanity ceiling — values above are corrupt/impossible and are excluded (never deleted). */
export const BASELINE_STEP_SANITY_MAX = 100_000;

export const DAILY_MOVEMENT_DEFAULT_TARGET = 5000;
export const DAILY_MOVEMENT_HARD_MAX = 10_000;
export const DAILY_MOVEMENT_HARD_MIN = 2000;

export const WEEKLY_MOVEMENT_DEFAULT_TARGET = 35_000;
export const WEEKLY_MOVEMENT_MIN = 21_000;
export const WEEKLY_MOVEMENT_MAX = 60_000;

/** Recent-performance window: last 7 previously assigned movement Quests of the same cadence. */
export const PERFORMANCE_WINDOW = 7;
export const PERFORMANCE_MIN_ASSIGNMENTS = 3;
export const STRUGGLING_BELOW = 0.4;
export const STABLE_HIGH_AT = 0.8;

/** Comeback: ≥7 fully missed local days after the last streak-counting daily completion. */
export const COMEBACK_GAP_DAYS = 8; // diff(today, lastActive) ≥ 8 ⇔ ≥7 empty days between

export function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Nearest multiple of 250, ties round up (Math.round semantics).
 * 3410 → 3500 · 5090 → 5000 · 7880 → 8000 · 125 → 250.
 */
export function roundTo250(value) {
  return Math.round(value / 250) * 250;
}

/**
 * Nearest multiple of 1000, ties round up.
 * 31200 → 31000 · 31600 → 32000 · 31500 → 32000.
 */
export function roundTo1000(value) {
  return Math.round(value / 1000) * 1000;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function baselineBucketFor(baseline) {
  if (baseline == null) return 'NONE';
  if (baseline < 2500) return 'VERY_LOW';
  if (baseline < 5000) return 'LOW';
  if (baseline < 8000) return 'MODERATE';
  return 'HIGH';
}

/** Analytics-only target bucket — never log the exact personalized target. */
export function targetBucketFor(target) {
  if (target < 4000) return 'LOW';
  if (target <= 7000) return 'STANDARD';
  return 'HIGH';
}

/**
 * Movement baseline = MEDIAN of valid daily step totals inside the most recent
 * 14 local days before `today` (window: today-14 … today-1, today excluded —
 * it is still in progress).
 *
 * A day is valid when its stored total is a finite number with 0 < steps ≤ 100000.
 *
 * Zero/missing-day semantics (documented decision): `HealthMetricDaily.steps`
 * is nullable and mobile sync cannot prove a stored 0 was a genuinely synced
 * zero-activity day versus a day the device simply reported nothing. Because
 * the architecture cannot distinguish them, BOTH null and 0 are treated as
 * missing and excluded from the baseline. Values above the sanity ceiling are
 * excluded and counted as anomalies (source rows are never deleted, raw values
 * are never logged).
 */
export function computeMovementBaseline(rows, today) {
  const windowStart = addDaysYmd(today, -BASELINE_WINDOW_DAYS);
  const values = [];
  let anomalies = 0;
  const seen = new Set();
  for (const row of rows || []) {
    const date = String(row?.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || seen.has(date)) continue;
    if (date < windowStart || date >= today) continue; // exclude out-of-window and future rows
    const steps = Number(row?.steps);
    if (!Number.isFinite(steps) || steps <= 0) continue; // null / missing / ambiguous zero
    if (steps > BASELINE_STEP_SANITY_MAX) {
      anomalies += 1; // excluded from personalization, never deleted
      continue;
    }
    seen.add(date);
    values.push(steps);
  }
  const baseline = values.length >= BASELINE_MIN_VALID_DAYS ? median(values) : null;
  return {
    baseline,
    baselineBucket: baselineBucketFor(baseline),
    validDays: values.length,
    anomalies,
  };
}

/**
 * Recent performance over the last ≤7 previously assigned movement Quests.
 * completed = COMPLETED or CLAIMED. Fewer than 3 settled assignments → NEUTRAL.
 * CANCELLED (capability loss — never punish) and still-ACTIVE assignments
 * (outcome unknown) are excluded.
 */
export function classifyMovementPerformance(recentQuests) {
  const rows = (recentQuests || []).filter(
    (row) => row && row.status !== 'CANCELLED' && row.status !== 'ACTIVE',
  );
  const considered = rows.slice(0, PERFORMANCE_WINDOW);
  if (considered.length < PERFORMANCE_MIN_ASSIGNMENTS) {
    return { performanceBucket: 'NEUTRAL', completionRatio: null, assignments: considered.length };
  }
  const completed = considered.filter((row) => row.status === 'COMPLETED' || row.status === 'CLAIMED').length;
  const ratio = completed / considered.length;
  const bucket = ratio >= STABLE_HIGH_AT ? 'STABLE_HIGH' : ratio >= STRUGGLING_BELOW ? 'STABLE' : 'STRUGGLING';
  return { performanceBucket: bucket, completionRatio: ratio, assignments: considered.length };
}

function diffYmdDays(fromYmd, toYmd) {
  return Math.round((Date.parse(`${toYmd}T00:00:00.000Z`) - Date.parse(`${fromYmd}T00:00:00.000Z`)) / 86_400_000);
}

/**
 * Comeback mode: the user HAS prior daily-completion history and no
 * streak-counting daily Quest was completed for ≥7 full local days.
 * `lastActiveQuestDate` is written only by daily completions, so it is exactly
 * "last qualifying daily completion day".
 */
export function resolveComebackMode({ lastActiveQuestDate, today }) {
  if (!lastActiveQuestDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(lastActiveQuestDate))) {
    return { comebackMode: false, gapDays: null };
  }
  const gapDays = diffYmdDays(String(lastActiveQuestDate), today);
  return { comebackMode: gapDays >= COMEBACK_GAP_DAYS, gapDays };
}

function difficultyFor(target, baseline) {
  if (baseline == null) return 'NORMAL';
  if (target <= baseline) return 'EASY';
  if (target <= baseline * 1.1) return 'NORMAL';
  return 'STRETCH';
}

/**
 * Daily movement target.
 *
 * 1. No baseline (<3 valid days) → 5000 (DEFAULT / DEFAULT_TARGET).
 * 2. Baseline band (B = median), clamp inside the band, then roundTo250:
 *      B < 2500        → clamp(B×1.15, 2000, 3000)
 *      2500 ≤ B < 5000 → clamp(B×1.10, 3000, 5500)
 *      5000 ≤ B < 8000 → clamp(B×1.075, 5000, 8500)
 *      B ≥ 8000        → clamp(B×1.05, 7500, 10000)
 * 3. STRUGGLING (<40% of last ≤7 assigned, ≥3 assignments) → −10%, roundTo250,
 *    never below 2000. High performance NEVER escalates the target.
 * 4. Comeback → target = min(target, roundTo250(max(2000, B×0.90))).
 *    Without a baseline the default 5000 stands in for B (documented) → 4500.
 * 5. Hard max 10000 — no escalating 15k/20k missions.
 */
export function resolveDailyMovementTarget({ baseline, performanceBucket, comebackMode }) {
  const modifiers = [];
  let target;
  let targetSource;
  let reasonKey;

  if (baseline == null) {
    target = DAILY_MOVEMENT_DEFAULT_TARGET;
    targetSource = 'DEFAULT';
    reasonKey = 'DEFAULT_TARGET';
  } else {
    let factor;
    let lo;
    let hi;
    if (baseline < 2500) {
      factor = 1.15; lo = 2000; hi = 3000;
    } else if (baseline < 5000) {
      factor = 1.1; lo = 3000; hi = 5500;
    } else if (baseline < 8000) {
      factor = 1.075; lo = 5000; hi = 8500;
    } else {
      factor = 1.05; lo = 7500; hi = 10_000;
    }
    modifiers.push({ type: 'BASELINE_STRETCH', value: factor });
    target = roundTo250(clampNumber(baseline * factor, lo, hi));
    targetSource = 'PERSONALIZED';
    reasonKey = 'PERSONAL_BASELINE';
  }

  if (performanceBucket === 'STRUGGLING') {
    modifiers.push({ type: 'STRUGGLING_REDUCTION', value: 0.9 });
    target = Math.max(DAILY_MOVEMENT_HARD_MIN, roundTo250(target * 0.9));
    reasonKey = 'STRUGGLING_ADJUSTED';
  }

  if (comebackMode) {
    const basis = baseline == null ? DAILY_MOVEMENT_DEFAULT_TARGET : baseline;
    const cap = roundTo250(Math.max(DAILY_MOVEMENT_HARD_MIN, basis * 0.9));
    modifiers.push({ type: 'COMEBACK_CAP', value: cap });
    target = Math.min(target, cap);
    targetSource = 'COMEBACK';
    reasonKey = 'COMEBACK_EASY';
  }

  target = Math.min(target, DAILY_MOVEMENT_HARD_MAX);

  return {
    target,
    targetSource,
    reasonKey,
    difficulty: difficultyFor(target, baseline),
    modifiers,
  };
}

/**
 * Weekly movement target.
 *
 * No baseline → 35000 default. Otherwise roundTo1000(B×7×0.90) clamped to
 * 21000–60000 (weekly consistency tolerates lighter days — never dailyTarget×7).
 * STRUGGLING weekly completion → −10%, roundTo1000, floor 21000.
 * Comeback does not change the weekly target (comeback is a daily re-entry rule).
 */
export function resolveWeeklyMovementTarget({ baseline, performanceBucket }) {
  const modifiers = [];
  let target;
  let targetSource;
  let reasonKey;

  if (baseline == null) {
    target = WEEKLY_MOVEMENT_DEFAULT_TARGET;
    targetSource = 'DEFAULT';
    reasonKey = 'DEFAULT_TARGET';
  } else {
    modifiers.push({ type: 'WEEKLY_BASELINE', value: 0.9 });
    target = clampNumber(roundTo1000(baseline * 7 * 0.9), WEEKLY_MOVEMENT_MIN, WEEKLY_MOVEMENT_MAX);
    targetSource = 'PERSONALIZED';
    reasonKey = 'PERSONAL_BASELINE';
  }

  if (performanceBucket === 'STRUGGLING') {
    modifiers.push({ type: 'STRUGGLING_REDUCTION', value: 0.9 });
    target = Math.max(WEEKLY_MOVEMENT_MIN, roundTo1000(target * 0.9));
    reasonKey = 'STRUGGLING_ADJUSTED';
  }

  const weeklyBaseline = baseline == null ? null : baseline * 7;
  const difficulty =
    weeklyBaseline == null
      ? 'NORMAL'
      : target < weeklyBaseline * 0.85
        ? 'EASY'
        : target <= weeklyBaseline
          ? 'NORMAL'
          : 'STRETCH';

  return { target, targetSource, reasonKey, difficulty, modifiers };
}

/* ── data loading (server-authoritative, fake-db compatible) ─────────── */

async function loadBaselineRows(db, userId, today) {
  if (typeof db?.healthMetricDaily?.findMany !== 'function') return [];
  const windowStart = addDaysYmd(today, -BASELINE_WINDOW_DAYS);
  return db.healthMetricDaily.findMany({
    where: { userId, date: { gte: windowStart, lt: today } },
  });
}

async function loadRecentMovementQuests(db, userId, templateId, beforePeriodKey) {
  if (typeof db?.userQuest?.findMany !== 'function') return [];
  return db.userQuest.findMany({
    where: { userId, templateId, periodKey: { lt: beforePeriodKey } },
    orderBy: { periodKey: 'desc' },
    take: PERFORMANCE_WINDOW,
  });
}

/**
 * Entry point used by quest assignment for STEPS templates (daily + weekly).
 *
 * Returns `{ target, metadata, trace }` or `null` for non-movement templates.
 * Never throws to the caller with a user-visible failure — assignment falls
 * back to the template default if anything here breaks (fallbackUsed=true).
 *
 * The target is computed ONCE at assignment and frozen for the periodKey —
 * later baseline/weather/capability/timezone changes never rewrite it.
 */
export async function resolveSmartQuestAssignment({ db, userId, template, periodKey, today }) {
  if (template?.progressType !== 'STEPS') return null;
  const cadence = template?.cadence === 'WEEKLY' ? 'WEEKLY' : 'DAILY';
  // For weekly quests baseline anchors on the week's Monday when the assignment
  // day is unknown; the caller passes the actual local assignment day.
  const anchor = today || (cadence === 'WEEKLY' ? mondayOfIsoWeek(periodKey) : periodKey);

  const [baselineRows, recent, profile] = await Promise.all([
    loadBaselineRows(db, userId, cadence === 'WEEKLY' ? anchor : periodKey),
    loadRecentMovementQuests(db, userId, template.id, periodKey),
    typeof db?.userQuestProfile?.findUnique === 'function'
      ? db.userQuestProfile.findUnique({ where: { userId } })
      : null,
  ]);

  const baselineInfo = computeMovementBaseline(baselineRows, cadence === 'WEEKLY' ? anchor : periodKey);
  const performance = classifyMovementPerformance(recent);

  let decision;
  let comeback = { comebackMode: false, gapDays: null };
  if (cadence === 'WEEKLY') {
    decision = resolveWeeklyMovementTarget({
      baseline: baselineInfo.baseline,
      performanceBucket: performance.performanceBucket,
    });
  } else {
    comeback = resolveComebackMode({
      lastActiveQuestDate: profile?.lastActiveQuestDate,
      today: periodKey,
    });
    decision = resolveDailyMovementTarget({
      baseline: baselineInfo.baseline,
      performanceBucket: performance.performanceBucket,
      comebackMode: comeback.comebackMode,
    });
  }

  const metadata = {
    engineVersion: SMART_QUEST_ENGINE_VERSION,
    targetSource: decision.targetSource,
    difficulty: decision.difficulty,
    reasonKey: decision.reasonKey,
    baselineBucket: baselineInfo.baselineBucket,
    performanceBucket: performance.performanceBucket,
    comebackMode: comeback.comebackMode,
    // Internal wellness telemetry for reproducibility/admin — publicQuest never
    // exposes quest metadata, and analytics only ever sees buckets.
    baseline: baselineInfo.baseline,
    validDays: baselineInfo.validDays,
  };

  const trace = {
    questKey: template.key,
    cadence,
    periodKey,
    engineVersion: SMART_QUEST_ENGINE_VERSION,
    target: decision.target,
    targetSource: decision.targetSource,
    difficulty: decision.difficulty,
    reasonKey: decision.reasonKey,
    baselineBucket: baselineInfo.baselineBucket,
    performanceBucket: performance.performanceBucket,
    comebackMode: comeback.comebackMode,
    validDays: baselineInfo.validDays,
    anomalies: baselineInfo.anomalies,
    modifiers: decision.modifiers,
    suppressions: [],
    fallbackUsed: false,
  };

  return { target: decision.target, metadata, trace };
}

/**
 * Privacy-safe structured decision log (dev/admin observability).
 * Never logs GPS, hourly weather, the raw 14-day history, medical signals,
 * or raw anomalous step values — buckets and counts only.
 */
export function logSmartQuestDecision(userId, trace) {
  if (!trace) return;
  console.info('[smart-quest] assigned', {
    userId,
    questKey: trace.questKey,
    periodKey: trace.periodKey,
    engineVersion: trace.engineVersion,
    targetBucket: targetBucketFor(trace.target),
    targetSource: trace.targetSource,
    difficulty: trace.difficulty,
    reasonKey: trace.reasonKey,
    baselineBucket: trace.baselineBucket,
    performanceBucket: trace.performanceBucket,
    comebackMode: trace.comebackMode,
    validDays: trace.validDays,
    anomalies: trace.anomalies,
    fallbackUsed: trace.fallbackUsed,
  });
}

/**
 * Admin-readable answer to "why did this user receive this target?" for a
 * persisted UserQuest row. No raw step history, no medical data — only the
 * safe decision metadata persisted at assignment time. (Admin UI is a later
 * phase; this serializer is the prepared read model.)
 */
export function serializeSmartQuestDecisionForAdmin(questRow) {
  const smart = questRow?.metadata?.smart;
  if (!smart) {
    return {
      questId: questRow?.id || null,
      questKey: questRow?.template?.key || null,
      periodKey: questRow?.periodKey || null,
      target: questRow?.target ?? null,
      engineVersion: null,
      targetSource: 'DEFAULT',
      explanation: 'Assigned before the Smart Quest Engine (template default target).',
    };
  }
  return {
    questId: questRow.id,
    questKey: questRow.template?.key || null,
    periodKey: questRow.periodKey,
    target: questRow.target,
    engineVersion: smart.engineVersion,
    targetSource: smart.targetSource,
    difficulty: smart.difficulty,
    reasonKey: smart.reasonKey,
    baselineBucket: smart.baselineBucket,
    performanceBucket: smart.performanceBucket,
    comebackMode: Boolean(smart.comebackMode),
    baseline: smart.baseline ?? null,
    validDays: smart.validDays ?? null,
  };
}

/** Analytics category string for the smart_quest_assigned product event (≤40 chars, buckets only). */
export function smartQuestAnalyticsCategory(smart) {
  if (!smart) return null;
  return [
    smart.targetSource,
    smart.difficulty,
    `v${smart.engineVersion}`,
    smart.comebackMode ? 'cb1' : 'cb0',
  ].join(':');
}
