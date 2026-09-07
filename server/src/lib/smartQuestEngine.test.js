import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BASELINE_MIN_VALID_DAYS,
  BASELINE_STEP_SANITY_MAX,
  BASELINE_WINDOW_DAYS,
  COMEBACK_GAP_DAYS,
  DAILY_MOVEMENT_DEFAULT_TARGET,
  DAILY_MOVEMENT_HARD_MAX,
  DAILY_MOVEMENT_HARD_MIN,
  SMART_QUEST_ENGINE_VERSION,
  WEEKLY_MOVEMENT_DEFAULT_TARGET,
  WEEKLY_MOVEMENT_MAX,
  WEEKLY_MOVEMENT_MIN,
  classifyMovementPerformance,
  computeMovementBaseline,
  resolveComebackMode,
  resolveDailyMovementTarget,
  resolveSmartQuestAssignment,
  resolveWeeklyMovementTarget,
  roundTo1000,
  roundTo250,
  serializeSmartQuestDecisionForAdmin,
  smartQuestAnalyticsCategory,
  targetBucketFor,
} from './smartQuestEngine.js';
import { createQuestFakeDb } from './questFakeDb.js';
import { addDaysYmd } from './questTime.js';
import { assertQuestRecordIsPrivate } from './questPrivacy.js';
import {
  assignDailyQuests,
  assignWeeklyQuests,
  claimQuest,
  getUserQuestDashboard,
  reconcileQuestEligibility,
  updateQuestProgress,
} from './quest.js';

const NOW = new Date('2026-09-06T12:00:00+04:00');
const TODAY = '2026-09-06';
const USER = 'user-smart-1';
const TZ = 'Asia/Tbilisi';

function daysAgo(n) {
  return addDaysYmd(TODAY, -n);
}

function metricRows(steps) {
  // steps[i] → the (i+1)-th day before TODAY
  return steps.map((value, index) => ({ date: daysAgo(index + 1), steps: value }));
}

async function seedMetrics(db, steps) {
  for (const row of metricRows(steps)) {
    if (row.steps === undefined) continue;
    await db.healthMetricDaily.create({ data: { userId: USER, ...row } });
  }
}

async function baseSetup({ steps = [], stepStatus = 'AVAILABLE', hydrationGoal = 2000, lastActiveQuestDate } = {}) {
  const db = createQuestFakeDb();
  await db.stepTrackingCapability.create({ data: { userId: USER, status: stepStatus, source: 'HEALTH_CONNECT' } });
  if (hydrationGoal) await db.hydrationPreference.create({ data: { userId: USER, goalMl: hydrationGoal } });
  await seedMetrics(db, steps);
  if (lastActiveQuestDate) {
    await db.userQuestProfile.create({
      data: { userId: USER, currentLevel: 1, totalXp: 0, cachedCoinBalance: 0, lastActiveQuestDate, timezone: TZ },
    });
  }
  const options = { db, now: NOW, timezone: TZ };
  return { db, options };
}

function questByKey(rows, key) {
  return rows.find((row) => (row.template?.key || row.key) === key);
}

/* ── §10/§17 rounding ────────────────────────────────────────────────── */

describe('phase 5 rounding', () => {
  it('roundTo250 matches the documented examples', () => {
    assert.equal(roundTo250(3410), 3500);
    assert.equal(roundTo250(5090), 5000);
    assert.equal(roundTo250(7880), 8000);
    assert.equal(roundTo250(2873.85), 2750);
    assert.equal(roundTo250(125), 250); // ties round up
  });

  it('roundTo1000 matches the documented examples', () => {
    assert.equal(roundTo1000(31_200), 31_000);
    assert.equal(roundTo1000(31_600), 32_000);
    assert.equal(roundTo1000(31_500), 32_000); // ties round up
  });
});

/* ── §7/§55/§56/§73 baseline ─────────────────────────────────────────── */

