/**
 * Product funnel (2026-09-28): install/source → signup → onboarding → first health action → "door"
 * (primaryGoal) → D1/D7/D30. Privacy rule: event names and small enums only. No health values,
 * no free text, no identifiers other than the account id and a hashed install id.
 * Table: prisma/20260928-funnel.sql (scripts/install-funnel.mjs in the release chain).
 */
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { addDaysYmd, createdAtToTbilisiYmd, dateOnlyYmd, enumerateYmds, rateSafe, tbilisiMidnight, tbilisiYmd } from './adminAnalyticsRange.js';

export const MAX_BATCH = 25;
export const MAX_PROPS_BYTES = 256;
/** Offline queues may send late; older events are dropped, future ones are clamped to now. */
export const MAX_EVENT_AGE_DAYS = 30;
export const FUNNEL_PERIODS = Object.freeze([7, 30, 90]);

export const ONBOARDING_STEP_KEYS = Object.freeze([
  'o1-gender', 'o2-goal', 'o3-birthdate', 'o4-body', 'o5-medication', 'o5-weight', 'o5-cycle',
  'privacy', 'ai-privacy', 'notifications', 'home-layout',
]);
export const PRIMARY_GOALS = Object.freeze(['medications', 'nutrition', 'cycle', 'general', 'unknown']);
export const HEALTH_ACTION_TYPES = Object.freeze(['medication', 'meal', 'cycle', 'weight', 'visit', 'record', 'checkin_manual']);
export const INSTALL_SOURCES = Object.freeze(['organic', 'invite', 'utm', 'deeplink']);
export const SIGNUP_METHODS = Object.freeze(['email', 'phone', 'google', 'apple']);
/** Personalised Home layouts. home_layout_changed.from is 'none' when there was no earlier choice (first pick in onboarding). */
export const HOME_LAYOUTS = Object.freeze(['standard', 'women', 'active', 'weight']);
export const HOME_LAYOUT_SOURCES = Object.freeze(['home_header', 'home_footer', 'profile', 'offer', 'onboarding']);
export const HOME_LAYOUT_OFFER_CHOICES = Object.freeze(['tried', 'dismissed', 'other']);

/** Marketing slug from a URL (utm_source=instagram). Letters, digits, - _ . only. */
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{0,39}$/);
const none = z.object({}).strict();

const PROPS = {
  app_first_open: z.object({
    source: z.enum(INSTALL_SOURCES),
    utmSource: slug.optional(),
    utmMedium: slug.optional(),
    utmCampaign: slug.optional(),
  }).strict(),
  signup_completed: z.object({ method: z.enum(SIGNUP_METHODS) }).strict(),
  onboarding_step_viewed: z.object({ stepKey: z.enum(ONBOARDING_STEP_KEYS) }).strict(),
  onboarding_step_completed: z.object({ stepKey: z.enum(ONBOARDING_STEP_KEYS) }).strict(),
  onboarding_completed: z.object({ primaryGoal: z.enum(PRIMARY_GOALS) }).strict(),
  first_health_action: z.object({ type: z.enum(HEALTH_ACTION_TYPES) }).strict(),
  price_alert_opened: none,
  health_passport_created: none,
  referral_shared: none,
  home_layout_picker_opened: z.object({ source: z.enum(HOME_LAYOUT_SOURCES) }).strict(),
  home_layout_changed: z.object({
    layout: z.enum(HOME_LAYOUTS),
    from: z.enum([...HOME_LAYOUTS, 'none']),
    source: z.enum(HOME_LAYOUT_SOURCES),
  }).strict(),
  home_layout_offer_answered: z.object({ choice: z.enum(HOME_LAYOUT_OFFER_CHOICES) }).strict(),
};

export const FUNNEL_EVENT_NAMES = Object.freeze(Object.keys(PROPS));
/** These make sense only for a signed-in person; anonymous copies are rejected. */
export const ACCOUNT_EVENTS = new Set([
  'signup_completed', 'onboarding_completed', 'first_health_action',
  'price_alert_opened', 'health_passport_created', 'referral_shared',
  'home_layout_picker_opened', 'home_layout_changed', 'home_layout_offer_answered',
]);

export const batchSchema = z.object({
  installId: z.string().trim().min(8).max(200),
  events: z.array(z.unknown()).min(1).max(MAX_BATCH),
});

const eventSchema = z.object({
  name: z.enum(FUNNEL_EVENT_NAMES),
  props: z.record(z.string(), z.unknown()).optional(),
  at: z.string().max(40).optional(),
}).strict();

export function installHashOf(installId) {
  const id = String(installId ?? '').trim();
  if (id.length < 8 || id.length > 200) return null;
  return createHash('sha256').update(`medicard-funnel:${id}`).digest('hex');
}

