import type { EngageLiveSignals } from './mediNotificationRevalidate';
import { Platform } from 'react-native';
import { Notifications } from '@/lib/expoNotifications';
import type { HealthProfile, User } from '@/lib/api';
import { api } from '@/lib/api';
import { loadHydrationGoalMl, loadHydrationLogs, dayTotalMl, todayYmd as hydrationToday, addDaysYmd } from '@/lib/hydration';
import { getCachedHealthBundle } from '@/lib/healthDataSync';
import { loadDoseLogs, parseFrequencyTimes } from '@/lib/medications.shared';
import { categoryForNotification, registerNotificationCategories } from '@/lib/mediNotificationActions';
import {
  appendEngageDecisions,
  loadEngageDecisionIndex,
  loadEngageHandled,
  loadEngageLastOpenAt,
  loadEngageOpenAt,
  loadEngageOutcomes,
  loadEngagePrefs,
  loadEngageSeen,
  loadEngageSent,
  loadEngageSignals,
  loadUnfinishedDrafts,
  markEngageAppOpen,
  recordEngageOutcome,
  recordEngageSent,
  saveEngageDecisionIndex,
  saveEngageSignals,
  saveEngageTrace,
  weeklySeenState,
} from '@/lib/mediEngagePrefs';
import type { EngageDecision, EngageDecisionIndex, EngageFamily, EngageSnapshot, UnfinishedDraft } from './mediNotificationBrain.shared';
import { ENGAGE_FAMILIES, evaluateEngageBrain, stabilizeEngageDecisions } from './mediNotificationBrain.shared';
import { hydrateFeatureFlags, isEngageFamilyOn, isFeatureOn } from '@/lib/featureFlags';
import { sleepBedtimeRemindersScheduled } from '@/lib/sleep/sleepReminders';
import { brainConfig, brainFamilyBlock, hydrateBrainConfig } from '@/lib/brainRemoteConfig';
import { visitDateTimeMs } from '@/lib/visitReminders';
import { cancelNotificationsByPrefix, ENGAGE_CHANNEL_ID, NOTIF_PREFIX, getNotificationPermissionGranted } from '@/lib/notifications';
import { applyPushCopy } from '@/lib/pushCopy';
import { displayFirstName } from '@/lib/displayName';
import { localAccountId } from '@/lib/localAccount';

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

function weekRange(end: Date): { thisWeek: string[]; prevWeek: string[] } {
  const endYmd = ymd(end);
  const thisWeek = Array.from({ length: 7 }, (_, i) => addDaysYmd(endYmd, i - 6));
  const prevWeek = Array.from({ length: 7 }, (_, i) => addDaysYmd(endYmd, i - 13));
  return { thisWeek, prevWeek };
}

/**
 * Families the admin keeps quiet: switched off in Push → Brain „მართვა“ (`admin_off`), or the module
 * behind them is paused in „მოდულები“ (weather tips, the weekly report, the after-visit question, water
 * and quiet-steps nudges → `module_paused`). The brain picks something else for the day; the person's
 * own choices stay untouched. Medication and visit reminders are not engage families and keep firing.
 */
function adminBlockedFamilies(): Partial<Record<string, string>> {
  const blocked: Partial<Record<string, string>> = {};
  for (const family of Object.keys(ENGAGE_FAMILIES) as EngageFamily[]) {
    const admin = brainFamilyBlock(family);
    if (admin) blocked[family] = admin;
    else if (!isEngageFamilyOn(family)) blocked[family] = 'module_paused';
  }
  return blocked;
}

function pickUnfinished(drafts: UnfinishedDraft[], scheduleGap: UnfinishedDraft | null): UnfinishedDraft | null {
  const real = [...drafts, scheduleGap].filter((row): row is UnfinishedDraft => Boolean(row));
  real.sort((a, b) => b.updatedAt - a.updatedAt);
  return real[0] ?? null;
}