describe('phase 5 movement baseline', () => {
  it('no history → no baseline', () => {
    const out = computeMovementBaseline([], TODAY);
    assert.equal(out.baseline, null);
    assert.equal(out.baselineBucket, 'NONE');
    assert.equal(out.validDays, 0);
  });

  it('1 and 2 valid days are not enough for personalization', () => {
    assert.equal(computeMovementBaseline(metricRows([4000]), TODAY).baseline, null);
    assert.equal(computeMovementBaseline(metricRows([4000, 5000]), TODAY).baseline, null);
    assert.equal(BASELINE_MIN_VALID_DAYS, 3);
  });

  it('3 valid days unlock the median baseline', () => {
    const out = computeMovementBaseline(metricRows([4000, 6000, 5000]), TODAY);
    assert.equal(out.baseline, 5000);
    assert.equal(out.validDays, 3);
  });

  it('uses the median, not the average — one unusually active day does not distort', () => {
    // avg would be 8400; median stays grounded
    const out = computeMovementBaseline(metricRows([4000, 4200, 25_000, 4400, 4400]), TODAY);
    assert.equal(out.baseline, 4400);
  });

  it('even count → average of the two middle values', () => {
    const out = computeMovementBaseline(metricRows([3000, 4000, 5000, 6000]), TODAY);
    assert.equal(out.baseline, 4500);
  });

  it('14 days count, day 15+ is outside the window', () => {
    const rows = metricRows(Array.from({ length: 14 }, () => 4000));
    rows.push({ date: daysAgo(15), steps: 20_000 });
    rows.push({ date: daysAgo(20), steps: 20_000 });
    const out = computeMovementBaseline(rows, TODAY);
    assert.equal(out.validDays, 14);
    assert.equal(out.baseline, 4000);
    assert.equal(BASELINE_WINDOW_DAYS, 14);
  });

  it('today and future rows never count', () => {
    const rows = [
      { date: TODAY, steps: 90_000 },
      { date: addDaysYmd(TODAY, 1), steps: 90_000 },
      ...metricRows([4000, 4000, 4000]),
    ];
    const out = computeMovementBaseline(rows, TODAY);
    assert.equal(out.baseline, 4000);
    assert.equal(out.validDays, 3);
  });

  it('excludes corrupt values above the 100000 sanity ceiling and counts a safe anomaly', () => {
    const rows = metricRows([4000, 4000, 4000, 250_000]);
    const out = computeMovementBaseline(rows, TODAY);
    assert.equal(out.baseline, 4000);
    assert.equal(out.validDays, 3);
    assert.equal(out.anomalies, 1);
    assert.equal(BASELINE_STEP_SANITY_MAX, 100_000);
  });

  it('exactly 100000 is still a valid (extreme) day', () => {
    const out = computeMovementBaseline(metricRows([100_000, 100_000, 100_000]), TODAY);
    assert.equal(out.baseline, 100_000);
    assert.equal(out.anomalies, 0);
  });

  it('missing days and ambiguous zero days are excluded (sync cannot prove a real zero)', () => {
    const rows = [
      { date: daysAgo(1), steps: 0 },
      { date: daysAgo(2), steps: null },
      { date: daysAgo(3), steps: 4000 },
      { date: daysAgo(5), steps: 5000 }, // day 4 missing entirely
      { date: daysAgo(6), steps: 6000 },
    ];
    const out = computeMovementBaseline(rows, TODAY);
    assert.equal(out.validDays, 3);
    assert.equal(out.baseline, 5000);
  });
});

/* ── §9/§74 daily target bands, boundaries, clamps, rounding ─────────── */

