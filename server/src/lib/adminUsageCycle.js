/**
 * Admin #/cycle „ვინ იყენებს და როგორ“ (MEDICYCLE) — cycle tracking, trying to conceive, pregnancy, perimenopause,
 * postpartum.
 *
 * Who counts. Every woman gets a CycleProfile automatically: the app loads the cycle view on sign-in to plan the
 * cycle reminders (`reconcileCycleReminders`), and that GET creates the profile. A profile is therefore NOT use. A
 * MEDICYCLE user is a woman who wrote at least one day in the calendar (a CycleLog or PregnancyLog row; a day that
 * holds only temperature imported from Health does not count). Activity on a day = writing a day (or editing it
 * later), Medi's cycle tips (AiInteraction CYCLE_WELLNESS — made when she opens the cycle page with AI on, at most
 * once per 18 h), starting / ending a pregnancy or postpartum episode, a partner link, a custom tag. Reminders are
 * local and on by default, so the server only knows who changed their settings.
 *
 * Privacy — stricter than the other usage pages (owner 2026-10-11: „nobody can tell whose period started when“):
 * the payload carries NO user ids, names, contacts or e-mails and no cycle / period / ovulation / pregnancy / due
 * dates, flows, symptoms, sex, BBT, test results or any other logged value. The wall is anonymous: a running
 * number, the mode, usage-length and last-activity BUCKETS and usage counts, ordered by those (never by a timestamp
 * or an id). Everything else is counts over everyone. The loader reduces health columns to „which kind of field a
 * day has“ before the builder sees them; bleeding days and hidden cycles are used only to count completed cycles
 * for the 3-cycle forecast gate. The anonymous funnel events (cycle_log_saved / cycle_period_started /
 * cycle_explain_opened) carry no user at all, so they are counted by source and day and cannot leave out the team.
 */
import { prisma } from './prisma.js';
import { addDaysYmd, createdAtToTbilisiYmd, rateSafe, tbilisiMidnight, tbilisiYmd } from './adminAnalyticsRange.js';
import { activityTracker, bump, daySeries, flagState, loadTeamUserIds, median, missingTable, ms, percentile, usageWindow, USAGE_PERIODS, zeroes } from './adminUsageKit.js';
import { inferCycleStats } from './cycle.js';
import { onlyImportedTemperature } from './cycleTemperature.js';
import { CYCLE_EXPLAIN_TOPICS, CYCLE_LOG_SOURCES, CYCLE_PERIOD_START_SOURCES } from './funnel.js';
import { listFeatureFlags } from './featureFlags.js';

/** The wall lists at most this many people; every count still covers all of them. */
export const CYCLE_USAGE_LIST_MAX = 400;
export const CYCLE_MODES = Object.freeze(['TRACK_PERIOD', 'TRY_TO_CONCEIVE', 'PREGNANCY', 'PERIMENOPAUSE', 'POSTPARTUM']);
/** What kind of field a logged day holds (never the value). `flow` = bleeding or spotting. */
export const CYCLE_LOG_PARTS = Object.freeze(['flow', 'symptoms', 'mood', 'sex', 'lifestyle', 'signs', 'notes', 'tags', 'other', 'pregnancy']);
/** Usage-length / last-activity buckets (Tbilisi days back from today). */
export const SINCE_BUCKETS = Object.freeze(['week', 'twoWeeks', 'month', 'quarter', 'older']);
export const LAST_BUCKETS = Object.freeze(['week', 'month', 'earlier', 'never']);
const ANON_EVENTS = Object.freeze({
  cycle_log_saved: ['logSources', CYCLE_LOG_SOURCES],
  cycle_period_started: ['periodStarts', CYCLE_PERIOD_START_SOURCES],
  cycle_explain_opened: ['explain', CYCLE_EXPLAIN_TOPICS],
});
const REMINDER_KEYS = ['ovulation', 'dailyLog', 'pms', 'opk', 'bbt'];
const OBS_NOT_DETAIL = new Set(['bbtSource', 'wristTempDelta', 'ovulationMarked']);
const isPeriodFlow = (flow) => flow === 'light' || flow === 'medium' || flow === 'heavy';
const nonEmpty = (v) => Array.isArray(v) && v.length > 0;

