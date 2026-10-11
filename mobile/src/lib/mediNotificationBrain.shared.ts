import {
  bumpOutOfQuiet,
  cooldownMsForFamily,
  computeEngageFatigue,
  isQuietAt,
  preferredHourFromOpens,
  shiftToPreferredHour,
  PREFERRED_WINDOW_FAMILIES,
  type EngageOutcome,
  type EngageFatigueLevel,
  type EngageFrequency,
  type MediEngagePrefs,
  type EngageTopic,
} from './mediEngageModel.ts';
import { engageDestination } from './notificationPlan.ts';
import { engageSignalHash, newDecisionId } from './mediNotificationRevalidate.ts';
import { pickBestQuestSmartCandidate } from './quest/questSmartEngage.js';
import { dateLocale } from '../i18n/locale.js';

export type EngageSentRow = { key: string; family: string; at: number; ymd: string };

export const ENGAGE_FAMILIES = {
  birthday: { priority: 90, topic: 'birthday' as EngageTopic },
  visitFollowup: { priority: 78, topic: 'visitFollowup' as EngageTopic },
  insight: { priority: 75, topic: 'insight' as EngageTopic },
  achievement: { priority: 70, topic: 'achievement' as EngageTopic },
  weekly: { priority: 60, topic: 'weekly' as EngageTopic },
  reengage: { priority: 55, topic: 'reengage' as EngageTopic },
  unfinished: { priority: 52, topic: 'unfinished' as EngageTopic },
  /** Phase 6 — Smart Quest companion family. Per-candidate scores override this base. */
  questSmart: { priority: 65, topic: 'questSmart' as EngageTopic },
  hydration: { priority: 45, topic: 'hydration' as EngageTopic },
  stepsQuiet: { priority: 40, topic: 'stepsSmart' as EngageTopic },
  chat: { priority: 33, topic: 'chatFollowup' as EngageTopic },
  morning: { priority: 32, topic: 'morning' as EngageTopic },
  checkin: { priority: 30, topic: 'checkin' as EngageTopic },
  sleep: { priority: 28, topic: 'sleep' as EngageTopic },
  question: { priority: 25, topic: 'question' as EngageTopic },
  feature: { priority: 10, topic: 'feature' as EngageTopic },
  weatherWellness: { priority: 42, topic: 'weather' as EngageTopic },
} as const;

export type EngageFamily = keyof typeof ENGAGE_FAMILIES;

/**
 * Families whose message belongs to one moment of one day („დილა მშვიდობისა“, „ძილის დრო ახლოვდება“,
 * today's water or steps, today's weather window). They are never pushed past the end of quiet hours
 * into another day and never slip to tomorrow with today's numbers — they are skipped instead.
 */
export const DAY_BOUND_FAMILIES: ReadonlySet<string> = new Set([
  'birthday',
  'morning',
  'checkin',
  'sleep',
  'hydration',
  'stepsQuiet',
  'weatherWellness',
  'questSmart',
]);

/** Minimum time between two Medi notifications on one day (the birthday wish is exempt). */
export const ENGAGE_MIN_GAP_MS = 90 * 60_000;

/**
 * Notifications that say the same thing share a kind, and a day gets one of each: one „how are you“
 * (morning greeting, check-in, „ორი დღეა არ შემოგივლია“), one weekly-report nudge (the report and the
 * „Medi learned to sum up your week“ intro), one „let's move“ (quiet steps, a good weather window, a
 * MEDIQUEST walk) and one water nudge (low water, a hot day).
 */
export function engageKindOf(family: string, key = ''): string {
  if (family === 'morning' || family === 'checkin' || family === 'reengage') return 'hello';
  if (family === 'weekly' || family === 'feature') return 'weekly';
  if (family === 'stepsQuiet' || family === 'questSmart') return 'move';
  if (family === 'weatherWellness') {
    if (key === 'engage-weather-walk' || key === 'engage-weather-rain-soon') return 'move';
    if (key === 'engage-weather-hot') return 'water';
  }
  if (family === 'hydration') return 'water';
  return family;
}

export type EngageCandidate = {
  key: string;
  family: EngageFamily;
  priority: number;
  fireAt: Date;
  vars: Record<string, string | number>;
  route: string;
  decisionId: string;
  signalHash: string;
  entityId?: string;
  validUntil?: number;
  candidateType?: string;
};

export type UnfinishedDraft = {
  kind: 'medication_add' | 'medication_schedule' | 'visit_draft' | 'cycle_log' | 'health_log';
  route: string;
  name?: string;
  updatedAt: number;
};