describe('phase 5 daily movement target', () => {
  function daily(baseline, extra = {}) {
    return resolveDailyMovementTarget({ baseline, performanceBucket: 'NEUTRAL', comebackMode: false, ...extra });
  }

  it('no baseline → 5000 default, DEFAULT source', () => {
    const out = daily(null);
    assert.equal(out.target, DAILY_MOVEMENT_DEFAULT_TARGET);
    assert.equal(out.targetSource, 'DEFAULT');
    assert.equal(out.reasonKey, 'DEFAULT_TARGET');
    assert.equal(out.difficulty, 'NORMAL');
  });

  it('exact band boundaries: 2499 / 2500 / 4999 / 5000 / 7999 / 8000', () => {
    assert.equal(daily(2499).target, 2750); // 2873.85 → 2750
    assert.equal(daily(2500).target, 3000); // 2750 clamped up to 3000
    assert.equal(daily(4999).target, 5500); // 5498.9 → 5500
    assert.equal(daily(5000).target, 5500); // 5375 → 5500 (ties up)
    assert.equal(daily(7999).target, 8500); // 8598.9 clamped to 8500
    assert.equal(daily(8000).target, 8500); // 8400 → roundTo250 → 8500
  });

  it('very low baseline clamps to a floor of 2000', () => {
    const out = daily(1000); // 1150 → clamp 2000
    assert.equal(out.target, 2000);
    assert.equal(out.difficulty, 'STRETCH'); // 2000 > 1000×1.10
  });

  it('hard max is 10000 — no escalating missions', () => {
    const out = daily(12_000); // 12600 → clamp 10000
    assert.equal(out.target, DAILY_MOVEMENT_HARD_MAX);
    assert.equal(daily(9800).target, 10_000); // 10290 → clamp
  });

  it('difficulty labels are relative to baseline', () => {
    assert.equal(daily(8000).difficulty, 'NORMAL'); // 8500 ≤ 8800
    assert.equal(daily(2499).difficulty, 'STRETCH'); // 2750 > 2748.9
    const struggling = daily(5000, { performanceBucket: 'STRUGGLING' });
    assert.equal(struggling.target, 5000); // 5500 × 0.9 = 4950 → roundTo250 → 5000
    assert.equal(struggling.difficulty, 'EASY'); // reduced to baseline
  });
});

/* ── §11/§12/§13/§75 performance modifier ────────────────────────────── */

describe('phase 5 recent performance', () => {
  function quests(completed, total) {
    return Array.from({ length: total }, (_, i) => ({
      status: i < completed ? 'COMPLETED' : 'EXPIRED',
    }));
  }

  it('fewer than 3 assignments → NEUTRAL', () => {
    assert.equal(classifyMovementPerformance([]).performanceBucket, 'NEUTRAL');
    assert.equal(classifyMovementPerformance(quests(1, 1)).performanceBucket, 'NEUTRAL');
    assert.equal(classifyMovementPerformance(quests(0, 2)).performanceBucket, 'NEUTRAL');
  });

  it('classifies the specified ratios', () => {
    assert.equal(classifyMovementPerformance(quests(0, 3)).performanceBucket, 'STRUGGLING'); // 0
    assert.equal(classifyMovementPerformance(quests(1, 3)).performanceBucket, 'STRUGGLING'); // 0.33
    assert.equal(classifyMovementPerformance(quests(2, 3)).performanceBucket, 'STABLE'); // 0.67
    assert.equal(classifyMovementPerformance(quests(3, 3)).performanceBucket, 'STABLE_HIGH'); // 1.0
    assert.equal(classifyMovementPerformance(quests(2, 5)).performanceBucket, 'STABLE'); // 0.40 boundary
    assert.equal(classifyMovementPerformance(quests(4, 5)).performanceBucket, 'STABLE_HIGH'); // 0.80 boundary
    assert.equal(classifyMovementPerformance(quests(7, 7)).performanceBucket, 'STABLE_HIGH');
  });

  it('CLAIMED counts as completed and CANCELLED is ignored', () => {
    const rows = [
      { status: 'CLAIMED' },
      { status: 'CANCELLED' },
      { status: 'COMPLETED' },
      { status: 'EXPIRED' },
      { status: 'CLAIMED' },
    ];
    const out = classifyMovementPerformance(rows);
    assert.equal(out.assignments, 4);
    assert.equal(out.performanceBucket, 'STABLE'); // 3/4 = 0.75
  });

  it('STRUGGLING reduces the target 10%, rounded, never below 2000', () => {
    const out = resolveDailyMovementTarget({ baseline: 5000, performanceBucket: 'STRUGGLING', comebackMode: false });
    // band → 5500, ×0.9 = 4950 → roundTo250 → 5000
    assert.equal(out.target, 5000);
    assert.equal(out.reasonKey, 'STRUGGLING_ADJUSTED');
    const floor = resolveDailyMovementTarget({ baseline: 1200, performanceBucket: 'STRUGGLING', comebackMode: false });
    assert.equal(floor.target, DAILY_MOVEMENT_HARD_MIN); // 2000 × 0.9 → floor 2000
  });

  it('high performance never escalates the target', () => {
    const neutral = resolveDailyMovementTarget({ baseline: 6000, performanceBucket: 'NEUTRAL', comebackMode: false });
    const high = resolveDailyMovementTarget({ baseline: 6000, performanceBucket: 'STABLE_HIGH', comebackMode: false });
    assert.equal(high.target, neutral.target);
  });
});

