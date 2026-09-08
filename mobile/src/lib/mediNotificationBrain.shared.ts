import {
  bumpOutOfQuiet,
  cooldownMsForFamily,
  computeEngageFatigue,
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
  streak: { priority: 35, topic: 'checkin' as EngageTopic },
  chat: { priority: 33, topic: 'chatFollowup' as EngageTopic },
  morning: { priority: 32, topic: 'morning' as EngageTopic },
  checkin: { priority: 30, topic: 'checkin' as EngageTopic },
  sleep: { priority: 28, topic: 'sleep' as EngageTopic },
  question: { priority: 25, topic: 'question' as EngageTopic },
  feature: { priority: 10, topic: 'feature' as EngageTopic },
  weatherWellness: { priority: 42, topic: 'weather' as EngageTopic },
} as const;

export type EngageFamily = keyof typeof ENGAGE_FAMILIES;

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
  streak: number;
  loggedHealthDays: number;
  medTakenWeek: number;
  medMissedWeek: number;
  missingProfileField: 'bloodType' | 'heightCm' | 'phone' | null;
  lastChatAt: number | null;
  lastChatId: string | null;
  lastChatMode: 'DOCTOR' | 'CONSILIUM' | null;
  cycleRegular: boolean;
  cyclePrivacyEnabled?: boolean;
  seenWeekly: boolean;
  unfinished: UnfinishedDraft | null;
  recentVisit: { id: string; hoursAgo: number } | null;
  openAt: number[];
  outcomes: EngageOutcome[];
  sent: EngageSentRow[];
  prefs: MediEngagePrefs;
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
  decision: 'SEND' | 'SKIP' | 'BLOCKED';
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

