'use strict';

/**
 * Phase 6 — Smart Quest × Notification Brain.
 * Pure eligibility / scoring / revalidation. Brain remains the only scheduler.
 */

export const QUEST_SMART_FAMILY = 'questSmart';
export const MAX_SMART_QUEST_PUSHES_PER_DAY = 1;
export const QUEST_SMART_COOLDOWN_HOURS = 20;

export const QUEST_SMART_TYPES = Object.freeze([
  'QUEST_NEAR_COMPLETE',
  'QUEST_GOOD_WEATHER_WINDOW',
  'QUEST_COMEBACK',
  'QUEST_MORNING_PLAN',
  'QUEST_WEEKLY_PROGRESS',
]);

export const QUEST_SMART_BASE_SCORES = Object.freeze({
  QUEST_NEAR_COMPLETE: 78,
  QUEST_GOOD_WEATHER_WINDOW: 72,
  QUEST_COMEBACK: 74,
  QUEST_MORNING_PLAN: 50,
  QUEST_WEEKLY_PROGRESS: 60,
});

export const QUEST_SMART_TEMPLATE_KEYS = Object.freeze({
  QUEST_NEAR_COMPLETE: 'engage-quest-near-complete',
  QUEST_GOOD_WEATHER_WINDOW: 'engage-quest-weather-window',
  QUEST_COMEBACK: 'engage-quest-comeback',
  QUEST_MORNING_PLAN: 'engage-quest-morning-plan',
  QUEST_WEEKLY_PROGRESS: 'engage-quest-weekly-progress',
});

export const QUEST_SMART_REASON = Object.freeze({
  QUEST_NOT_ACTIVE: 'QUEST_NOT_ACTIVE',
  QUEST_ALREADY_COMPLETE: 'QUEST_ALREADY_COMPLETE',
  QUEST_PROGRESS_TOO_LOW: 'QUEST_PROGRESS_TOO_LOW',
  QUEST_PROGRESS_TOO_HIGH: 'QUEST_PROGRESS_TOO_HIGH',
  QUEST_REMAINING_TRIVIAL: 'QUEST_REMAINING_TRIVIAL',
  QUEST_EVENING_PRESSURE_BLOCK: 'QUEST_EVENING_PRESSURE_BLOCK',
  QUEST_APP_RECENTLY_OPENED: 'QUEST_APP_RECENTLY_OPENED',
  QUEST_PAIN_SUPPRESSED: 'QUEST_PAIN_SUPPRESSED',
  QUEST_WEATHER_UNAVAILABLE: 'QUEST_WEATHER_UNAVAILABLE',
  QUEST_WEATHER_UNSAFE: 'QUEST_WEATHER_UNSAFE',
  QUEST_WINDOW_PASSED: 'QUEST_WINDOW_PASSED',
  QUEST_COMEBACK_ALREADY_RESOLVED: 'QUEST_COMEBACK_ALREADY_RESOLVED',
  QUEST_SMART_DAILY_LIMIT: 'QUEST_SMART_DAILY_LIMIT',
  QUEST_FAMILY_COOLDOWN: 'QUEST_FAMILY_COOLDOWN',
  QUEST_MORNING_WINDOW_PASSED: 'QUEST_MORNING_WINDOW_PASSED',
  QUEST_WEEKLY_CUTOFF: 'QUEST_WEEKLY_CUTOFF',
  QUEST_FREQUENCY_BLOCK: 'QUEST_FREQUENCY_BLOCK',
  QUEST_MISSING: 'QUEST_MISSING',
});

const OUTDOOR_SAFE = new Set(['excellent_outdoor', 'good_outdoor']);
const OUTDOOR_OKAY = new Set(['okay_outdoor']);
const PROGRESS_THRESHOLDS = Object.freeze([50, 75, 80, 90, 100]);

export function progressBucket(percent) {
  const p = Number(percent);
  if (!Number.isFinite(p) || p < 0) return 'LT_50';
  if (p >= 100) return 'COMPLETE';
  if (p >= 90) return 'P90_99';
  if (p >= 80) return 'P80_89';
  if (p >= 75) return 'P75_79';
  if (p >= 50) return 'P50_74';
  return 'LT_50';
}