/* ── §27/§28/§76 comeback ───────────────────────────────────────────── */

describe('phase 5 comeback mode', () => {
  it('6-day absence is not a comeback, 7 full missed days is', () => {
    assert.equal(resolveComebackMode({ lastActiveQuestDate: daysAgo(7), today: TODAY }).comebackMode, false);
    assert.equal(resolveComebackMode({ lastActiveQuestDate: daysAgo(8), today: TODAY }).comebackMode, true);
    assert.equal(resolveComebackMode({ lastActiveQuestDate: daysAgo(9), today: TODAY }).comebackMode, true);
    assert.equal(COMEBACK_GAP_DAYS, 8);
  });

  it('no prior completion history → never comeback', () => {
    assert.equal(resolveComebackMode({ lastActiveQuestDate: null, today: TODAY }).comebackMode, false);
    assert.equal(resolveComebackMode({ lastActiveQuestDate: undefined, today: TODAY }).comebackMode, false);
  });

  it('comeback uses local period keys, not wall-clock hours', () => {
    // The decision is a pure YMD diff — hours/timezone hops cannot flip it.
    const out = resolveComebackMode({ lastActiveQuestDate: '2026-08-29', today: '2026-09-06' });
    assert.equal(out.gapDays, 8);
    assert.equal(out.comebackMode, true);
  });

  it('comeback caps the target at roundTo250(max(2000, baseline×0.90))', () => {
    const out = resolveDailyMovementTarget({ baseline: 6000, performanceBucket: 'NEUTRAL', comebackMode: true });
    // normal band → 6500, cap = roundTo250(6000×0.9=5400) = 5500 → min(6500, 5500)
    assert.equal(roundTo250(5400), 5500); // documented Math.round semantics
    assert.equal(out.target, 5500);
    assert.equal(out.targetSource, 'COMEBACK');
    assert.equal(out.reasonKey, 'COMEBACK_EASY');
  });

  it('comeback never goes below 2000', () => {
    const out = resolveDailyMovementTarget({ baseline: 2100, performanceBucket: 'NEUTRAL', comebackMode: true });
    assert.equal(out.target, 2000); // cap roundTo250(max(2000, 1890)) = 2000
  });

  it('comeback with no baseline uses the 5000 default as the cap basis (documented)', () => {
    const out = resolveDailyMovementTarget({ baseline: null, performanceBucket: 'NEUTRAL', comebackMode: true });
    assert.equal(out.target, 4500); // min(5000, roundTo250(4500))
    assert.equal(out.targetSource, 'COMEBACK');
  });

  it('comeback never assigns a harder mission than the normal target', () => {
    const normal = resolveDailyMovementTarget({ baseline: 3000, performanceBucket: 'NEUTRAL', comebackMode: false });
    const comeback = resolveDailyMovementTarget({ baseline: 3000, performanceBucket: 'NEUTRAL', comebackMode: true });
    assert.ok(comeback.target <= normal.target);
  });
});

