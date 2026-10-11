/**
 * Admin #/nutrition „ანალიზი“ (MEDIFOOD) — who uses the food diary and how.
 *
 * Everything comes from the nutrition tables themselves (meals, saved foods, programs + planned meals, fasts,
 * activities, body measurements, preferences), the anonymous `NutritionScanMetric` (AI estimate success and
 * duration, no account), the shared barcode cache, `AiInteraction` mode `WEIGHT_ADVICE` and the number of days
 * with a weight in `HealthMetricDaily`. There is no screen tracking: „used“ means a saved record. Team accounts
 * (exact `@medicard.ge` logins) are left out unless `includeTeam`.
 *
 * Privacy: a person's card carries name, contact and counts (meals, diary days, how they log, plan / fasting /
 * activity use, last log). Never meal names, notes, photos, calories or macros, weights, body measurements,
 * program targets or the fasting screening answers — those columns are not even loaded (raw SQL picks the few
 * enum fields the page counts).
 */
import { prisma } from './prisma.js';
import { addDaysYmd, createdAtToTbilisiYmd, rateSafe, tbilisiMidnight, tbilisiYmd } from './adminAnalyticsRange.js';
import {
  activityTracker, bump, daySeries, flagState, iso, loadPeople, loadTeamUserIds, median, missingTable, ms, percentile,
  personSummary, USAGE_PERIODS, usageWindow, zeroes,
} from './adminUsageKit.js';
import { listFeatureFlags } from './featureFlags.js';

/** The page lists at most this many people (newest activity first); every count still covers all of them. */
export const FOOD_USAGE_LIST_MAX = 400;

export const MEAL_SOURCE_KEYS = Object.freeze(['photo', 'label', 'text', 'voice', 'search', 'saved', 'barcode', 'manual', 'plan']);
/** Sources where the meal came out of an AI estimate (photo, nutrition label, typed or spoken description). */
export const AI_SOURCES = Object.freeze(['photo', 'label', 'text', 'voice']);
/** Sources where the food came from a database (search, saved foods, barcode). */
const DB_SOURCES = ['search', 'saved', 'barcode'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const GOALS = ['lose', 'maintain', 'gain'];
const PACES = ['gentle', 'steady'];
const DIETS = ['balanced', 'vegetarian', 'vegan'];
const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active'];
const ACTIVITY_KINDS = ['walk', 'run', 'cycle', 'strength', 'swim', 'yoga', 'hiit', 'sport', 'dance', 'other'];
const FAST_PROTOCOLS = ['12:12', '14:10', '16:8', '18:6', '20:4', 'custom'];
const FOOD_SOURCES = ['custom', 'photo', 'barcode', 'catalog', 'label', 'text', 'meal', 'recipe'];
/** Diary days per person → bucket. */
const DAY_BUCKETS = [['d1', 1, 1], ['d2_3', 2, 3], ['d4_6', 4, 6], ['d7_13', 7, 13], ['d14', 14, Infinity]];
const HABIT_DAYS = 7;
const EDIT_GAP_MS = 60_000;

const known = (list, value, fallback) => (list.includes(value) ? value : fallback);
const avgOf = (list) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null);

function scanStats(rows) {
  const ok = rows.filter((r) => r.success);
  const times = rows.map((r) => Number(r.durationMs)).filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  return {
    total: rows.length,
    ok: ok.length,
    failed: rows.length - ok.length,
    failRate: rateSafe(rows.length - ok.length, rows.length),
    avgMs: avgOf(times),
    p95Ms: percentile(times, 95),
  };
}

/**
 * Pure: raw rows (all accounts) → the page payload. `raw` comes from loadFoodUsageRaw (or a test fixture).
 * @param {object} raw
 * @param {{ days?: number, includeTeam?: boolean, now?: Date }} opts
 */
