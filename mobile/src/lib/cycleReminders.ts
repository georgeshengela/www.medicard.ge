import type { CycleBundle } from '@/lib/api';
import { addDaysToKey, parseDateKey } from '@/lib/cyclePhase';
import { todayKey } from '@/components/cycle/CycleCalendar';
import {
  cancelCycleReminders,
  scheduleCycleDateNotification,
} from '@/lib/notifications';
import type { CycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { cycleHonestyFlags } from '@/lib/cycleHonesty';
import { applyPushCopy } from '@/lib/pushCopy';

const REMINDER_HOUR = 9;
const REMINDER_MINUTE = 0;

function reminderDate(ymd: string): Date {
  const { y, m, d } = parseDateKey(ymd);
  return new Date(y, m, d, REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
}

function isFutureYmd(ymd: string): boolean {
  return ymd >= todayKey();
}

export async function syncCycleReminders(
  bundle: CycleBundle,
  prefs: CycleReminderPrefs,
): Promise<number> {
  await cancelCycleReminders();
  if (!prefs.enabled) return 0;

  let count = 0;
  const { profile, predictions, logs } = bundle;
  const mode = profile.mode;
  const flags = cycleHonestyFlags({
    confidence: predictions.confidence,
    isIrregular: profile.isIrregular,
    conditions: profile.conditions,
  });
  const today = todayKey();
  const hasLogToday = logs.some((l) => l.date === today);

  const schedule = async (
    id: string,
    ymd: string,
    templateKey: string,
    vars: Record<string, string | number | undefined>,
    route: string,
  ) => {
    if (!isFutureYmd(ymd) && ymd !== today) return;
    const date = reminderDate(ymd);
    if (date.getTime() <= Date.now()) return;
    const copy = applyPushCopy(templateKey, vars);
    const ok = await scheduleCycleDateNotification({
      identifier: `${id}:${ymd}`,
      title: copy.title,
      body: copy.body,
      date,
      data: { route, templateKey },
    });
    if (ok) count += 1;
  };

  if (mode !== 'PREGNANCY' && predictions.nextPeriodStart) {
    const start = predictions.nextPeriodStart;
    if (prefs.periodDaysBefore > 0) {
      const soon = addDaysToKey(start, -prefs.periodDaysBefore);
      await schedule(
        'period_soon',
        soon,
        'cycle-period-soon',
        { days: flags.cautious ? `დაახლოებით ${prefs.periodDaysBefore}` : String(prefs.periodDaysBefore) },
        '/cycle',
      );
    }
    await schedule('period_start', start, 'cycle-period-start', {}, '/cycle/log');
  }

  const allowFertilityReminders = bundle.contraception?.presentation?.showFertilityMarkers !== false;

  if (mode === 'TRY_TO_CONCEIVE' && prefs.ovulation && allowFertilityReminders) {
    if (predictions.ovulationDate) {
      await schedule('ovulation', predictions.ovulationDate, 'cycle-ovulation', {}, '/cycle/log?tab=more');
    }
    if (predictions.fertileWindow?.start) {
      await schedule('fertile', predictions.fertileWindow.start, 'cycle-fertile', {}, '/cycle');
    }
  }

  if (prefs.pms && allowFertilityReminders && mode !== 'PREGNANCY' && profile.lastPeriodStart && predictions.ovulationDate) {
    await schedule('pms', addDaysToKey(predictions.ovulationDate, 2), 'cycle-pms', {}, '/cycle');
  }

  if (mode === 'TRY_TO_CONCEIVE' && prefs.opk && allowFertilityReminders && predictions.fertileWindow?.start) {
    await schedule('opk', predictions.fertileWindow.start, 'cycle-opk', {}, '/cycle/log?tab=more');
  }

  if (mode === 'TRY_TO_CONCEIVE' && prefs.bbt && allowFertilityReminders) {
    const hasBbtToday = logs.some((l) => l.date === today && l.bbt != null);
    if (!hasBbtToday) {
      await schedule('bbt', today, 'cycle-bbt', {}, '/cycle/log?tab=more');
    }
  }

  if (prefs.dailyLog && !hasLogToday) {
    await schedule('log_nudge', today, 'cycle-log', {}, '/cycle/log');
  }

  return count;
}