/* ── §16/§17/§77 weekly target ──────────────────────────────────────── */

describe('phase 5 weekly movement target', () => {
  it('no baseline → default 35000', () => {
    const out = resolveWeeklyMovementTarget({ baseline: null, performanceBucket: 'NEUTRAL' });
    assert.equal(out.target, WEEKLY_MOVEMENT_DEFAULT_TARGET);
    assert.equal(out.targetSource, 'DEFAULT');
  });

  it('baseline → roundTo1000(B×7×0.90) with clamps', () => {
    assert.equal(resolveWeeklyMovementTarget({ baseline: 5000, performanceBucket: 'NEUTRAL' }).target, 32_000); // 31500 → 32000
    assert.equal(resolveWeeklyMovementTarget({ baseline: 3000, performanceBucket: 'NEUTRAL' }).target, WEEKLY_MOVEMENT_MIN); // 18900 → clamp 21000
    assert.equal(resolveWeeklyMovementTarget({ baseline: 10_000, performanceBucket: 'NEUTRAL' }).target, WEEKLY_MOVEMENT_MAX); // 63000 → clamp 60000
  });

  it('struggling weekly completion reduces 10% with the 21000 floor', () => {
    const out = resolveWeeklyMovementTarget({ baseline: 5000, performanceBucket: 'STRUGGLING' });
    assert.equal(out.target, 29_000); // 32000 × 0.9 = 28800 → 29000
    assert.equal(out.reasonKey, 'STRUGGLING_ADJUSTED');
    const floor = resolveWeeklyMovementTarget({ baseline: 3400, performanceBucket: 'STRUGGLING' });
    assert.equal(floor.target, WEEKLY_MOVEMENT_MIN);
  });
});

/* ── integration: assignment, freeze, lifecycle, safety ─────────────── */

