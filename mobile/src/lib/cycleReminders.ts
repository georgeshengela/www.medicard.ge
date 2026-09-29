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
import { applyPushCopy, interpolatePushCopy } from '@/lib/pushCopy';
import { isEn } from '../i18n/locale.js';
import { bumpOutOfQuiet } from '@/lib/mediEngageModel';
import { loadEngagePrefs } from '@/lib/mediEngagePrefs';
import {
  buildCycleCandidates,
  CYCLE_REMINDER_HOUR,
  CYCLE_REMINDER_MINUTE,
  pickCycleScheduleSet,
  revalidateCycleCandidate,
} from '@/lib/cycleNotificationContract.js';

/**
 * English reminder copy for English users. Admin push templates and the pushCopy fallbacks are
 * Georgian; same honesty as the Georgian (estimates stay "likely" / "estimated").
 */
const EN_CYCLE_COPY: Record<string, { title: string; body: string }> = {
  'cycle-period-soon': {
    title: 'Your estimated period is coming up 🌸',
    body: 'Based on your cycle, your period is likely in {days}. This is an estimate — Medi is just reminding you 💗',
  },
  'cycle-period-start': {
    title: 'It might start today 🌷',
    body: 'By Medi’s estimate, your period is likely to start today. If it doesn’t, that’s okay — cycles don’t always follow the calendar exactly 🤍',
  },
  'cycle-ovulation': {
    title: 'Estimated ovulation is coming up ✨',
    body: 'Based on the calendar, your estimated ovulation day is getting close. This is an estimate — cycles don’t always follow the calendar exactly 🤍',
  },
  'cycle-fertile': {
    title: 'Estimated fertile window 🌱',
    body: 'Your estimated fertile window may be starting. This is a calendar estimate — the prediction can change 🤍',
  },
  'cycle-pms': {
    title: 'PMS may be coming up 🌙',
    body: 'If you feel a little different today, your cycle suggests PMS may be coming up. Listen to your body 🤍',
  },
  'cycle-opk': {
    title: 'Time for your OPK test 🧪',
    body: 'If you’re using ovulation tests this cycle, don’t forget today’s OPK 💗',
  },
  'cycle-bbt': {
    title: 'Good morning ☀️ BBT?',
    body: 'Before you get up and start your day, remember to take your basal temperature 🌡️',
  },
  'cycle-log': {
    title: 'How are you today? 💚',
    body: 'A minute for Medi? Note how your day went — symptoms, mood and whatever matters to you.',
  },
  'cycle-masked': {
    title: 'A reminder from Medi',
    body: 'Stop by when you have a moment 💚',
  },
};

function reminderCopy(key: string, vars: Record<string, string | undefined>): { title: string; body: string } {
  const en = isEn() ? EN_CYCLE_COPY[key] : undefined;
  if (!en) return applyPushCopy(key, vars);
  return { title: interpolatePushCopy(en.title, vars), body: interpolatePushCopy(en.body, vars) };
}

function periodDaysVar(days: number, cautious: boolean): string {
  if (!isEn()) return cautious ? `დაახლოებით ${days}` : String(days);
  const unit = days === 1 ? 'day' : 'days';
  return cautious ? `about ${days} ${unit}` : `${days} ${unit}`;
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
        ? { days: periodDaysVar(Number(prefs.periodDaysBefore), Boolean(flags.cautious)) }
        : {};
    const copy = reminderCopy(candidate.templateKey, vars);
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
    const prefs = await getCycleReminderPrefs();
    return await syncCycleReminders(view.canonical, prefs);
  } catch {
    return 0;
  }
}