/** Pure: which kinds of field one CycleLog row holds. Imported temperature is not something she logged. */
export function logParts(row, { hasNote = false } = {}) {
  const obs = row?.observations && typeof row.observations === 'object' && !Array.isArray(row.observations) ? row.observations : {};
  const parts = [];
  if (row.flow && row.flow !== 'none') parts.push('flow');
  if (nonEmpty(row.symptoms) || nonEmpty(row.painEntries)) parts.push('symptoms');
  if (nonEmpty(row.moods)) parts.push('mood');
  if (row.sexualActivity != null || row.libido != null) parts.push('sex');
  if (row.sleepQuality || row.stressLevel || row.exerciseLevel || row.caffeine || row.alcohol) parts.push('lifestyle');
  const typedBbt = row.bbt != null && obs.bbtSource !== 'health';
  if (typedBbt || row.cervicalMucus || row.ovulationTest || row.pregnancyTest || obs.ovulationMarked) parts.push('signs');
  if (hasNote) parts.push('notes');
  if (nonEmpty(row.customTagIds)) parts.push('tags');
  if (Object.keys(obs).some((k) => !OBS_NOT_DETAIL.has(k) && obs[k] != null && obs[k] !== false && !(Array.isArray(obs[k]) && !obs[k].length))) parts.push('other');
  return parts;
}

/** Bucket of a Tbilisi day relative to today: this week, two weeks, a month, three months, older. */
function sinceBucket(ymd, today) {
  if (!ymd) return null;
  if (ymd >= addDaysYmd(today, -6)) return 'week';
  if (ymd >= addDaysYmd(today, -13)) return 'twoWeeks';
  if (ymd >= addDaysYmd(today, -29)) return 'month';
  if (ymd >= addDaysYmd(today, -89)) return 'quarter';
  return 'older';
}

function lastBucket(ymd, today) {
  if (!ymd) return 'never';
  if (ymd >= addDaysYmd(today, -6)) return 'week';
  if (ymd >= addDaysYmd(today, -29)) return 'month';
  return 'earlier';
}

/** Logged-days band per person: 1 / 2–3 / 4–9 / 10+. */
export const depthBand = (n) => (n >= 10 ? 'many' : n >= 4 ? 'several' : n >= 2 ? 'few' : n === 1 ? 'one' : 'none');

/**
 * Pure: raw rows (all accounts) → the page payload. `raw` comes from loadCycleUsageRaw (or a test fixture).
 * @param {object} raw
 * @param {{ days?: number, includeTeam?: boolean, now?: Date }} opts
 */