describe('phase 5 smart assignment integration', () => {
  it('new user without history gets the 5000 default and DEFAULT metadata', async () => {
    const { options } = await baseSetup();
    const assigned = await assignDailyQuests(USER, TODAY, options);
    const steps = questByKey(assigned, 'daily_steps');
    assert.equal(steps.target, 5000);
    assert.equal(steps.metadata.smart.targetSource, 'DEFAULT');
    assert.equal(steps.metadata.smart.engineVersion, SMART_QUEST_ENGINE_VERSION);
  });

  it('existing user with ≥3 valid days personalizes immediately', async () => {
    const { options } = await baseSetup({ steps: [4200, 3800, 4000, 4100] });
    const assigned = await assignDailyQuests(USER, TODAY, options);
    const steps = questByKey(assigned, 'daily_steps');
    // median 4050 → ×1.10 = 4455 → clamp(3000,5500) → roundTo250 → 4500
    assert.equal(steps.target, 4500);
    assert.equal(steps.metadata.smart.targetSource, 'PERSONALIZED');
    assert.equal(steps.metadata.smart.reasonKey, 'PERSONAL_BASELINE');
    assert.equal(steps.metadata.smart.baselineBucket, 'LOW');
  });

  it('weekly quest personalizes from the same baseline', async () => {
    const { options } = await baseSetup({ steps: [5000, 5000, 5000] });
    const assigned = await assignWeeklyQuests(USER, undefined, options);
    const weekly = questByKey(assigned, 'weekly_steps');
    assert.equal(weekly.target, 32_000);
    assert.equal(weekly.metadata.smart.targetSource, 'PERSONALIZED');
  });

  it('comeback user gets the easier re-entry target', async () => {
    const { options } = await baseSetup({
      steps: [6000, 6000, 6000],
      lastActiveQuestDate: daysAgo(10),
    });
    const assigned = await assignDailyQuests(USER, TODAY, options);
    const steps = questByKey(assigned, 'daily_steps');
    assert.equal(steps.metadata.smart.comebackMode, true);
    assert.equal(steps.metadata.smart.targetSource, 'COMEBACK');
    assert.equal(steps.target, 5500); // min(6500, roundTo250(5400)=5500)
  });

  it('struggling history lowers the assigned target', async () => {
    const { db, options } = await baseSetup({ steps: [5000, 5000, 5000] });
    // seed 5 prior expired movement assignments (0/5 completion)
    const assigned = await assignDailyQuests(USER, TODAY, options);
    const template = questByKey(assigned, 'daily_steps');
    const db2 = db;
    for (let i = 1; i <= 5; i += 1) {
      await db2.userQuest.create({
        data: {
          userId: USER,
          templateId: template.templateId,
          periodKey: daysAgo(i),
          target: 5000,
          progress: 0,
          status: 'EXPIRED',
          assignedAt: new Date(NOW.getTime() - i * 86_400_000),
          expiresAt: new Date(NOW.getTime() - (i - 1) * 86_400_000),
          metadata: {},
        },
      });
    }
    // assign for tomorrow so the engine sees the history
    const tomorrow = addDaysYmd(TODAY, 1);
    const next = await assignDailyQuests(USER, tomorrow, {
      ...options,
      now: new Date(NOW.getTime() + 86_400_000),
    });
    const steps = questByKey(next, 'daily_steps');
    assert.equal(steps.metadata.smart.performanceBucket, 'STRUGGLING');
    assert.equal(steps.metadata.smart.reasonKey, 'STRUGGLING_ADJUSTED');
    // baseline unchanged (5000, still within window) → band 5500 → ×0.9 = 4950 → 5000
    assert.equal(steps.target, 5000);
  });

  it('FREEZE: later baseline/capability changes never rewrite the assigned target', async () => {
    const { db, options } = await baseSetup({ steps: [4000, 4000, 4000] });
    const first = questByKey(await assignDailyQuests(USER, TODAY, options), 'daily_steps');
    assert.equal(first.target, 4500);

    // baseline changes drastically
    for (let i = 5; i <= 9; i += 1) {
      await db.healthMetricDaily.create({ data: { userId: USER, date: daysAgo(i), steps: 9000 } });
    }
    // capability flaps, timezone changes, dashboard resyncs
    await db.stepTrackingCapability.update({ where: { userId: USER }, data: { status: 'UNAVAILABLE' } });
    await db.stepTrackingCapability.update({ where: { userId: USER }, data: { status: 'AVAILABLE' } });
    const dashboard = await getUserQuestDashboard(USER, { ...options, timezone: 'Europe/Paris' });
    const steps = questByKey(dashboard.daily.quests, 'daily_steps');
    assert.equal(steps.target, 4500); // frozen
    assert.equal(steps.targetSource, 'PERSONALIZED');
  });

  it('reconciliation updates progress but never the target', async () => {
    const { db, options } = await baseSetup({ steps: [4000, 4000, 4000] });
    await assignDailyQuests(USER, TODAY, options);
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: 1200 } });
    const updated = await updateQuestProgress(USER, {}, options);
    const steps = questByKey(updated, 'daily_steps');
    assert.equal(steps.progress, 1200);
    assert.equal(steps.target, 4500);
  });

  it('REWARD FAIRNESS: personalized target does not change the 50 XP / 30 Coin reward', async () => {
    const { db, options } = await baseSetup({ steps: [9000, 9500, 9000] });
    const assigned = await assignDailyQuests(USER, TODAY, options);
    const steps = questByKey(assigned, 'daily_steps');
    assert.ok(steps.target >= 7500); // personalized high
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: steps.target } });
    await updateQuestProgress(USER, {}, options);
    const result = await claimQuest(USER, steps.id, options);
    assert.equal(result.reward.xpAwarded, 50);
    assert.equal(result.reward.coinsAwarded, 30);
  });

  it('SAFETY: persisted smart metadata is privacy-clean and bucket-based', async () => {
    const { options } = await baseSetup({ steps: [4000, 4000, 4000] });
    const assigned = await assignDailyQuests(USER, TODAY, options);
    const steps = questByKey(assigned, 'daily_steps');
    assertQuestRecordIsPrivate(steps.metadata);
    const blob = JSON.stringify(steps.metadata).toLowerCase();
    for (const banned of ['gps', 'weather', 'pain', 'diagnos', 'medication', 'pregnan', 'cycle', 'chat']) {
      assert.ok(!blob.includes(banned), `metadata leaked ${banned}`);
    }
    const category = smartQuestAnalyticsCategory(steps.metadata.smart);
    assert.equal(category, 'PERSONALIZED:STRETCH:v1:cb0'); // 4500 > 4000×1.10
    assert.ok(!category.includes('4500'), 'analytics must not carry the exact target');
    assert.equal(targetBucketFor(steps.target), 'STANDARD');
  });

  it('API: dashboard exposes only safe smart fields, never baseline or trace', async () => {
    const { options } = await baseSetup({ steps: [4000, 4000, 4000] });
    const dashboard = await getUserQuestDashboard(USER, options);
    const steps = questByKey(dashboard.daily.quests, 'daily_steps');
    assert.equal(steps.targetSource, 'PERSONALIZED');
    assert.equal(steps.difficulty, 'STRETCH'); // 4500 > 4000×1.10
    assert.equal(steps.reasonKey, 'PERSONAL_BASELINE');
    const blob = JSON.stringify(steps);
    assert.ok(
      !/"baseline"|"performanceBucket"|"validDays"|"anomalies"|"metadata"|"trace"|"smart"/.test(blob),
      'leaked internals',
    );
  });

  it('admin serializer explains a persisted decision without raw history', () => {
    const row = {
      id: 'q1',
      periodKey: TODAY,
      target: 4500,
      template: { key: 'daily_steps' },
      metadata: {
        smart: {
          engineVersion: 1,
          targetSource: 'PERSONALIZED',
          difficulty: 'NORMAL',
          reasonKey: 'PERSONAL_BASELINE',
          baselineBucket: 'LOW',
          performanceBucket: 'NEUTRAL',
          comebackMode: false,
          baseline: 4000,
          validDays: 3,
        },
      },
    };
    const out = serializeSmartQuestDecisionForAdmin(row);
    assert.equal(out.targetSource, 'PERSONALIZED');
    assert.equal(out.baselineBucket, 'LOW');
    const legacy = serializeSmartQuestDecisionForAdmin({ id: 'q0', metadata: {} });
    assert.equal(legacy.targetSource, 'DEFAULT');
  });

  it('engine works without any weather input — weather is never a target source', async () => {
    // resolveSmartQuestAssignment takes no weather/GPS parameters at all.
    const { db } = await baseSetup({ steps: [4000, 4000, 4000] });
    const resolved = await resolveSmartQuestAssignment({
      db,
      userId: USER,
      template: { id: 'tpl', key: 'daily_steps', progressType: 'STEPS', cadence: 'DAILY' },
      periodKey: TODAY,
      today: TODAY,
    });
    assert.equal(resolved.target, 4500);
    assert.equal(resolved.trace.suppressions.length, 0);
    assert.ok(!('weatherContextKey' in resolved.metadata), 'server engine stores no weather context');
  });
});