export function buildFoodUsage(raw, { days = 30, includeTeam = false, now = new Date() } = {}) {
  const win = usageWindow(days, now);
  const { today, inPeriod } = win;
  const weekFrom = addDaysYmd(today, -6);
  const teamIds = new Set(raw.teamUserIds || []);
  const keep = (row) => includeTeam || !teamIds.has(row.userId);
  const allMeals = raw.meals || [];
  const meals = allMeals.filter(keep);
  const programs = (raw.programs || []).filter(keep);
  const planned = (raw.planned || []).filter(keep);
  const activities = (raw.activities || []).filter(keep);
  const fasts = (raw.fasts || []).filter(keep);
  const measurements = (raw.measurements || []).filter(keep);
  const foods = (raw.foods || []).filter(keep);
  const prefs = (raw.preferences || []).filter(keep);
  const weightDays = (raw.weightDays || []).filter(keep);
  const advice = (raw.weightAdvice || []).filter(keep);
  const scans = raw.scans || [];
  const users = new Map((raw.people || []).map((u) => [u.id, u]));

  // ── per person ───────────────────────────────────────────────────────────
  const people = new Map();
  const person = (userId) => {
    if (!people.has(userId)) {
      people.set(userId, {
        userId, meals: 0, diaryDays: new Set(), methods: zeroes(MEAL_SOURCE_KEYS), items: 0, firstMealAt: null, lastMealAt: null,
        program: null, planned: 0, activities: 0, fasts: 0, screened: false, measurements: 0, foods: 0, prefs: false, lastAt: 0,
      });
    }
    return people.get(userId);
  };
  const tracker = activityTracker();
  const act = (userId, at) => {
    if (!at) return;
    tracker.act(userId, at);
    const p = person(userId);
    p.lastAt = Math.max(p.lastAt, ms(at));
  };

  const mealTypes = zeroes(MEAL_TYPES);
  let edited = 0;
  let backdated = 0;
  for (const m of meals) {
    const p = person(m.userId);
    p.meals += 1;
    if (m.date) p.diaryDays.add(String(m.date));
    bump(p.methods, known(MEAL_SOURCE_KEYS, m.source, 'manual'));
    p.items += Number(m.itemCount) || 0;
    if (!p.firstMealAt || ms(m.createdAt) < ms(p.firstMealAt)) p.firstMealAt = m.createdAt;
    if (!p.lastMealAt || ms(m.createdAt) > ms(p.lastMealAt)) p.lastMealAt = m.createdAt;
    bump(mealTypes, known(MEAL_TYPES, m.type, 'snack'));
    act(m.userId, m.createdAt);
    if (ms(m.updatedAt) - ms(m.createdAt) > EDIT_GAP_MS) {
      edited += 1;
      act(m.userId, m.updatedAt);
    }
    if (m.date && createdAtToTbilisiYmd(m.createdAt) !== String(m.date)) backdated += 1;
  }
  for (const r of programs) {
    person(r.userId).program = r.active ? 'active' : 'paused';
    act(r.userId, r.updatedAt);
  }
  for (const r of planned) {
    person(r.userId).planned += Number(r.count) || 0;
    act(r.userId, r.firstAt);
    act(r.userId, r.lastAt);
  }
  for (const r of activities) {
    person(r.userId).activities += 1;
    act(r.userId, r.createdAt);
  }
  for (const r of fasts) {
    person(r.userId).fasts += 1;
    act(r.userId, r.startedAt || r.createdAt);
    if (r.endedAt) act(r.userId, r.endedAt);
  }
  for (const r of measurements) {
    person(r.userId).measurements += 1;
    act(r.userId, r.createdAt);
  }
  for (const r of foods) {
    person(r.userId).foods += 1;
    act(r.userId, r.createdAt);
  }
  for (const r of prefs) {
    const p = person(r.userId);
    p.prefs = true;
    if (r.screened) p.screened = true;
    act(r.userId, r.updatedAt);
  }

  const list = [...people.values()];
  const loggers = list.filter((p) => p.meals > 0);
  const count = (fn, from = list) => from.filter(fn).length;
  const isAi = (p) => AI_SOURCES.some((k) => p.methods[k] > 0);
  const hasPlan = (p) => Boolean(p.program) || p.planned > 0;
  const ladder = [
    { key: 'users', count: list.length },
    { key: 'logged', count: loggers.length },
    { key: 'ai', count: count(isAi) },
    { key: 'returned', count: count((p) => tracker.days(p.userId) >= 2) },
    { key: 'plan', count: count(hasPlan) },
    { key: 'habit', count: count((p) => p.diaryDays.size >= HABIT_DAYS) },
  ].map((step) => ({ ...step, rate: rateSafe(step.count, list.length) }));

  const accounts = Math.max(0, (raw.accountsTotal || 0) - (includeTeam ? 0 : teamIds.size));
  const aiMeals = meals.filter((m) => AI_SOURCES.includes(m.source));
  const personDays = loggers.reduce((sum, p) => sum + p.diaryDays.size, 0);
  const onlyOnce = count((p) => p.diaryDays.size === 1, loggers);
  const weekLoggers = new Set(meals.filter((m) => {
    const d = createdAtToTbilisiYmd(m.createdAt);
    return d >= weekFrom && d <= today;
  }).map((m) => m.userId));
  const lapsed = count((p) => createdAtToTbilisiYmd(p.lastMealAt) < addDaysYmd(today, -13), loggers);

  // ── app return after the first meal (any screen, AppActivity) ─────────────
  const appDays = new Map();
  for (const a of raw.appActivity || []) {
    if (!appDays.has(a.userId)) appDays.set(a.userId, new Set());
    appDays.get(a.userId).add(String(a.date).slice(0, 10));
  }
  const appReturned = count((p) => {
    const first = createdAtToTbilisiYmd(p.firstMealAt);
    return [...(appDays.get(p.userId) || [])].some((d) => d > first);
  }, loggers);

  // ── first meal after sign-up ─────────────────────────────────────────────
  const timing = { sameDay: 0, week: 0, later: 0 };
  const hoursToMeal = [];
  for (const p of loggers) {
    const u = users.get(p.userId);
    if (!u?.createdAt) continue;
    const hours = Math.max(0, (ms(p.firstMealAt) - ms(u.createdAt)) / 3_600_000);
    hoursToMeal.push(hours);
    if (hours < 24) timing.sameDay += 1;
    else if (hours < 24 * 7) timing.week += 1;
    else timing.later += 1;
  }

  // ── logging habits ───────────────────────────────────────────────────────
  const sources = zeroes(MEAL_SOURCE_KEYS);
  for (const m of meals) bump(sources, known(MEAL_SOURCE_KEYS, m.source, 'manual'));
  const daysDist = zeroes(DAY_BUCKETS.map(([k]) => k));
  for (const p of loggers) {
    const n = p.diaryDays.size;
    const bucket = DAY_BUCKETS.find(([, lo, hi]) => n >= lo && n <= hi);
    if (bucket) bump(daysDist, bucket[0]);
  }
  const methodCounts = { one: 0, two: 0, more: 0 };
  for (const p of loggers) {
    const n = MEAL_SOURCE_KEYS.filter((k) => p.methods[k] > 0).length;
    bump(methodCounts, n <= 1 ? 'one' : n === 2 ? 'two' : 'more');
  }
  const mainMethod = zeroes(MEAL_SOURCE_KEYS);
  for (const p of loggers) {
    const top = MEAL_SOURCE_KEYS.reduce((best, k) => (p.methods[k] > p.methods[best] ? k : best), MEAL_SOURCE_KEYS[0]);
    bump(mainMethod, top);
  }
  const itemCounts = meals.map((m) => Number(m.itemCount) || 0).filter((n) => n > 0);

  // ── period ───────────────────────────────────────────────────────────────
  const periodMeals = meals.filter((m) => inPeriod(m.createdAt));
  const signups = (raw.signups || []).filter((u) => (includeTeam || !teamIds.has(u.id)) && inPeriod(u.createdAt));
  const signupsLogged = signups.filter((u) => (people.get(u.id)?.meals || 0) > 0);
  const periodScans = scans.filter((s) => inPeriod(s.createdAt));

  // ── AI ───────────────────────────────────────────────────────────────────
  const aiBySource = zeroes(AI_SOURCES);
  for (const m of aiMeals) bump(aiBySource, m.source);
  const allScans = scanStats(scans);
  // Scans carry no account, so the „estimate → saved“ ratio compares them with AI meals of every account.
  const aiMealsAll = allMeals.filter((m) => AI_SOURCES.includes(m.source)).length;
  const adviceOk = advice.filter((r) => r.status === 'OK');
  const adviceTimes = adviceOk.map((r) => Number(r.latencyMs)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  let adviceCost = 0;
  for (const r of advice) {
    const c = Number(r.tokenUsage?.cost);
    if (Number.isFinite(c)) adviceCost += c;
  }

  // ── program ──────────────────────────────────────────────────────────────
  const goals = zeroes(GOALS);
  const paces = zeroes(PACES);
  const diets = zeroes(DIETS);
  const levels = zeroes(ACTIVITY_LEVELS);
  for (const r of programs) {
    if (!r.active) continue;
    bump(goals, known(GOALS, r.mode, 'maintain'));
    bump(paces, known(PACES, r.pace, 'steady'));
    bump(diets, known(DIETS, r.diet, 'balanced'));
    bump(levels, known(ACTIVITY_LEVELS, r.activity, 'light'));
  }
  const planMeals = meals.filter((m) => m.source === 'plan');

  // ── tools ────────────────────────────────────────────────────────────────
  const protocols = zeroes(FAST_PROTOCOLS);
  const durations = [];
  let reachedGoal = 0;
  for (const f of fasts) {
    bump(protocols, known(FAST_PROTOCOLS, f.protocol, 'custom'));
    if (!f.endedAt) continue;
    const minutes = (ms(f.endedAt) - ms(f.startedAt)) / 60_000;
    if (minutes > 0) durations.push(minutes / 60);
    if (minutes >= (Number(f.targetMinutes) || Infinity)) reachedGoal += 1;
  }
  const activityKinds = zeroes(ACTIVITY_KINDS);
  for (const a of activities) bump(activityKinds, known(ACTIVITY_KINDS, a.kind, 'other'));
  const foodSources = zeroes(FOOD_SOURCES);
  for (const f of foods) bump(foodSources, known(FOOD_SOURCES, f.source, 'custom'));
  const peopleIds = new Set(list.map((p) => p.userId));
  const weightOf = weightDays.filter((w) => peopleIds.has(w.userId));

  // ── people list ──────────────────────────────────────────────────────────
  const items = list
    .map((p) => {
      const lastAt = p.lastAt ? new Date(p.lastAt).toISOString() : null;
      return {
        id: p.userId,
        meals: p.meals,
        days: p.diaryDays.size,
        activeDays: tracker.days(p.userId),
        methods: { ...p.methods },
        ai: AI_SOURCES.reduce((sum, k) => sum + p.methods[k], 0),
        program: p.program,
        planned: p.planned,
        planEaten: p.methods.plan,
        fasting: { screened: p.screened, fasts: p.fasts },
        activities: p.activities,
        foods: p.foods,
        weekLogged: weekLoggers.has(p.userId),
        firstMealAt: iso(p.firstMealAt),
        lastMealAt: iso(p.lastMealAt),
        lastAt,
        person: personSummary(users.get(p.userId) || { id: p.userId }, { teamIds }),
      };
    })
    .sort((a, b) => ms(b.lastAt) - ms(a.lastAt));

  const teamMeals = allMeals.filter((m) => teamIds.has(m.userId));
  const teamUsers = new Set([...allMeals, ...(raw.programs || []), ...(raw.planned || []), ...(raw.activities || []), ...(raw.fasts || []), ...(raw.preferences || [])]
    .filter((r) => teamIds.has(r.userId)).map((r) => r.userId));

  return {
    installed: true,
    generatedAt: now.toISOString(),
    includeTeam,
    team: { accounts: teamIds.size, users: teamUsers.size, meals: teamMeals.length },
    flags: { nutrition: flagState(raw.flags, 'nutrition'), nutritionAi: flagState(raw.flags, 'nutritionAi') },
    settings: {
      photoEnabled: raw.settings?.photoEnabled !== false,
      programEnabled: raw.settings?.programEnabled !== false,
    },
    totals: {
      accounts,
      users: list.length,
      userRate: rateSafe(list.length, accounts),
      loggers: loggers.length,
      loggerRate: rateSafe(loggers.length, accounts),
      meals: meals.length,
      personDays,
      daysPerLogger: loggers.length ? Math.round((personDays / loggers.length) * 10) / 10 : null,
      mealsPerDay: personDays ? Math.round((meals.length / personDays) * 10) / 10 : null,
      onlyOnce,
      noMeals: list.length - loggers.length,
      aiUsers: count(isAi),
      aiMeals: aiMeals.length,
      aiShare: rateSafe(aiMeals.length, meals.length),
      habit: count((p) => p.diaryDays.size >= HABIT_DAYS),
      maxDays: loggers.reduce((max, p) => Math.max(max, p.diaryDays.size), 0),
      weekLoggers: weekLoggers.size,
      lapsed,
      appReturned,
    },
    ladder,
    firstMeal: { ...timing, medianHours: median(hoursToMeal) },
    period: {
      days: win.days,
      from: win.from,
      to: win.to,
      meals: periodMeals.length,
      loggers: new Set(periodMeals.map((m) => m.userId)).size,
      newLoggers: count((p) => inPeriod(p.firstMealAt), loggers),
      activeUsers: tracker.activeIn(win.from, win.to),
      aiMeals: periodMeals.filter((m) => AI_SOURCES.includes(m.source)).length,
      signups: signups.length,
      signupsLogged: signupsLogged.length,
      signupRate: rateSafe(signupsLogged.length, signups.length),
      scans: scanStats(periodScans),
      trend: {
        meals: daySeries(win.dayKeys, meals),
        active: tracker.activeByDay(win.dayKeys),
        ai: daySeries(win.dayKeys, aiMeals),
      },
    },
    logging: {
      sources,
      types: mealTypes,
      daysDist,
      methodCounts,
      mainMethod,
      itemsPerMeal: itemCounts.length ? Math.round((itemCounts.reduce((a, b) => a + b, 0) / itemCounts.length) * 10) / 10 : null,
      edited,
      backdated,
      dbMeals: meals.filter((m) => DB_SOURCES.includes(m.source)).length,
    },
    ai: {
      meals: aiMeals.length,
      users: count(isAi),
      bySource: aiBySource,
      scans: allScans,
      savedAll: aiMealsAll,
      savedRate: rateSafe(aiMealsAll, allScans.ok),
      weightAdvice: {
        total: advice.length,
        users: new Set(advice.map((r) => r.userId)).size,
        ok: adviceOk.length,
        errors: advice.filter((r) => r.status === 'ERROR').length,
        avgMs: avgOf(adviceTimes),
        costUsd: Math.round(adviceCost * 10000) / 10000,
      },
    },
    program: {
      users: programs.length,
      active: programs.filter((r) => r.active).length,
      paused: programs.filter((r) => !r.active).length,
      goals,
      paces,
      diets,
      levels,
      plannedMeals: planned.reduce((sum, r) => sum + (Number(r.count) || 0), 0),
      planUsers: planned.length,
      eaten: planMeals.length,
      eatenUsers: new Set(planMeals.map((m) => m.userId)).size,
    },
    tools: {
      fasting: {
        screened: prefs.filter((r) => r.screened).length,
        users: new Set(fasts.map((f) => f.userId)).size,
        fasts: fasts.length,
        completed: fasts.filter((f) => f.endedAt).length,
        running: fasts.filter((f) => !f.endedAt).length,
        reachedGoal,
        medianHours: median(durations),
        protocols,
      },
      activity: { entries: activities.length, users: new Set(activities.map((a) => a.userId)).size, kinds: activityKinds },
      foods: {
        total: foods.length,
        users: new Set(foods.map((f) => f.userId)).size,
        favorites: foods.filter((f) => f.favorite).length,
        recipes: foods.filter((f) => f.source === 'recipe').length,
        withBarcode: foods.filter((f) => f.hasBarcode).length,
        sources: foodSources,
      },
      // Shared, non-personal cache of Open Food Facts products (every account).
      products: { total: raw.products?.total || 0, hits: raw.products?.hits || 0 },
      measurements: { entries: measurements.length, users: new Set(measurements.map((m) => m.userId)).size },
      // Days with a weight (from any screen or Health sync) among MEDIFOOD users — a count, never a value.
      weight: { users: weightOf.length, tracked: weightOf.filter((w) => (Number(w.count) || 0) >= 2).length },
      prefs: {
        users: prefs.length,
        reminders: prefs.filter((r) => r.reminders).length,
        rollover: prefs.filter((r) => r.rollover).length,
        addBurned: prefs.filter((r) => r.addBurned).length,
        countSteps: prefs.filter((r) => r.countSteps).length,
        customMacros: prefs.filter((r) => r.macrosCustom).length,
      },
    },
    items: items.slice(0, FOOD_USAGE_LIST_MAX),
    itemsTotal: items.length,
  };
}

/** Every row the page needs, for all accounts (the builder drops team accounts). Read-only. */
export async function loadFoodUsageRaw(db = prisma, { now = new Date() } = {}) {
  const since = tbilisiMidnight(addDaysYmd(tbilisiYmd(now), -(Math.max(...USAGE_PERIODS) - 1)));
  const [teamUserIds, accountsTotal, meals, programs, planned, activities, fasts, measurements, foods, preferences, products, weightDays, weightAdvice, scans, settings, signups, flags] = await Promise.all([
    loadTeamUserIds(db),
    db.user.count(),
    // Only the fields the page counts — never items (names, calories, macros), notes or titles.
    db.$queryRaw`SELECT "userId", date, type, source, "createdAt", "updatedAt",
      CASE WHEN jsonb_typeof(items) = 'array' THEN jsonb_array_length(items) ELSE 0 END::int AS "itemCount"
      FROM "NutritionMeal"`,
    // Goal direction, pace, diet and activity level only — never weight, height, birth date, targets or screening.
    db.$queryRaw`SELECT "userId", active, config->>'mode' AS mode, config->>'pace' AS pace, config->>'diet' AS diet,
      config->>'activity' AS activity, "updatedAt" FROM "NutritionProgram"`,
    db.nutritionPlannedMeal.groupBy({ by: ['userId'], _count: { _all: true }, _min: { updatedAt: true }, _max: { updatedAt: true } }),
    db.nutritionActivity.findMany({ select: { userId: true, kind: true, createdAt: true } }),
    db.nutritionFast.findMany({ select: { userId: true, startedAt: true, endedAt: true, targetMinutes: true, protocol: true, createdAt: true } }),
    db.bodyMeasurement.findMany({ select: { userId: true, createdAt: true } }),
    db.nutritionFood.findMany({ select: { userId: true, source: true, favorite: true, barcode: true, createdAt: true } }),
    // Switches only — the fasting screening answers stay in the row; only whether it was answered.
    db.$queryRaw`SELECT "userId", "updatedAt",
      COALESCE(data->'reminders'->>'enabled', 'false') = 'true' AS reminders,
      COALESCE(data->>'rollover', 'false') = 'true' AS rollover,
      COALESCE(data->>'addBurned', 'false') = 'true' AS "addBurned",
      COALESCE(data->>'countSteps', 'true') = 'true' AS "countSteps",
      COALESCE(data->'macros'->>'mode', 'auto') = 'custom' AS "macrosCustom",
      COALESCE(jsonb_typeof(data->'fasting'->'screening') = 'object', false) AS screened
      FROM "NutritionPreference"`,
    db.$queryRaw`SELECT count(*)::int AS total, COALESCE(sum(hits), 0)::int AS hits FROM "NutritionProduct"`,
    db.healthMetricDaily.groupBy({ by: ['userId'], where: { weightKg: { not: null } }, _count: { _all: true } }),
    db.aiInteraction.findMany({ where: { mode: 'WEIGHT_ADVICE' }, select: { userId: true, status: true, latencyMs: true, tokenUsage: true, createdAt: true } }),
    db.nutritionScanMetric.findMany({ select: { success: true, durationMs: true, createdAt: true } }),
    db.$queryRaw`SELECT "photoEnabled", "programEnabled" FROM "NutritionSettings" WHERE id = 'main'`.catch(() => []),
    db.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true } }),
    listFeatureFlags(db).catch(() => []),
  ]);
  const ids = [...meals, ...programs, ...planned, ...activities, ...fasts, ...measurements, ...foods, ...preferences].map((r) => r.userId);
  const { people, appDays } = await loadPeople(ids, db);
  return {
    teamUserIds,
    accountsTotal,
    meals: meals.map((m) => ({ ...m, itemCount: Number(m.itemCount) || 0 })),
    programs,
    planned: planned.map((r) => ({ userId: r.userId, count: r._count?._all || 0, firstAt: r._min?.updatedAt || null, lastAt: r._max?.updatedAt || null })),
    activities,
    fasts,
    measurements,
    // The barcode itself is not needed: only whether the saved food has one.
    foods: foods.map(({ barcode, ...f }) => ({ ...f, hasBarcode: Boolean(barcode) })),
    preferences,
    products: { total: Number(products?.[0]?.total) || 0, hits: Number(products?.[0]?.hits) || 0 },
    weightDays: weightDays.map((r) => ({ userId: r.userId, count: r._count?._all || 0 })),
    weightAdvice: weightAdvice.map(({ tokenUsage, ...r }) => ({ ...r, tokenUsage: { cost: tokenUsage?.cost ?? null } })),
    scans,
    settings: settings?.[0] || null,
    signups,
    people,
    appActivity: appDays,
    flags,
  };
}

export async function loadFoodUsage({ days = 30, includeTeam = false, db = prisma, now = new Date() } = {}) {
  try {
    const raw = await loadFoodUsageRaw(db, { now });
    return buildFoodUsage(raw, { days, includeTeam, now });
  } catch (error) {
    if (missingTable(error)) return { installed: false, generatedAt: now.toISOString() };
    throw error;
  }
}
