/**
 * „MEDICARD ციკლი“ on the iPhone Home screen and lock screen (train 1.0.0.20, brief §8.7 / §9 „მერე“).
 *
 * Pure: builds the props the widget extension renders (`cycleWidgetLayout.tsx`) and the Live Activity
 * shows on the expected day (`cycleDayActivityLayout.tsx`). Every word is decided here, in the app's
 * language; the layouts only draw props. No React Native and only relative value imports, so node tests
 * load it.
 *
 * Rules (owner, brief [კ-32]):
 * - Period family only — the same words as the Home glow and the default reminders: „მენსტრუაციამდე
 *   · 3 დღე · სავარაუდოდ“, a variable cycle's window, „ვსწავლობთ“, „თვალყურის დევნება“, „მენსტრუაციის
 *   დღე N“. Fertile days, ovulation, sex, BBT, tests, pregnancy and postpartum never appear, and the
 *   dot is rose (period) or a calm grey — never the fertile turquoise, even when she sees it in the app.
 * - Discreet: the cycle Face ID / PIN lock, privacy mode, masked cycle notifications, Medi's discreet
 *   notifications or her own „დამალვა“ switch → a neutral tile, „MEDICARD“ and a dot, nothing else.
 * - Signed out, another account, the cycle module paused, pregnancy, no data → the same neutral tile.
 */
import type { CycleBundle } from './api';
import { WEEKDAYS_KA } from '../constants/cycle.ts';
import { ka } from '../i18n/ka.ts';
import { tx } from '../i18n/locale.js';
import { cycleDark, cycleLight } from '../theme/cyclePalette.ts';
import { phaseFromBundle, usedCycleLength } from './cycleCanonical.ts';
import { bleedingIsUncertain } from './cycleContraception.ts';
import { needsCycleOnboarding } from './cycleExperience.ts';
import { shortDateRange } from './cycleForecastCopy.ts';
import { forecastPresentationAllowed, suppressCycleLengthChrome } from './cycleForecastEligibility.js';
import { cycleBundleCapabilities, cycleModeCapabilities } from './cycleModes.js';
import { heroPeriodState } from './cyclePeriodStatus.ts';
import {
  addDaysKey,
  cycleCenter,
  cyclePeriodWindow,
  cycleSpreadModel,
  daysBetweenKeys,
  weekdayIndex,
  type CycleCenter,
} from './home/homeCycle.ts';

/** Bumped when the props shape changes (the extension may hold an older timeline until the next write). */
export const CYCLE_WIDGET_PROPS_VERSION = 1;
export const CYCLE_WIDGET_BRAND = 'MEDICARD';
/** „დაიწყო“ in the medium widget / Live Activity: the one-tap period start (claimed once per day). */
export const CYCLE_WIDGET_START_URL = 'medicard://cycle?periodStart=1';
export const CYCLE_WIDGET_OPEN_URL = 'medicard://cycle';
/** The neutral tile opens the app on Home — nothing about the cycle, even in the link. */
export const CYCLE_WIDGET_NEUTRAL_URL = 'medicard://';

export type CycleWidgetState =
  | 'neutral'
  | 'countdown'
  | 'window'
  | 'today'
  | 'period'
  | 'late'
  | 'cycleDay'
  | 'learning'
  | 'tracking';

/** period / expected = the number in rose · calm / neutral = the number in ink. */
export type CycleWidgetTone = 'period' | 'expected' | 'calm' | 'neutral';

export type CycleWidgetColors = {
  bg: string;
  ink: string;
  muted: string;
  /** The rose of the answer on a period / expected day, a calm grey otherwise. */
  dot: string;
  button: string;
  onButton: string;
};

export type CycleWidgetProps = {
  v: number;
  state: CycleWidgetState;
  brand: string;
  /** Small line over the number („მენსტრუაციამდე“). Empty on the neutral tile. */
  caption: string;
  /** The big answer („3“, „3–7“, „დღეს“). Empty when the caption says it all. */
  value: string;
  /** Word after the number („დღე“). */
  unit: string;
  /** Line under it („სავარაუდოდ“). */
  note: string;
  /** Medium widget only: dates („ხუთ, 6 ოქტ“ / „3–9 ოქტ“). */
  detail: string;
  /** VoiceOver: the whole answer in one sentence. */
  a11y: string;
  tone: CycleWidgetTone;
  /** „დაიწყო“ — empty = no button (neutral, already on the period). */
  startLabel: string;
  startA11y: string;
  startUrl: string;
  openUrl: string;
  light: CycleWidgetColors;
  dark: CycleWidgetColors;
  /** The app group folder with the logo PNGs (`cycleWidgetArt.ts`), added by the controller; absent =
   *  no logo art yet, the widget draws the words only. */
  art?: string;
};