/* ── §57/§58/§59 capability-loss lifecycle ──────────────────────────── */

describe('phase 5 eligibility lifecycle', () => {
  it('losing step capability cancels the ACTIVE movement quest and reconciles the denominator', async () => {
    const { db, options } = await baseSetup({ steps: [4000, 4000, 4000] });
    await assignDailyQuests(USER, TODAY, options);
    await assignWeeklyQuests(USER, undefined, options);
    await db.stepTrackingCapability.update({ where: { userId: USER }, data: { status: 'PERMISSION_DENIED' } });

    const out = await reconcileQuestEligibility(USER, options);
    assert.equal(out.cancelled, 2); // daily_steps + weekly_steps

    const dashboard = await getUserQuestDashboard(USER, options);
    assert.ok(!questByKey(dashboard.daily.quests, 'daily_steps'), 'cancelled quest left the dashboard');
    assert.equal(dashboard.summary.dailyTotal, dashboard.daily.quests.length);
    assert.ok(dashboard.daily.quests.length >= 1); // hydration + medi still counting
  });

  it('completed movement quests are never cancelled by capability loss', async () => {
    const { db, options } = await baseSetup({ steps: [4000, 4000, 4000] });
    const assigned = await assignDailyQuests(USER, TODAY, options);
    const steps = questByKey(assigned, 'daily_steps');
    await db.healthMetricDaily.create({ data: { userId: USER, date: TODAY, steps: steps.target } });
    await updateQuestProgress(USER, {}, options);
    await db.stepTrackingCapability.update({ where: { userId: USER }, data: { status: 'UNAVAILABLE' } });
    await reconcileQuestEligibility(USER, options);
    const row = await db.userQuest.findUnique({ where: { id: steps.id } });
    assert.equal(row.status, 'COMPLETED'); // untouched, still claimable
  });

  it('capability returning the same day restores the quest with its frozen target', async () => {
    const { db, options } = await baseSetup({ steps: [4000, 4000, 4000] });
    const assigned = await assignDailyQuests(USER, TODAY, options);
    const steps = questByKey(assigned, 'daily_steps');
    await db.stepTrackingCapability.update({ where: { userId: USER }, data: { status: 'UNAVAILABLE' } });
    await reconcileQuestEligibility(USER, options);
    await db.stepTrackingCapability.update({ where: { userId: USER }, data: { status: 'AVAILABLE' } });
    await reconcileQuestEligibility(USER, options);
    const row = await db.userQuest.findUnique({ where: { id: steps.id } });
    assert.equal(row.status, 'ACTIVE');
    assert.equal(row.target, 4500); // frozen target survives the round trip
    assert.equal(row.metadata.cancelReason, undefined);
  });

  it('removing the hydration goal cancels ACTIVE hydration; restoring keeps the frozen goalBasis', async () => {
    const { db, options } = await baseSetup({});
    const assigned = await assignDailyQuests(USER, TODAY, options);
    const hydro = questByKey(assigned, 'daily_hydration');
    assert.equal(hydro.metadata.goalBasisMl, 2000);

    await db.hydrationPreference.update({ where: { userId: USER }, data: { goalMl: 0 } });
    await reconcileQuestEligibility(USER, options);
    let row = await db.userQuest.findUnique({ where: { id: hydro.id } });
    assert.equal(row.status, 'CANCELLED');

    await db.hydrationPreference.update({ where: { userId: USER }, data: { goalMl: 3000 } });
    await reconcileQuestEligibility(USER, options);
    row = await db.userQuest.findUnique({ where: { id: hydro.id } });
    assert.equal(row.status, 'ACTIVE');
    assert.equal(row.metadata.goalBasisMl, 2000); // frozen basis, not the new 3000
  });

  it('streak is never punished by capability loss', async () => {
    const { db, options } = await baseSetup({ steps: [4000, 4000, 4000] });
    await assignDailyQuests(USER, TODAY, options);
    const before = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    await db.stepTrackingCapability.update({ where: { userId: USER }, data: { status: 'UNAVAILABLE' } });
    await reconcileQuestEligibility(USER, options);
    const after = await db.userQuestProfile.findUnique({ where: { userId: USER } });
    assert.equal(after.currentStreak || 0, before.currentStreak || 0);
    assert.equal(after.lastActiveQuestDate ?? null, before.lastActiveQuestDate ?? null);
  });
});