export async function buildEngageSnapshot(user?: User | null, health?: HealthProfile | null): Promise<EngageSnapshot> {
  const now = new Date();
  const today = hydrationToday(now);
  // A cold start can run the brain before the switches load; the last known answer is enough.
  await Promise.all([hydrateFeatureFlags(), hydrateBrainConfig()]);
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
  const medTakenWeek = doses.filter((row) => thisWeek.includes(row.date) && row.status === 'taken').length;
  const medMissedWeek = doses.filter((row) => thisWeek.includes(row.date) && row.status === 'skipped').length;
  const todayRow = daily.find((item) => item.date === today);
  let lastChatAt: number | null = null;
  let lastChatId: string | null = null;
  let lastChatMode: EngageSnapshot['lastChatMode'] = null;
  let recentVisit: EngageSnapshot['recentVisit'] = null;
  let scheduleGap: UnfinishedDraft | null = null;
  try {
    const { sessions } = await api.chats.list();
    // Consultation nudges follow clinical chats only, not Medi action conversations.
    const latest = sessions?.find((row) => row.mode === 'DOCTOR' || row.mode === 'CONSILIUM');
    if (latest?.updatedAt && (latest.mode === 'DOCTOR' || latest.mode === 'CONSILIUM')) {
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
  const { loggedPain, cyclePrivacyEnabled } = await detectLoggedPain(user, today);
  let weather: EngageSnapshot['weather'] = null;
  try {
    const { loadWeatherEngageSignal } = await import('@/lib/weather/engage');
    weather = await loadWeatherEngageSignal({
      profile: health,
      userKey: user?.id ?? null,
      loggedPain,
    });
  } catch {
    weather = null;
  }
  let quest: EngageSnapshot['quest'] = null;
  try {
    const { readQuestCache } = await import('@/lib/quest/cache');
    const cached = await readQuestCache();
    const dash = cached?.dashboard;
    if (dash && !dash.unavailable) {
      let questWeather: NonNullable<EngageSnapshot['quest']>['weather'] = null;
      try {
        const { readDevQuestWeather } = await import('@/lib/weather/devFixture');
        const devWx = readDevQuestWeather(now);
        if (devWx !== undefined) {
          questWeather = devWx ? { ...devWx, stale: false } : null;
        } else {
          const { loadWeatherWellnessContext } = await import('@/lib/weather/context');
          const { getWeatherWellnessRecommendation } = await import('@/lib/weather');
          const { readWeatherCache, isCacheFresh } = await import('@/lib/weather/cache');
          const wxCache = await readWeatherCache();
          if (wxCache?.snapshot && isCacheFresh(wxCache)) {
            const ctx = await loadWeatherWellnessContext({
              profile: health,
              userKey: user?.id ?? null,
              loggedPain,
              now,
            });
            const rec = getWeatherWellnessRecommendation(wxCache.snapshot, ctx);
            questWeather = {
              category: rec.category,
              severity: rec.severity,
              stale: Boolean(rec.adviceKind === 'cached'),
              bestOutdoorWindow: rec.bestOutdoorWindow
                ? {
                    start: rec.bestOutdoorWindow.start,
                    end: rec.bestOutdoorWindow.end,
                    startIso: rec.bestOutdoorWindow.startIso,
                    endIso: rec.bestOutdoorWindow.endIso,
                  }
                : null,
            };
          }
        }
      } catch {
        questWeather = null;
      }
      quest = {
        daily: (dash.daily?.quests || []).map((q) => ({
          id: q.id,
          key: q.key,
          progressType: q.progressType,
          cadence: q.cadence,
          status: q.status,
          progress: q.progress,
          target: q.target,
          progressPercent: q.progressPercent,
          targetSource: q.targetSource ?? null,
          difficulty: q.difficulty ?? null,
          reasonKey: q.reasonKey ?? null,
          periodKey: q.periodKey,
        })),
        weekly: (dash.weekly?.quests || []).map((q) => ({
          id: q.id,
          key: q.key,
          progressType: q.progressType,
          cadence: q.cadence,
          status: q.status,
          progress: q.progress,
          target: q.target,
          progressPercent: q.progressPercent,
          targetSource: q.targetSource ?? null,
          difficulty: q.difficulty ?? null,
          periodKey: q.periodKey,
        })),
        hasQuestHistory: Boolean(
          (dash.profile?.longestStreak ?? 0) > 0 ||
            (dash.profile?.totalXp ?? 0) > 0 ||
            (dash.summary?.dailyCompleted ?? 0) > 0,
        ),
        weather: questWeather,
      };
    }
  } catch {
    quest = null;
  }
  return {
    now,
    lastOpenAt,
    // Never the server's placeholder name: „დილა მშვიდობისა ☀️“ rather than „…, Medicard“.
    firstName: displayFirstName(user, health?.extraAnswers),
    birthDate: user?.birthDate ?? null,
    createdAt: user?.createdAt ?? null,
    todaySteps: todayRow?.steps && todayRow.steps > 0 ? todayRow.steps : null,
    weekSteps: stepsOn(thisWeek),
    prevWeekSteps: stepsOn(prevWeek),
    hydrationMl: dayTotalMl(logs, today),
    hydrationGoal: goalMl,
    loggedPain,
    medTakenWeek,
    medMissedWeek,
    missingProfileField: missing,
    lastChatAt,
    lastChatId,
    lastChatMode,
    sleepModuleOn: isFeatureOn('sleep'),
    sleepBedtimeReminders: isFeatureOn('sleep') && (await sleepBedtimeRemindersScheduled()),
    cycleRegular: false,
    cyclePrivacyEnabled,
    seenWeekly: weeklySeenState(seen, now).thisWeek,
    weeklyEverSeen: weeklySeenState(seen, now).ever,
    unfinished: pickUnfinished(drafts, scheduleGap),
    recentVisit,
    openAt,
    outcomes,
    sent,
    prefs,
    blockedFamilies: adminBlockedFamilies(),
    maxPerDay: brainConfig().maxPerDay,
    weather,
    quest,
  };
}

async function detectLoggedPain(user: User | null | undefined, today: string): Promise<{ loggedPain: boolean; cyclePrivacyEnabled: boolean }> {
  if (!user?.id) return { loggedPain: false, cyclePrivacyEnabled: false };
  try {
    const { loadCycleView } = await import('@/lib/cycleOffline');
    const view = await loadCycleView(user.id);
    const log = view.display.logs.find((row) => row.date === today);
    return {
      loggedPain: Boolean(log?.painEntries?.length),
      cyclePrivacyEnabled: Boolean(view.canonical?.profile?.privacyEnabled),
    };
  } catch {
    return { loggedPain: false, cyclePrivacyEnabled: false };
  }
}

/** At most one brain run per minute and never two at once (foreground used to fire it 3× in a row). */
const BRAIN_MIN_GAP_MS = 60_000;
let brainInFlight: Promise<number> | null = null;
let brainLastAt = 0;
let brainLastUser: string | null = null;
let brainTrailing: ReturnType<typeof setTimeout> | null = null;
/** Bumped by every session reset: a run started before it never schedules after it. */
let brainGeneration = 0;

export async function runMediNotificationBrain(
  user?: User | null,
  health?: HealthProfile | null,
  opts: { markOpen?: boolean; force?: boolean } = {},
): Promise<number> {
  if (user) rememberEngageActor(user, health);
  // An open counts even when this run is skipped (the trailing run below does not mark one).
  const noteOpen = () => (opts.markOpen !== false ? markEngageAppOpen().catch(() => undefined) : undefined);
  if (brainInFlight) {
    void noteOpen();
    return brainInFlight;
  }
  const uid = (user ?? lastActor.user)?.id ?? null;
  const since = Date.now() - brainLastAt;
  if (!opts.force && uid === brainLastUser && since < BRAIN_MIN_GAP_MS) {
    void noteOpen();
    // Too soon: one trailing run at the end of the gap picks up whatever changed.
    if (!brainTrailing) {
      brainTrailing = setTimeout(() => {
        brainTrailing = null;
        void runMediNotificationBrain(lastActor.user, lastActor.health, { markOpen: false });
      }, BRAIN_MIN_GAP_MS - since);
    }
    return 0;
  }
  if (brainTrailing) {
    clearTimeout(brainTrailing);
    brainTrailing = null;
  }
  brainLastAt = Date.now();
  brainLastUser = uid;
  const run = runMediNotificationBrainNow(user, health, opts);
  brainInFlight = run;
  try {
    return await run;
  } finally {
    brainInFlight = null;
  }
}

/**
 * Sign-out (every session reset): forgets the person this runtime planned for and drops the pending
 * trailing / refresh runs. Before this, a timer or a foreground run after sign-out planned the previous
 * person's `engage:` notifications — with her name — on a signed-out phone. A run already in flight
 * sees the new generation and schedules nothing.
 */
export function resetMediNotificationBrain(): void {
  brainGeneration += 1;
  lastActor = {};
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  if (brainTrailing) clearTimeout(brainTrailing);
  brainTrailing = null;
  brainLastAt = 0;
  brainLastUser = null;
}

/**
 * The previous run's plans that reached their time since: the system showed them while the app was
 * closed (the app only hears about a notification itself when it is open or tapped). They count for
 * the daily budget, cooldowns and the fatigue model, and the server learns they were delivered.
 */
async function reconcileDeliveredPlans(index: EngageDecisionIndex, nowMs: number, permitted: boolean): Promise<void> {
  const handled = await loadEngageHandled();
  const delivered: Array<{ decisionId: string; outcome: string; occurredAt: string }> = [];
  for (const entry of Object.values(index)) {
    if (entry.decision !== 'SEND' || !entry.scheduled || entry.fireAt == null || entry.fireAt > nowMs) continue;
    entry.scheduled = false; // counted once
    // No permission: it was not shown. Handled: the app saw it itself (shown in the foreground, tapped or dropped).
    if (!permitted || handled[entry.id]) continue;
    const at = new Date(entry.fireAt);
    await recordEngageSent({ key: entry.template, family: entry.family, at: entry.fireAt, ymd: ymd(at) });
    await recordEngageOutcome({ key: entry.template, family: entry.family, sentAt: entry.fireAt, decisionId: entry.id });
    delivered.push({ decisionId: entry.id, outcome: 'delivered', occurredAt: at.toISOString() });
  }
  if (delivered.length) {
    void api.push.syncOutcomes({ outcomes: delivered.slice(-80) }).catch(() => undefined);
  }
}

async function runMediNotificationBrainNow(
  user?: User | null,
  health?: HealthProfile | null,
  opts: { markOpen?: boolean } = {},
): Promise<number> {
  try {
  if (Platform.OS === 'web') return 0;
  // Signed out: nobody to plan for. A sign-out or account switch during the run stops it before it
  // schedules or reports anything (`stillHers`).
  const account = localAccountId();
  if (!account) return 0;
  const generation = brainGeneration;
  const stillHers = () => generation === brainGeneration && localAccountId() === account;
  rememberEngageActor(user, health);
  // The open that started this run counts: „დღეს ჯერ არ შემოგივლია“ must not be planned while the person is here.
  if (opts.markOpen !== false) await markEngageAppOpen();
  const nowMs = Date.now();
  const granted = await getNotificationPermissionGranted();
  const priorIndex = await loadEngageDecisionIndex();
  await reconcileDeliveredPlans(priorIndex, nowMs, granted);
  if (!granted) {
    // Without permission nothing scheduled is shown: never count those plans as delivered later.
    for (const entry of Object.values(priorIndex)) entry.scheduled = false;
    await saveEngageDecisionIndex(priorIndex);
    return 0;
  }
  await registerNotificationCategories();
  await hydrateBrainConfig();
  if (brainConfig().paused) {
    // Admin paused Medi's notifications: nothing stays scheduled, pending plans are reported as cancelled.
    await cancelNotificationsByPrefix(NOTIF_PREFIX.engage);
    const cancelled: EngageDecision[] = [];
    for (const entry of Object.values(priorIndex)) {
      if (entry.decision !== 'SEND' || entry.fireAt == null || entry.fireAt <= nowMs) continue;
      cancelled.push({
        id: entry.id,
        candidate: entry.candidate,
        family: entry.family as EngageFamily,
        score: entry.score,
        reasons: [],
        suppressions: [],
        blocked: 'admin_paused',
        decision: 'CANCELLED',
        template: entry.template,
        route: entry.route,
        fireAt: null,
        createdAt: entry.createdAt,
        scheduledAt: new Date(entry.fireAt).toISOString(),
        reason: 'admin_paused',
      });
    }
    await saveEngageDecisionIndex({});
    if (cancelled.length) void syncEngageDecisionsToServer({ decisions: cancelled, fatigue: null });
    return 0;
  }
  const snap = await buildEngageSnapshot(user ?? lastActor.user, health ?? lastActor.health);
  if (!stillHers()) return 0;
  const { accepted, trace, index, changed } = stabilizeEngageDecisions(evaluateEngageBrain(snap), priorIndex, snap.now);
  await saveEngageTrace(trace);
  await appendEngageDecisions(trace.decisions);
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
  const scheduledIds = new Set<string>();
  for (const row of accepted) {
    if (!stillHers()) return 0;
    if (row.fireAt.getTime() <= Date.now() + 45_000) continue;
    const cycleInsight = row.key === 'engage-insight-cycle';
    const discreet = snap.prefs.discreet || (cycleInsight && snap.cyclePrivacyEnabled);
    const copy = discreet
      ? applyPushCopy(cycleInsight ? 'cycle-masked' : 'engage-masked', row.vars)
      : applyPushCopy(row.key, row.vars);
    const id = `${NOTIF_PREFIX.engage}${row.key}:${ymd(row.fireAt)}`;
    const categoryIdentifier = snap.prefs.discreet ? undefined : categoryForNotification('medi_engage', row.family);
    try {
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
            candidateType: row.candidateType ?? '',
            windowStartIso: typeof row.vars.windowStartIso === 'string' ? row.vars.windowStartIso : '',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: row.fireAt,
          ...(Platform.OS === 'android' ? { channelId: ENGAGE_CHANNEL_ID } : {}),
        },
      });
      scheduledIds.add(row.decisionId);
    } catch {
      /* one failed slot must not stop the rest */
    }
  }
  for (const entry of Object.values(index)) {
    if (entry.decision === 'SEND' && scheduledIds.has(entry.id)) entry.scheduled = true;
  }
  await saveEngageDecisionIndex(index);
  if (changed.length) {
    void syncEngageDecisionsToServer({ decisions: changed, fatigue: trace.fatigue }).then((ok) => {
      if (!ok) return;
      // Mark what the server now has, on the latest index (a newer run may have saved one meanwhile).
      const syncedState = new Map(changed.map((row) => [row.id, `${row.decision}|${row.reason ?? ''}|${row.fireAt ?? row.scheduledAt ?? ''}`]));
      void loadEngageDecisionIndex().then((latest) => {
        let touched = false;
        for (const entry of Object.values(latest)) {
          if (!entry.synced && syncedState.get(entry.id) === entry.state) {
            entry.synced = true;
            touched = true;
          }
        }
        if (touched) void saveEngageDecisionIndex(latest);
      });
    });
  }
  return scheduledIds.size;
  } catch {
    return 0;
  }
}