/** Words that must never reach the widget or the Live Activity (tests scan every snapshot). */
export const CYCLE_WIDGET_FORBIDDEN =
  /ნაყოფიერ|ოვულაც|სექს|ლიბიდო|ტემპერატურ|ტესტ|ორსულ|მშობიარ|მშობიარობის|ლორწო|fertil|ovulat|\bsex|libido|temperature|\bbbt\b|\btest|pregnan|postpartum|mucus/i;

function colors(tone: CycleWidgetTone, dark: boolean): CycleWidgetColors {
  const p = dark ? cycleDark : cycleLight;
  return {
    bg: p.card,
    ink: p.ink,
    muted: p.muted,
    dot: tone === 'period' || tone === 'expected' ? p.period : p.mutedSoft,
    button: p.cta,
    onButton: p.onPrimary,
  };
}

function base(state: CycleWidgetState, tone: CycleWidgetTone): CycleWidgetProps {
  return {
    v: CYCLE_WIDGET_PROPS_VERSION,
    state,
    brand: CYCLE_WIDGET_BRAND,
    caption: '',
    value: '',
    unit: '',
    note: '',
    detail: '',
    a11y: CYCLE_WIDGET_BRAND,
    tone,
    startLabel: '',
    startA11y: '',
    startUrl: CYCLE_WIDGET_START_URL,
    openUrl: state === 'neutral' ? CYCLE_WIDGET_NEUTRAL_URL : CYCLE_WIDGET_OPEN_URL,
    light: colors(tone, false),
    dark: colors(tone, true),
  };
}

/** „MEDICARD“ and a grey dot — what a discreet, signed-out or paused widget shows. */
export function neutralCycleWidget(): CycleWidgetProps {
  return base('neutral', 'neutral');
}

/**
 * Discreet is automatic: any of the cycle lock, privacy mode, masked cycle notifications or Medi's
 * discreet notifications makes the widget neutral, and her own „დამალვა“ switch can only add to it.
 * A switch that could not be read counts as on (`null`).
 */
export function cycleWidgetDiscreet(input: {
  lockOn: boolean | null;
  privacyEnabled: boolean | null | undefined;
  maskNotifications: boolean | null;
  engageDiscreet: boolean | null;
  widgetDiscreet: boolean | null;
}): boolean {
  return (
    input.lockOn !== false ||
    Boolean(input.privacyEnabled) ||
    input.maskNotifications !== false ||
    input.engageDiscreet !== false ||
    input.widgetDiscreet !== false
  );
}

/** The person may turn her own „დამალვა“ switch off only while nothing else forces discreet. */
export function cycleWidgetDiscreetForced(input: {
  lockOn: boolean | null;
  privacyEnabled: boolean | null | undefined;
  maskNotifications: boolean | null;
  engageDiscreet: boolean | null;
}): boolean {
  return cycleWidgetDiscreet({ ...input, widgetDiscreet: false });
}

function dayWord(n: number): string {
  return tx('დღე', n === 1 ? 'day' : 'days');
}

function shortDay(ymd: string): string {
  return shortDateRange(ymd, ymd);
}

function windowOpenTail(days: number): string {
  return tx(`ან მომდევნო ${days} დღეში`, days === 1 ? 'or tomorrow' : `or within the next ${days} days`);
}

function startCopy(uncertain: boolean, tracking: boolean) {
  return {
    startLabel: tx('დაიწყო', 'Started'),
    startA11y: tracking ? tx('ახალი ციკლის დაწყება', 'Start a new cycle') : uncertain ? ka.cycle.heroBleedingStarted : ka.cycle.heroPeriodStarted,
  };
}

function finish(props: CycleWidgetProps): CycleWidgetProps {
  const sentence = [props.caption, [props.value, props.unit].filter(Boolean).join(' '), props.note, props.detail]
    .filter(Boolean)
    .join(' · ');
  return { ...props, a11y: sentence ? `${CYCLE_WIDGET_BRAND} · ${sentence}` : CYCLE_WIDGET_BRAND };
}

function learning(note: string, uncertain: boolean): CycleWidgetProps {
  return finish({
    ...base('learning', 'calm'),
    caption: tx('ვსწავლობთ შენს რიტმს', 'Learning your rhythm'),
    note,
    ...startCopy(uncertain, false),
  });
}