/** One client event → { name, props, createdAt } or null (unknown name, extra props, too big, stale). */
export function sanitizeFunnelEvent(raw, { now = new Date(), signedIn = false } = {}) {
  const base = eventSchema.safeParse(raw);
  if (!base.success) return null;
  const { name } = base.data;
  if (ACCOUNT_EVENTS.has(name) && !signedIn) return null;
  const rawProps = base.data.props ?? {};
  if (JSON.stringify(rawProps).length > MAX_PROPS_BYTES) return null;
  const props = PROPS[name].safeParse(rawProps);
  if (!props.success) return null;
  let createdAt = now;
  if (base.data.at) {
    const at = new Date(base.data.at);
    if (Number.isNaN(at.getTime())) return null;
    if (now.getTime() - at.getTime() > MAX_EVENT_AGE_DAYS * 86_400_000) return null;
    createdAt = at.getTime() > now.getTime() ? now : at;
  }
  return { name, props: props.data, createdAt };
}

function missingTable(error) {
  return error?.code === 'P2010' || error?.meta?.code === '42P01' || /FunnelEvent.*does not exist|relation .* does not exist/i.test(String(error?.message || ''));
}

/**
 * Stores a validated batch. Once-per-install / once-per-account rows are deduped by partial unique
 * indexes (ON CONFLICT DO NOTHING). When signed in, earlier anonymous rows of this install are linked.
 */
export async function ingestFunnelEvents({ userId = null, installId, events, meta = {} }, { db = prisma, now = new Date() } = {}) {
  const installHash = installHashOf(installId);
  const clean = (events || []).slice(0, MAX_BATCH)
    .map((event) => sanitizeFunnelEvent(event, { now, signedIn: Boolean(userId) }))
    .filter(Boolean);
  const rejected = (events || []).length - clean.length;
  let stored = 0;
  let linked = 0;
  try {
    for (const event of clean) {
      stored += await db.$executeRaw`INSERT INTO "FunnelEvent" (id, "userId", "installHash", name, props, platform, "appVersion", "createdAt")
        VALUES (${randomUUID()}, ${userId}, ${installHash}, ${event.name}, ${JSON.stringify(event.props)}::jsonb,
          ${meta.platform ?? null}, ${meta.appVersion ?? null}, ${event.createdAt})
        ON CONFLICT DO NOTHING`;
    }
    if (userId && installHash) linked = await linkInstallToUser(userId, installHash, { db });
  } catch (error) {
    if (missingTable(error)) return { accepted: 0, rejected, stored: 0, linked: 0, installed: false };
    throw error;
  }
  return { accepted: clean.length, rejected, stored, linked, installed: true };
}

/** Attach this install's anonymous events (first open, onboarding views) to the account that signed in. */
export async function linkInstallToUser(userId, installHash, { db = prisma } = {}) {
  if (!userId || !installHash) return 0;
  return db.$executeRaw`UPDATE "FunnelEvent" SET "userId" = ${userId}
    WHERE "installHash" = ${installHash} AND "userId" IS NULL
      AND name NOT IN ('signup_completed', 'onboarding_completed', 'first_health_action')`;
}

/* ─────────────── Admin report ─────────────── */

export const SOURCE_LABELS = { organic: 'ორგანული', invite: 'მოწვევა', deeplink: 'ბმული', unknown: 'უცნობი' };

export function sourceKey(props) {
  if (!props || typeof props !== 'object') return 'unknown';
  if (props.source === 'utm') return `utm:${props.utmSource || 'unknown'}${props.utmCampaign ? `/${props.utmCampaign}` : ''}`;
  return INSTALL_SOURCES.includes(props.source) ? props.source : 'unknown';
}

function activityIndex(activityRows) {
  const byUser = new Map();
  for (const row of activityRows || []) {
    const day = dateOnlyYmd(row.date) || createdAtToTbilisiYmd(row.lastAt || row.firstAt);
    if (!row.userId || !day) continue;
    if (!byUser.has(row.userId)) byUser.set(row.userId, new Set());
    byUser.get(row.userId).add(day);
  }
  return byUser;
}

/** „სხვა მოვლენები“ on the admin page, in this order. */
export const FEATURE_EVENTS = Object.freeze([
  'price_alert_opened', 'health_passport_created', 'referral_shared',
  'home_layout_picker_opened', 'home_layout_changed', 'home_layout_offer_answered',
]);
/** Events counted per value of one enum prop (event counts, not people). */
const FEATURE_BREAKDOWN = Object.freeze({ home_layout_changed: 'layout', home_layout_offer_answered: 'choice' });