export function buildCycleUsage(raw, { days = 30, includeTeam = false, now = new Date() } = {}) {
  const win = usageWindow(days, now);
  const { inPeriod, dayKeys, today } = win;
  const teamIds = new Set(raw.teamUserIds || []);
  const keepId = (id) => includeTeam || !teamIds.has(id);
  const keep = (row) => keepId(row.userId);

  const profiles = (raw.profiles || []).filter(keep);
  const allLogs = (raw.logs || []).filter(keep);
  const logs = allLogs.filter((l) => !l.imported);
  const imported = allLogs.filter((l) => l.imported);
  const pregnancyLogs = (raw.pregnancyLogs || []).filter(keep);
  const tips = (raw.tips || []).filter(keep);
  const feedback = (raw.tipFeedback || []).filter(keep);
  const pregnancies = (raw.pregnancies || []).filter(keep);
  const postpartums = (raw.postpartums || []).filter(keep);
  const shares = (raw.shares || []).filter((s) => keepId(s.ownerUserId));
  const tags = (raw.tags || []).filter(keep);
  const women = (raw.women || []).filter((u) => keepId(u.id));
  const goalCycle = new Set((raw.goalCycleUserIds || []).filter(keepId));
  const tracking = new Map((raw.trackingPrefs || []).filter(keep).map((r) => [r.userId, r]));

  // ── per person (internal only: the id never leaves this function) ─────────
  const people = new Map();
  const person = (userId) => {
    if (!people.has(userId)) {
      people.set(userId, { userId, profile: null, dates: new Set(), detailDates: new Set(), periodLogged: false, tips: 0, firstDay: null, firstLogAt: 0, cycleLogs: [] });
    }
    return people.get(userId);
  };
  const tracker = activityTracker();
  const act = (userId, at) => {
    if (!userId || !at) return;
    tracker.act(userId, at);
    const day = createdAtToTbilisiYmd(at);
    const p = person(userId);
    if (day && (!p.firstDay || day < p.firstDay)) p.firstDay = day;
  };
  const edited = (row) => ms(row.updatedAt) - ms(row.createdAt) > 60_000;
  for (const pr of profiles) person(pr.userId).profile = pr;
  const partPeople = Object.fromEntries(CYCLE_LOG_PARTS.map((k) => [k, new Set()]));
  const partDays = zeroes(CYCLE_LOG_PARTS);
  for (const l of logs) {
    const p = person(l.userId);
    p.dates.add(l.date);
    const parts = l.parts || [];
    if (parts.some((k) => k !== 'flow')) p.detailDates.add(l.date);
    for (const k of parts) {
      if (!partPeople[k]) continue;
      partPeople[k].add(l.userId);
      partDays[k] += 1;
    }
    if (isPeriodFlow(l.flow)) p.periodLogged = true;
    if (!l.postpartum) p.cycleLogs.push({ date: l.date, flow: l.flow });
    if (!p.firstLogAt || ms(l.createdAt) < p.firstLogAt) p.firstLogAt = ms(l.createdAt);
    act(l.userId, l.createdAt);
    if (edited(l)) act(l.userId, l.updatedAt);
  }
  for (const l of pregnancyLogs) {
    const p = person(l.userId);
    p.dates.add(l.date);
    p.detailDates.add(l.date);
    partPeople.pregnancy.add(l.userId);
    partDays.pregnancy += 1;
    if (!p.firstLogAt || ms(l.createdAt) < p.firstLogAt) p.firstLogAt = ms(l.createdAt);
    act(l.userId, l.createdAt);
    if (edited(l)) act(l.userId, l.updatedAt);
  }
  for (const t of tips) {
    if (t.status === 'OK') person(t.userId).tips += 1;
    act(t.userId, t.createdAt);
  }
  for (const e of [...pregnancies, ...postpartums]) {
    act(e.userId, e.startedAt);
    act(e.userId, e.endedAt);
  }
  for (const s of shares) act(s.ownerUserId, s.createdAt);
  for (const t of tags) act(t.userId, t.createdAt);

  const list = [...people.values()];
  const count = (fn) => list.filter(fn).length;
  const started = (p) => Boolean(p.profile?.hasLastPeriod) || p.periodLogged;
  const logged = (p) => p.dates.size > 0;
  const profileCount = profiles.length;
  const loggers = list.filter(logged);

  const ladder = [
    { key: 'profile', count: profileCount },
    { key: 'started', count: count(started) },
    { key: 'logged', count: loggers.length },
    { key: 'details', count: count((p) => p.detailDates.size > 0) },
    { key: 'multiDay', count: count((p) => p.dates.size >= 2) },
    { key: 'returned', count: count((p) => tracker.days(p.userId) >= 2) },
  ].map((step) => ({ ...step, rate: rateSafe(step.count, profileCount) }));

  const accounts = Math.max(0, (raw.accountsTotal || 0) - (includeTeam ? 0 : teamIds.size));
  const onlyProfile = list.filter((p) => p.profile && !logged(p)).length;
  const goalLogged = [...goalCycle].filter((id) => people.get(id) && logged(people.get(id))).length;

  // ── the anonymous wall ───────────────────────────────────────────────────
  const modeOf = (p) => (CYCLE_MODES.includes(p.profile?.mode) ? p.profile.mode : 'TRACK_PERIOD');
  const cards = list.map((p) => {
    const first = p.firstDay;
    const since = first
      ? { kind: 'use', bucket: sinceBucket(first, today) }
      : { kind: 'profile', bucket: sinceBucket(createdAtToTbilisiYmd(p.profile?.createdAt), today) || 'week' };
    return {
      mode: modeOf(p),
      team: teamIds.has(p.userId),
      since,
      last: lastBucket(tracker.lastDay(p.userId), today),
      started: started(p),
      days: p.dates.size,
      detailDays: p.detailDates.size,
      tips: p.tips,
      activeDays: tracker.days(p.userId),
    };
  });
  // Order by what the card shows only (never a timestamp or an id), so equal keys are equal cards.
  const rank = (arr, v) => arr.indexOf(v);
  cards.sort((a, b) => rank(LAST_BUCKETS, a.last) - rank(LAST_BUCKETS, b.last)
    || b.days - a.days
    || b.activeDays - a.activeDays
    || b.detailDays - a.detailDays
    || b.tips - a.tips
    || Number(b.started) - Number(a.started)
    || rank(CYCLE_MODES, a.mode) - rank(CYCLE_MODES, b.mode)
    || (a.since.kind === b.since.kind ? 0 : a.since.kind === 'use' ? -1 : 1)
    || rank(SINCE_BUCKETS, a.since.bucket) - rank(SINCE_BUCKETS, b.since.bucket)
    || Number(a.team) - Number(b.team));
  const items = cards.slice(0, CYCLE_USAGE_LIST_MAX).map((c, i) => ({ mark: `#${i + 1}`, ...c }));

  // ── period ────────────────────────────────────────────────────────────────
  const periodLogs = [...logs, ...pregnancyLogs].filter((l) => inPeriod(l.createdAt));
  const periodTips = tips.filter((t) => inPeriod(t.createdAt));
  const signups = women.filter((u) => inPeriod(u.createdAt));
  const signupsLogged = signups.filter((u) => people.get(u.id) && logged(people.get(u.id)));
  const events = { logSources: {}, periodStarts: {}, explain: {} };
  const eventTotals = { logSources: 0, periodStarts: 0, explain: 0 };
  for (const e of raw.events || []) {
    const spec = ANON_EVENTS[e.name];
    if (!spec || !e.day || e.day < win.from || e.day > win.to) continue;
    const [bucket, allowed] = spec;
    bump(events[bucket], allowed.includes(e.value) ? e.value : 'other');
    eventTotals[bucket] += 1;
  }

  // ── what they log ────────────────────────────────────────────────────────
  const perPerson = { one: 0, few: 0, several: 0, many: 0 };
  for (const p of loggers) bump(perPerson, depthBand(p.dates.size));

  // ── profile, modes, forecast readiness ───────────────────────────────────
  const modes = zeroes(CYCLE_MODES);
  const forecast = { none: 0, first: 0, learning: 0, ready: 0 };
  let lastPeriod = 0;
  let irregular = 0;
  let customLengths = 0;
  let conditions = 0;
  const contraception = { answered: 0, none: 0, method: 0 };
  const reminders = { saved: 0, off: 0, ...zeroes(REMINDER_KEYS) };
  let privacyLock = 0;
  for (const p of list) {
    const pr = p.profile;
    if (!pr) continue;
    bump(modes, modeOf(p));
    if (pr.hasLastPeriod) lastPeriod += 1;
    if (pr.isIrregular) irregular += 1;
    if (pr.customLengths) customLengths += 1;
    if (pr.hasConditions) conditions += 1;
    if (pr.contraception) {
      contraception.answered += 1;
      bump(contraception, pr.contraception === 'NONE' ? 'none' : 'method');
    }
    if (pr.privacyEnabled) privacyLock += 1;
    if (pr.reminders) {
      reminders.saved += 1;
      if (pr.reminders.enabled === false) reminders.off += 1;
      for (const k of REMINDER_KEYS) if (pr.reminders[k] === true) reminders[k] += 1;
    }
    const hidden = tracking.get(p.userId)?.hiddenStarts || [];
    const stats = inferCycleStats(p.cycleLogs, 28, 5, { hiddenStarts: hidden });
    if (!stats.periodStarts.length) forecast.none += 1;
    else if (stats.cycleCount >= 3) forecast.ready += 1;
    else if (stats.cycleCount >= 1) forecast.learning += 1;
    else forecast.first += 1;
  }
  const trackRows = [...tracking.values()];
  const shareOwners = new Set(shares.map((s) => s.ownerUserId));
  const activeShares = shares.filter((s) => !s.revokedAt && ms(s.expiresAt) > now.getTime());
  const episodes = (rows) => ({ total: rows.length, people: new Set(rows.map((r) => r.userId)).size, active: rows.filter((r) => r.status === 'ACTIVE').length });

  // ── Medi's cycle tips ────────────────────────────────────────────────────
  const ok = tips.filter((t) => t.status === 'OK');
  const latencies = ok.map((t) => Number(t.latencyMs)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  let costUsd = 0;
  for (const t of tips) {
    const c = Number(t.cost);
    if (Number.isFinite(c)) costUsd += c;
  }

  const teamLogs = (raw.logs || []).filter((l) => teamIds.has(l.userId) && !l.imported);
  return {
    installed: true,
    generatedAt: now.toISOString(),
    includeTeam,
    team: {
      accounts: teamIds.size,
      profiles: (raw.profiles || []).filter((p) => teamIds.has(p.userId)).length,
      loggers: new Set(teamLogs.map((l) => l.userId)).size,
      logs: teamLogs.length + (raw.pregnancyLogs || []).filter((l) => teamIds.has(l.userId)).length,
    },
    flags: { cycle: flagState(raw.flags, 'cycle') },
    totals: {
      accounts,
      women: women.length,
      profiles: profileCount,
      profileRate: rateSafe(profileCount, women.length),
      started: ladder[1].count,
      startedOnly: count((p) => started(p) && !logged(p)),
      loggers: loggers.length,
      loggerRate: rateSafe(loggers.length, profileCount),
      onlyProfile,
      logs: logs.length + pregnancyLogs.length,
      logDays: loggers.reduce((sum, p) => sum + p.dates.size, 0),
      medianDays: median(loggers.map((p) => p.dates.size)),
      returned: ladder[5].count,
      activeWeek: tracker.activeIn(addDaysYmd(today, -6), today),
      goalCycle: goalCycle.size,
      goalCycleLogged: goalLogged,
    },
    ladder,
    period: {
      days: win.days,
      from: win.from,
      to: win.to,
      active: tracker.activeIn(win.from, win.to),
      logs: periodLogs.length,
      loggers: new Set(periodLogs.map((l) => l.userId)).size,
      newLoggers: loggers.filter((p) => inPeriod(p.firstLogAt)).length,
      tips: periodTips.length,
      tipUsers: new Set(periodTips.map((t) => t.userId)).size,
      signups: signups.length,
      signupsLogged: signupsLogged.length,
      signupRate: rateSafe(signupsLogged.length, signups.length),
      events,
      eventTotals,
      trend: {
        logs: daySeries(dayKeys, [...logs, ...pregnancyLogs]),
        active: tracker.activeByDay(dayKeys),
        tips: daySeries(dayKeys, tips),
      },
    },
    logging: {
      perPerson,
      detailPeople: count((p) => p.detailDates.size > 0),
      parts: CYCLE_LOG_PARTS.map((key) => ({ key, people: partPeople[key].size, days: partDays[key] })),
    },
    profile: {
      modes,
      lastPeriod,
      irregular,
      customLengths,
      conditions,
      contraception,
      pregnancy: episodes(pregnancies),
      postpartum: episodes(postpartums),
      forecast,
    },
    medi: {
      tips: tips.length,
      ok: ok.length,
      errors: tips.filter((t) => t.status !== 'OK').length,
      users: new Set(ok.map((t) => t.userId)).size,
      perUser: ok.length ? Math.round((ok.length / new Set(ok.map((t) => t.userId)).size) * 10) / 10 : null,
      avgMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
      p95Ms: percentile(latencies, 95),
      costUsd: Math.round(costUsd * 10000) / 10000,
      feedback: { up: feedback.filter((f) => f.rating > 0).length, down: feedback.filter((f) => f.rating < 0).length },
    },
    settings: {
      reminders,
      privacyLock,
      share: { owners: shareOwners.size, active: activeShares.length, accepted: shares.filter((s) => s.partnerUserId).length },
      hiddenCycles: trackRows.filter((r) => r.hiddenStarts?.length).length,
      noBleeding: trackRows.filter((r) => r.expectsBleeding === false).length,
      fertilityOff: trackRows.filter((r) => r.fertilityDisplay === 'off').length,
      tags: new Set(tags.filter((t) => !t.archivedAt).map((t) => t.userId)).size,
      temperatureImport: new Set(imported.map((l) => l.userId)).size,
    },
    items,
    itemsTotal: cards.length,
  };
}

/**
 * Every row the page needs, for all accounts (the builder drops team accounts). Read-only. Health columns are
 * reduced here to „which kind of field“ booleans; only bleeding days (for counting completed cycles) stay.
 */
export async function loadCycleUsageRaw(db = prisma, { now = new Date() } = {}) {
  const since = tbilisiMidnight(addDaysYmd(tbilisiYmd(now), -(Math.max(...USAGE_PERIODS) - 1)));
  const [teamUserIds, accountsTotal, women, profiles, logs, noted, pregnancyLogs, tips, tipFeedback, pregnancies, postpartums, shares, tags, events, onboarding, trackingPrefs, flags] = await Promise.all([
    loadTeamUserIds(db),
    db.user.count(),
    db.user.findMany({ where: { gender: 'FEMALE' }, select: { id: true, createdAt: true } }),
    db.cycleProfile.findMany({
      select: {
        userId: true, mode: true, lastPeriodStart: true, isIrregular: true, avgCycleLength: true, avgPeriodLength: true,
        privacyEnabled: true, conditions: true, reminderPrefs: true, contraceptionMethod: true, createdAt: true,
      },
    }),
    db.cycleLog.findMany({
      select: {
        userId: true, date: true, flow: true, symptoms: true, moods: true, painEntries: true, sexualActivity: true, libido: true,
        bbt: true, cervicalMucus: true, ovulationTest: true, pregnancyTest: true, sleepQuality: true, stressLevel: true,
        exerciseLevel: true, caffeine: true, alcohol: true, customTagIds: true, observations: true, trackingContext: true,
        createdAt: true, updatedAt: true,
      },
    }),
    // Notes: only which days have one — the text is never read.
    db.cycleLog.findMany({ where: { AND: [{ notes: { not: null } }, { notes: { not: '' } }] }, select: { userId: true, date: true } }),
    db.pregnancyLog.findMany({ select: { userId: true, date: true, createdAt: true, updatedAt: true } }),
    db.aiInteraction.findMany({ where: { mode: 'CYCLE_WELLNESS' }, select: { userId: true, status: true, latencyMs: true, tokenUsage: true, createdAt: true } }),
    db.aiFeedback.findMany({ where: { interaction: { mode: 'CYCLE_WELLNESS' } }, select: { userId: true, rating: true } }),
    db.cyclePregnancyEpisode.findMany({ select: { userId: true, status: true, startedAt: true, endedAt: true } }),
    db.cyclePostpartumEpisode.findMany({ select: { userId: true, status: true, startedAt: true, endedAt: true } }),
    db.cyclePartnerShare.findMany({ select: { ownerUserId: true, partnerUserId: true, createdAt: true, expiresAt: true, revokedAt: true } }),
    db.cycleCustomTag.findMany({ select: { userId: true, createdAt: true, archivedAt: true } }),
    db.funnelEvent.findMany({ where: { name: { in: Object.keys(ANON_EVENTS) }, createdAt: { gte: since } }, select: { name: true, props: true, createdAt: true } }),
    db.funnelEvent.findMany({ where: { name: 'onboarding_completed', userId: { not: null } }, select: { userId: true, props: true } }),
    // Raw-SQL columns (cycleTrackingPrefs.js / cycleHiddenCycles.js); a database without them just has none.
    db.$queryRaw`SELECT "userId", "expectsBleeding", "fertilityDisplay", "hiddenCycles" FROM "CycleProfile"`.catch(() => []),
    listFeatureFlags(db).catch(() => []),
  ]);
  const notedDays = new Set(noted.map((n) => `${n.userId}|${n.date}`));
  return {
    teamUserIds,
    accountsTotal,
    women,
    profiles: profiles.map((p) => ({
      userId: p.userId,
      mode: p.mode,
      createdAt: p.createdAt,
      hasLastPeriod: Boolean(p.lastPeriodStart),
      isIrregular: Boolean(p.isIrregular),
      customLengths: p.avgCycleLength !== 28 || p.avgPeriodLength !== 5,
      privacyEnabled: Boolean(p.privacyEnabled),
      hasConditions: Array.isArray(p.conditions) && p.conditions.length > 0,
      contraception: p.contraceptionMethod ? (p.contraceptionMethod === 'NONE' ? 'NONE' : 'METHOD') : null,
      reminders: p.reminderPrefs && typeof p.reminderPrefs === 'object'
        ? Object.fromEntries(['enabled', ...REMINDER_KEYS].filter((k) => typeof p.reminderPrefs[k] === 'boolean').map((k) => [k, p.reminderPrefs[k]]))
        : null,
    })),
    logs: logs.map((l) => {
      const hasNote = notedDays.has(`${l.userId}|${l.date}`);
      return {
        userId: l.userId,
        date: l.date,
        flow: l.flow,
        postpartum: l.trackingContext === 'POSTPARTUM',
        imported: onlyImportedTemperature({ ...l, notes: hasNote ? '·' : null }),
        parts: logParts(l, { hasNote }),
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      };
    }),
    pregnancyLogs,
    tips: tips.map((t) => ({ userId: t.userId, status: t.status, latencyMs: t.latencyMs, cost: t.tokenUsage?.cost ?? null, createdAt: t.createdAt })),
    tipFeedback,
    pregnancies,
    postpartums,
    shares,
    tags,
    events: events.map((e) => ({ name: e.name, value: String(Object.values(e.props || {})[0] ?? ''), day: createdAtToTbilisiYmd(e.createdAt) })),
    goalCycleUserIds: [...new Set(onboarding.filter((e) => e.props?.primaryGoal === 'cycle').map((e) => e.userId))],
    trackingPrefs: (Array.isArray(trackingPrefs) ? trackingPrefs : []).map((r) => ({
      userId: r.userId,
      expectsBleeding: r.expectsBleeding,
      fertilityDisplay: r.fertilityDisplay,
      hiddenStarts: Array.isArray(r.hiddenCycles) ? r.hiddenCycles.map(String) : [],
    })),
    flags,
  };
}

export async function loadCycleUsage({ days = 30, includeTeam = false, db = prisma, now = new Date() } = {}) {
  try {
    const raw = await loadCycleUsageRaw(db, { now });
    return buildCycleUsage(raw, { days, includeTeam, now });
  } catch (error) {
    if (missingTable(error)) return { installed: false, generatedAt: now.toISOString() };
    throw error;
  }
}