function tracking(day: string): CycleWidgetProps {
  const [, m, d] = day.split('-').map(Number);
  return finish({
    ...base('tracking', 'calm'),
    caption: tx('თვალყურის დევნება', 'Tracking'),
    value: String(d),
    unit: shortDay(day).split(' ').slice(1).join(' ') || String(m),
    note: tx('როგორ ხარ დღეს?', 'How are you today?'),
    ...startCopy(false, true),
  });
}

/**
 * Today's period status as the server will see it on a later day: `active` through the usual length,
 * `askStill` the day after, then `ended` (server cyclePeriodStatus.js). Only for the widget's next days.
 */
function projectedStatus(bundle: CycleBundle, baseToday: string, day: string) {
  const status = bundle.periodStatus;
  const k = daysBetweenKeys(baseToday, day);
  if (!status || bundle.meta?.today !== baseToday) return { status: null, statusToday: null };
  if (k === 0) return { status, statusToday: day };
  if (status.state !== 'active' || status.day == null) return { status: null, statusToday: null };
  const runDay = status.day + k;
  const state = runDay <= status.typicalLength ? 'active' : runDay === status.typicalLength + 1 ? 'askStill' : 'ended';
  return { status: { ...status, state, day: state === 'ended' ? null : runDay } as typeof status, statusToday: day };
}

/** The classic overview's centre for `day` (the Home glow's rules, `HomeCycleHero` ClassicCycleCard). */
function classicModel(bundle: CycleBundle, baseToday: string, day: string) {
  const caps = cycleModeCapabilities(bundle.profile.mode);
  const k = Math.max(0, daysBetweenKeys(baseToday, day));
  const phase = phaseFromBundle(bundle, day);
  const baseDay = phaseFromBundle(bundle, baseToday).day;
  const cycleLen = usedCycleLength(bundle);
  const log = bundle.logs?.find((l) => l.date === day);
  const uncertain = bleedingIsUncertain(bundle);
  const hideLengthChrome = suppressCycleLengthChrome(bundle);
  const hidePredicted = !forecastPresentationAllowed(bundle);
  const projected = projectedStatus(bundle, baseToday, day);
  const periodState = heroPeriodState({
    status: projected.status,
    statusToday: projected.statusToday,
    today: day,
    todayFlow: log?.flow,
    enabled: caps.showClassicCycleOverview && !hideLengthChrome && !hidePredicted && !uncertain,
  });
  const next = bundle.predictions?.nextPeriodStart ?? null;
  const mark = bundle.predictions?.calendar?.[day];
  const predictedToday = Boolean(mark?.period && mark.predicted);
  const forecastOn = Boolean(next) && caps.showNextPeriodForecast && !hidePredicted;
  const inDays = next ? daysBetweenKeys(day, next) : null;
  const cycleDay = hideLengthChrome ? null : phase.day ?? (baseDay != null ? baseDay + k : null);
  const runDay = periodState.onPeriod && projected.status?.day != null ? projected.status.day : null;
  const spread = cycleSpreadModel({
    isIrregular: bundle.profile.isIrregular,
    usedCycleLength: cycleLen,
    cycleLengths: bundle.trends?.cycleLengths,
    nextPeriodStart: next,
    serverRange: bundle.predictions?.nextPeriodRange ?? null,
  });
  const center = cycleCenter({
    hideLengthChrome,
    hidePredicted,
    onPeriod: periodState.onPeriod,
    predictedToday,
    forecastOn,
    inDays,
    day: runDay ?? cycleDay,
    cycleLength: cycleLen,
    spread,
  });
  const window = cyclePeriodWindow({ today: day, nextPeriodStart: next, spread });
  return { center, window, next, uncertain, cycleLen, forecastOn, onPeriod: periodState.onPeriod, inDays, predictedToday };
}