/**
 * Pure: builds the funnel from events (period + cohort history) and AppActivity rows.
 * periodEvents: events created in the period. cohortEvents: every funnel event of the signup cohort.
 */
export function buildFunnelReport({ periodEvents = [], cohortEvents = [], activityRows = [], days, today }) {
  const fromYmd = addDaysYmd(today, -(days - 1));
  const inPeriod = (e) => {
    const d = createdAtToTbilisiYmd(e.createdAt);
    return d && d >= fromYmd && d <= today;
  };
  const period = periodEvents.filter(inPeriod);
  const active = activityIndex(activityRows);

  const installs = new Map(); // installHash → source
  for (const e of period) if (e.name === 'app_first_open' && e.installHash && !installs.has(e.installHash)) installs.set(e.installHash, sourceKey(e.props));

  const signupDay = new Map();
  for (const e of period) if (e.name === 'signup_completed' && e.userId && !signupDay.has(e.userId)) signupDay.set(e.userId, createdAtToTbilisiYmd(e.createdAt));
  const cohort = [...signupDay.keys()];
  const inCohort = new Set(cohort);

  const per = new Map(cohort.map((id) => [id, { source: 'unknown', goal: null, started: false, onboarded: false, action: null }]));
  for (const e of cohortEvents) {
    const p = per.get(e.userId);
    if (!p) continue;
    if (e.name === 'app_first_open') p.source = sourceKey(e.props);
    else if (e.name === 'onboarding_step_viewed') p.started = true;
    else if (e.name === 'onboarding_completed') { p.onboarded = true; p.started = true; p.goal = e.props?.primaryGoal || 'unknown'; }
    else if (e.name === 'first_health_action') p.action = e.props?.type || 'unknown';
  }
  const returned = (id, offset) => {
    const day = addDaysYmd(signupDay.get(id), offset);
    if (day > today) return null; // not eligible yet
    return Boolean(active.get(id)?.has(day));
  };

  const count = (pred) => cohort.filter((id) => pred(per.get(id), id)).length;
  const d1Eligible = count((_, id) => returned(id, 1) !== null);
  const steps = [
    { key: 'install', label: 'ინსტალაცია', count: installs.size },
    { key: 'signup', label: 'რეგისტრაცია', count: cohort.length },
    { key: 'onboarding_started', label: 'ონბორდინგი დაიწყო', count: count((p) => p.started) },
    { key: 'onboarding_completed', label: 'ონბორდინგი დასრულდა', count: count((p) => p.onboarded) },
    { key: 'first_health_action', label: 'პირველი ჯანმრთელობის ქმედება', count: count((p) => p.action) },
    { key: 'd1', label: 'დაბრუნდა D1', count: count((_, id) => returned(id, 1) === true), eligible: d1Eligible },
  ];
  steps.forEach((step, i) => {
    step.fromPrevious = i === 0 ? null : rateSafe(step.count, steps[i - 1].count);
    step.fromSignup = i < 1 ? null : rateSafe(step.count, steps[1].count);
  });

  const bySource = new Map();
  const sourceRow = (key) => {
    if (!bySource.has(key)) bySource.set(key, { key, installs: 0, signups: 0, onboarded: 0, activated: 0, d1: 0, d1Eligible: 0 });
    return bySource.get(key);
  };
  for (const source of installs.values()) sourceRow(source).installs += 1;
  for (const id of cohort) {
    const p = per.get(id);
    const row = sourceRow(p.source);
    row.signups += 1;
    if (p.onboarded) row.onboarded += 1;
    if (p.action) row.activated += 1;
    const r1 = returned(id, 1);
    if (r1 !== null) row.d1Eligible += 1;
    if (r1) row.d1 += 1;
  }
  const sources = [...bySource.values()]
    .map((row) => ({ ...row, signupRate: rateSafe(row.signups, row.installs), activationRate: rateSafe(row.activated, row.signups), d1Rate: rateSafe(row.d1, row.d1Eligible) }))
    .sort((a, b) => b.signups - a.signups || b.installs - a.installs);

  const byGoal = new Map(PRIMARY_GOALS.map((g) => [g, { goal: g, users: 0, activated: 0, d1: 0, d1Eligible: 0, d7: 0, d7Eligible: 0, actions: {} }]));
  for (const id of cohort) {
    const p = per.get(id);
    if (!p.onboarded) continue;
    const row = byGoal.get(PRIMARY_GOALS.includes(p.goal) ? p.goal : 'unknown');
    row.users += 1;
    if (p.action) { row.activated += 1; row.actions[p.action] = (row.actions[p.action] || 0) + 1; }
    for (const [offset, k] of [[1, 'd1'], [7, 'd7']]) {
      const r = returned(id, offset);
      if (r !== null) row[`${k}Eligible`] += 1;
      if (r) row[k] += 1;
    }
  }
  const goals = [...byGoal.values()].filter((g) => g.users > 0 || g.goal !== 'unknown')
    .map((g) => ({ ...g, activationRate: rateSafe(g.activated, g.users), d1Rate: rateSafe(g.d1, g.d1Eligible), d7Rate: rateSafe(g.d7, g.d7Eligible) }));

  const who = (e) => e.userId || e.installHash;
  const onboarding = ONBOARDING_STEP_KEYS.map((stepKey) => {
    const viewed = new Set();
    const completed = new Set();
    for (const e of period) {
      if (e.props?.stepKey !== stepKey || !who(e)) continue;
      if (e.name === 'onboarding_step_viewed') viewed.add(who(e));
      if (e.name === 'onboarding_step_completed') completed.add(who(e));
    }
    return { stepKey, viewed: viewed.size, completed: completed.size, completionRate: rateSafe(completed.size, viewed.size) };
  }).filter((s) => s.viewed > 0 || !s.stepKey.startsWith('o5-'));

  const features = FEATURE_EVENTS.map((name) => {
    const rows = period.filter((e) => e.name === name);
    const feature = { name, events: rows.length, users: new Set(rows.map((e) => e.userId).filter(Boolean)).size };
    const prop = FEATURE_BREAKDOWN[name];
    if (prop) {
      feature.breakdown = {};
      for (const e of rows) {
        const value = typeof e.props?.[prop] === 'string' ? e.props[prop] : 'unknown';
        feature.breakdown[value] = (feature.breakdown[value] || 0) + 1;
      }
    }
    return feature;
  });

  const dayList = enumerateYmds(fromYmd, today);
  const series = (name, key = (e) => e.installHash || e.userId) => {
    const map = new Map(dayList.map((d) => [d, new Set()]));
    for (const e of period) if (e.name === name) map.get(createdAtToTbilisiYmd(e.createdAt))?.add(key(e));
    return dayList.map((day) => ({ day, count: map.get(day).size }));
  };
  const trend = {
    installs: series('app_first_open', (e) => e.installHash),
    signups: series('signup_completed', (e) => e.userId),
    activated: series('first_health_action', (e) => e.userId),
  };

  return {
    period: { days, from: fromYmd, to: today, timezone: 'Asia/Tbilisi' },
    steps,
    sources,
    goals,
    onboarding,
    features,
    trend,
    cohortSize: inCohort.size,
    hasData: period.length > 0,
  };
}