export function requestEngageRefresh(): void {
  // No run has known the person in this runtime yet (Android's headless notification task, an iOS
  // background launch before sign-in restored): nothing to re-plan for — the first run with her plans.
  if (!lastActor.user) return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void runMediNotificationBrain(lastActor.user, lastActor.health, { markOpen: false });
  }, 450);
}

async function deliverCycleReminder(data: Record<string, unknown>): Promise<{
  ok: boolean;
  reason: string | null;
  rewriteMasked?: boolean;
}> {
  const { cycleDeliveryDecision, getEffectiveCycleMask } = await import('./cycleNotificationContract.js');
  const { getCycleReminderPrefs } = await import('./cycleReminderPrefs');
  let prefs = await getCycleReminderPrefs();
  const typeEnabledFrom = (p: typeof prefs) => ({
    period_soon: p.periodDaysBefore > 0,
    period_start: true,
    period_late: p.periodLate,
    ovulation: p.ovulation,
    fertile: p.ovulation,
    pms: p.pms,
    opk: p.opk,
    bbt: p.bbt,
    log_nudge: p.dailyLog,
  });
  const engage = await loadEngagePrefs().catch(() => null);
  let today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  let live: Record<string, unknown> = {
    today,
    prefsEnabled: prefs.enabled,
    globalEnabled: true,
    privacyEnabled: false,
    typeEnabled: typeEnabledFrom(prefs),
    periodDaysBefore: prefs.periodDaysBefore,
    logs: [],
  };
  const userId = lastActor.user?.id;
  if (userId) {
    try {
      const { loadCycleView } = await import('@/lib/cycleOffline');
      const { cycleToday } = await import('@/lib/cycleCanonical');
      const { cycleReminderGates } = await import('@/lib/cycleForecastEligibility');
      const view = await loadCycleView(userId);
      const bundle = view.canonical;
      // Tracking / fertile-days display off (brief §9 wave 2 item 17): a delivered reminder of a hidden family is dropped.
      const gates = cycleReminderGates(bundle);
      today = cycleToday(bundle, today);
      // TTC profiles default ovulation/fertile reminders on — re-read the prefs with the mode known.
      prefs = await getCycleReminderPrefs({ mode: bundle.profile.mode });
      live = {
        ...live,
        today,
        typeEnabled: typeEnabledFrom(prefs),
        mode: bundle.profile.mode,
        privacyEnabled: Boolean(bundle.profile.privacyEnabled),
        nextPeriodStart: bundle.predictions.nextPeriodStart,
        ovulationDate: bundle.predictions.ovulationDate,
        fertileWindowStart: bundle.predictions.fertileWindow?.start ?? null,
        showFertilityMarkers: gates.showFertilityMarkers,
        logs: bundle.logs,
        forecastAllowed: gates.forecastAllowed,
      };
    } catch {
      /* prefs + mask still apply */
    }
  }
  const mask = getEffectiveCycleMask({
    privacyEnabled: Boolean(live.privacyEnabled),
    maskNotifications: prefs.maskNotifications,
    discreet: Boolean(engage?.discreet),
  });
  if (data.type === 'cycle_tip' || !data.candidateType) {
    if (mask.masked && !data.masked) {
      return { ok: true, reason: 'DELIVER_WITH_DISCREET_COPY', rewriteMasked: true };
    }
    return { ok: true, reason: mask.masked ? 'PRIVACY_MASKED' : null };
  }
  return cycleDeliveryDecision(
    {
      type: String(data.candidateType || ''),
      candidateType: String(data.candidateType || ''),
      eventDate: String(data.eventDate || ''),
      candidateId: String(data.candidateId || ''),
      masked: Boolean(data.masked),
      notifyEligible: String(data.candidateType || '') !== 'late',
    },
    live,
    mask,
  );
}

