// MEDISLEEP analytics (2026-10-12). Pure: nights + plan (+ steps) in, numbers out. The app, the web page,
// Medi and the admin page all read these, so the rules live in one place.
//
// What we measure and why (research brief 2026-10-12):
// - Duration against her own goal (NSF/AASM 7–9 h), regularity of the sleep midpoint (the strongest predictor in
//   UK Biobank, Windred 2024) and how rested she felt — the same 50/30/20 split Apple's score uses, but with her
//   own morning rating instead of phone-guessed stages. No score anxiety: the score can be hidden (plan.hideScore).
// - Sleep debt over the last 7 logged nights, social jetlag (weekend vs weekday midpoint), personal factor effects
//   only with ≥3 nights on each side, steps the day before.
import { clockMinutes, localParts, plannedBedtime, sleptMinutes } from './sleep.js';

const DAY_MS = 86_400_000;
const NOON = 12 * 60;

/** Clock minutes re-based on noon, so 23:30 (690) and 00:30 (750) sit next to each other. */
export function fromNoon(minutesOfDay) {
  return (((minutesOfDay - NOON) % 1440) + 1440) % 1440;
}
export function toClock(minutesFromNoon) {
  return Math.round((((minutesFromNoon + NOON) % 1440) + 1440) % 1440);
}

