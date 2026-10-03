import type { CycleBundle } from '@/lib/api';
import { parseDateKey } from '@/lib/cyclePhase';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { cycleToday } from '@/lib/cycleCanonical';
import {
  cancelCycleReminders,
  scheduleCycleDateNotification,
} from '@/lib/notifications';
import type { CycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { cycleHonestyFlags } from '@/lib/cycleHonesty';
import { getCachedPushTemplate, interpolatePushCopy } from '@/lib/pushCopy';
import { isEn } from '../i18n/locale.js';
import { bumpOutOfQuiet } from '@/lib/mediEngageModel';
import { loadEngagePrefs } from '@/lib/mediEngagePrefs';
import {
  buildCycleCandidates,
  CYCLE_REMINDER_HOUR,
  CYCLE_REMINDER_MINUTE,
  CYCLE_TEMPLATE_BY_TYPE,
  pickCycleScheduleSet,
  revalidateCycleCandidate,
} from '@/lib/cycleNotificationContract.js';
import { periodSoonDaysVar, pickCycleReminderCopy } from '@/lib/cycleReminderCopy';

/**
 * Lock-screen copy for one reminder: the app's own texts (cycleReminderCopy), or the admin's Georgian
 * template when the admin actually changed it. Estimates stay „სავარაუდოდ“ / "estimated".
 */
function reminderCopy(
  key: string,
  vars: Record<string, string | undefined>,
  cautious: boolean,
): { title: string; body: string } {
  const raw = pickCycleReminderCopy(key, { en: isEn(), cautious, cached: getCachedPushTemplate(key) });
  return { title: interpolatePushCopy(raw.title, vars), body: interpolatePushCopy(raw.body, vars) };
}

export type CycleReminderPreviewType =
  | 'period_soon'
  | 'period_start'
  | 'period_late'
  | 'ovulation'
  | 'fertile'
  | 'pms'
  | 'opk'
  | 'bbt'
  | 'log_nudge';

/**
 * Exactly the text a reminder of this type would put on the lock screen (unmasked), for the settings
 * screen to show beside each switch before it is turned on.
 */
export function cycleReminderPreview(
  type: CycleReminderPreviewType,
  opts: { periodDaysBefore?: number; cautious?: boolean } = {},
): { title: string; body: string } {
  const key = CYCLE_TEMPLATE_BY_TYPE[type] ?? 'cycle-masked';
  const vars =
    type === 'period_soon'
      ? { days: periodSoonDaysVar(Math.max(1, Number(opts.periodDaysBefore ?? 2)), isEn()) }
      : {};
  return reminderCopy(key, vars, Boolean(opts.cautious));
}

function reminderDate(ymd: string, quietStart: string, quietEnd: string): Date {
  const { y, m, d } = parseDateKey(ymd);
  const atNine = new Date(y, m, d, CYCLE_REMINDER_HOUR, CYCLE_REMINDER_MINUTE, 0, 0);
  return bumpOutOfQuiet(atNine, quietStart, quietEnd);
}

function liveFromBundle(bundle: CycleBundle, prefs: CycleReminderPrefs, today: string) {
  return {
    today,
    mode: bundle.profile.mode,
    nextPeriodStart: bundle.predictions.nextPeriodStart,
    ovulationDate: bundle.predictions.ovulationDate,
    fertileWindowStart: bundle.predictions.fertileWindow?.start ?? null,
    periodDaysBefore: prefs.periodDaysBefore,
    showFertilityMarkers: bundle.contraception?.presentation?.showFertilityMarkers !== false,
    logs: bundle.logs,
    prefsEnabled: prefs.enabled,
    globalEnabled: true,
    forecastAllowed: bundle.forecastEligibility?.allowed !== false,
    typeEnabled: {
      period_soon: prefs.periodDaysBefore > 0,
      period_start: true,
      period_late: prefs.periodLate,
      ovulation: prefs.ovulation,
      fertile: prefs.ovulation,
      pms: prefs.pms,
      opk: prefs.opk,
      bbt: prefs.bbt,
      log_nudge: prefs.dailyLog,
    },
  };
}

export async function syncCycleReminders(
  bundle: CycleBundle,
  prefs: CycleReminderPrefs,
): Promise<number> {
  await cancelCycleReminders();
  if (!prefs.enabled) return 0;

  const today = cycleToday(bundle, todayKey());
  const engage = await loadEngagePrefs().catch(() => null);
  const flags = cycleHonestyFlags({
    confidence: bundle.predictions.confidence,
    isIrregular: bundle.profile.isIrregular,
    conditions: bundle.profile.conditions,
  });
  const lateAlert = (bundle.alerts ?? []).find((row) => Boolean((row as { late?: { status?: string } }).late));
  const candidates = buildCycleCandidates({
    today,
    mode: bundle.profile.mode,
    predictions: bundle.predictions,
    logs: bundle.logs,
    prefs,
    showFertilityMarkers: bundle.contraception?.presentation?.showFertilityMarkers !== false,
    lateStatus: lateAlert ? { status: 'late' } : null,
    forecastAllowed: bundle.forecastEligibility?.allowed !== false,
  } as never);
  const live = liveFromBundle(bundle, prefs, today);
  const chosen = pickCycleScheduleSet(candidates, today);
  let count = 0;

  for (const candidate of chosen) {
    const check = revalidateCycleCandidate(candidate, live);
    if (!check.ok) continue;
    const date = reminderDate(candidate.eventDate, engage?.quietStart ?? '22:00', engage?.quietEnd ?? '08:00');
    if (date.getTime() <= Date.now()) continue;
    const vars =
      candidate.type === 'period_soon'
        ? { days: periodSoonDaysVar(Number(prefs.periodDaysBefore), isEn()) }
        : {};
    const copy = reminderCopy(candidate.templateKey, vars, Boolean(flags.cautious));
    const ok = await scheduleCycleDateNotification({
      identifier: `${candidate.type}:${candidate.eventDate}`,
      title: copy.title,
      body: copy.body,
      date,
      privacyEnabled: Boolean(bundle.profile.privacyEnabled),
      data: {
        candidateId: candidate.candidateId,
        candidateType: candidate.type,
        eventDate: candidate.eventDate,
        templateKey: candidate.templateKey,
        route: candidate.route,
        estimated: candidate.estimated,
        predicted: candidate.predicted,
        revalidationKey: candidate.revalidationKey,
        family: 'cycleReminder',
      },
    });
    if (ok) count += 1;
  }

  return count;
}

let lastReconcileAt = 0;

/**
 * Keep cycle reminders scheduled without opening the cycle screen: runs on login and every foreground
 * (at most every 10 minutes). Uses the cached/online cycle view; never throws.
 */
export async function reconcileCycleReminders(userId: string, opts: { force?: boolean } = {}): Promise<number> {
  const now = Date.now();
  if (!opts.force && now - lastReconcileAt < 10 * 60_000) return 0;
  lastReconcileAt = now;
  try {
    const { isFeatureOn } = await import('@/lib/featureFlags');
    if (!isFeatureOn('cycle')) {
      await cancelCycleReminders();
      return 0;
    }
    const { loadCycleView } = await import('@/lib/cycleOffline');
    const { getCycleReminderPrefs } = await import('@/lib/cycleReminderPrefs');
    const view = await loadCycleView(userId);
    if (!view?.canonical?.profile) return 0;
    const prefs = await getCycleReminderPrefs({ mode: view.canonical.profile.mode });
    const count = await syncCycleReminders(view.canonical, prefs);
    // Pregnancy care reminders used to be scheduled only when the cycle screen opened.
    try {
      const { supportsCycleCapability } = await import('@/lib/cycleModes');
      const mode = view.canonical.profile.mode;
      if (supportsCycleCapability(mode, 'showPregnancyCarePlanner')) {
        const [{ api }, { cycleToday }, { syncPregnancyCareReminders }, { todayYmd }] = await Promise.all([
          import('@/lib/api'),
          import('@/lib/cycleCanonical'),
          import('@/lib/pregnancyCareReminders'),
          import('@/lib/hydration'),
        ]);
        const plan = await api.cycle.pregnancyCarePlan();
        await syncPregnancyCareReminders({
          plan,
          userId,
          mode,
          today: cycleToday(view.canonical, todayYmd()),
          privacyEnabled: Boolean(view.canonical.profile.privacyEnabled),
        });
      }
    } catch {
      /* pregnancy reminders are retried on the next foreground */
    }
    return count;
  } catch {
    return 0;
  }
}
