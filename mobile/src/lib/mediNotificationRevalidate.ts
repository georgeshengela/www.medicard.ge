import { cooldownMsForFamily } from './mediEngageModel.ts';
import { revalidateQuestSmart, QUEST_SMART_REASON } from './quest/questSmartEngage.js';

export type EngageSentLike = { key: string; family: string; at: number; ymd: string };
export type UnfinishedLike = { kind: string; route: string; name?: string; updatedAt: number };

export type EngageLiveSignals = {
  now: Date;
  hydrationMl: number;
  hydrationGoal: number;
  loggedPain: boolean;
  seenWeekly: boolean;
  unfinished: UnfinishedLike | null;
  lastOpenAt: number | null;
  missingProfileField: string | null;
  recentVisitId: string | null;
  medMissedWeek: number;
  todaySteps: number | null;
  prevWeekSteps: number;
  sent: EngageSentLike[];
  doseTaken?: boolean;
  stepsGoalReached?: boolean;
  weatherWindowGone?: boolean;
  weatherRainChanged?: boolean;
  weatherCandidate?: string | null;
  /** Phase 6 Quest Smart live revalidation */
  daily?: Array<{
    id: string;
    key: string | null;
    progressType: string | null;
    cadence?: string | null;
    status: string;
    progress: number;
    target: number;
    progressPercent: number;
    targetSource?: string | null;
  }>;
  weekly?: Array<{
    id: string;
    key: string | null;
    progressType: string | null;
    cadence?: string | null;
    status: string;
    progress: number;
    target: number;
    progressPercent: number;
    targetSource?: string | null;
  }>;
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
  weatherWindowChanged?: boolean;
  smartQuestSentToday?: boolean;
  openedRecently?: boolean;
};

export type EngagePayload = {
  type?: string;
  family?: string;
  templateKey?: string;
  key?: string;
  signalHash?: string;
  entityId?: string;
  validUntil?: number;
  medicationId?: string;
  time?: string;
  candidateType?: string;
  questSmartType?: string;
};

export function newDecisionId(now = Date.now(), salt = Math.random()): string {
  return `notif_dec_${now.toString(36)}${Math.floor(salt * 1e9).toString(36)}`;
}

export function engageSignalHash(
  family: string,
  live: Pick<
    EngageLiveSignals,
    'hydrationMl' | 'hydrationGoal' | 'loggedPain' | 'seenWeekly' | 'unfinished' | 'recentVisitId' | 'missingProfileField' | 'todaySteps'
  >,
  extra?: { key?: string; entityId?: string; candidateType?: string },
): string {
  switch (family) {
    case 'hydration':
      return `hydration:${live.hydrationMl}/${live.hydrationGoal}`;
    case 'stepsQuiet':
      return `steps:${live.todaySteps ?? 0}:pain:${live.loggedPain ? 1 : 0}`;
    case 'unfinished':
      return `draft:${live.unfinished?.kind ?? 'none'}:${live.unfinished?.updatedAt ?? 0}`;
    case 'visitFollowup':
      return `visit:${extra?.entityId ?? live.recentVisitId ?? 'none'}`;
    case 'question':
      return `question:${live.missingProfileField ?? 'none'}`;
    case 'weekly':
      return `weekly:${live.seenWeekly ? 1 : 0}`;
    case 'achievement':
      return `achieve:${extra?.key ?? ''}`;
    case 'weatherWellness':
      return `weather:${extra?.key ?? ''}:pain:${live.loggedPain ? 1 : 0}`;
    case 'questSmart':
      return `questSmart:${extra?.candidateType || extra?.key || ''}:pain:${live.loggedPain ? 1 : 0}`;
    default:
      return `${family}:${extra?.key ?? ''}`;
  }
}

function sentKeySince(sent: EngageSentLike[], key: string, since: number): boolean {
  return sent.some((row) => row.key === key && row.at >= since);
}

function lastFamilyAt(sent: EngageSentLike[], family: string): number | null {
  const row = sent.filter((item) => item.family === family).sort((a, b) => b.at - a.at)[0];
  return row?.at ?? null;
}

