import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { HealthProfile, User } from '@/lib/api';
import { api } from '@/lib/api';
import { loadHydrationGoalMl, loadHydrationLogs, dayTotalMl, todayYmd as hydrationToday, addDaysYmd } from '@/lib/hydration';
import { getCachedHealthBundle } from '@/lib/healthDataSync';
import { loadDoseLogs, parseFrequencyTimes } from '@/lib/medications.shared';
import { categoryForNotification, registerNotificationCategories } from '@/lib/mediNotificationActions';
import {
  appendEngageDecisions,
  loadEngageLastOpenAt,
  loadEngageOpenAt,
  loadEngageOutcomes,
  loadEngagePrefs,
  loadEngageSeen,
  loadEngageSent,
  loadEngageSignals,
  loadUnfinishedDrafts,
  markEngageAppOpen,
  saveEngageSignals,
  saveEngageTrace,
} from '@/lib/mediEngagePrefs';
import type { EngageSnapshot, UnfinishedDraft } from './mediNotificationBrain.shared';
import { evaluateEngageBrain } from './mediNotificationBrain.shared';
import { visitDateTimeMs } from '@/lib/visitReminders';
import { cancelNotificationsByPrefix, ENGAGE_CHANNEL_ID, NOTIF_PREFIX, requestNotificationPermission } from '@/lib/notifications';
import { applyPushCopy } from '@/lib/pushCopy';

export {
  ENGAGE_FAMILIES,
  evaluateEngageBrain,
  evaluateEngageCandidates,
  formatEngageTrace,
  pickCheckinKey,
  pickReengageKey,
} from './mediNotificationBrain.shared';
export type { EngageCandidate, EngageFamily, EngageSnapshot, EngageTrace } from './mediNotificationBrain.shared';
export { revalidateEngageCandidate, fallbackNotificationRoute } from './mediNotificationRevalidate';

type Actor = { user?: User | null; health?: HealthProfile | null };
let lastActor: Actor = {};
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export function rememberEngageActor(user?: User | null, health?: HealthProfile | null): void {
  lastActor = { user, health };
}

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function firstNameOf(user?: User | null): string {
  const raw = user?.fullName?.trim() ?? '';
  return raw.split(/\s+/)[0] || '';
}

function weekRange(end: Date): { thisWeek: string[]; prevWeek: string[] } {
  const endYmd = ymd(end);
  const thisWeek = Array.from({ length: 7 }, (_, i) => addDaysYmd(endYmd, i - 6));
  const prevWeek = Array.from({ length: 7 }, (_, i) => addDaysYmd(endYmd, i - 13));
  return { thisWeek, prevWeek };
}

function pickUnfinished(drafts: UnfinishedDraft[], scheduleGap: UnfinishedDraft | null): UnfinishedDraft | null {
  const real = [...drafts, scheduleGap].filter((row): row is UnfinishedDraft => Boolean(row));
  real.sort((a, b) => b.updatedAt - a.updatedAt);
  return real[0] ?? null;
}