export function weatherAnalyticsKey(weather) {
  if (!weather || weather.stale) return 'NONE';
  const cat = String(weather.category || '');
  if (OUTDOOR_SAFE.has(cat) || OUTDOOR_OKAY.has(cat)) {
    return weather.bestOutdoorWindow ? 'GOOD_WINDOW' : 'OTHER';
  }
  if (/rain|drizzle|storm/i.test(cat)) return 'RAIN';
  if (/uv|hot|heat/i.test(cat)) return 'UV';
  if (/wind/i.test(cat)) return 'WIND';
  if (weather.severity === 'avoid' || /storm|severe|cold|fog|night/i.test(cat)) return 'SEVERE';
  return 'OTHER';
}

/** Remaining must be at least max(250, target * 0.05). */
export function remainingMeaningful(progress, target) {
  const t = Number(target) || 0;
  const p = Number(progress) || 0;
  if (t <= 0) return false;
  const remaining = Math.max(0, t - p);
  const min = Math.max(250, Math.round(t * 0.05));
  return remaining >= min;
}

export function isMovementQuest(quest) {
  if (!quest) return false;
  if (quest.progressType === 'STEPS') return true;
  const key = String(quest.key || '');
  return key === 'daily_steps' || key === 'weekly_steps';
}

export function isWeeklyMovementQuest(quest) {
  if (!quest) return false;
  if (quest.key === 'weekly_steps') return true;
  return quest.progressType === 'STEPS' && String(quest.cadence || '').toUpperCase() === 'WEEKLY';
}

function activeMovement(daily) {
  return (daily || []).find((q) => isMovementQuest(q) && q.status === 'ACTIVE' && !isWeeklyMovementQuest(q)) || null;
}

function weeklyMovement(weekly) {
  return (weekly || []).find((q) => isMovementQuest(q) || isWeeklyMovementQuest(q)) || null;
}

function anyDailyMeaningfulProgress(daily) {
  return (daily || []).some((q) => {
    if (q.status === 'COMPLETED' || q.status === 'CLAIMED') return true;
    return Number(q.progressPercent) >= 40;
  });
}

function anyDailyCompleted(daily) {
  return (daily || []).some((q) => q.status === 'COMPLETED' || q.status === 'CLAIMED');
}

function outdoorAllowed(weather) {
  if (!weather || weather.stale) return { ok: false, reason: QUEST_SMART_REASON.QUEST_WEATHER_UNAVAILABLE };
  if (weather.severity === 'avoid') return { ok: false, reason: QUEST_SMART_REASON.QUEST_WEATHER_UNSAFE };
  const cat = String(weather.category || '');
  if (OUTDOOR_SAFE.has(cat)) return { ok: true, reason: null };
  if (OUTDOOR_OKAY.has(cat) && weather.bestOutdoorWindow) return { ok: true, reason: null };
  return { ok: false, reason: QUEST_SMART_REASON.QUEST_WEATHER_UNSAFE };
}

function windowStartMs(weather, now) {
  const w = weather?.bestOutdoorWindow;
  if (!w) return null;
  if (w.startIso) {
    const ms = new Date(w.startIso).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof w.start === 'string' && /^\d{1,2}:\d{2}$/.test(w.start)) {
    const [h, m] = w.start.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }
  return null;
}

/** Schedule 30–90 minutes before window; prefer 45 min. */
export function weatherWindowFireAt(weather, now) {
  const start = windowStartMs(weather, now);
  if (start == null) return null;
  const preferred = start - 45 * 60_000;
  const earliest = start - 90 * 60_000;
  const latest = start - 30 * 60_000;
  const t = now.getTime();
  if (t >= start) return null;
  if (preferred > t + 60_000 && preferred >= earliest && preferred <= latest) return new Date(preferred);
  if (latest > t + 60_000) return new Date(Math.max(t + 20 * 60_000, Math.min(latest, preferred)));
  if (earliest > t + 60_000) return new Date(earliest);
  return new Date(t + 15 * 60_000);
}

function formatHm(ms) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function windowLabel(weather, now) {
  const w = weather?.bestOutdoorWindow;
  if (!w) return { start: '', end: '' };
  if (w.start && w.end) return { start: w.start, end: w.end };
  const startMs = windowStartMs(weather, now);
  let endMs = null;
  if (w.endIso) endMs = new Date(w.endIso).getTime();
  else if (typeof w.end === 'string' && /^\d{1,2}:\d{2}$/.test(w.end)) {
    const [h, m] = w.end.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    endMs = d.getTime();
  }
  return { start: formatHm(startMs), end: formatHm(endMs) };
}