function fromCenter(
  center: CycleCenter,
  model: ReturnType<typeof classicModel>,
): CycleWidgetProps {
  const { uncertain, window, next } = model;
  const start = startCopy(uncertain, false);
  const until = uncertain ? ka.cycle.heroUntilBleeding : ka.cycle.heroUntilPeriod;
  switch (center.kind) {
    case 'periodDay':
      return finish({
        ...base('period', 'period'),
        caption: uncertain ? ka.cycle.heroBleedingDay : ka.cycle.heroPeriodDay,
        value: center.day != null ? String(center.day) : '—',
      });
    case 'periodToday':
      return finish({
        ...base('today', 'expected'),
        caption: ka.cycle.heroLikely,
        value: ka.cycle.heroToday,
        note: ka.cycle.legendPeriodPredicted,
        ...start,
      });
    case 'windowOpen':
      return finish({
        ...base('today', 'expected'),
        caption: ka.cycle.heroLikely,
        value: ka.cycle.heroToday,
        note: center.to > 0 ? windowOpenTail(center.to) : ka.cycle.legendPeriodPredicted,
        detail: window ? shortDateRange(window.from, window.to) : '',
        ...start,
      });
    case 'countdown':
      return finish({
        ...base('countdown', 'calm'),
        caption: until,
        value: String(center.days),
        unit: dayWord(center.days),
        note: ka.cycle.heroLikely,
        detail: next ? `${WEEKDAYS_KA[weekdayIndex(next)]}, ${shortDay(next)}` : '',
        ...start,
      });
    case 'countdownRange':
      return finish({
        ...base('window', 'calm'),
        caption: until,
        value: `${center.from}–${center.to}`,
        unit: tx('დღე', 'days'),
        note: `${ka.cycle.heroLikely} · ${tx('ციკლები ცვალებადია', 'cycles vary')}`,
        detail: window ? shortDateRange(window.from, window.to) : '',
        ...start,
      });
    case 'late':
      return finish({
        ...base('late', 'calm'),
        caption: ka.cycle.cycleDay,
        value: String(center.day),
        note: ka.cycle.heroLateBy(center.lateBy),
        ...start,
      });
    case 'cycleDay':
      if (center.day == null) return learning(tx('აღრიცხე შემდეგი მენსტრუაცია', 'Log your next period'), uncertain);
      return finish({
        ...base('cycleDay', 'calm'),
        caption: ka.cycle.cycleDay,
        value: String(center.day),
        note: center.length ? tx(`${center.length}-დან`, `of ${center.length}`) : '',
        ...start,
      });
    default:
      return learning(tx('აღრიცხე შემდეგი მენსტრუაცია', 'Log your next period'), uncertain);
  }
}

export type CycleWidgetInput = {
  bundle: CycleBundle | null | undefined;
  /** The day to show (YYYY-MM-DD, local civil date). */
  day: string;
  /** Today as the app sees it — the bundle's server stamps belong to this day. Defaults to `day`. */
  today?: string;
  discreet: boolean;
  /** The cycle module is on (admin switch) and someone is signed in. */
  available: boolean;
};

/** What the widget shows on `day`. Neutral whenever anything is unknown, off or discreet. */
export function cycleWidgetSnapshot({ bundle, day, today = day, discreet, available }: CycleWidgetInput): CycleWidgetProps {
  if (!available || discreet || !bundle?.profile) return neutralCycleWidget();
  const caps = cycleModeCapabilities(bundle.profile.mode);
  // Pregnancy never shows on a Home screen; postpartum / perimenopause / Tracking show the neutral
  // „თვალყურის დევნება“ with the date (no forecast exists for them, and the words never say why).
  if (caps.showPregnancyOverview) return neutralCycleWidget();
  if (caps.showPostpartumOverview || caps.showPerimenopauseTracking) return tracking(day);
  if (cycleBundleCapabilities(bundle).showTrackingOverview) return tracking(day);
  if (needsCycleOnboarding(bundle.profile.mode, bundle.profile.lastPeriodStart ?? null)) {
    return learning(tx('მიუთითე ბოლო მენსტრუაცია', 'Add your last period'), bleedingIsUncertain(bundle));
  }
  const model = classicModel(bundle, today, day);
  return fromCenter(model.center, model);
}

/** Midnight of each civil day from today for `days` days: the widget changes its number by itself. */
export function cycleWidgetTimeline(input: Omit<CycleWidgetInput, 'day' | 'today'> & { today: string; days?: number }) {
  const count = Math.max(1, Math.min(14, input.days ?? 7));
  const out: { day: string; props: CycleWidgetProps }[] = [];
  for (let k = 0; k < count; k += 1) {
    const day = addDaysKey(input.today, k);
    out.push({ day, props: cycleWidgetSnapshot({ ...input, day, today: input.today }) });
  }
  return out;
}

/** Local midnight of a civil day (the timeline entry's date). */
export function civilDayStart(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 1);
}

// ---------- „სავარაუდო დღე ჩაკეტილ ეკრანზე“ (Live Activity, off by default) ----------

/** The Live Activity stays at most this long; the system itself ends it sooner (8 h active + 4 h). */
export const CYCLE_DAY_ACTIVITY_MAX_MS = 24 * 3600 * 1000;