async function deliverPregnancyCareReminder(data: Record<string, unknown>): Promise<{
  ok: boolean;
  reason: string | null;
  rewriteMasked?: boolean;
}> {
  const { pregnancyCareReminderDeliveryDecision } = await import('./pregnancyCareReminderContract.js');
  const { getEffectiveCycleMask } = await import('./cycleNotificationContract.js');
  const { getCycleReminderPrefs } = await import('./cycleReminderPrefs');
  const prefs = await getCycleReminderPrefs();
  const engage = await loadEngagePrefs().catch(() => null);
  const deviceToday = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  let live: Record<string, unknown> = {
    today: deviceToday,
    now: new Date(),
    privacyEnabled: false,
    maskNotifications: prefs.maskNotifications,
    discreet: Boolean(engage?.discreet),
    mode: null,
    pregnancyActive: false,
    episodeStatus: 'ENDED',
    items: [],
  };
  const userId = lastActor.user?.id;
  if (userId) {
    try {
      const { loadCycleView } = await import('@/lib/cycleOffline');
      const { cycleToday } = await import('@/lib/cycleCanonical');
      const { api } = await import('@/lib/api');
      const view = await loadCycleView(userId);
      const bundle = view.canonical;
      const today = cycleToday(bundle, deviceToday);
      live.today = today;
      live.userId = userId;
      live.mode = bundle.profile.mode;
      live.privacyEnabled = Boolean(bundle.profile.privacyEnabled);
      if (bundle.profile.mode === 'PREGNANCY') {
        const plan = await api.cycle.pregnancyCarePlan();
        live.pregnancyActive = Boolean(plan.pregnancyActive);
        live.episodeId = plan.pregnancyEpisodeId;
        live.episodeStatus = plan.pregnancyActive ? 'ACTIVE' : 'ENDED';
        live.items = plan.items;
      }
    } catch {
      live.pregnancyActive = false;
      live.episodeStatus = 'ENDED';
    }
  }
  const mask = getEffectiveCycleMask({
    privacyEnabled: Boolean(live.privacyEnabled),
    maskNotifications: prefs.maskNotifications,
    discreet: Boolean(engage?.discreet),
  });
  const decision = pregnancyCareReminderDeliveryDecision(
    {
      type: 'pregnancy_care_plan',
      careItemId: String(data.careItemId || ''),
      episodeId: String(data.episodeId || ''),
      userId: String(data.userId || ''),
      plannedDate: String(data.plannedDate || ''),
      plannedTime: data.plannedTime ? String(data.plannedTime) : null,
      offset: Number(data.offset),
      reminderMode: String(data.reminderMode || 'DATE_BASED'),
      eventDate: String(data.eventDate || ''),
      candidateId: String(data.candidateId || ''),
      masked: Boolean(data.masked),
    },
    live,
    mask,
  );
  return { ...decision, reason: decision.reason ?? null };
}