export type EngageSnapshot = {
  now: Date;
  /** Last time the app was opened — the current open included when the Brain runs on one. */
  lastOpenAt: number | null;
  firstName: string;
  birthDate: string | null;
  createdAt: string | null;
  todaySteps: number | null;
  weekSteps: number;
  prevWeekSteps: number;
  hydrationMl: number;
  hydrationGoal: number;
  loggedPain: boolean;
  medTakenWeek: number;
  medMissedWeek: number;
  missingProfileField: 'bloodType' | 'heightCm' | 'phone' | null;
  lastChatAt: number | null;
  lastChatId: string | null;
  lastChatMode: 'DOCTOR' | 'CONSILIUM' | null;
  cycleRegular: boolean;
  cyclePrivacyEnabled?: boolean;
  /** This week's report (since Monday) was already opened. */
  seenWeekly: boolean;
  /** The weekly report was ever opened — the „Medi can sum up your week“ intro is no longer news. */
  weeklyEverSeen?: boolean;
  unfinished: UnfinishedDraft | null;
  recentVisit: { id: string; hoursAgo: number } | null;
  openAt: number[];
  outcomes: EngageOutcome[];
  sent: EngageSentRow[];
  prefs: MediEngagePrefs;
  /** Families the admin switched off (`admin_off`) or whose module is paused (`module_paused`). */
  blockedFamilies?: Partial<Record<string, string>>;
  /** Admin ceiling on Medi notifications per day (never above the person's own choice). */
  maxPerDay?: number | null;
  weather?: {
    candidate: 'weather_good_walk' | 'weather_rain_soon' | 'weather_hot_hydration' | 'weather_high_uv';
    category: string;
    windowStartIso: string | null;
    stale: boolean;
  } | null;
  /** Phase 6 — safe Quest Smart snapshot (no baseline / medical). */
  quest?: {
    daily: Array<{
      id: string;
      key: string | null;
      progressType: string | null;
      cadence?: string | null;
      status: string;
      progress: number;
      target: number;
      progressPercent: number;
      targetSource?: string | null;
      difficulty?: string | null;
      reasonKey?: string | null;
      periodKey: string;
    }>;
    weekly: Array<{
      id: string;
      key: string | null;
      progressType: string | null;
      cadence?: string | null;
      status: string;
      progress: number;
      target: number;
      progressPercent: number;
      targetSource?: string | null;
      difficulty?: string | null;
      periodKey: string;
    }>;
    hasQuestHistory: boolean;
    weather?: {
      category: string;
      severity?: string | null;
      stale: boolean;
      bestOutdoorWindow?: {
        start?: string;
        end?: string;
        startIso?: string;
        endIso?: string;
      } | null;
    } | null;
  } | null;
};

export type EngageDecision = {
  id: string;
  candidate: string;
  family: EngageFamily;
  score: number;
  reasons: string[];
  suppressions: string[];
  blocked: string | null;
  /** SEND = scheduled · SKIP = never scheduled · CANCELLED = scheduled, then dropped before it fired. */
  decision: 'SEND' | 'SKIP' | 'BLOCKED' | 'CANCELLED';
  template: string;
  route: string;
  fireAt: string | null;
  createdAt: string;
  scheduledAt: string | null;
  revalidatedAt?: string;
  reason: string | null;
};

export type EngageTrace = {
  at: string;
  fatigue: {
    selectedFrequency: EngageFrequency;
    baseDailyCap: number;
    adaptiveDailyCap: number;
    ewma: number;
    level: EngageFatigueLevel;
    opened: number;
    ignored: number;
    cap: number;
    setting: EngageFrequency;
  };
  preferredHour: number | null;
  decisions: EngageDecision[];
};

