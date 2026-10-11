/**
 * Admin #/sleep (MEDISLEEP) — who uses the sleep module and how.
 *
 * Sources: SleepPlan (one per person: the plan and which sleep reminders / alarm are on), SleepNight (one per
 * night, keyed by the morning it ends; times from sleep mode, a hand entry or Apple Health / Health Connect and
 * the morning check-in), SleepPlay (listening sessions: sound ids and minutes), SleepSound (the catalogue the
 * admin manages). The app sends no MEDISLEEP screen views, so „used“ means a saved plan, night or play.
 *
 * Window: a night belongs to the Tbilisi day it ends on (`night`), a play to the day it started. Team accounts
 * (exact `…@medicard.ge`) are left out unless `includeTeam`.
 *
 * Privacy: the person list carries the name and contact (as on the user page) and counts only — never anyone's
 * sleep duration, times, rating or check-in factors, and the last activity is a day, not a time (a saved night's
 * time would give away when they woke up). The sleep picture (average sleep, duration buckets, average rating,
 * factors) and the bedtime hours are aggregates shown only when at least SLEEP_K_MIN different real (non-team)
 * people contributed in the window; otherwise just `{ hidden: true, people }`.
 */
import { prisma } from './prisma.js';
import { addDaysYmd, rateSafe, tbilisiMidnight, tbilisiYmd } from './adminAnalyticsRange.js';
import {
  bump, daySeries, flagState, loadPeople, loadTeamUserIds, missingTable, ms, personSummary, USAGE_PERIODS, usageWindow,
} from './adminUsageKit.js';
import { listFeatureFlags } from './featureFlags.js';
import { SLEEP_CATEGORIES, SLEEP_FACTORS, localParts, sleptMinutes } from './sleep.js';

export const SLEEP_ADMIN_PERIODS = USAGE_PERIODS;
/** The person list shows at most this many people (most active first); every count still covers all of them. */
export const SLEEP_PEOPLE_MAX = 60;
/** k-anonymity: the sleep picture and the bedtime hours need at least this many different real people. */
export const SLEEP_K_MIN = 5;

export const SLEEP_CATEGORY_KA = Object.freeze({ rain: 'წვიმა', nature: 'ბუნება', noise: 'ხმაური', music: 'მელოდიები' });
export const SLEEP_STATUS_KA = Object.freeze({ LIVE: 'აპში ჩანს', DRAFT: 'მონახაზი', HIDDEN: 'დამალული' });
/** Slept-time buckets: [key, Georgian label, from minutes (inclusive), to minutes (exclusive)]. */
export const SLEPT_BUCKETS = Object.freeze([
  ['under5', '5 საათზე ნაკლები', 0, 300],
  ['h5to6', '5–6 საათი', 300, 360],
  ['h6to7', '6–7 საათი', 360, 420],
  ['h7to8', '7–8 საათი', 420, 480],
  ['h8to9', '8–9 საათი', 480, 540],
  ['over9', '9 საათი და მეტი', 540, Infinity],
]);
const TIMES_SOURCES = ['mode', 'manual', 'health'];
const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' of a DATE column (Prisma returns UTC midnight) or a string. */
function dayKey(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
const dayDiff = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS);

/** Three or more nights inside any seven consecutive days. */
export function hasThreeNightsInAWeek(days) {
  const sorted = [...new Set((days || []).filter(Boolean))].sort();
  for (let i = 0; i + 2 < sorted.length; i += 1) if (dayDiff(sorted[i + 2], sorted[i]) <= 6) return true;
  return false;
}

/** Tbilisi clock hour (0–23) a night started, from the hour the loader computed or the bed time. */
function bedHourOf(night) {
  if (Number.isInteger(night.bedHour) && night.bedHour >= 0 && night.bedHour <= 23) return night.bedHour;
  const parts = night.bedAt ? localParts(night.bedAt, 'Asia/Tbilisi') : null;
  return parts ? Math.floor(parts.minutes / 60) : null;
}