async function deliverPetCareReminder(data: Record<string, unknown>): Promise<{
  ok: boolean;
  reason: string | null;
  rewriteMasked?: boolean;
}> {
  const { petCareReminderDeliveryDecision } = await import('./petCareReminderContract.js');
  const { localAccountId } = await import('@/lib/localAccount');
  const { loadPetCareReminderPrefs } = await import('@/lib/petCareReminderPrefs');
  const { getNotificationPermissionGranted } = await import('@/lib/notifications');
  const engage = await loadEngagePrefs().catch(() => null);
  const prefs = await loadPetCareReminderPrefs().catch(() => null);
  const userId = lastActor.user?.id || localAccountId();
  const permissionGranted = await getNotificationPermissionGranted();
  const live = {
    userId,
    permissionGranted,
    globalOptIn: prefs?.globalOptIn !== false,
    reminderEnabled: true,
    revision: typeof data.revision === 'number' ? data.revision : Number(data.revision || 0) || undefined,
  };
  const decision = petCareReminderDeliveryDecision(
    {
      type: 'pet_care',
      family: 'petCareReminder',
      userId: data.userId,
      revision: data.revision,
      masked: Boolean(data.masked),
    },
    live,
    Boolean(engage?.discreet),
  );
  return { ok: decision.ok && decision.deliver !== false, reason: decision.reason, rewriteMasked: decision.rewriteMasked };
}