export function parseFunnelDays(raw) {
  const days = Number(raw);
  return FUNNEL_PERIODS.includes(days) ? days : 30;
}

const FUNNEL_NAMES_SQL = FUNNEL_EVENT_NAMES;

export async function loadFunnelReport({ days: rawDays } = {}, { db = prisma, now = new Date(), loadActivity, loadRetention } = {}) {
  const days = parseFunnelDays(rawDays);
  const today = tbilisiYmd(now);
  const fromYmd = addDaysYmd(today, -(days - 1));
  const from = tbilisiMidnight(fromYmd);
  let periodEvents = [];
  let cohortEvents = [];
  let installed = true;
  try {
    periodEvents = await db.$queryRaw`SELECT "userId", "installHash", name, props, "createdAt" FROM "FunnelEvent"
      WHERE "createdAt" >= ${from} AND name = ANY(${FUNNEL_NAMES_SQL})`;
    const cohortIds = [...new Set(periodEvents.filter((e) => e.name === 'signup_completed' && e.userId).map((e) => e.userId))];
    if (cohortIds.length) {
      cohortEvents = await db.$queryRaw`SELECT "userId", "installHash", name, props, "createdAt" FROM "FunnelEvent"
        WHERE "userId" = ANY(${cohortIds}) AND name IN ('app_first_open', 'onboarding_step_viewed', 'onboarding_completed', 'first_health_action')`;
    }
  } catch (error) {
    if (!missingTable(error)) throw error;
    installed = false;
  }
  const activityRows = loadActivity ? await loadActivity(fromYmd, today) : [];
  const report = buildFunnelReport({ periodEvents, cohortEvents, activityRows, days, today });
  const retention = loadRetention ? await loadRetention().catch(() => null) : null;
  const newAccounts = await db.user.count({ where: { createdAt: { gte: from } } }).catch(() => null);
  return {
    ...report,
    installed,
    newAccounts,
    retention: retention
      ? { d1: retention.d1, d7: retention.d7, d30: retention.d30, definition: retention.definition, reason: retention.reason }
      : null,
    refreshedAt: now.toISOString(),
  };
}