export type CycleDayActivityPlan =
  | { action: 'none' }
  | { action: 'start'; dueDay: string; props: CycleWidgetProps }
  | { action: 'update'; props: CycleWidgetProps }
  | { action: 'end' };

/**
 * Whether today is the expected first day (the single estimate, or the first day of a variable cycle's
 * window) and she has not logged bleeding yet. Same gates as the Home glow.
 */
export function cycleExpectedDayDue(bundle: CycleBundle | null | undefined, today: string): boolean {
  if (!bundle?.profile) return false;
  const caps = cycleModeCapabilities(bundle.profile.mode);
  if (!caps.showClassicCycleOverview || caps.showPregnancyOverview) return false;
  if (cycleBundleCapabilities(bundle).showTrackingOverview) return false;
  if (needsCycleOnboarding(bundle.profile.mode, bundle.profile.lastPeriodStart ?? null)) return false;
  const model = classicModel(bundle, today, today);
  if (!model.forecastOn || model.onPeriod) return false;
  if (model.window) return model.window.from === today;
  return model.inDays === 0 || model.predictedToday;
}

/**
 * One decision per sync: start on the expected day (once — `shownFor` remembers the day, so a dismissed
 * activity never comes back), update it when discreet / the words change, end it when bleeding is
 * logged, the switch is off, the cycle is unavailable, or it has been up for 24 h.
 */
export function cycleDayActivityPlan(input: {
  enabled: boolean;
  available: boolean;
  bundle: CycleBundle | null | undefined;
  today: string;
  discreet: boolean;
  now: number;
  /** The running activity (this process saw it start, or found it at launch). */
  running: { startedAt: number; dueDay: string; key: string } | null;
  /** The expected day an activity was already started for (persisted). */
  shownFor: string | null;
}): CycleDayActivityPlan {
  const { enabled, available, bundle, today, discreet, now, running, shownFor } = input;
  if (running) {
    if (!enabled || !available || !bundle) return { action: 'end' };
    if (now - running.startedAt >= CYCLE_DAY_ACTIVITY_MAX_MS) return { action: 'end' };
    // Bleeding logged (or the period otherwise started) → the estimate is answered.
    const model =
      bundle.profile && cycleModeCapabilities(bundle.profile.mode).showClassicCycleOverview ? classicModel(bundle, today, today) : null;
    if (!model || model.onPeriod || bundle.profile.lastPeriodStart === today) return { action: 'end' };
    // Past midnight the words move on with the day („ან მომდევნო N დღეში“) until the 24 h are up.
    const props = activityProps(bundle, today, discreet, available);
    return activityKey(props) === running.key ? { action: 'none' } : { action: 'update', props };
  }
  if (!enabled || !available || !bundle || shownFor === today) return { action: 'none' };
  if (!cycleExpectedDayDue(bundle, today)) return { action: 'none' };
  return { action: 'start', dueDay: today, props: activityProps(bundle, today, discreet, available) };
}

/** The Live Activity reuses the widget's words; discreet = „MEDICARD“ only. */
export function activityProps(bundle: CycleBundle | null | undefined, today: string, discreet: boolean, available = true): CycleWidgetProps {
  return cycleWidgetSnapshot({ bundle, day: today, today, discreet, available });
}

/** What the person can see — an update is sent only when it changes. */
export function activityKey(props: CycleWidgetProps): string {
  return [props.state, props.caption, props.value, props.unit, props.note, props.tone, props.startLabel].join('|');
}

/**
 * The widget's „დაიწყო“ opened the cycle screen: start the period with the one-tap flow only when the
 * hero would offer it — a classic or Tracking cycle (never pregnancy / postpartum / perimenopause),
 * not already started today, no bleeding logged today, no period running. Otherwise the screen just opens.
 */
export function cycleWidgetStartAllowed(bundle: CycleBundle | null | undefined, today: string): boolean {
  if (!bundle?.profile) return false;
  const caps = cycleModeCapabilities(bundle.profile.mode);
  if (caps.showPregnancyOverview || caps.showPostpartumOverview || caps.showPerimenopauseTracking) return false;
  if (bundle.profile.lastPeriodStart === today) return false;
  const flow = bundle.logs?.find((l) => l.date === today)?.flow;
  if (flow === 'light' || flow === 'medium' || flow === 'heavy') return false;
  const status = bundle.periodStatus;
  if (status && bundle.meta?.today === today && status.state === 'active') return false;
  return true;
}