function mean(values) {
  const v = values.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
function sd(values) {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return null;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const round = (x) => (x == null ? null : Math.round(x));

function weekdayOfNight(night) {
  return new Date(`${night}T12:00:00Z`).getUTCDay();
}
/** Free nights end on Saturday or Sunday morning. */
function isFreeNight(night) {
  const d = weekdayOfNight(night);
  return d === 0 || d === 6;
}

/** Per-night facts in her time zone: slept minutes, bedtime/wake/midpoint as minutes from noon. */
export function nightFacts(nights, timeZone) {
  return nights
    .map((n) => {
      const slept = sleptMinutes(n);
      const bed = n.bedAt ? localParts(n.bedAt, timeZone) : null;
      const wake = n.wakeAt ? localParts(n.wakeAt, timeZone) : null;
      const bedRel = bed ? fromNoon(bed.minutes) : null;
      let wakeRel = wake ? fromNoon(wake.minutes) : null;
      if (bedRel != null && wakeRel != null && wakeRel < bedRel) wakeRel += 1440;
      const mid = bedRel != null && wakeRel != null ? (bedRel + wakeRel) / 2 : null;
      return {
        night: typeof n.night === 'string' ? n.night : new Date(n.night).toISOString().slice(0, 10),
        slept, bed: bedRel, wake: wakeRel, mid,
        quality: Number.isFinite(n.quality) ? n.quality : null,
        wakeups: Number.isFinite(n.wakeups) ? n.wakeups : null,
        latency: Number.isFinite(n.latencyMinutes) ? n.latencyMinutes : null,
        factors: n.factors || [],
        checkedIn: !!(n.checkedInAt || n.checkedIn),
      };
    })
    .filter((f) => f.slept != null || f.quality != null)
    .sort((a, b) => a.night.localeCompare(b.night));
}

function planMidpoint(plan, free) {
  if (!plan) return null;
  const bed = plannedBedtime(plan, { weekend: free });
  const wake = clockMinutes(free && plan.weekendWakeTime ? plan.weekendWakeTime : plan.wakeTime);
  if (bed == null || wake == null) return null;
  const b = fromNoon(bed);
  let w = fromNoon(wake);
  if (w < b) w += 1440;
  return (b + w) / 2;
}

/**
 * One night's score 0–100: duration 50, regularity 30, how rested 20. Missing parts drop out and the rest is
 * re-weighted, so a night without a check-in is not punished. Regularity = how far the midpoint sits from her
 * usual one (median of up to 7 earlier nights; the plan's midpoint while there is no history).
 */
export function nightScore(fact, history, plan) {
  const goal = plan?.goalMinutes || 480;
  const parts = [];
  if (fact.slept != null) parts.push([50, clamp01((fact.slept - goal * 0.5) / (goal * 0.5))]);
  let ref = null;
  const earlier = history.filter((h) => h.mid != null && h.night < fact.night).slice(-7);
  if (earlier.length >= 2) ref = median(earlier.map((h) => h.mid));
  else ref = planMidpoint(plan, isFreeNight(fact.night));
  if (fact.mid != null && ref != null) {
    const dev = Math.abs(fact.mid - ref);
    parts.push([30, clamp01(1 - (dev - 15) / 105)]);
  }
  if (fact.quality != null) parts.push([20, (fact.quality - 1) / 4]);
  if (!parts.length) return null;
  const weight = parts.reduce((a, [w]) => a + w, 0);
  return Math.round((parts.reduce((a, [w, s]) => a + w * s, 0) / weight) * 100);
}

export function scoreBand(score) {
  if (score == null) return null;
  if (score >= 85) return 'great';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'low';
}

/** Regularity words for a midpoint spread in minutes (sample SD). */
export function regularityBand(spread) {
  if (spread == null) return null;
  if (spread <= 30) return 'steady';
  if (spread <= 60) return 'regular';
  if (spread <= 90) return 'variable';
  return 'irregular';
}

function factorEffects(facts) {
  const checked = facts.filter((f) => f.checkedIn && f.slept != null);
  const ids = [...new Set(checked.flatMap((f) => f.factors))];
  const effects = [];
  for (const id of ids) {
    const withIt = checked.filter((f) => f.factors.includes(id));
    const without = checked.filter((f) => !f.factors.includes(id));
    if (withIt.length < 3 || without.length < 3) continue;
    const sleptDiff = mean(withIt.map((f) => f.slept)) - mean(without.map((f) => f.slept));
    const qw = mean(withIt.map((f) => f.quality));
    const qo = mean(without.map((f) => f.quality));
    const qualityDiff = qw != null && qo != null ? qw - qo : null;
    if (Math.abs(sleptDiff) < 15 && (qualityDiff == null || Math.abs(qualityDiff) < 0.5)) continue;
    effects.push({ factor: id, nightsWith: withIt.length, nightsWithout: without.length, sleptDiff: round(sleptDiff), qualityDiff: qualityDiff == null ? null : Math.round(qualityDiff * 10) / 10 });
  }
  return effects.sort((a, b) => Math.abs(b.sleptDiff) + Math.abs(b.qualityDiff || 0) * 30 - (Math.abs(a.sleptDiff) + Math.abs(a.qualityDiff || 0) * 30));
}

/** Nights after an active day (steps ≥ her median) vs a quiet one; needs 4 nights on each side. */
function stepsEffect(facts, stepsByDay) {
  if (!stepsByDay) return null;
  const rows = facts
    .map((f) => {
      const day = new Date(Date.parse(`${f.night}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
      const steps = stepsByDay[day];
      return Number.isFinite(steps) && steps > 0 && f.slept != null ? { ...f, steps } : null;
    })
    .filter(Boolean);
  if (rows.length < 8) return null;
  const cut = median(rows.map((r) => r.steps));
  const active = rows.filter((r) => r.steps >= cut);
  const quiet = rows.filter((r) => r.steps < cut);
  if (active.length < 4 || quiet.length < 4) return null;
  const sleptDiff = mean(active.map((r) => r.slept)) - mean(quiet.map((r) => r.slept));
  const qa = mean(active.map((r) => r.quality));
  const qq = mean(quiet.map((r) => r.quality));
  return {
    stepsCut: Math.round(cut / 100) * 100,
    nights: rows.length,
    sleptDiff: round(sleptDiff),
    qualityDiff: qa != null && qq != null ? Math.round((qa - qq) * 10) / 10 : null,
  };
}

/** The bedtime of her best-rated nights (quality ≥ 4, at least 3 of them). */
function bestBedtime(facts) {
  const good = facts.filter((f) => f.quality != null && f.quality >= 4 && f.bed != null);
  if (good.length < 3) return null;
  return { bedtime: toClock(median(good.map((f) => f.bed))), nights: good.length };
}

/**
 * Summary of a window of nights. `days` = window length ending today; nights outside are used only as history
 * for regularity. Returns null-filled fields when there is not enough data — the UI says what is missing.
 */
export function sleepSummary(nights, { plan = null, timeZone = 'Asia/Tbilisi', today, days = 7, stepsByDay = null } = {}) {
  const all = nightFacts(nights, timeZone);
  const end = today || localParts(new Date(), timeZone).date;
  const startMs = Date.parse(`${end}T00:00:00Z`) - (days - 1) * DAY_MS;
  const start = new Date(startMs).toISOString().slice(0, 10);
  const prevStart = new Date(startMs - days * DAY_MS).toISOString().slice(0, 10);
  const facts = all.filter((f) => f.night >= start && f.night <= end);
  const previous = all.filter((f) => f.night >= prevStart && f.night < start);
  const goal = plan?.goalMinutes || 480;

  const scored = facts.map((f) => ({ ...f, score: nightScore(f, all, plan) }));
  const slept = facts.map((f) => f.slept).filter((x) => x != null);
  const avgSlept = mean(slept);
  const prevAvg = mean(previous.map((f) => f.slept));
  const mids = facts.map((f) => f.mid).filter((x) => x != null);
  const spread = mids.length >= 3 ? sd(mids) : null;

  const last7 = all.filter((f) => f.slept != null && f.night <= end).slice(-7);
  const debt = last7.length >= 3 ? Math.max(0, last7.reduce((a, f) => a + (goal - f.slept), 0)) : null;

  const free = facts.filter((f) => f.mid != null && isFreeNight(f.night));
  const work = facts.filter((f) => f.mid != null && !isFreeNight(f.night));
  const jetlag = free.length >= 2 && work.length >= 2 ? Math.abs(mean(free.map((f) => f.mid)) - mean(work.map((f) => f.mid))) : null;

  const beds = facts.map((f) => f.bed).filter((x) => x != null);
  const avgBed = mean(beds);
  const plannedBed = plan ? plannedBedtime(plan) : null;
  const bedVsPlan = avgBed != null && plannedBed != null ? avgBed - fromNoon(plannedBed) : null;

  const weekday = Array.from({ length: 7 }, (_, d) => {
    const v = all.filter((f) => f.slept != null && weekdayOfNight(f.night) === d).slice(-8).map((f) => f.slept);
    return v.length ? round(mean(v)) : null;
  });

  const scores = scored.map((f) => f.score).filter((x) => x != null);
  const score = scores.length ? Math.round(mean(scores)) : null;
  const factorCounts = {};
  for (const f of facts) for (const id of f.factors) factorCounts[id] = (factorCounts[id] || 0) + 1;

  return {
    window: { start, end, days },
    nightsLogged: facts.length,
    goalMinutes: goal,
    avgSleptMinutes: round(avgSlept),
    previousAvgSleptMinutes: previous.filter((f) => f.slept != null).length >= 3 ? round(prevAvg) : null,
    nightsOnGoal: slept.filter((m) => m >= goal - 15).length,
    avgBedtime: avgBed == null ? null : toClock(avgBed),
    avgWake: mean(facts.map((f) => f.wake)) == null ? null : toClock(mean(facts.map((f) => f.wake))),
    bedtimeVsPlanMinutes: round(bedVsPlan),
    regularity: { spreadMinutes: round(spread), band: regularityBand(spread) },
    debtMinutes: debt == null ? null : Math.round(debt),
    socialJetlagMinutes: round(jetlag),
    avgQuality: mean(facts.map((f) => f.quality)) == null ? null : Math.round(mean(facts.map((f) => f.quality)) * 10) / 10,
    avgWakeups: mean(facts.map((f) => f.wakeups)) == null ? null : Math.round(mean(facts.map((f) => f.wakeups)) * 10) / 10,
    avgLatencyMinutes: round(mean(facts.map((f) => f.latency))),
    score,
    scoreBand: scoreBand(score),
    nightScores: scored.map((f) => ({ night: f.night, score: f.score })),
    factorCounts,
    factorEffects: factorEffects(all.filter((f) => f.night <= end).slice(-60)),
    stepsEffect: stepsEffect(all.filter((f) => f.night <= end).slice(-60), stepsByDay),
    bestBedtime: bestBedtime(all.filter((f) => f.night <= end).slice(-60)),
    weekday,
  };
}

/**
 * Which advice fits now. Triggers match SleepTip."trigger"; 'always' tips fill the rest. Order = most specific
 * first; the app shows up to three.
 */
export function tipTriggers(summary) {
  if (!summary) return ['always'];
  const out = [];
  const goal = summary.goalMinutes;
  if (summary.avgSleptMinutes != null && summary.avgSleptMinutes < goal - 30) out.push('short');
  if (summary.regularity?.spreadMinutes != null && summary.regularity.spreadMinutes > 60) out.push('irregular');
  if (summary.bedtimeVsPlanMinutes != null && summary.bedtimeVsPlanMinutes > 30) out.push('late');
  if (summary.socialJetlagMinutes != null && summary.socialJetlagMinutes >= 60) out.push('weekend');
  if (summary.avgLatencyMinutes != null && summary.avgLatencyMinutes >= 30) out.push('latency');
  if (summary.avgWakeups != null && summary.avgWakeups >= 2) out.push('wakeups');
  if (summary.avgQuality != null && summary.avgQuality <= 2.5) out.push('poor');
  const harmful = new Set((summary.factorEffects || []).filter((e) => e.sleptDiff < 0 || (e.qualityDiff ?? 0) < 0).map((e) => e.factor));
  for (const factor of ['caffeine', 'alcohol', 'screens', 'stress', 'late_meal', 'noise', 'heat']) {
    if (harmful.has(factor) || (summary.factorCounts?.[factor] || 0) >= 2) out.push(factor);
  }
  out.push('always');
  return out;
}

export function pickTips(tips, summary, { limit = 3 } = {}) {
  const triggers = tipTriggers(summary);
  const live = tips.filter((t) => t.status === 'LIVE');
  const picked = [];
  for (const trigger of triggers) {
    for (const tip of live.filter((t) => t.trigger === trigger).sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (picked.length >= limit) return picked;
      if (!picked.includes(tip)) picked.push(tip);
      if (trigger !== 'always') break; // one tip per specific reason
    }
  }
  return picked;
}