function sameYmd(a: Date, b: Date): boolean {
  return ymd(a) === ymd(b);
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

function sentFamilySince(sent: EngageSentRow[], family: string, since: number): boolean {
  return sent.some((row) => row.family === family && row.at >= since);
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

export function pickCheckinKey(now: Date): string {
  const hour = now.getHours();
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

function scheduleAt(now: Date, prefs: MediEngagePrefs, hour: number, minute: number, dayOffset = 0): Date {
  const raw = atHour(addDays(now, dayOffset), hour, minute);
  const bumped = bumpOutOfQuiet(raw, prefs.quietStart, prefs.quietEnd);
  return bumped.getTime() > now.getTime() + 60_000 ? bumped : addDays(bumped, 1);
}

function applyWindow(now: Date, prefs: MediEngagePrefs, family: EngageFamily, fireAt: Date, preferredHour: number | null): Date {
  let next = fireAt;
  if (preferredHour != null && PREFERRED_WINDOW_FAMILIES.has(family)) {
    next = shiftToPreferredHour(fireAt, preferredHour);
    if (next.getTime() <= now.getTime() + 60_000) next = addDays(next, 1);
  }
  return bumpOutOfQuiet(next, prefs.quietStart, prefs.quietEnd);
}

function unfinishedCopy(draft: UnfinishedDraft): { key: string; vars: Record<string, string | number> } {
  if (draft.kind === 'medication_add' || draft.kind === 'medication_schedule') {
    return { key: 'engage-unfinished-med', vars: { name: draft.name || '' } };
  }
  return { key: 'engage-unfinished', vars: { task: draft.name || '' } };
}

function laterKeep(family: EngageFamily): boolean {
  return (
    family === 'reengage' ||
    family === 'weekly' ||
    family === 'morning' ||
    family === 'birthday' ||
    family === 'sleep' ||
    family === 'insight' ||
    family === 'achievement' ||
    family === 'checkin' ||
    family === 'question' ||
    family === 'unfinished' ||
    family === 'visitFollowup' ||
    family === 'chat' ||
    family === 'feature' ||
    family === 'weatherWellness' ||
    family === 'questSmart'
  );
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
  const cap = fatigue.adaptiveDailyCap;
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
      vars: { steps: snap.weekSteps.toLocaleString('ka-GE') },
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
      vars: { steps: snap.weekSteps.toLocaleString('ka-GE') },
      route: engageDestination('achievement', { insight: 'steps' }),
      reasons: ['50k steps this week', 'once per achievement'],
    });
  }
  if (snap.streak >= 30 && !sentKeySince(snap.sent, 'engage-achieve-month', now.getTime() - 28 * 86_400_000)) {
    attempts.push({
      key: 'engage-achieve-month',
      family: 'achievement',
      fireAt: scheduleAt(now, prefs, 10, 30, 1),
      vars: {},
      route: '/profile/streak',
      reasons: ['30-day streak', 'once per achievement'],
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

  const hydroPct = snap.hydrationGoal > 0 ? Math.round((snap.hydrationMl / snap.hydrationGoal) * 100) : 0;
  if (snap.hydrationMl < snap.hydrationGoal * 0.7 && hour < 20) {
    attempts.push({
      key: hour >= 16 ? 'engage-hydration-low' : 'engage-hydration',
      family: 'hydration',
      fireAt: scheduleAt(now, prefs, Math.max(hour + 1, 15), 0, 0),
      vars: {},
      route: engageDestination('hydration'),
      reasons: [`hydration ${hydroPct}% of target`, openedToday ? 'user active today' : 'user not recently active'],
    });
  } else if (snap.hydrationMl >= snap.hydrationGoal * 0.7) {
    skip('hydration', 'engage-hydration', 'hydration target not reached is false — already at/above 70%', engageDestination('hydration'), [
      `hydration ${hydroPct}% of target`,
    ]);
  }

  const lowBar = snap.prevWeekSteps > 0 ? Math.max(1200, Math.round(snap.prevWeekSteps / 14)) : 1500;
  if (snap.loggedPain) {
    skip('stepsQuiet', 'engage-steps-quiet', 'pain logged today', engageDestination('stepsQuiet'));
  } else if (snap.todaySteps != null && snap.todaySteps < lowBar && hour < 19) {
    attempts.push({
      key: 'engage-steps-quiet',
      family: 'stepsQuiet',
      fireAt: scheduleAt(now, prefs, 18, 0, 0),
      vars: { steps: snap.todaySteps.toLocaleString('ka-GE') },
      route: engageDestination('stepsQuiet'),
      reasons: [`today steps ${snap.todaySteps} below usual`, 'no pain logged'],
    });
  }

  if (snap.streak === 6 || snap.loggedHealthDays === 6) {
    attempts.push({
      key: 'engage-streak-continue',
      family: 'streak',
      fireAt: scheduleAt(now, prefs, 19, 10, 0),
      vars: {},
      route: '/profile/streak',
      reasons: ['6-day logging streak'],
    });
  } else if (snap.streak === 7) {
    attempts.push({
      key: 'engage-streak-week',
      family: 'streak',
      fireAt: scheduleAt(now, prefs, 10, 0, 1),
      vars: {},
      route: '/profile/streak',
      reasons: ['7 days together'],
    });
  }

  if (!openedRecently && !openedToday) {
    attempts.push({
      key: pickCheckinKey(now),
      family: 'checkin',
      fireAt: scheduleAt(now, prefs, hour < 12 ? 9 : hour < 18 ? 16 : 20, 15, 0),
      vars: {},
      route: engageDestination('checkin'),
      reasons: [`${minutesSinceOpen} min since last open`, 'optional check-in'],
    });
  } else if (!openedRecently) {
    attempts.push({
      key: 'engage-checkin-morning',
      family: 'checkin',
      fireAt: scheduleAt(now, prefs, 9, 10, 1),
      vars: {},
      route: engageDestination('checkin'),
      reasons: ['already opened today — schedule tomorrow morning'],
    });
  } else {
    skip('checkin', pickCheckinKey(now), 'user recently active', engageDestination('checkin'), [
      `opened ${minutesSinceOpen} min ago`,
    ]);
  }

  const morningDay = weekdayMon(addDays(now, 1));
  const morningDays = prefs.frequency === 'often' ? [0, 2, 4, 6] : [0, 2, 4];
  if (morningDays.includes(morningDay)) {
    attempts.push({
      key: morningDay === 4 ? 'engage-morning-wish' : 'engage-morning',
      family: 'morning',
      fireAt: scheduleAt(now, prefs, 8, 20, 1),
      vars: { firstName: snap.firstName },
      route: morningDay === 4 ? '/(tabs)/home' : engageDestination('morning'),
      reasons: ['personalized good morning 2–3×/week'],
    });
  }

  if ([0, 2, 5].includes(weekdayMon(now)) || prefs.frequency === 'often') {
    attempts.push({
      key: 'engage-sleep',
      family: 'sleep',
      fireAt: scheduleAt(now, prefs, 21, 10, hour >= 21 ? 1 : 0),
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

  if (!snap.seenWeekly && prefs.topics.feature) {
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
      fireAt: scheduleAt(now, prefs, Math.max(hour + 1, 16), 0, 0),
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
    if (openedRecently) {
      skip('weatherWellness', weatherKey, 'user recently active', engageDestination('weatherWellness'), [
        `${snap.weather.candidate}`,
      ]);
    } else if (snap.loggedPain && snap.weather.candidate === 'weather_good_walk') {
      skip('weatherWellness', weatherKey, 'pain logged today', engageDestination('weatherWellness'));
    } else {
      let fireAt = scheduleAt(now, prefs, Math.max(hour + 1, 11), 20, 0);
      if (snap.weather.candidate === 'weather_good_walk' && snap.weather.windowStartIso) {
        const windowHour = Number(String(snap.weather.windowStartIso).slice(11, 13));
        if (Number.isFinite(windowHour)) {
          fireAt = scheduleAt(now, prefs, Math.max(0, windowHour), 0, 0);
          fireAt = new Date(fireAt.getTime() - 30 * 60_000);
        }
        if (fireAt.getTime() <= now.getTime() + 60_000) fireAt = new Date(now.getTime() + 20 * 60_000);
      }
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
    let blocked: string | null = null;
    if (!topicOn(prefs, row.family)) blocked = 'topic off';
    else if (prefs.frequency === 'rare' && !rareAllows(row.family)) blocked = 'rare frequency';
    else if (sentFamilyOn(snap.sent, row.family, ymd(row.fireAt)) && row.family !== 'reengage') blocked = 'already sent this family today';
    else {
      const cool = cooldownMsForFamily(row.family);
      const last = lastFamilyAt(snap.sent, row.family);
      if (cool && last && now.getTime() - last < cool) {
        blocked = `${row.family} cooldown (${FAMILY_LABEL(row.family)})`;
      } else if (cool && last) {
        suppressions.push(`no ${row.family} push in last ${Math.round(cool / 3_600_000)}h`);
      }
    }
    if (!blocked && row.family === 'feature' && sentKeySince(snap.sent, row.key, now.getTime() - 120 * 86_400_000)) {
      blocked = 'once per campaign';
    }
    const fireAt = applyWindow(now, prefs, row.family, row.fireAt, preferredHour);
    if (preferredHour != null && PREFERRED_WINDOW_FAMILIES.has(row.family)) {
      row.reasons.push('preferred window match');
    }
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

  const todayRows = pool.filter((row) => sameYmd(row.fireAt, now)).sort((a, b) => b.priority - a.priority);
  const later = pool.filter((row) => !sameYmd(row.fireAt, now) && laterKeep(row.family));
  const sentToday = snap.sent.filter((row) => row.ymd === today).length;
  const remaining = Math.max(0, cap - sentToday);
  const keptToday: EngageCandidate[] = [];
  for (const row of todayRows) {
    if (row.priority >= 90 || keptToday.length < remaining) {
      keptToday.push(row);
      const hit = decisions.find((item) => item.template === row.key && item.decision === 'SEND' && item.fireAt === row.fireAt.toISOString());
      if (hit) hit.suppressions.push('daily cap passed', openedRecently ? 'user recently active (non-check-in)' : 'user not recently active');
    } else {
      const hit = decisions.find((item) => item.template === row.key && item.decision === 'SEND');
      if (hit) {
        hit.decision = 'SKIP';
        hit.blocked = `adaptive_cap_${cap}`;
        hit.reason = `adaptive_cap_${cap}`;
        hit.fireAt = null;
        hit.scheduledAt = null;
      }
    }
  }

  const accepted = [...keptToday, ...later.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())];
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