export async function buildEngageSnapshot(user?: User | null, health?: HealthProfile | null): Promise<EngageSnapshot> {
  const now = new Date();
  const today = hydrationToday(now);
  const [prefs, lastOpenAt, sent, seen, logs, goalMl, bundle, doses, outcomes, openAt, drafts] = await Promise.all([
    loadEngagePrefs(),
    loadEngageLastOpenAt(),
    loadEngageSent(),
    loadEngageSeen(),
    loadHydrationLogs(),
    loadHydrationGoalMl(),
    getCachedHealthBundle(),
    loadDoseLogs(),
    loadEngageOutcomes(),
    loadEngageOpenAt(),
    loadUnfinishedDrafts(),
  ]);
  const { thisWeek, prevWeek } = weekRange(now);
  const daily = bundle?.daily ?? [];
  const stepsOn = (days: string[]) =>
    days.reduce((sum, day) => {
      const row = daily.find((item) => item.date === day);
      return sum + (row?.steps && row.steps > 0 ? row.steps : 0);
    }, 0);
  const loggedHealthDays = thisWeek.filter((day) => {
    const row = daily.find((item) => item.date === day);
    return Boolean(row?.steps || row?.weightKg || row?.hydrationMl || row?.sleepHours);
  }).length;
  const medTakenWeek = doses.filter((row) => thisWeek.includes(row.date) && row.status === 'taken').length;
  const medMissedWeek = doses.filter((row) => thisWeek.includes(row.date) && row.status === 'skipped').length;
  const todayRow = daily.find((item) => item.date === today);
  let lastChatAt: number | null = null;
  let lastChatId: string | null = null;
  let lastChatMode: EngageSnapshot['lastChatMode'] = null;
  let recentVisit: EngageSnapshot['recentVisit'] = null;
  let scheduleGap: UnfinishedDraft | null = null;
  try {
    const chats = await api.chats.list();
    const latest = chats?.[0];
    if (latest?.updatedAt) {
      lastChatAt = new Date(latest.updatedAt).getTime();
      lastChatId = latest.id;
      lastChatMode = latest.mode;
    }
  } catch {
    lastChatAt = null;
  }
  try {
    const { visits } = await api.visits.list();
    const past = visits
      .filter((visit) => visit.active && !visit.notes && visitDateTimeMs(visit) < now.getTime())
      .map((visit) => ({
        id: visit.id,
        hoursAgo: (now.getTime() - visitDateTimeMs(visit)) / 3_600_000,
      }))
      .filter((row) => row.hoursAgo >= 3 && row.hoursAgo <= 36)
      .sort((a, b) => a.hoursAgo - b.hoursAgo);
    recentVisit = past[0] ?? null;
  } catch {
    recentVisit = null;
  }
  try {
    const { medications } = await api.medications.list();
    const incomplete = medications.find((med) => parseFrequencyTimes(med.frequency || '').length === 0);
    if (incomplete) {
      scheduleGap = {
        kind: 'medication_schedule',
        route: `/medications/${incomplete.id}`,
        name: incomplete.medName,
        updatedAt: new Date(incomplete.createdAt || now).getTime(),
      };
    }
  } catch {
    scheduleGap = null;
  }
  const missing: EngageSnapshot['missingProfileField'] = !health?.bloodType
    ? 'bloodType'
    : health.heightCm == null
      ? 'heightCm'
      : !user?.phone
        ? 'phone'
        : null;
  return {
    now,
    lastOpenAt,
    firstName: firstNameOf(user),
    birthDate: user?.birthDate ?? null,
    createdAt: user?.createdAt ?? null,
    todaySteps: todayRow?.steps && todayRow.steps > 0 ? todayRow.steps : null,
    weekSteps: stepsOn(thisWeek),
    prevWeekSteps: stepsOn(prevWeek),
    hydrationMl: dayTotalMl(logs, today),
    hydrationGoal: goalMl,
    loggedPain: await detectLoggedPain(user, today),
    streak: user?.currentStreak ?? 0,
    loggedHealthDays,
    medTakenWeek,
    medMissedWeek,
    missingProfileField: missing,
    lastChatAt,
    lastChatId,
    lastChatMode,
    cycleRegular: false,
    seenWeekly: Boolean(seen.weekly),
    unfinished: pickUnfinished(drafts, scheduleGap),
    recentVisit,
    openAt,
    outcomes,
    sent,
    prefs,
  };
}

async function detectLoggedPain(user: User | null | undefined, today: string): Promise<boolean> {
  if (!user?.id) return false;
  try {
    const { loadCycleView } = await import('@/lib/cycleOffline');
    const view = await loadCycleView(user.id);
    const log = view.display.logs.find((row) => row.date === today);
    return Boolean(log?.painEntries?.length);
  } catch {
    return false;
  }
}

export async function runMediNotificationBrain(
  user?: User | null,
  health?: HealthProfile | null,
  opts: { markOpen?: boolean } = {},
): Promise<number> {
  if (Platform.OS === 'web') return 0;
  rememberEngageActor(user, health);
  const granted = await requestNotificationPermission();
  if (!granted) {
    if (opts.markOpen !== false) await markEngageAppOpen();
    return 0;
  }
  await registerNotificationCategories();
  const snap = await buildEngageSnapshot(user ?? lastActor.user, health ?? lastActor.health);
  if (opts.markOpen !== false) await markEngageAppOpen();
  const { accepted, trace } = evaluateEngageBrain(snap);
  await saveEngageTrace(trace);
  await appendEngageDecisions(trace.decisions);
  void syncEngageDecisionsToServer(trace);
  await saveEngageSignals({
    hydrationMl: snap.hydrationMl,
    hydrationGoal: snap.hydrationGoal,
    loggedPain: snap.loggedPain,
    seenWeekly: snap.seenWeekly,
    unfinished: snap.unfinished,
    lastOpenAt: snap.lastOpenAt,
    missingProfileField: snap.missingProfileField,
    recentVisitId: snap.recentVisit?.id ?? null,
    medMissedWeek: snap.medMissedWeek,
    todaySteps: snap.todaySteps,
    prevWeekSteps: snap.prevWeekSteps,
  });
  await cancelNotificationsByPrefix(NOTIF_PREFIX.engage);
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ENGAGE_CHANNEL_ID, {
      name: 'Medi',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 160, 100, 160],
      lightColor: '#14B8A6',
      sound: 'default',
    });
  }
  let scheduled = 0;
  for (const row of accepted) {
    if (row.fireAt.getTime() <= Date.now() + 45_000) continue;
    const copy = snap.prefs.discreet ? applyPushCopy('engage-masked', row.vars) : applyPushCopy(row.key, row.vars);
    const id = `${NOTIF_PREFIX.engage}${row.key}:${ymd(row.fireAt)}`;
    const categoryIdentifier = snap.prefs.discreet ? undefined : categoryForNotification('medi_engage', row.family);
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: copy.title,
        body: copy.body,
        sound: 'default',
        ...(categoryIdentifier ? { categoryIdentifier } : {}),
        data: {
          type: 'medi_engage',
          templateKey: row.key,
          family: row.family,
          route: row.route,
          decisionId: row.decisionId,
          signalHash: row.signalHash,
          entityId: row.entityId ?? '',
          validUntil: row.validUntil ?? 0,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: row.fireAt,
        ...(Platform.OS === 'android' ? { channelId: ENGAGE_CHANNEL_ID } : {}),
      },
    });
    scheduled += 1;
  }
  return scheduled;
}