export async function shouldDeliverNotification(data: Record<string, unknown> | undefined | null): Promise<{
  ok: boolean;
  reason: string | null;
  rewriteMasked?: boolean;
}> {
  if (!data || typeof data !== 'object') return { ok: true, reason: null };
  if (data.rewrite === true || data.rewrite === 'true') return { ok: true, reason: 'PRIVACY_MASKED' };
  if (
    data.type === 'admin_broadcast' ||
    data.source === 'broadcast' ||
    data.family === 'adminBroadcast' ||
    data.qa === true ||
    data.qa === 'true'
  ) {
    return { ok: true, reason: null };
  }

  if (data.type === 'quota_reset' || data.family === 'quotaReset') {
    return { ok: true, reason: null };
  }
  if (data.type === 'pregnancy_care_plan' || data.family === 'pregnancyCareReminder') {
    return deliverPregnancyCareReminder(data);
  }
  if (data.type === 'pet_care' || data.family === 'petCareReminder') {
    return deliverPetCareReminder(data);
  }
  if (data.type === 'family_reminder' || data.family === 'familyReminder') {
    const { deliverFamilyReminder } = await import('@/lib/family/familyReminders');
    return deliverFamilyReminder(data);
  }
  if (data.type === 'cycle_reminder' || data.family === 'cycleReminder' || data.type === 'cycle_tip') {
    return deliverCycleReminder(data);
  }
  // Scheduled before an admin paused its module or switched Medi's notifications off: drop it.
  if (data.type === 'medi_engage') {
    await hydrateBrainConfig();
    const admin = brainFamilyBlock(String(data.family || ''));
    if (admin) return { ok: false, reason: admin };
    if (!isEngageFamilyOn(String(data.family || ''))) return { ok: false, reason: 'module_paused' };
  }
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
  let weatherWindowGone = false;
  let weatherRainChanged = false;
  let stepsGoalReached = false;
  let questDaily: NonNullable<EngageLiveSignals['daily']> = [];
  let questWeekly: NonNullable<EngageLiveSignals['weekly']> = [];
  let questWeather: {
    category: string;
    severity?: string | null;
    stale: boolean;
    bestOutdoorWindow?: {
      start?: string;
      end?: string;
      startIso?: string;
      endIso?: string;
    } | null;
  } | null = null;
  let weatherWindowChanged = false;
  if (String(data.family || '') === 'weatherWellness') {
    try {
      const { recheckWeatherForDelivery, weatherKeyToCandidate } = await import('@/lib/weather/engage');
      const check = await recheckWeatherForDelivery({
        profile: lastActor.health,
        userKey: lastActor.user?.id ?? null,
        loggedPain: cached?.loggedPain ?? false,
        expected: weatherKeyToCandidate(String(data.templateKey || data.key || '')),
      });
      weatherWindowGone = check.windowGone;
      weatherRainChanged = check.rainChanged;
      stepsGoalReached = check.stepsGoalReached;
    } catch {
      weatherWindowGone = true;
    }
  }
  if (String(data.family || '') === 'questSmart') {
    try {
      const { readQuestCache } = await import('@/lib/quest/cache');
      const qCached = await readQuestCache();
      const dash = qCached?.dashboard;
      if (dash) {
        questDaily = dash.daily?.quests || [];
        questWeekly = dash.weekly?.quests || [];
      }
      const { readDevQuestWeather } = await import('@/lib/weather/devFixture');
      const nowLive = new Date();
      const devWx = readDevQuestWeather(nowLive);
      if (devWx !== undefined) {
        questWeather = devWx ? { ...devWx, stale: false } : null;
      } else {
        const { readWeatherCache, isCacheFresh } = await import('@/lib/weather/cache');
        const { getWeatherWellnessRecommendation } = await import('@/lib/weather');
        const { loadWeatherWellnessContext } = await import('@/lib/weather/context');
        const wxCache = await readWeatherCache();
        if (!wxCache?.snapshot || !isCacheFresh(wxCache)) {
          questWeather = null;
          weatherWindowChanged = String(data.templateKey || '') === 'engage-quest-weather-window';
        } else {
          const ctx = await loadWeatherWellnessContext({
            profile: lastActor.health,
            userKey: lastActor.user?.id ?? null,
            loggedPain: cached?.loggedPain ?? false,
            now: nowLive,
          });
          const rec = getWeatherWellnessRecommendation(wxCache.snapshot, ctx);
          questWeather = {
            category: rec.category,
            severity: rec.severity,
            stale: rec.adviceKind === 'cached',
            bestOutdoorWindow: rec.bestOutdoorWindow
              ? {
                  start: rec.bestOutdoorWindow.start,
                  end: rec.bestOutdoorWindow.end,
                  startIso: rec.bestOutdoorWindow.startIso,
                  endIso: rec.bestOutdoorWindow.endIso,
                }
              : null,
          };
          const expectedStart = typeof data.windowStartIso === 'string' ? data.windowStartIso : '';
          if (
            expectedStart &&
            rec.bestOutdoorWindow?.startIso &&
            Math.abs(new Date(expectedStart).getTime() - new Date(rec.bestOutdoorWindow.startIso).getTime()) > 45 * 60_000
          ) {
            weatherWindowChanged = true;
          }
        }
      }
    } catch {
      if (String(data.templateKey || '') === 'engage-quest-weather-window') {
        weatherWindowChanged = true;
        questWeather = null;
      }
    }
  }
  const live = {
    now: new Date(),
    hydrationMl: dayTotalMl(hydro, today),
    hydrationGoal: goal,
    loggedPain: cached?.loggedPain ?? false,
    seenWeekly: weeklySeenState(seen).thisWeek,
    unfinished: drafts[0] ?? cached?.unfinished ?? null,
    lastOpenAt,
    missingProfileField: cached?.missingProfileField ?? null,
    recentVisitId: cached?.recentVisitId ?? null,
    medMissedWeek: cached?.medMissedWeek ?? 0,
    todaySteps: cached?.todaySteps ?? null,
    prevWeekSteps: cached?.prevWeekSteps ?? 0,
    sent,
    doseTaken: Boolean(medicationId && time && findDoseLog(doses, medicationId, today, time)?.status === 'taken'),
    stepsGoalReached,
    weatherWindowGone,
    weatherRainChanged,
    daily: questDaily,
    weekly: questWeekly,
    weather: questWeather,
    weatherWindowChanged,
    openedRecently: Boolean(lastOpenAt && Date.now() - lastOpenAt < 90 * 60_000),
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
      candidateType: typeof data.candidateType === 'string' ? data.candidateType : undefined,
      medicationId,
      time,
    },
    live,
  );
}

async function syncEngageDecisionsToServer(trace: {
  decisions: EngageDecision[];
  fatigue: {
    selectedFrequency: string;
    baseDailyCap: number;
    adaptiveDailyCap: number;
    ewma: number;
  } | null;
}): Promise<boolean> {
  try {
    for (let i = 0; i < trace.decisions.length; i += 80) {
      await api.push.syncDecisions({
        decisions: trace.decisions.slice(i, i + 80).map((row) => ({
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
        ...(trace.fatigue
          ? {
              fatigue: {
                selectedFrequency: trace.fatigue.selectedFrequency,
                baseDailyCap: trace.fatigue.baseDailyCap,
                adaptiveDailyCap: trace.fatigue.adaptiveDailyCap,
                ewma: trace.fatigue.ewma,
              },
            }
          : {}),
      });
    }
    return true;
  } catch {
    /* admin sync is best-effort; unsynced rows go again with the next run */
    return false;
  }
}
