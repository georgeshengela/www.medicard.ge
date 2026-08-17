import { ka } from '@/i18n/ka';
import type { CycleBundle } from '@/lib/api';
import { addDaysToKey, daysBetween, parseDateKey } from '@/lib/cyclePhase';
import { todayKey } from '@/components/cycle/CycleCalendar';
import {
  cancelCycleReminders,
  scheduleCycleDateNotification,
} from '@/lib/notifications';
import type { CycleReminderPrefs } from '@/lib/cycleReminderPrefs';

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
  const today = todayKey();
  const hasLogToday = logs.some((l) => l.date === today);

  const schedule = async (
    id: string,
    ymd: string,
    title: string,
    body: string,
    route: string,
  ) => {
    if (!isFutureYmd(ymd) && ymd !== today) return;
    const date = reminderDate(ymd);
    if (date.getTime() <= Date.now()) return;
    const ok = await scheduleCycleDateNotification({
      identifier: `${id}:${ymd}`,
      title,
      body,
      date,
      data: { route },
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
        ka.cycle.remPeriodSoon,
        ka.cycle.remPeriodSoonBody(prefs.periodDaysBefore),
        '/cycle',
      );
    }
    await schedule(
      'period_start',
      start,
      ka.cycle.remPeriodStart,
      ka.cycle.remPeriodStartBody,
      '/cycle/log',
    );
  }

  if (mode === 'TRY_TO_CONCEIVE' && prefs.ovulation) {
    if (predictions.ovulationDate) {
      await schedule(
        'ovulation',
        predictions.ovulationDate,
        ka.cycle.remOvulation,
        ka.cycle.remOvulationBody,
        '/cycle/log?tab=more',
      );
    }
    if (predictions.fertileWindow?.start) {
      await schedule(
        'fertile',
        predictions.fertileWindow.start,
        ka.cycle.remFertile,
        ka.cycle.remFertileBody,
        '/cycle',
      );
    }
  }

  if (prefs.pms && mode !== 'PREGNANCY' && profile.lastPeriodStart && predictions.ovulationDate) {
    const pmsStart = addDaysToKey(predictions.ovulationDate, 2);
    await schedule(
      'pms',
      pmsStart,
      ka.cycle.remPms,
      ka.cycle.remPmsBody,
      '/cycle',
    );
  }

  if (prefs.dailyLog && !hasLogToday) {
    await schedule(
      'log_nudge',
      today,
      ka.cycle.remLog,
      ka.cycle.remLogBody,
      '/cycle/log',
    );
  }

  return count;
}