export function requestEngageRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void runMediNotificationBrain(lastActor.user, lastActor.health, { markOpen: false });
  }, 450);
}

export async function shouldDeliverNotification(data: Record<string, unknown> | undefined | null): Promise<{
  ok: boolean;
  reason: string | null;
}> {
  if (!data || typeof data !== 'object') return { ok: true, reason: null };
  const { revalidateEngageCandidate } = await import('./mediNotificationRevalidate');
  const { findDoseLog, loadDoseLogs } = await import('@/lib/medications.shared');
  const { dayTotalMl, loadHydrationGoalMl, loadHydrationLogs, todayYmd } = await import('@/lib/hydration');
  const cached = await loadEngageSignals();
  const [prefs, sent, seen, drafts, lastOpenAt, hydro, goal, doses] = await Promise.all([
    loadEngagePrefs(),
    loadEngageSent(),
    loadEngageSeen(),
    loadUnfinishedDrafts(),
    loadEngageLastOpenAt(),
    loadHydrationLogs(),
    loadHydrationGoalMl(),
    loadDoseLogs(),
  ]);
  const today = todayYmd();
  const time = typeof data.time === 'string' ? data.time : '';
  const medicationId = typeof data.medicationId === 'string' ? data.medicationId : '';
  const live = {
    now: new Date(),
    hydrationMl: dayTotalMl(hydro, today),
    hydrationGoal: goal,
    loggedPain: cached?.loggedPain ?? false,
    seenWeekly: Boolean(seen.weekly),
    unfinished: drafts[0] ?? cached?.unfinished ?? null,
    lastOpenAt,
    missingProfileField: cached?.missingProfileField ?? null,
    recentVisitId: cached?.recentVisitId ?? null,
    medMissedWeek: cached?.medMissedWeek ?? 0,
    todaySteps: cached?.todaySteps ?? null,
    prevWeekSteps: cached?.prevWeekSteps ?? 0,
    sent,
    doseTaken: Boolean(medicationId && time && findDoseLog(doses, medicationId, today, time)?.status === 'taken'),
  };
  void prefs;
  return revalidateEngageCandidate(
    {
      type: typeof data.type === 'string' ? data.type : undefined,
      family: typeof data.family === 'string' ? data.family : undefined,
      templateKey: typeof data.templateKey === 'string' ? data.templateKey : undefined,
      signalHash: typeof data.signalHash === 'string' ? data.signalHash : undefined,
      entityId: typeof data.entityId === 'string' ? data.entityId : undefined,
      validUntil: typeof data.validUntil === 'number' ? data.validUntil : undefined,
      medicationId,
      time,
    },
    live,
  );
}

async function syncEngageDecisionsToServer(trace: {
  decisions: Array<{
    id: string;
    candidate: string;
    family: string;
    score: number;
    decision: string;
    reason: string | null;
    blocked: string | null;
    template: string;
    route: string;
    createdAt: string;
    scheduledAt: string | null;
    fireAt: string | null;
    revalidatedAt?: string;
  }>;
  fatigue: {
    selectedFrequency: string;
    baseDailyCap: number;
    adaptiveDailyCap: number;
    ewma: number;
  };
}): Promise<void> {
  try {
    await api.push.syncDecisions({
      decisions: trace.decisions.map((row) => ({
        id: row.id,
        candidate: row.candidate,
        family: row.family,
        score: row.score,
        decision: row.decision,
        reason: row.reason,
        blocked: row.blocked,
        template: row.template,
        route: row.route,
        createdAt: row.createdAt,
        scheduledAt: row.scheduledAt,
        fireAt: row.fireAt,
        revalidatedAt: row.revalidatedAt,
      })),
      fatigue: {
        selectedFrequency: trace.fatigue.selectedFrequency,
        baseDailyCap: trace.fatigue.baseDailyCap,
        adaptiveDailyCap: trace.fatigue.adaptiveDailyCap,
        ewma: trace.fatigue.ewma,
      },
    });
  } catch {
    /* admin sync is best-effort */
  }
}
