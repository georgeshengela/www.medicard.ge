/** MEDISLEEP widget timeline (pure — node tests load it; sleepWidget.ts writes it). */
import { tx } from '../../i18n/locale.js';
import { formatDuration, formatHoursCompact, hhmm, plannedBedtimeMinutes, tonight } from './sleepTime.ts';
import type { SleepWidgetProps } from './sleepWidgetLayout';
import type { SleepPlan } from './sleepTypes';

const OPEN_URL = 'medicard://sleep';

export const EMPTY_SLEEP_WIDGET: Partial<SleepWidgetProps> = {
  state: 'empty',
  detail: tx('დააყენე ძილის გეგმა MEDISLEEP-ში', 'Set your sleep plan in MEDISLEEP'),
  openUrl: OPEN_URL,
};

/**
 * Pure timeline builder (tests call it): from now, one entry per change over the next 24 hours.
 * `session` = sleep mode running (start + alarm), `last` = last night's slept minutes.
 */
export function sleepWidgetTimeline(
  plan: SleepPlan | null,
  last: { night: string; sleptMinutes: number | null } | null,
  session: { startedAt: number; alarmAt: number | null } | null,
  now: Date,
): { date: Date; props: Partial<SleepWidgetProps> }[] {
  if (!plan) return [{ date: now, props: EMPTY_SLEEP_WIDGET }];
  const rest = (at: Date): Partial<SleepWidgetProps> => {
    const bedtime = hhmm(plannedBedtimeMinutes(plan, new Date(at.getTime() + 18 * 3600_000)));
    const slept = last?.sleptMinutes ?? null;
    return {
      state: slept ? 'rest' : 'evening',
      label: slept ? tx('ბოლო ღამე', 'Last night') : tx('დაწოლა', 'Bedtime'),
      value: slept ? formatHoursCompact(slept) : bedtime,
      detail: slept ? tx(`დაწოლა ${bedtime}`, `Bedtime ${bedtime}`) : tx('ძილის გეგმით', 'From your sleep plan'),
      inline: slept ? tx(`ძილი ${formatHoursCompact(slept)}`, `Slept ${formatHoursCompact(slept)}`) : tx(`დაწოლა ${bedtime}`, `Bedtime ${bedtime}`),
      fraction: slept ? Math.min(1, slept / plan.goalMinutes) : 0,
      countdownTo: 0,
      countdownLabel: '',
      openUrl: OPEN_URL,
    };
  };
  const evening = (bed: Date, lastSlept: number | null): Partial<SleepWidgetProps> => ({
    state: 'evening',
    label: tx('დაწოლამდე', 'Until bedtime'),
    value: hhmm(bed.getHours() * 60 + bed.getMinutes()),
    detail: lastSlept ? tx(`ბოლო ღამე ${formatDuration(lastSlept)}`, `Last night ${formatDuration(lastSlept)}`) : tx('ძილის გეგმით', 'From your sleep plan'),
    inline: tx(`დაწოლა ${hhmm(bed.getHours() * 60 + bed.getMinutes())}`, `Bedtime ${hhmm(bed.getHours() * 60 + bed.getMinutes())}`),
    countdownTo: bed.getTime(),
    countdownLabel: tx(`დაწოლა ${hhmm(bed.getHours() * 60 + bed.getMinutes())}-ზე`, `Bedtime at ${hhmm(bed.getHours() * 60 + bed.getMinutes())}`),
    fraction: 0,
    openUrl: OPEN_URL,
  });
  const nightProps = (alarmAt: number | null): Partial<SleepWidgetProps> => {
    const alarm = alarmAt ? hhmm(new Date(alarmAt).getHours() * 60 + new Date(alarmAt).getMinutes()) : '';
    return {
      state: 'night',
      label: tx('ძილის რეჟიმი', 'Sleep mode'),
      value: alarm || '—',
      detail: alarm ? tx('მაღვიძარა', 'Alarm') : tx('ტკბილი ძილი', 'Sleep well'),
      inline: alarm ? tx(`მაღვიძარა ${alarm}`, `Alarm ${alarm}`) : tx('ძილის რეჟიმი', 'Sleep mode'),
      countdownTo: 0, countdownLabel: '', fraction: 0, openUrl: 'medicard://sleep/night',
    };
  };
  if (session) {
    const until = session.alarmAt ?? session.startedAt + 10 * 3600_000;
    return [
      { date: now, props: nightProps(session.alarmAt) },
      // After the alarm: last night is not saved yet, so the plain tile until the app saves it.
      { date: new Date(Math.max(now.getTime() + 60_000, until + 30 * 60_000)), props: { ...EMPTY_SLEEP_WIDGET, detail: tx('როგორ გეძინა? გახსენი MEDISLEEP', 'How did you sleep? Open MEDISLEEP') } },
    ];
  }
  const { windDown, bedtime, wake } = tonight(plan, now);
  const entries: { date: Date; props: Partial<SleepWidgetProps> }[] = [];
  const startEvening = new Date(Math.min(windDown.getTime(), bedtime.getTime() - 3 * 3600_000));
  if (now.getTime() < startEvening.getTime()) entries.push({ date: now, props: rest(now) });
  entries.push({ date: new Date(Math.max(now.getTime(), startEvening.getTime())), props: evening(bedtime, last?.sleptMinutes ?? null) });
  // Past the bedtime without sleep mode: still „დაწოლა“ (the countdown is over), until the wake-up.
  entries.push({ date: bedtime, props: { ...evening(bedtime, last?.sleptMinutes ?? null), countdownTo: 0, label: tx('დაწოლის დროა', "It's bedtime") } });
  entries.push({ date: wake, props: { ...rest(wake), detail: tx('როგორ გეძინა? შეაფასე ღამე', 'How did you sleep? Rate the night') } });
  return entries.filter((e, i, list) => i === 0 || e.date.getTime() > list[i - 1].date.getTime());
}