function hashSeed(parts) {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function pickQuestCopyVariant(variants, userId, localDate, candidateType) {
  const list = Array.isArray(variants) ? variants.filter(Boolean) : [];
  if (!list.length) return '';
  const seed = hashSeed([String(userId || ''), String(localDate || ''), String(candidateType || '')]);
  return list[seed % list.length];
}

/**
 * Score a candidate with explainable modifiers.
 * @returns {{ score: number, reasons: string[], suppressions: string[] }}
 */
export function scoreQuestSmartCandidate(type, mods = {}) {
  let score = QUEST_SMART_BASE_SCORES[type] ?? 50;
  const reasons = [`base ${type}=${QUEST_SMART_BASE_SCORES[type]}`];
  const suppressions = [];

  if (mods.preferredWindow) {
    score += 10;
    reasons.push('preferred engagement window +10');
  }
  if (mods.weatherWindowSoon) {
    score += 10;
    reasons.push('good weather window starts soon +10');
  }
  if (mods.progressBucket === 'P80_89' || mods.progressBucket === 'P90_99') {
    const pct = Number(mods.progressPercent);
    if (pct >= 85 && pct <= 95) {
      score += 8;
      reasons.push('progress 85–95% +8');
    }
  }
  if (mods.comebackFirstDay) {
    score += 8;
    reasons.push('comeback first return day +8');
  }
  if (mods.historicallyOpensQuest) {
    score += 5;
    reasons.push('historically opened Quest notifications +5');
  }
  if (mods.outsidePreferredWindow) {
    score -= 5;
    reasons.push('outside preferred window -5');
    suppressions.push('outside preferred window');
  }
  if (mods.weatherMarginal) {
    score -= 10;
    reasons.push('weather context marginal -10');
    suppressions.push('weather context marginal');
  }
  return { score, reasons, suppressions };
}

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Build all eligible Quest Smart candidates, score them, return the single best.
 * @returns {null | {
 *   type, key, score, reasons, suppressions, fireAt, vars, progressBucket,
 *   targetSource, difficulty, weatherContext, comebackMode
 * }}
 */
export function pickBestQuestSmartCandidate(input = {}) {
  const now = input.now instanceof Date ? input.now : new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const mins = hour * 60 + minute;
  const openedRecently = Boolean(input.openedRecently);
  const loggedPain = Boolean(input.loggedPain);
  const frequency = input.frequency || 'balanced';
  const preferredHour = input.preferredHour ?? null;
  const daily = input.daily || [];
  const weekly = input.weekly || [];
  const weather = input.weather || null;
  const move = activeMovement(daily);
  const week = weeklyMovement(weekly);
  const hasHistory = Boolean(input.hasQuestHistory);
  const candidates = [];

  // —— NEAR COMPLETE ——
  if (move) {
    const pct = Number(move.progressPercent) || 0;
    const bucket = progressBucket(pct);
    const suppress = [];
    let eligible = true;
    let block = null;
    if (openedRecently) {
      eligible = false;
      block = QUEST_SMART_REASON.QUEST_APP_RECENTLY_OPENED;
    } else if (loggedPain) {
      eligible = false;
      block = QUEST_SMART_REASON.QUEST_PAIN_SUPPRESSED;
    } else if (hour >= 20) {
      eligible = false;
      block = QUEST_SMART_REASON.QUEST_EVENING_PRESSURE_BLOCK;
    } else if (pct < 80) {
      eligible = false;
      block = QUEST_SMART_REASON.QUEST_PROGRESS_TOO_LOW;
    } else if (pct >= 100) {
      eligible = false;
      block = QUEST_SMART_REASON.QUEST_ALREADY_COMPLETE;
    } else if (!remainingMeaningful(move.progress, move.target)) {
      eligible = false;
      block = QUEST_SMART_REASON.QUEST_REMAINING_TRIVIAL;
    }
    if (eligible) {
      const scored = scoreQuestSmartCandidate('QUEST_NEAR_COMPLETE', {
        preferredWindow: preferredHour != null && hour === preferredHour,
        progressBucket: bucket,
        progressPercent: pct,
        historicallyOpensQuest: Boolean(input.historicallyOpensQuest),
        outsidePreferredWindow: preferredHour != null && Math.abs(hour - preferredHour) > 2,
      });
      const fireHour = Math.min(19, Math.max(hour, hour + (minute < 30 ? 0 : 1)));
      const fireAt = new Date(now);
      fireAt.setHours(fireHour, minute < 30 ? Math.max(minute + 15, 0) : 0, 0, 0);
      if (fireAt.getTime() <= now.getTime() + 60_000) fireAt.setTime(now.getTime() + 20 * 60_000);
      if (fireAt.getHours() >= 20) {
        /* still schedule before 20 if possible */
        fireAt.setHours(19, 45, 0, 0);
        if (fireAt.getTime() <= now.getTime()) eligible = false;
      }
      if (eligible) {
        candidates.push({
          type: 'QUEST_NEAR_COMPLETE',
          key: QUEST_SMART_TEMPLATE_KEYS.QUEST_NEAR_COMPLETE,
          score: scored.score,
          reasons: scored.reasons,
          suppressions: scored.suppressions,
          fireAt,
          vars: {},
          progressBucket: bucket,
          targetSource: move.targetSource || null,
          difficulty: move.difficulty || null,
          weatherContext: weatherAnalyticsKey(weather),
          comebackMode: move.targetSource === 'COMEBACK',
        });
      } else {
        suppress.push(block || QUEST_SMART_REASON.QUEST_EVENING_PRESSURE_BLOCK);
      }
    }
  }

  // —— GOOD WEATHER WINDOW ——
  if (move && move.status === 'ACTIVE') {
    const pct = Number(move.progressPercent) || 0;
    let eligible = true;
    let block = null;
    if (openedRecently) {
      eligible = false;
      block = QUEST_SMART_REASON.QUEST_APP_RECENTLY_OPENED;
    } else if (loggedPain) {
      eligible = false;
      block = QUEST_SMART_REASON.QUEST_PAIN_SUPPRESSED;
    } else if (pct >= 90) {
      eligible = false;
      block = QUEST_SMART_REASON.QUEST_PROGRESS_TOO_HIGH;
    } else if (pct >= 100) {
      eligible = false;
      block = QUEST_SMART_REASON.QUEST_ALREADY_COMPLETE;
    } else {
      const out = outdoorAllowed(weather);
      if (!out.ok) {
        eligible = false;
        block = out.reason;
      } else if (!weather?.bestOutdoorWindow) {
        eligible = false;
        block = QUEST_SMART_REASON.QUEST_WEATHER_UNAVAILABLE;
      } else {
        const fireAt = weatherWindowFireAt(weather, now);
        if (!fireAt) {
          eligible = false;
          block = QUEST_SMART_REASON.QUEST_WINDOW_PASSED;
        } else if (pct >= 70 && pct < 90) {
          /* near-complete may win via score; still allow weather but with lower relative priority via no +8 */
        }
        if (eligible && fireAt) {
          const label = windowLabel(weather, now);
          const soon = fireAt.getTime() - now.getTime() < 90 * 60_000;
          const scored = scoreQuestSmartCandidate('QUEST_GOOD_WEATHER_WINDOW', {
            preferredWindow: preferredHour != null && fireAt.getHours() === preferredHour,
            weatherWindowSoon: soon,
            weatherMarginal: OUTDOOR_OKAY.has(String(weather.category || '')),
            historicallyOpensQuest: Boolean(input.historicallyOpensQuest),
          });
          const startMs = windowStartMs(weather, now);
          candidates.push({
            type: 'QUEST_GOOD_WEATHER_WINDOW',
            key: QUEST_SMART_TEMPLATE_KEYS.QUEST_GOOD_WEATHER_WINDOW,
            score: scored.score,
            reasons: scored.reasons,
            suppressions: scored.suppressions,
            fireAt,
            vars: {
              windowStart: label.start,
              windowEnd: label.end,
              windowStartIso: startMs != null ? new Date(startMs).toISOString() : '',
            },
            progressBucket: progressBucket(pct),
            targetSource: move.targetSource || null,
            difficulty: move.difficulty || null,
            weatherContext: weatherAnalyticsKey(weather),
            comebackMode: move.targetSource === 'COMEBACK',
          });
        }
      }
    }
    void block;
  }

  // —— COMEBACK ——
  if (move && move.targetSource === 'COMEBACK' && move.status === 'ACTIVE') {
    let eligible = true;
    if (openedRecently || anyDailyCompleted(daily) || Number(move.progressPercent) >= 40) {
      eligible = false;
    } else if (mins < 11 * 60 || mins > 17 * 60) {
      /* prefer 11–17; if preferred hour in range use it, else schedule next slot */
    }
    if (eligible) {
      const fireAt = new Date(now);
      let targetHour = preferredHour != null && preferredHour >= 11 && preferredHour <= 17 ? preferredHour : 12;
      if (hour >= 11 && hour <= 16) targetHour = Math.max(hour, preferredHour != null ? preferredHour : hour);
      if (hour > 17) {
        eligible = false;
      } else {
        fireAt.setHours(Math.min(17, Math.max(11, targetHour)), hour === targetHour ? Math.max(minute + 20, 30) : 0, 0, 0);
        if (fireAt.getTime() <= now.getTime() + 60_000) fireAt.setTime(now.getTime() + 25 * 60_000);
        if (fireAt.getHours() > 17) eligible = false;
      }
      if (eligible) {
        const scored = scoreQuestSmartCandidate('QUEST_COMEBACK', {
          preferredWindow: preferredHour != null && fireAt.getHours() === preferredHour,
          comebackFirstDay: true,
          historicallyOpensQuest: Boolean(input.historicallyOpensQuest),
        });
        candidates.push({
          type: 'QUEST_COMEBACK',
          key: QUEST_SMART_TEMPLATE_KEYS.QUEST_COMEBACK,
          score: scored.score,
          reasons: scored.reasons,
          suppressions: scored.suppressions,
          fireAt,
          vars: {},
          progressBucket: progressBucket(move.progressPercent),
          targetSource: 'COMEBACK',
          difficulty: move.difficulty || null,
          weatherContext: weatherAnalyticsKey(weather),
          comebackMode: true,
        });
      }
    }
  }

  // —— MORNING PLAN ——
  if (frequency === 'rare') {
    /* suppressed for rare by default */
  } else if (daily.length > 0 && hasHistory) {
    let eligible = true;
    if (openedRecently) eligible = false;
    else if (anyDailyMeaningfulProgress(daily)) eligible = false;
    else if (mins > 10 * 60 + 30) eligible = false;
    else {
      const fireAt = new Date(now);
      if (mins < 8 * 60 + 30) {
        fireAt.setHours(8, 45, 0, 0);
      } else {
        fireAt.setTime(now.getTime() + 20 * 60_000);
      }
      if (fireAt.getHours() > 10 || (fireAt.getHours() === 10 && fireAt.getMinutes() > 30)) {
        eligible = false;
      }
      if (eligible) {
        const scored = scoreQuestSmartCandidate('QUEST_MORNING_PLAN', {
          preferredWindow: preferredHour != null && fireAt.getHours() === preferredHour,
          historicallyOpensQuest: Boolean(input.historicallyOpensQuest),
        });
        candidates.push({
          type: 'QUEST_MORNING_PLAN',
          key: QUEST_SMART_TEMPLATE_KEYS.QUEST_MORNING_PLAN,
          score: scored.score,
          reasons: scored.reasons,
          suppressions: scored.suppressions,
          fireAt,
          vars: {},
          progressBucket: 'LT_50',
          targetSource: move?.targetSource || null,
          difficulty: move?.difficulty || null,
          weatherContext: weatherAnalyticsKey(weather),
          comebackMode: move?.targetSource === 'COMEBACK',
        });
      }
    }
  }

  // —— WEEKLY PROGRESS ——
  if (week && (week.status === 'ACTIVE' || week.status === 'COMPLETED')) {
    const dow = now.getDay(); // 0 Sun … 6 Sat
    const isWeekend = dow === 0 || dow === 6;
    const pct = Number(week.progressPercent) || 0;
    let eligible = true;
    if (!isWeekend) eligible = false;
    else if (dow === 0 && hour >= 19) eligible = false;
    else if (hour >= 19) eligible = false;
    else if (pct < 75) eligible = false;
    else if (pct >= 100 || week.status === 'COMPLETED' || week.status === 'CLAIMED') eligible = false;
    else if (!remainingMeaningful(week.progress, week.target)) eligible = false;
    else if (openedRecently) eligible = false;
    else if (loggedPain) eligible = false;
    else if (weather?.severity === 'avoid') eligible = false;
    if (eligible) {
      const fireAt = new Date(now);
      fireAt.setTime(now.getTime() + 30 * 60_000);
      if (fireAt.getHours() >= 19) fireAt.setHours(18, 30, 0, 0);
      if (fireAt.getTime() <= now.getTime()) eligible = false;
      if (eligible) {
        const scored = scoreQuestSmartCandidate('QUEST_WEEKLY_PROGRESS', {
          preferredWindow: preferredHour != null && fireAt.getHours() === preferredHour,
          progressBucket: progressBucket(pct),
          progressPercent: pct,
          historicallyOpensQuest: Boolean(input.historicallyOpensQuest),
        });
        candidates.push({
          type: 'QUEST_WEEKLY_PROGRESS',
          key: QUEST_SMART_TEMPLATE_KEYS.QUEST_WEEKLY_PROGRESS,
          score: scored.score,
          reasons: scored.reasons,
          suppressions: scored.suppressions,
          fireAt,
          vars: {},
          progressBucket: progressBucket(pct),
          targetSource: week.targetSource || null,
          difficulty: week.difficulty || null,
          weatherContext: weatherAnalyticsKey(weather),
          comebackMode: false,
        });
      }
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || a.fireAt.getTime() - b.fireAt.getTime());
  return candidates[0];
}

function anyMovement(daily) {
  return (daily || []).find((q) => isMovementQuest(q) && !isWeeklyMovementQuest(q)) || null;
}

/**
 * Revalidate a scheduled QUEST_SMART notification against live state.
 */
export function revalidateQuestSmart(payload, live = {}) {
  const type = String(payload.candidateType || payload.questSmartType || '');
  const key = String(payload.templateKey || payload.key || '');
  const resolvedType =
    type ||
    Object.entries(QUEST_SMART_TEMPLATE_KEYS).find(([, v]) => v === key)?.[0] ||
    '';

  if (live.openedRecently || (live.lastOpenAt && live.now && live.now.getTime() - live.lastOpenAt < 90 * 60_000)) {
    return { ok: false, reason: QUEST_SMART_REASON.QUEST_APP_RECENTLY_OPENED };
  }
  if (live.smartQuestSentToday) {
    return { ok: false, reason: QUEST_SMART_REASON.QUEST_SMART_DAILY_LIMIT };
  }

  const daily = live.daily || [];
  const weekly = live.weekly || [];
  const move = anyMovement(daily);
  const week = weeklyMovement(weekly);
  const hour = live.now instanceof Date ? live.now.getHours() : new Date().getHours();
  const weather = live.weather || null;

  if (resolvedType === 'QUEST_NEAR_COMPLETE') {
    if (!move) return { ok: false, reason: QUEST_SMART_REASON.QUEST_MISSING };
    if (move.status !== 'ACTIVE') {
      return {
        ok: false,
        reason:
          move.status === 'COMPLETED' || move.status === 'CLAIMED'
            ? QUEST_SMART_REASON.QUEST_ALREADY_COMPLETE
            : QUEST_SMART_REASON.QUEST_NOT_ACTIVE,
      };
    }
    const pct = Number(move.progressPercent) || 0;
    if (pct < 80) return { ok: false, reason: QUEST_SMART_REASON.QUEST_PROGRESS_TOO_LOW };
    if (pct >= 100) return { ok: false, reason: QUEST_SMART_REASON.QUEST_ALREADY_COMPLETE };
    if (!remainingMeaningful(move.progress, move.target)) {
      return { ok: false, reason: QUEST_SMART_REASON.QUEST_REMAINING_TRIVIAL };
    }
    if (hour >= 20) return { ok: false, reason: QUEST_SMART_REASON.QUEST_EVENING_PRESSURE_BLOCK };
    if (live.loggedPain) return { ok: false, reason: QUEST_SMART_REASON.QUEST_PAIN_SUPPRESSED };
    return { ok: true, reason: null };
  }

  if (resolvedType === 'QUEST_GOOD_WEATHER_WINDOW') {
    if (!move || move.status !== 'ACTIVE') {
      return {
        ok: false,
        reason:
          move && (move.status === 'COMPLETED' || move.status === 'CLAIMED')
            ? QUEST_SMART_REASON.QUEST_ALREADY_COMPLETE
            : QUEST_SMART_REASON.QUEST_NOT_ACTIVE,
      };
    }
    if (Number(move.progressPercent) >= 90) return { ok: false, reason: QUEST_SMART_REASON.QUEST_PROGRESS_TOO_HIGH };
    if (live.loggedPain) return { ok: false, reason: QUEST_SMART_REASON.QUEST_PAIN_SUPPRESSED };
    const out = outdoorAllowed(weather);
    if (!out.ok) return { ok: false, reason: out.reason };
    if (!weather?.bestOutdoorWindow) return { ok: false, reason: QUEST_SMART_REASON.QUEST_WEATHER_UNAVAILABLE };
    const start = windowStartMs(weather, live.now || new Date());
    if (start != null && (live.now || new Date()).getTime() > start + 30 * 60_000) {
      return { ok: false, reason: QUEST_SMART_REASON.QUEST_WINDOW_PASSED };
    }
    if (live.weatherWindowChanged) return { ok: false, reason: QUEST_SMART_REASON.QUEST_WINDOW_PASSED };
    return { ok: true, reason: null };
  }

  if (resolvedType === 'QUEST_COMEBACK') {
    if (!move || move.status !== 'ACTIVE') return { ok: false, reason: QUEST_SMART_REASON.QUEST_NOT_ACTIVE };
    if (move.targetSource !== 'COMEBACK') return { ok: false, reason: QUEST_SMART_REASON.QUEST_COMEBACK_ALREADY_RESOLVED };
    if (anyDailyCompleted(daily) || Number(move.progressPercent) >= 40) {
      return { ok: false, reason: QUEST_SMART_REASON.QUEST_COMEBACK_ALREADY_RESOLVED };
    }
    return { ok: true, reason: null };
  }

  if (resolvedType === 'QUEST_MORNING_PLAN') {
    if (!daily.length) return { ok: false, reason: QUEST_SMART_REASON.QUEST_MISSING };
    if (anyDailyMeaningfulProgress(daily)) return { ok: false, reason: QUEST_SMART_REASON.QUEST_PROGRESS_TOO_HIGH };
    if (hour > 10 || (hour === 10 && (live.now?.getMinutes?.() || 0) > 30)) {
      return { ok: false, reason: QUEST_SMART_REASON.QUEST_MORNING_WINDOW_PASSED };
    }
    return { ok: true, reason: null };
  }

  if (resolvedType === 'QUEST_WEEKLY_PROGRESS') {
    if (!week) return { ok: false, reason: QUEST_SMART_REASON.QUEST_MISSING };
    if (week.status !== 'ACTIVE') {
      return {
        ok: false,
        reason:
          week.status === 'COMPLETED' || week.status === 'CLAIMED'
            ? QUEST_SMART_REASON.QUEST_ALREADY_COMPLETE
            : QUEST_SMART_REASON.QUEST_NOT_ACTIVE,
      };
    }
    const dow = (live.now || new Date()).getDay();
    if (dow === 0 && hour >= 19) return { ok: false, reason: QUEST_SMART_REASON.QUEST_WEEKLY_CUTOFF };
    if (Number(week.progressPercent) < 75) return { ok: false, reason: QUEST_SMART_REASON.QUEST_PROGRESS_TOO_LOW };
    if (!remainingMeaningful(week.progress, week.target)) {
      return { ok: false, reason: QUEST_SMART_REASON.QUEST_REMAINING_TRIVIAL };
    }
    if (live.loggedPain) return { ok: false, reason: QUEST_SMART_REASON.QUEST_PAIN_SUPPRESSED };
    return { ok: true, reason: null };
  }

  return { ok: false, reason: QUEST_SMART_REASON.QUEST_MISSING };
}

/** Detect meaningful progress threshold crossings for Engage refresh. */
export function crossedQuestProgressThreshold(prevPercent, nextPercent) {
  const a = Number(prevPercent);
  const b = Number(nextPercent);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return false;
  return PROGRESS_THRESHOLDS.some((t) => a < t && b >= t);
}

export function questSmartAnalyticsProps(candidate) {
  if (!candidate) return {};
  return {
    candidateType: candidate.type,
    targetSource: candidate.targetSource || null,
    difficulty: candidate.difficulty || null,
    progressBucket: candidate.progressBucket || null,
    weatherContextPresent: Boolean(candidate.weatherContext && candidate.weatherContext !== 'NONE'),
    weatherContextKey: candidate.weatherContext || 'NONE',
    comebackMode: Boolean(candidate.comebackMode),
  };
}

export { ymd as questSmartYmd, PROGRESS_THRESHOLDS };