const hadSound = (n) => Boolean(n.hadSound) || (Array.isArray(n.sounds) && n.sounds.length > 0);
/** Times from sleep mode, or a sound played in sleep mode that night (Health or a hand edit may have set the times since). */
const fromSleepMode = (n) => n.timesSource === 'mode' || hadSound(n);
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/**
 * Pure: raw rows (all accounts) → the page payload. `raw` comes from loadSleepAdminRaw (or a test fixture).
 * @param {object} raw
 * @param {{ days?: number, includeTeam?: boolean, now?: Date }} opts
 */
export function buildSleepOverview(raw, { days = 30, includeTeam = false, now = new Date() } = {}) {
  const win = usageWindow(days, now);
  const { today, dayKeys, inPeriod } = win;
  const inWindow = (ymd) => Boolean(ymd) && ymd >= win.from && ymd <= today;

  const teamIds = new Set(raw.teamUserIds || []);
  const keep = (row) => includeTeam || !teamIds.has(row.userId);
  const allPlans = raw.plans || [];
  const allNights = (raw.nights || []).map((n) => ({ ...n, day: dayKey(n.night) })).filter((n) => n.day && n.userId);
  const allPlays = (raw.plays || []).filter((p) => p.userId);
  const plans = allPlans.filter(keep);
  const nights = allNights.filter(keep);
  const plays = allPlays.filter(keep);
  const users = new Map((raw.people || []).map((u) => [u.id, u]));

  // ── per person ───────────────────────────────────────────────────────────
  const people = new Map();
  const person = (userId) => {
    if (!people.has(userId)) people.set(userId, { userId, plan: null, nights: [], plays: [], days: new Set() });
    return people.get(userId);
  };
  /** Every action on its Tbilisi day: active people per day and „came back another week“. */
  const act = (p, at) => {
    const t = ms(at);
    if (!t) return;
    const day = tbilisiYmd(new Date(t));
    p.days.add(day);
  };
  for (const pl of plans) {
    const p = person(pl.userId);
    p.plan = pl;
    act(p, pl.createdAt);
    // A change more than a minute after creating counts as coming back to the plan.
    if (ms(pl.updatedAt) - ms(pl.createdAt) > 60_000) act(p, pl.updatedAt);
  }
  for (const n of nights) {
    const p = person(n.userId);
    p.nights.push(n);
    act(p, n.createdAt);
    if (n.checkedInAt) act(p, n.checkedInAt);
    if (ms(n.updatedAt) - ms(n.createdAt) > 60_000) act(p, n.updatedAt);
  }
  for (const pl of plays) {
    const p = person(pl.userId);
    p.plays.push(pl);
    act(p, pl.startedAt || pl.createdAt);
  }

  const shaped = [...people.values()].map((p) => {
    const sortedDays = [...p.days].sort();
    const nightDays = p.nights.map((n) => n.day);
    return {
      p,
      checkins: p.nights.filter((n) => n.checkedInAt).length,
      listenMinutes: p.plays.reduce((sum, pl) => sum + (Number(pl.minutes) || 0), 0),
      firstDay: sortedDays[0] || null,
      lastDay: sortedDays[sortedDays.length - 1] || null,
      periodDays: sortedDays.filter(inWindow).length,
      week3: hasThreeNightsInAWeek(nightDays),
      // Came back at least a week after the first day in MEDISLEEP.
      returned: sortedDays.length >= 2 && dayDiff(sortedDays[sortedDays.length - 1], sortedDays[0]) >= 7,
    };
  });
  const count = (fn) => shaped.filter(fn).length;
  const peopleCount = shaped.length;
  const ladder = [
    { key: 'plan', count: count((s) => Boolean(s.p.plan)) },
    { key: 'listened', count: count((s) => s.p.plays.length > 0) },
    { key: 'logged', count: count((s) => s.p.nights.length > 0) },
    { key: 'checkin', count: count((s) => s.checkins > 0) },
    { key: 'week3', count: count((s) => s.week3) },
    { key: 'returned', count: count((s) => s.returned) },
  ].map((step) => ({ ...step, rate: rateSafe(step.count, peopleCount) }));

  const accounts = Math.max(0, (raw.accountsTotal || 0) - (includeTeam ? 0 : teamIds.size));

  // ── period ────────────────────────────────────────────────────────────────
  const periodNights = nights.filter((n) => inWindow(n.day));
  const periodPlays = plays.filter((pl) => inPeriod(pl.startedAt || pl.createdAt));
  const bySource = Object.fromEntries(TIMES_SOURCES.map((k) => [k, 0]));
  for (const n of periodNights) bump(bySource, TIMES_SOURCES.includes(n.timesSource) ? n.timesSource : 'manual');
  const activeByDay = new Map(dayKeys.map((d) => [d, new Set()]));
  for (const s of shaped) for (const day of s.p.days) activeByDay.get(day)?.add(s.p.userId);
  const nightsByDay = new Map(dayKeys.map((d) => [d, 0]));
  for (const n of periodNights) if (nightsByDay.has(n.day)) nightsByDay.set(n.day, nightsByDay.get(n.day) + 1);
  const signups = (raw.signups || []).filter((u) => (includeTeam || !teamIds.has(u.id)) && inPeriod(u.createdAt));
  const signupsWithSleep = signups.filter((u) => people.has(u.id));

  // ── sounds (window): a play with several layers counts once for each sound, with its full minutes ─────────
  const catalogue = raw.sounds || [];
  const known = new Set(catalogue.map((s) => s.id));
  const stats = new Map();
  const stat = (id) => {
    if (!stats.has(id)) stats.set(id, { plays: 0, minutes: 0, listeners: new Set() });
    return stats.get(id);
  };
  const unknown = { plays: 0, minutes: 0, listeners: new Set() };
  for (const pl of periodPlays) {
    for (const id of new Set(pl.soundIds || [])) {
      const row = known.has(id) ? stat(id) : unknown;
      row.plays += 1;
      row.minutes += Number(pl.minutes) || 0;
      row.listeners.add(pl.userId);
    }
  }
  const soundRows = catalogue
    .map((s) => {
      const st = stats.get(s.id) || { plays: 0, minutes: 0, listeners: new Set() };
      return {
        id: s.id,
        title: s.titleKa || s.id,
        category: s.category,
        categoryLabel: SLEEP_CATEGORY_KA[s.category] || 'სხვა',
        status: s.status,
        statusLabel: SLEEP_STATUS_KA[s.status] || 'უცნობი',
        featured: Boolean(s.featured),
        hasAudio: Boolean(s.hasAudio ?? s.audioFileId),
        sortOrder: Number(s.sortOrder) || 0,
        plays: st.plays,
        minutes: st.minutes,
        listeners: st.listeners.size,
      };
    })
    .sort((a, b) => b.plays - a.plays || b.minutes - a.minutes || a.sortOrder - b.sortOrder);
  const library = { total: catalogue.length, live: 0, draft: 0, hidden: 0, noAudio: 0, byCategory: Object.fromEntries(SLEEP_CATEGORIES.map((c) => [c, 0])) };
  for (const s of soundRows) {
    if (s.status === 'LIVE') library.live += 1;
    else if (s.status === 'HIDDEN') library.hidden += 1;
    else library.draft += 1;
    if (!s.hasAudio) library.noAudio += 1;
    if (library.byCategory[s.category] != null) library.byCategory[s.category] += 1;
  }

  // ── aggregates behind k-anonymity: counted on real (non-team) people, whatever `includeTeam` says ─────────
  const realPeople = (rows) => new Set(rows.filter((r) => !teamIds.has(r.userId)).map((r) => r.userId)).size;

  const modeNights = periodNights.filter((n) => n.timesSource === 'mode' && bedHourOf(n) != null);
  const bedPeople = realPeople(modeNights);
  let bedtimes;
  if (bedPeople < SLEEP_K_MIN) {
    bedtimes = { hidden: true, people: bedPeople, min: SLEEP_K_MIN };
  } else {
    const hours = Array.from({ length: 24 }, () => 0);
    for (const n of modeNights) hours[bedHourOf(n)] += 1;
    bedtimes = { hidden: false, people: new Set(modeNights.map((n) => n.userId)).size, nights: modeNights.length, hours };
  }

  const picturePeople = realPeople(periodNights);
  let picture;
  if (picturePeople < SLEEP_K_MIN) {
    picture = { hidden: true, people: picturePeople, min: SLEEP_K_MIN };
  } else {
    const slept = periodNights.map((n) => sleptMinutes(n)).filter((v) => Number.isFinite(v) && v > 0);
    const ratings = periodNights.map((n) => Number(n.quality)).filter((q) => Number.isInteger(q) && q >= 1 && q <= 5);
    const checked = periodNights.filter((n) => n.checkedInAt);
    const factorCounts = {};
    for (const n of checked) for (const f of new Set(n.factors || [])) if (SLEEP_FACTORS[f]) bump(factorCounts, f);
    const avgSlept = mean(slept);
    const avgQuality = mean(ratings);
    picture = {
      hidden: false,
      people: new Set(periodNights.map((n) => n.userId)).size,
      nights: periodNights.length,
      sleptNights: slept.length,
      avgSleptMinutes: avgSlept == null ? null : Math.round(avgSlept),
      buckets: SLEPT_BUCKETS.map(([key, label, from, to]) => {
        const n = slept.filter((v) => v >= from && v < to).length;
        return { key, label, count: n, share: rateSafe(n, slept.length) };
      }),
      ratedNights: ratings.length,
      avgQuality: avgQuality == null ? null : Math.round(avgQuality * 10) / 10,
      checkins: checked.length,
      factors: Object.entries(factorCounts)
        .map(([id, n]) => ({ id, label: SLEEP_FACTORS[id][0], count: n, share: rateSafe(n, checked.length) }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    };
  }

  // ── reminders and alarm among plans ─────────────────────────────────────────
  const reminders = {
    plans: plans.length,
    bedtimeReminder: plans.filter((p) => p.bedtimeReminder).length,
    checkinReminder: plans.filter((p) => p.checkinReminder).length,
    alarm: plans.filter((p) => p.alarm).length,
    hideScore: plans.filter((p) => p.hideScore).length,
  };

  // ── people (counts only) ────────────────────────────────────────────────────
  const items = shaped
    .map((s) => ({
      id: s.p.userId,
      plan: Boolean(s.p.plan),
      nights: s.p.nights.length,
      checkins: s.checkins,
      plays: s.p.plays.length,
      listenMinutes: s.listenMinutes,
      activeDays: s.p.days.size,
      periodDays: s.periodDays,
      week3: s.week3,
      returned: s.returned,
      firstDay: s.firstDay,
      lastDay: s.lastDay,
      person: personSummary(users.get(s.p.userId) || { id: s.p.userId }, { teamIds }),
    }))
    .sort((a, b) => b.periodDays - a.periodDays || b.activeDays - a.activeDays
      || String(b.lastDay || '').localeCompare(String(a.lastDay || '')) || b.nights + b.plays - (a.nights + a.plays));

  const teamRows = [...allPlans, ...allNights, ...allPlays].filter((r) => teamIds.has(r.userId));
  const periodListeners = new Set(periodPlays.map((pl) => pl.userId));

  return {
    installed: true,
    generatedAt: now.toISOString(),
    includeTeam,
    team: {
      accounts: teamIds.size,
      people: new Set(teamRows.map((r) => r.userId)).size,
      nights: allNights.filter((n) => teamIds.has(n.userId)).length,
      plays: allPlays.filter((p) => teamIds.has(p.userId)).length,
    },
    flag: flagState(raw.flags, 'sleep'),
    kMin: SLEEP_K_MIN,
    totals: {
      accounts,
      people: peopleCount,
      peopleRate: rateSafe(peopleCount, accounts),
      plans: plans.length,
      nights: nights.length,
      checkins: nights.filter((n) => n.checkedInAt).length,
      nightPeople: count((s) => s.p.nights.length > 0),
      plays: plays.length,
      listenMinutes: plays.reduce((sum, pl) => sum + (Number(pl.minutes) || 0), 0),
      listeners: count((s) => s.p.plays.length > 0),
      onlySounds: count((s) => s.p.plays.length > 0 && !s.p.nights.length),
      onlyPlan: count((s) => s.p.plan && !s.p.plays.length && !s.p.nights.length),
    },
    ladder,
    period: {
      days: win.days,
      from: win.from,
      to: win.to,
      activePeople: new Set(shaped.filter((s) => s.periodDays > 0).map((s) => s.p.userId)).size,
      plans: { total: plans.length, new: plans.filter((p) => inPeriod(p.createdAt)).length },
      nights: { total: periodNights.length, ...bySource },
      nightPeople: new Set(periodNights.map((n) => n.userId)).size,
      checkins: periodNights.filter((n) => n.checkedInAt).length,
      modeNights: periodNights.filter(fromSleepMode).length,
      plays: periodPlays.length,
      listenMinutes: periodPlays.reduce((sum, pl) => sum + (Number(pl.minutes) || 0), 0),
      listeners: periodListeners.size,
      sleepModePlays: periodPlays.filter((pl) => pl.sleepMode).length,
      signups: signups.length,
      signupsWithSleep: signupsWithSleep.length,
      signupRate: rateSafe(signupsWithSleep.length, signups.length),
      trend: {
        nights: [...nightsByDay].map(([day, n]) => ({ day, count: n })),
        plays: daySeries(dayKeys, periodPlays, (pl) => pl.startedAt || pl.createdAt),
        active: [...activeByDay].map(([day, set]) => ({ day, count: set.size })),
      },
    },
    sounds: {
      rows: soundRows,
      unknown: { plays: unknown.plays, minutes: unknown.minutes, listeners: unknown.listeners.size },
      library,
    },
    bedtimes,
    picture,
    reminders,
    people: items.slice(0, SLEEP_PEOPLE_MAX),
    peopleTotal: items.length,
  };
}

/**
 * Every row the page needs, for all accounts (the builder drops team accounts). Read-only. Raw SQL on the Sleep*
 * tables (they are raw-SQL installed, so a missing table answers „not installed“ instead of a broken page).
 * The bed time never leaves the database: only its Tbilisi hour, and only for sleep-mode nights.
 */
export async function loadSleepAdminRaw(db = prisma, { now = new Date() } = {}) {
  const since = tbilisiMidnight(addDaysYmd(tbilisiYmd(now), -(Math.max(...USAGE_PERIODS) - 1)));
  const [teamUserIds, accountsTotal, plans, nights, plays, sounds, signups, flags] = await Promise.all([
    loadTeamUserIds(db),
    db.user.count(),
    db.$queryRaw`SELECT "userId", "bedtimeReminder", "checkinReminder", "alarm", "hideScore", "createdAt", "updatedAt" FROM "SleepPlan"`,
    db.$queryRaw`SELECT "userId", "night", "timesSource", "checkedInAt", "createdAt", "updatedAt",
        "inBedMinutes", "asleepMinutes", "latencyMinutes", "quality", "factors",
        COALESCE(cardinality("sounds"), 0) > 0 AS "hadSound",
        CASE WHEN "timesSource" = 'mode' AND "bedAt" IS NOT NULL
          THEN EXTRACT(HOUR FROM ("bedAt" AT TIME ZONE 'Asia/Tbilisi'))::int END AS "bedHour"
      FROM "SleepNight"`,
    db.$queryRaw`SELECT "userId", "soundIds", "startedAt", "minutes", "sleepMode", "createdAt" FROM "SleepPlay"`,
    db.$queryRaw`SELECT "id", "category", "titleKa", "status", "featured", "sortOrder", "audioFileId" IS NOT NULL AS "hasAudio"
      FROM "SleepSound" ORDER BY "sortOrder" ASC, "createdAt" ASC`,
    db.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true } }),
    listFeatureFlags(db).catch(() => []),
  ]);
  const ids = [...new Set([...plans, ...nights, ...plays].map((r) => r.userId))];
  const { people } = await loadPeople(ids, db);
  return { teamUserIds, accountsTotal, plans, nights, plays, sounds, signups, people, flags };
}

export async function loadSleepOverview({ days = 30, includeTeam = false, db = prisma, now = new Date() } = {}) {
  try {
    const raw = await loadSleepAdminRaw(db, { now });
    return buildSleepOverview(raw, { days, includeTeam, now });
  } catch (error) {
    if (missingTable(error)) return { installed: false, generatedAt: now.toISOString() };
    throw error;
  }
}