export function revalidateEngageCandidate(payload: EngagePayload, live: EngageLiveSignals): { ok: boolean; reason: string | null } {
  const family = String(payload.family || '');
  const key = String(payload.templateKey || payload.key || '');
  const now = live.now.getTime();

  if (payload.type === 'medication') {
    return live.doseTaken
      ? { ok: false, reason: 'dose_already_taken' }
      : { ok: true, reason: null };
  }

  if (typeof payload.validUntil === 'number' && payload.validUntil > 0 && now > payload.validUntil) {
    return { ok: false, reason: 'valid_until_expired' };
  }

  if (family === 'hydration') {
    if (live.hydrationGoal > 0 && live.hydrationMl >= live.hydrationGoal * 0.7) {
      return { ok: false, reason: 'hydration_target_reached_after_scheduling' };
    }
  }

  if (family === 'weatherWellness') {
    if (live.lastOpenAt && now - live.lastOpenAt < 90 * 60_000) {
      return { ok: false, reason: 'user_recently_active' };
    }
    if (key === 'engage-weather-walk' && live.loggedPain) {
      return { ok: false, reason: 'pain_logged_after_scheduling' };
    }
    if (key === 'engage-weather-walk' && live.stepsGoalReached) {
      return { ok: false, reason: 'steps_goal_reached_after_scheduling' };
    }
    if (key === 'engage-weather-hot' && live.hydrationGoal > 0 && live.hydrationMl >= live.hydrationGoal * 0.7) {
      return { ok: false, reason: 'hydration_target_reached_after_scheduling' };
    }
    if (live.weatherWindowGone) return { ok: false, reason: 'weather_window_no_longer_good' };
    if (live.weatherRainChanged) return { ok: false, reason: 'rain_forecast_changed' };
  }

  if (family === 'stepsQuiet') {
    if (live.loggedPain) return { ok: false, reason: 'pain_logged_after_scheduling' };
    const lowBar = live.prevWeekSteps > 0 ? Math.max(1200, Math.round(live.prevWeekSteps / 14)) : 1500;
    if (live.todaySteps != null && live.todaySteps >= lowBar) {
      return { ok: false, reason: 'steps_no_longer_low' };
    }
  }

  if (family === 'checkin' && live.lastOpenAt && now - live.lastOpenAt < 90 * 60_000) {
    return { ok: false, reason: 'user_recently_active' };
  }

  if (family === 'unfinished') {
    if (!live.unfinished) return { ok: false, reason: 'draft_completed' };
    if (now - live.unfinished.updatedAt < 3 * 3_600_000) return { ok: false, reason: 'draft_completed' };
  }

  if (family === 'visitFollowup') {
    const id = payload.entityId || null;
    if (!live.recentVisitId || (id && id !== live.recentVisitId)) {
      return { ok: false, reason: 'visit_canceled_or_gone' };
    }
  }

  if (family === 'question' && !live.missingProfileField) {
    return { ok: false, reason: 'profile_question_answered' };
  }

  if (family === 'weekly') {
    if (live.seenWeekly) return { ok: false, reason: 'weekly_already_opened' };
    if (sentKeySince(live.sent, 'engage-weekly', now - 6 * 86_400_000)) {
      return { ok: false, reason: 'weekly_already_sent' };
    }
  }

  if (family === 'achievement' && key && sentKeySince(live.sent, key, now - 7 * 86_400_000)) {
    return { ok: false, reason: 'achievement_already_sent' };
  }

  if (family === 'questSmart') {
    const todayYmd = `${live.now.getFullYear()}-${String(live.now.getMonth() + 1).padStart(2, '0')}-${String(live.now.getDate()).padStart(2, '0')}`;
    const smartQuestSentToday = live.sent.some((row) => row.family === 'questSmart' && row.ymd === todayYmd);
    const result = revalidateQuestSmart(
      {
        templateKey: key,
        candidateType: payload.candidateType || payload.questSmartType,
      },
      {
        now: live.now,
        lastOpenAt: live.lastOpenAt,
        openedRecently: live.openedRecently,
        loggedPain: live.loggedPain,
        daily: live.daily || [],
        weekly: live.weekly || [],
        weather: live.weather || null,
        weatherWindowChanged: live.weatherWindowChanged,
        smartQuestSentToday,
      },
    );
    if (!result.ok) return result;
    const coolQs = cooldownMsForFamily('questSmart');
    const lastQs = lastFamilyAt(live.sent, 'questSmart');
    if (coolQs && lastQs && now - lastQs < coolQs) {
      return { ok: false, reason: QUEST_SMART_REASON.QUEST_FAMILY_COOLDOWN };
    }
    return { ok: true, reason: null };
  }

  if (key === 'engage-insight-meds' && live.medMissedWeek < 3) {
    return { ok: false, reason: 'misses_below_threshold' };
  }

  const cool = cooldownMsForFamily(family);
  const last = lastFamilyAt(live.sent, family);
  if (cool && last && now - last < cool) {
    return { ok: false, reason: `${family}_cooldown` };
  }

  return { ok: true, reason: null };
}

export function fallbackNotificationRoute(route: string | null | undefined, exists = true): string {
  if (!exists) {
    if (route?.startsWith('/medications/')) return '/medications';
    if (route?.startsWith('/visits/')) return '/visits';
    if (route?.startsWith('/chat/')) return '/chat/DOCTOR';
  }
  return route && route.startsWith('/') ? route : '/(tabs)/home';
}
