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
import { applyPushCopy } from '@/lib/pushCopy';
import { bumpOutOfQuiet } from '@/lib/mediEngageModel';
import { loadEngagePrefs } from '@/lib/mediEngagePrefs';
import {
  buildCycleCandidates,
  CYCLE_REMINDER_HOUR,
  CYCLE_REMINDER_MINUTE,
  pickCycleScheduleSet,
  revalidateCycleCandidate,
} from '@/lib/cycleNotificationContract.js';

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
    typeEnabled: {
      period_soon: prefs.periodDaysBefore > 0,
      period_start: true,
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
        ? { days: flags.cautious ? `დაახლოებით ${prefs.periodDaysBefore}` : String(prefs.periodDaysBefore) }
        : {};
    const copy = applyPushCopy(candidate.templateKey, vars);
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