type Attempt = {
  key: string;
  family: EngageFamily;
  /** Day-bound families: the raw slot (not yet moved out of quiet hours). */
  fireAt: Date;
  vars: Record<string, string | number>;
  route: string;
  reasons: string[];
  /** Optional per-candidate score (Quest Smart). Defaults to family priority. */
  score?: number;
  /** Safe candidate type label for trace (e.g. QUEST_NEAR_COMPLETE). */
  candidateType?: string;
  /** Extra safe metadata for DEV trace / analytics (no exact steps). */
  meta?: Record<string, string | number | boolean | null>;
};

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function atHour(base: Date, hour: number, minute = 0): Date {
  const next = new Date(base);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function weekdayMon(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function sentFamilyOn(sent: EngageSentRow[], family: string, day: string): boolean {
  return sent.some((row) => row.family === family && row.ymd === day);
}

function sentKeySince(sent: EngageSentRow[], key: string, since: number): boolean {
  return sent.some((row) => row.key === key && row.at >= since);
}

function lastFamilyAt(sent: EngageSentRow[], family: string): number | null {
  const row = sent.filter((item) => item.family === family).sort((a, b) => b.at - a.at)[0];
  return row?.at ?? null;
}

function rareAllows(family: EngageFamily): boolean {
  return (
    family === 'weekly' ||
    family === 'insight' ||
    family === 'achievement' ||
    family === 'reengage' ||
    family === 'birthday' ||
    family === 'visitFollowup' ||
    family === 'questSmart'
  );
}

function topicOn(prefs: MediEngagePrefs, family: EngageFamily): boolean {
  return prefs.topics[ENGAGE_FAMILIES[family].topic] !== false;
}

/** The check-in copy follows the hour it is delivered at, not the hour it was planned at. */
export function pickCheckinKey(at: Date): string {
  const hour = at.getHours();
  if (hour < 12) return 'engage-checkin-morning';
  if (hour < 18) return 'engage-checkin-mid';
  return 'engage-checkin-evening';
}

export function pickReengageKey(daysAway: number): string {
  if (daysAway >= 30) return 'engage-reengage-30';
  if (daysAway >= 14) return 'engage-reengage-14';
  if (daysAway >= 5) return 'engage-reengage-5';
  return 'engage-reengage-2';
}

/** Flexible families: out of quiet hours, and to tomorrow when the slot already passed. */
function scheduleAt(now: Date, prefs: MediEngagePrefs, hour: number, minute: number, dayOffset = 0): Date {
  const raw = atHour(addDays(now, dayOffset), hour, minute);
  const bumped = bumpOutOfQuiet(raw, prefs.quietStart, prefs.quietEnd);
  return bumped.getTime() > now.getTime() + 60_000 ? bumped : addDays(bumped, 1);
}

/** Day-bound families: the raw slot; placement decides later whether it still fits its day. */
function slotAt(now: Date, hour: number, minute: number, dayOffset = 0): Date {
  return atHour(addDays(now, dayOffset), hour, minute);
}

/**
 * Where a candidate lands: the person's usual hour when the family allows it (never into quiet hours),
 * then out of quiet hours. A day-bound family that would leave its day (or whose moment passed) is
 * blocked instead of moved.
 */
function placeCandidate(
  now: Date,
  prefs: MediEngagePrefs,
  family: EngageFamily,
  raw: Date,
  preferredHour: number | null,
): { fireAt: Date; blocked: string | null; preferred: boolean } {
  let fireAt = raw;
  let preferred = false;
  if (preferredHour != null && PREFERRED_WINDOW_FAMILIES.has(family)) {
    let shifted = shiftToPreferredHour(raw, preferredHour);
    if (shifted.getTime() <= now.getTime() + 60_000) shifted = addDays(shifted, 1);
    if (!isQuietAt(shifted, prefs.quietStart, prefs.quietEnd)) {
      fireAt = shifted;
      preferred = true;
    }
  }
  if (DAY_BOUND_FAMILIES.has(family)) {
    if (fireAt.getTime() <= now.getTime() + 60_000) return { fireAt, blocked: 'window_passed', preferred };
    const bumped = bumpOutOfQuiet(fireAt, prefs.quietStart, prefs.quietEnd);
    if (ymd(bumped) !== ymd(fireAt)) return { fireAt, blocked: 'quiet_hours', preferred };
    return { fireAt: bumped, blocked: null, preferred };
  }
  let bumped = bumpOutOfQuiet(fireAt, prefs.quietStart, prefs.quietEnd);
  if (bumped.getTime() <= now.getTime() + 60_000) bumped = bumpOutOfQuiet(addDays(bumped, 1), prefs.quietStart, prefs.quietEnd);
  return { fireAt: bumped, blocked: null, preferred };
}

function unfinishedCopy(draft: UnfinishedDraft): { key: string; vars: Record<string, string | number> } {
  if (draft.kind === 'medication_add' || draft.kind === 'medication_schedule') {
    return { key: 'engage-unfinished-med', vars: { name: draft.name || '' } };
  }
  return { key: 'engage-unfinished', vars: { task: draft.name || '' } };
}

function hm(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatEngageTrace(trace: EngageTrace): string {
  const lines = [
    `selectedFrequency = ${trace.fatigue.selectedFrequency}`,
    `baseDailyCap = ${trace.fatigue.baseDailyCap}`,
    `adaptiveDailyCap = ${trace.fatigue.adaptiveDailyCap}`,
    `ewma = ${trace.fatigue.ewma.toFixed(2)} · ${trace.fatigue.opened} opened / ${trace.fatigue.ignored} ignored`,
    `preferredEngagementWindow: ${trace.preferredHour == null ? 'none yet' : `${trace.preferredHour}:00–${(trace.preferredHour + 1) % 24}:00`}`,
    '',
  ];
  for (const row of trace.decisions) {
    lines.push(`Decision ID: ${row.id}`);
    lines.push(`Candidate: ${row.candidate}`);
    lines.push(`Created: ${hm(row.createdAt)}`);
    lines.push(`Scheduled: ${hm(row.scheduledAt)}`);
    if (row.revalidatedAt) lines.push(`Revalidated: ${hm(row.revalidatedAt)}`);
    lines.push(`Score: ${row.score}`);
    if (row.reasons.length) {
      lines.push('Reasons:');
      for (const reason of row.reasons) lines.push(`+ ${reason}`);
    }
    if (row.suppressions.length) {
      lines.push('Suppressions:');
      for (const item of row.suppressions) lines.push(`✓ ${item}`);
    }
    lines.push(`Result: ${row.blocked ? 'BLOCKED' : row.decision}`);
    if (row.reason || row.blocked) lines.push(`Reason: ${row.reason ?? row.blocked}`);
    lines.push(`Template: ${row.template}`);
    lines.push(`Deep link: ${row.route}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

export function evaluateEngageBrain(snap: EngageSnapshot): { accepted: EngageCandidate[]; trace: EngageTrace } {
  const { now, prefs } = snap;
  const today = ymd(now);
  const hour = now.getHours();
  const minutesSinceOpen = snap.lastOpenAt ? Math.round((now.getTime() - snap.lastOpenAt) / 60_000) : 10_000;
  const openedRecently = minutesSinceOpen < 90;
  const openedToday = Boolean(snap.lastOpenAt && ymd(new Date(snap.lastOpenAt)) === today);
  const weekStart = now.getTime() - 7 * 86_400_000;
  const fatigue = computeEngageFatigue(prefs.frequency, snap.outcomes, now.getTime());
  const adminCap = Number(snap.maxPerDay);
  const cap = Number.isFinite(adminCap) && adminCap >= 1 ? Math.min(fatigue.adaptiveDailyCap, Math.floor(adminCap)) : fatigue.adaptiveDailyCap;
  const preferredHour = preferredHourFromOpens(snap.openAt, now.getTime());
  const attempts: Attempt[] = [];
  const skips: EngageDecision[] = [];
  const live = {
    hydrationMl: snap.hydrationMl,
    hydrationGoal: snap.hydrationGoal,
    loggedPain: snap.loggedPain,
    seenWeekly: snap.seenWeekly,
    unfinished: snap.unfinished,
    recentVisitId: snap.recentVisit?.id ?? null,
    missingProfileField: snap.missingProfileField,
    todaySteps: snap.todaySteps,
  };

  const skip = (family: EngageFamily, key: string, blocked: string, route: string, reasons: string[] = []) => {
    skips.push({
      id: newDecisionId(now.getTime()),
      candidate: family,
      family,
      score: ENGAGE_FAMILIES[family].priority,
      reasons,
      suppressions: [],
      blocked,
      decision: 'SKIP',
      template: key,
      route,
      fireAt: null,
      createdAt: now.toISOString(),
      scheduledAt: null,
      reason: blocked,
    });
  };

  if (snap.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(snap.birthDate)) {
    const [, mm, dd] = snap.birthDate.split('-');
    const thisYear = new Date(now.getFullYear(), Number(mm) - 1, Number(dd), 9, 15, 0, 0);
    const fire = thisYear.getTime() > now.getTime() ? thisYear : new Date(now.getFullYear() + 1, Number(mm) - 1, Number(dd), 9, 15, 0, 0);
    if (!sentKeySince(snap.sent, 'engage-birthday', now.getTime() - 300 * 86_400_000)) {
      attempts.push({
        key: 'engage-birthday',
        family: 'birthday',
        fireAt: fire,
        vars: { firstName: snap.firstName },
        route: engageDestination('birthday'),
        reasons: ['birthday today/upcoming', 'once per year'],
      });
    }
  }

  const sundayOffset = (7 - now.getDay()) % 7 || (hour >= 11 ? 7 : 0);
  const weeklyOffset = snap.seenWeekly && sundayOffset === 0 ? 7 : sundayOffset;
  if (sentKeySince(snap.sent, 'engage-weekly', now.getTime() - 6 * 86_400_000)) {
    skip('weekly', 'engage-weekly', 'weekly_already_sent', engageDestination('weekly'), ['Sunday ჩემი კვირა Medi-სთან report']);
  } else {
    attempts.push({
      key: 'engage-weekly',
      family: 'weekly',
      fireAt: scheduleAt(now, prefs, 11, 0, weeklyOffset),
      vars: {},
      route: engageDestination('weekly'),
      reasons: ['Sunday ჩემი კვირა Medi-სთან report'],
    });
  }

  if (snap.weekSteps > 0 && snap.prevWeekSteps > 0 && snap.weekSteps >= Math.round(snap.prevWeekSteps * 1.15) && snap.weekSteps >= 4000) {
    attempts.push({
      key: 'engage-insight-steps',
      family: 'insight',
      fireAt: scheduleAt(now, prefs, 12, 20, openedToday ? 1 : 0),
      vars: { steps: snap.weekSteps.toLocaleString(dateLocale()) },
      route: engageDestination('insight', { insight: 'steps' }),
      reasons: [`week steps ${snap.weekSteps} ≥ 15% above previous week`, 'real signal only'],
    });
  } else if (snap.cycleRegular) {
    attempts.push({
      key: 'engage-insight-cycle',
      family: 'insight',
      fireAt: scheduleAt(now, prefs, 12, 20, 1),
      vars: {},
      route: engageDestination('insight', { insight: 'cycle' }),
      reasons: ['repeating cycle trend'],
    });
  }

  if (snap.medMissedWeek >= 3) {
    attempts.push({
      key: 'engage-insight-meds',
      family: 'insight',
      fireAt: scheduleAt(now, prefs, 19, 0, openedRecently ? 1 : 0),
      vars: {},
      route: engageDestination('insight', { insight: 'meds' }),
      reasons: [`${snap.medMissedWeek} logged misses this week`, 'offer to retune reminder time'],
    });
  }

  if (snap.weekSteps >= 50_000 && !sentKeySince(snap.sent, 'engage-achieve-steps', weekStart)) {
    attempts.push({
      key: 'engage-achieve-steps',
      family: 'achievement',
      fireAt: scheduleAt(now, prefs, 18, 10, 0),
      vars: { steps: snap.weekSteps.toLocaleString(dateLocale()) },
      route: engageDestination('achievement', { insight: 'steps' }),
      reasons: ['50k steps this week', 'once per achievement'],
    });
  }
  if (snap.medTakenWeek >= 5 && snap.medMissedWeek === 0 && !sentKeySince(snap.sent, 'engage-achieve-meds', weekStart)) {
    attempts.push({
      key: 'engage-achieve-meds',
      family: 'achievement',
      fireAt: scheduleAt(now, prefs, 20, 0, 0),
      vars: {},
      route: '/medications',
      reasons: ['clean medication week', 'once per achievement'],
    });
  }

  // Water: today only, at least an hour from now, never after 20:00.
  const hydroPct = snap.hydrationGoal > 0 ? Math.round((snap.hydrationMl / snap.hydrationGoal) * 100) : 0;
  if (snap.hydrationMl < snap.hydrationGoal * 0.7 && hour < 20) {
    const fireHour = Math.max(hour + 1, 15);
    attempts.push({
      key: fireHour >= 16 ? 'engage-hydration-low' : 'engage-hydration',
      family: 'hydration',
      fireAt: slotAt(now, fireHour, 0),
      vars: {},
      route: engageDestination('hydration'),
      reasons: [`hydration ${hydroPct}% of target`, openedToday ? 'user active today' : 'user not recently active'],
    });
  } else if (snap.hydrationMl >= snap.hydrationGoal * 0.7) {
    skip('hydration', 'engage-hydration', 'hydration_goal_near', engageDestination('hydration'), [`hydration ${hydroPct}% of target`]);
  }

  // Quiet steps: about today's steps, so only today at 18:00.
  const lowBar = snap.prevWeekSteps > 0 ? Math.max(1200, Math.round(snap.prevWeekSteps / 14)) : 1500;
  if (snap.loggedPain) {
    skip('stepsQuiet', 'engage-steps-quiet', 'pain logged today', engageDestination('stepsQuiet'));
  } else if (snap.todaySteps != null && snap.todaySteps < lowBar && hour < 18) {
    attempts.push({
      key: 'engage-steps-quiet',
      family: 'stepsQuiet',
      fireAt: slotAt(now, 18, 0),
      vars: { steps: snap.todaySteps.toLocaleString(dateLocale()) },
      route: engageDestination('stepsQuiet'),
      reasons: [`today steps ${snap.todaySteps} below usual`, 'no pain logged'],
    });
  }

  // No streak pushes (owner 2026-10-08): the app-open streak rewarded opening the app, not health.

  // Check-in: „haven't seen you today“. Opened today → tomorrow afternoon (it only fires if the person
  // has not come by then — every open re-plans it); not yet today → this afternoon or evening.
  if (openedToday || openedRecently) {
    attempts.push({
      key: 'engage-checkin-mid',
      family: 'checkin',
      fireAt: slotAt(now, 16, 15, 1),
      vars: {},
      route: engageDestination('checkin'),
      reasons: [`opened ${minutesSinceOpen} min ago`, 'fires tomorrow only if the app stays closed'],
    });
  } else {
    attempts.push({
      key: 'engage-checkin-mid',
      family: 'checkin',
      fireAt: hour < 16 ? slotAt(now, 16, 15) : hour < 20 ? slotAt(now, 20, 15) : slotAt(now, 16, 15, 1),
      vars: {},
      route: engageDestination('checkin'),
      reasons: [`${minutesSinceOpen} min since last open`, 'optional check-in'],
    });
  }

  const morningDay = weekdayMon(addDays(now, 1));
  const morningDays = prefs.frequency === 'often' ? [0, 2, 4, 6] : [0, 2, 4];
  if (morningDays.includes(morningDay)) {
    attempts.push({
      key: morningDay === 4 ? 'engage-morning-wish' : 'engage-morning',
      family: 'morning',
      fireAt: slotAt(now, 8, 20, 1),
      vars: { firstName: snap.firstName },
      route: morningDay === 4 ? '/(tabs)/home' : engageDestination('morning'),
      reasons: ['personalized good morning 2–3×/week'],
    });
  }

  const sleepDay = hour >= 21 ? addDays(now, 1) : now;
  if ([0, 2, 5].includes(weekdayMon(sleepDay)) || prefs.frequency === 'often') {
    attempts.push({
      key: 'engage-sleep',
      family: 'sleep',
      fireAt: slotAt(sleepDay, 21, 10),
      vars: {},
      route: engageDestination('sleep'),
      reasons: ['evening wind-down window'],
    });
  }

  if (snap.lastChatAt) {
    const hoursAgo = (now.getTime() - snap.lastChatAt) / 3_600_000;
    if (hoursAgo >= 18 && hoursAgo <= 40) {
      attempts.push({
        key: 'engage-chat',
        family: 'chat',
        fireAt: scheduleAt(now, prefs, 15, 30, 0),
        vars: {},
        route: engageDestination('chat', { chatMode: snap.lastChatMode ?? 'DOCTOR', chatId: snap.lastChatId ?? undefined }),
        reasons: [`last chat ${Math.round(hoursAgo)}h ago`, 'lock screen does not quote the chat'],
      });
    }
  }

  if (snap.missingProfileField) {
    attempts.push({
      key: 'engage-question',
      family: 'question',
      fireAt: scheduleAt(now, prefs, 19, 20, weekdayMon(now) % 2 === 0 ? 0 : 1),
      vars: {},
      route: engageDestination('question'),
      reasons: [`missing ${snap.missingProfileField}`],
    });
  }

  const weeklyKnown = snap.weeklyEverSeen ?? snap.seenWeekly;
  if (!weeklyKnown && prefs.topics.feature) {
    attempts.push({
      key: 'engage-feature',
      family: 'feature',
      fireAt: scheduleAt(now, prefs, 12, 0, sundayOffset || 1),
      vars: {},
      route: engageDestination('feature'),
      reasons: ['weekly report not opened yet', 'once per campaign'],
    });
  }

  if (snap.unfinished && now.getTime() - snap.unfinished.updatedAt >= 3 * 3_600_000) {
    const copy = unfinishedCopy(snap.unfinished);
    attempts.push({
      key: copy.key,
      family: 'unfinished',
      fireAt: scheduleAt(now, prefs, Math.min(Math.max(hour + 1, 16), 20), 0, hour >= 20 ? 1 : 0),
      vars: copy.vars,
      route: snap.unfinished.route,
      reasons: [`saved ${snap.unfinished.kind} draft`, 'waited at least 3h'],
    });
  }

  if (snap.recentVisit && snap.recentVisit.hoursAgo >= 3 && snap.recentVisit.hoursAgo <= 36) {
    attempts.push({
      key: 'engage-visit-followup',
      family: 'visitFollowup',
      fireAt: scheduleAt(now, prefs, hour >= 21 ? 10 : Math.max(hour + 1, 16), 0, hour >= 21 ? 1 : 0),
      vars: {},
      route: engageDestination('visitFollowup', { visitId: snap.recentVisit.id }),
      reasons: [`appointment ended ${Math.round(snap.recentVisit.hoursAgo)}h ago`, 'ask how the visit went'],
    });
  }

  if (snap.weather?.candidate && !snap.weather.stale) {
    const weatherKey =
      snap.weather.candidate === 'weather_good_walk'
        ? 'engage-weather-walk'
        : snap.weather.candidate === 'weather_rain_soon'
          ? 'engage-weather-rain-soon'
          : snap.weather.candidate === 'weather_hot_hydration'
            ? 'engage-weather-hot'
            : 'engage-weather-uv';
    let fireAt = slotAt(now, Math.max(hour + 1, 11), 20);
    if (snap.weather.candidate === 'weather_good_walk' && snap.weather.windowStartIso) {
      const windowHour = Number(String(snap.weather.windowStartIso).slice(11, 13));
      if (Number.isFinite(windowHour)) fireAt = new Date(slotAt(now, Math.max(0, windowHour), 0).getTime() - 30 * 60_000);
      if (fireAt.getTime() <= now.getTime() + 60_000) fireAt = new Date(now.getTime() + 20 * 60_000);
    }
    // Someone in the app right now does not need a weather nudge in the next two hours.
    if (snap.lastOpenAt && fireAt.getTime() - snap.lastOpenAt < 2 * 3_600_000) {
      skip('weatherWellness', weatherKey, 'user recently active', engageDestination('weatherWellness'), [
        `${snap.weather.candidate}`,
      ]);
    } else if (snap.loggedPain && snap.weather.candidate === 'weather_good_walk') {
      skip('weatherWellness', weatherKey, 'pain logged today', engageDestination('weatherWellness'));
    } else {
      attempts.push({
        key: weatherKey,
        family: 'weatherWellness',
        fireAt,
        vars: {},
        route: engageDestination('weatherWellness'),
        reasons: [`weather ${snap.weather.category}`, snap.weather.candidate, 'max 1 weather companion / day'],
      });
    }
  }

  // Phase 6 — Smart Quest (at most one QUEST_SMART candidate per evaluation)
  if (snap.quest) {
    const questWeather = snap.quest.weather ?? null;
    const best = pickBestQuestSmartCandidate({
      now,
      daily: snap.quest.daily,
      weekly: snap.quest.weekly,
      weather: questWeather,
      openedRecently,
      loggedPain: snap.loggedPain,
      frequency: prefs.frequency,
      preferredHour,
      hasQuestHistory: snap.quest.hasQuestHistory,
      historicallyOpensQuest: snap.outcomes.some((row) => row.family === 'questSmart' && row.openedAt),
    });
    if (best) {
      attempts.push({
        key: best.key,
        family: 'questSmart',
        fireAt: best.fireAt,
        vars: best.vars,
        route: engageDestination('questSmart'),
        reasons: [
          `candidate ${best.type}`,
          `score ${best.score}`,
          ...(best.reasons || []),
          'max 1 Smart Quest push / local day',
        ],
        score: best.score,
        candidateType: best.type,
        meta: {
          progressBucket: best.progressBucket,
          targetSource: best.targetSource,
          difficulty: best.difficulty,
          weatherContext: best.weatherContext,
          comebackMode: best.comebackMode,
        },
      });
    }
  }

  for (const days of [2, 5, 14, 30]) {
    attempts.push({
      key: pickReengageKey(days),
      family: 'reengage',
      fireAt: bumpOutOfQuiet(atHour(addDays(now, days), 11, 0), prefs.quietStart, prefs.quietEnd),
      vars: { days },
      route: engageDestination('reengage'),
      reasons: [`re-engage ladder day ${days}`],
    });
  }

  const decisions: EngageDecision[] = [...skips];
  const pool: EngageCandidate[] = [];

  for (const row of attempts) {
    const suppressions: string[] = [];
    const placed = placeCandidate(now, prefs, row.family, row.fireAt, preferredHour);
    const fireAt = placed.fireAt;
    // A check-in reads like the hour it arrives at (moved to the person's usual hour or not).
    if (row.family === 'checkin') row.key = pickCheckinKey(fireAt);
    if (row.family === 'hydration') row.key = fireAt.getHours() >= 16 ? 'engage-hydration-low' : 'engage-hydration';
    let blocked: string | null = snap.blockedFamilies?.[row.family] ?? null;
    if (blocked) {
      /* admin switch or paused module */
    } else if (!topicOn(prefs, row.family)) blocked = 'topic off';
    else if (prefs.frequency === 'rare' && !rareAllows(row.family)) blocked = 'rare frequency';
    else if (placed.blocked) blocked = placed.blocked;
    else if (sentFamilyOn(snap.sent, row.family, ymd(fireAt)) && row.family !== 'reengage') blocked = 'already sent this family today';
    else {
      const cool = cooldownMsForFamily(row.family);
      const last = lastFamilyAt(snap.sent, row.family);
      if (cool && last && fireAt.getTime() - last < cool) {
        blocked = `${row.family} cooldown (${FAMILY_LABEL(row.family)})`;
      } else if (cool && last) {
        suppressions.push(`no ${row.family} push in last ${Math.round(cool / 3_600_000)}h`);
      }
    }
    if (!blocked && row.family === 'feature' && sentKeySince(snap.sent, row.key, now.getTime() - 120 * 86_400_000)) {
      blocked = 'once per campaign';
    }
    if (placed.preferred) row.reasons.push('preferred window match');
    suppressions.push('quiet hours passed');
    const id = newDecisionId(now.getTime());
    const entityId = row.family === 'visitFollowup' ? snap.recentVisit?.id : undefined;
    const score = typeof row.score === 'number' ? row.score : ENGAGE_FAMILIES[row.family].priority;
    const decision: EngageDecision = {
      id,
      candidate: row.candidateType || row.family,
      family: row.family,
      score,
      reasons: row.reasons,
      suppressions,
      blocked,
      decision: blocked ? 'SKIP' : 'SEND',
      template: row.key,
      route: row.route,
      fireAt: blocked ? null : fireAt.toISOString(),
      createdAt: now.toISOString(),
      scheduledAt: blocked ? null : fireAt.toISOString(),
      reason: blocked,
    };
    if (row.meta) {
      for (const [k, v] of Object.entries(row.meta)) {
        if (v != null) decision.reasons.push(`${k}=${String(v)}`);
      }
    }
    decisions.push(decision);
    if (!blocked) {
      pool.push({
        key: row.key,
        family: row.family,
        priority: score,
        fireAt,
        vars: row.vars,
        route: row.route,
        decisionId: id,
        signalHash: engageSignalHash(row.family, live, { key: row.key, entityId, candidateType: row.candidateType }),
        entityId,
        validUntil: fireAt.getTime() + 18 * 3_600_000,
        candidateType: row.candidateType,
      });
    }
  }

  // Every day gets the same budget — tomorrow too, when nobody opens the app to re-plan it: at most
  // `cap` notifications, one of each kind, at least 90 minutes apart. The birthday wish always goes.
  const byDay = new Map<string, EngageCandidate[]>();
  for (const row of pool) {
    const day = ymd(row.fireAt);
    byDay.set(day, [...(byDay.get(day) ?? []), row]);
  }
  const accepted: EngageCandidate[] = [];
  const holdBack = (row: EngageCandidate, reason: string) => {
    const hit = decisions.find((item) => item.id === row.decisionId);
    if (!hit) return;
    hit.decision = 'SKIP';
    hit.blocked = reason;
    hit.reason = reason;
    hit.fireAt = null;
    hit.scheduledAt = null;
  };
  for (const [day, rows] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sentThatDay = snap.sent.filter((row) => row.ymd === day);
    let remaining = Math.max(0, cap - sentThatDay.length);
    const kinds = new Set(sentThatDay.map((row) => engageKindOf(row.family, row.key)));
    const times = sentThatDay.map((row) => row.at);
    rows.sort((a, b) => b.priority - a.priority || a.fireAt.getTime() - b.fireAt.getTime());
    for (const row of rows) {
      if (row.priority >= 90) {
        accepted.push(row);
        continue;
      }
      const kind = engageKindOf(row.family, row.key);
      if (kinds.has(kind)) holdBack(row, 'same_kind_today');
      else if (times.some((at) => Math.abs(at - row.fireAt.getTime()) < ENGAGE_MIN_GAP_MS)) holdBack(row, 'too_close');
      else if (remaining <= 0) holdBack(row, `adaptive_cap_${cap}`);
      else {
        remaining -= 1;
        kinds.add(kind);
        times.push(row.fireAt.getTime());
        accepted.push(row);
        decisions.find((item) => item.id === row.decisionId)?.suppressions.push(
          'daily cap passed',
          openedRecently ? 'user recently active (non-check-in)' : 'user not recently active',
        );
      }
    }
  }
  accepted.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());

  return {
    accepted,
    trace: {
      at: now.toISOString(),
      fatigue: {
        selectedFrequency: fatigue.selectedFrequency,
        baseDailyCap: fatigue.baseDailyCap,
        adaptiveDailyCap: fatigue.adaptiveDailyCap,
        ewma: fatigue.ewma,
        level: fatigue.level,
        opened: fatigue.opened,
        ignored: fatigue.ignored,
        cap,
        setting: fatigue.selectedFrequency,
      },
      preferredHour,
      decisions,
    },
  };
}

function FAMILY_LABEL(family: EngageFamily): string {
  const hours = cooldownMsForFamily(family) / 3_600_000;
  return hours ? `${hours}h` : 'none';
}

export function evaluateEngageCandidates(snap: EngageSnapshot): EngageCandidate[] {
  return evaluateEngageBrain(snap).accepted;
}

/**
 * One row per plan, not per run. The Brain re-plans on every open (up to once a minute) and used to
 * send ~15 fresh decisions each time — 25 000 rows a week for 200 people, each with a new id, so the
 * notification that fired carried an id no report could follow. A pending plan for a template keeps
 * its id while it moves in time; a skip keeps one id per template, reason and day.
 */
export type EngageDecisionIndexEntry = {
  id: string;
  family: string;
  candidate: string;
  template: string;
  route: string;
  score: number;
  decision: 'SEND' | 'SKIP' | 'CANCELLED';
  reason: string | null;
  createdAt: string;
  /** Planned delivery (ms) for SEND / CANCELLED rows. */
  fireAt: number | null;
  /** decision|reason|fireAt as last synced. */
  state: string;
  synced: boolean;
  /** The phone accepted the scheduled notification. */
  scheduled?: boolean;
};

export type EngageDecisionIndex = Record<string, EngageDecisionIndexEntry>;

/** Families that can have several plans at once (the re-engagement ladder, two insights, two achievements). */
const MULTI_PLAN_FAMILIES: ReadonlySet<string> = new Set(['reengage', 'insight', 'achievement']);

/** The plan slot: one per family, or one per template where a family runs several plans at once. */
function planSlot(family: string, template: string): string {
  return MULTI_PLAN_FAMILIES.has(family) ? `${family}|${template}` : family;
}

export function engageDecisionSignature(decision: Pick<EngageDecision, 'decision' | 'family' | 'template' | 'reason'>, now: Date): string {
  return decision.decision === 'SEND'
    ? `send|${planSlot(decision.family, decision.template)}`
    : `skip|${decision.family}|${decision.template}|${decision.reason ?? ''}|${ymd(now)}`;
}

function decisionState(row: Pick<EngageDecision, 'decision' | 'reason' | 'fireAt' | 'scheduledAt'>): string {
  return `${row.decision}|${row.reason ?? ''}|${row.fireAt ?? row.scheduledAt ?? ''}`;
}

export function stabilizeEngageDecisions(
  result: { accepted: EngageCandidate[]; trace: EngageTrace },
  prior: EngageDecisionIndex,
  now: Date,
): {
  accepted: EngageCandidate[];
  trace: EngageTrace;
  index: EngageDecisionIndex;
  /** Rows the server has not seen in this state yet (new, moved, cancelled). */
  changed: EngageDecision[];
} {
  const nowMs = now.getTime();
  const index: EngageDecisionIndex = {};
  const changed: EngageDecision[] = [];
  const remap = new Map<string, string>();
  const pendingByTemplate = new Map<string, EngageDecisionIndexEntry>();
  for (const entry of Object.values(prior)) {
    if (entry.decision === 'SEND' && entry.fireAt != null && entry.fireAt > nowMs) {
      pendingByTemplate.set(planSlot(entry.family, entry.template), entry);
    }
  }
  const usedPending = new Set<string>();

  for (const decision of result.trace.decisions) {
    const sig = engageDecisionSignature(decision, now);
    let previous: EngageDecisionIndexEntry | undefined = prior[sig];
    if (previous?.decision === 'SEND' && !(previous.fireAt != null && previous.fireAt > nowMs)) previous = undefined;
    // A pending plan that this run holds back becomes that plan's cancellation, not a second row.
    const pending = decision.decision !== 'SEND' ? pendingByTemplate.get(planSlot(decision.family, decision.template)) : undefined;
    if (pending && !usedPending.has(pending.id)) {
      usedPending.add(pending.id);
      remap.set(decision.id, pending.id);
      decision.id = pending.id;
      decision.createdAt = pending.createdAt;
      decision.decision = 'CANCELLED';
      decision.scheduledAt = new Date(pending.fireAt as number).toISOString();
      previous = undefined;
    } else if (previous) {
      if (decision.decision === 'SEND') usedPending.add(previous.id);
      remap.set(decision.id, previous.id);
      decision.id = previous.id;
      decision.createdAt = previous.createdAt;
      // Once a plan was cancelled for a reason, the same skip later that day stays its cancellation.
      if (previous.decision === 'CANCELLED' && decision.decision !== 'SEND') {
        decision.decision = 'CANCELLED';
        decision.scheduledAt = previous.fireAt != null ? new Date(previous.fireAt).toISOString() : null;
      }
    }
    const state = decisionState(decision);
    const synced = Boolean(previous && previous.state === state && previous.synced);
    index[sig] = {
      id: decision.id,
      family: decision.family,
      candidate: decision.candidate,
      template: decision.template,
      route: decision.route,
      score: decision.score,
      decision: decision.decision === 'SEND' ? 'SEND' : decision.decision === 'CANCELLED' ? 'CANCELLED' : 'SKIP',
      reason: decision.reason,
      createdAt: decision.createdAt,
      fireAt: decision.fireAt ? new Date(decision.fireAt).getTime() : decision.scheduledAt ? new Date(decision.scheduledAt).getTime() : null,
      state,
      synced,
      scheduled: false,
    };
    if (!synced) changed.push(decision);
  }

  // A pending plan nobody re-planned or held back: its reason to exist is gone (water logged, draft finished…).
  for (const entry of pendingByTemplate.values()) {
    if (usedPending.has(entry.id)) continue;
    const cancelled: EngageDecision = {
      id: entry.id,
      candidate: entry.candidate,
      family: entry.family as EngageFamily,
      score: entry.score,
      reasons: [],
      suppressions: [],
      blocked: 'no_longer_needed',
      decision: 'CANCELLED',
      template: entry.template,
      route: entry.route,
      fireAt: null,
      createdAt: entry.createdAt,
      scheduledAt: entry.fireAt != null ? new Date(entry.fireAt).toISOString() : null,
      reason: 'no_longer_needed',
    };
    changed.push(cancelled);
    result.trace.decisions.push(cancelled);
  }

  const accepted = result.accepted.map((row) => (remap.has(row.decisionId) ? { ...row, decisionId: remap.get(row.decisionId) as string } : row));
  return { accepted, trace: result.trace, index, changed };
}
