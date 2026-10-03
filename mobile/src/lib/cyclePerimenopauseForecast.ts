/**
 * Perimenopause next period (W3-4, brief §9 „მერე“ item 7; Flo shows a range, never a date, here).
 *
 * The server sends `perimenopause.forecast.status` (learning | range | long_gap | no_bleeding_12m) and
 * the window as `predictions.nextPeriodRange` (from her last ≤ 6 not-hidden cycles, ≥ 7 and ≤ 60 days
 * wide). This file only words it, with the same window states every other surface uses
 * (`cyclePeriodWindow`: before / open / late). Never a single date, never „late“ as an alarm, always
 * „სავარაუდოდ“. Plain module (relative imports only) so node tests load it.
 */
import { tx } from '../i18n/locale.js';
import { shortDateRange } from './cycleForecastCopy.ts';
import { cyclePeriodWindow, cycleSpreadModel, daysBetweenKeys } from './home/homeCycle.ts';

export type PeriForecastInput = {
  /** `bundle.perimenopause.forecast` (status / range / daysSinceBleeding are optional on older servers). */
  forecast?: {
    status?: string | null;
    range?: { basedOn?: number | null } | null;
    daysSinceBleeding?: number | null;
  } | null;
  /** `bundle.predictions` — the window and the median estimate it is placed around. */
  predictions?: { nextPeriodStart?: string | null; nextPeriodRange?: { from: string; to: string } | null } | null;
  today: string;
};

export type PeriForecastView = {
  kind: 'range' | 'learning' | 'longGap' | 'noBleeding12m';
  /** For `range`: where today sits in the window. */
  state: 'before' | 'open' | 'late' | null;
  from: string | null;
  to: string | null;
  /** The big line: „სავარაუდოდ 3–12 ოქტ“ / a calm sentence. */
  title: string;
  /** The line under it: „5–14 დღეში“, „შეიძლება დაიწყოს დღეს ან …“, the doctor note. */
  detail: string | null;
  /** Where the window comes from („შენი ბოლო 5 ციკლის მიხედვით …“), only for a window. */
  basis: string | null;
  /** One short line for Home: „სავარაუდოდ 3–12 ოქტ“ / the calm title. */
  short: string;
};

const LONG_GAP_DAYS = 60;

export function periNextPeriodLabel(): string {
  return tx('შემდეგი მენსტრუაცია', 'Next period');
}

function likelyRange(from: string, to: string): string {
  return tx(`სავარაუდოდ ${shortDateRange(from, to, false)}`, `Likely ${shortDateRange(from, to, true)}`);
}

function inDaysRange(a: number, b: number): string {
  if (a === b) return tx(`${a} დღეში`, a === 1 ? 'in 1 day' : `in ${a} days`);
  return tx(`${a}–${b} დღეში`, `in ${a}–${b} days`);
}

function openTail(daysLeft: number): string {
  if (daysLeft <= 0) return tx('შეიძლება დაიწყოს დღეს — ფანჯრის ბოლო დღეა', 'May start today — the last day of the window');
  return tx(
    `შეიძლება დაიწყოს დღეს ან მომდევნო ${daysLeft} დღეში`,
    daysLeft === 1 ? 'May start today or tomorrow' : `May start today or within the next ${daysLeft} days`,
  );
}

function basisLine(n: number | null | undefined): string {
  const count = Math.max(2, Math.round(Number(n) || 0));
  return tx(
    `შენი ბოლო ${count} ციკლის მიხედვით · ერთ თარიღს არ ვამბობთ`,
    `From your last ${count} cycles · we don’t name one date`,
  );
}

function learning(): PeriForecastView {
  const title = tx('ვსწავლობთ შენს რიტმს', 'Learning your rhythm');
  return {
    kind: 'learning',
    state: null,
    from: null,
    to: null,
    title,
    detail: tx('სანამ რამდენიმე ციკლს არ დავითვლით, თარიღს არ ვამბობთ.', 'Until we have counted a few cycles, we don’t give a date.'),
    basis: null,
    short: tx('თარიღს ჯერ არ ვამბობთ', 'No date yet'),
  };
}

function longGap(days: number | null): PeriForecastView {
  const title = tx('დიდი ხანია მენსტრუაცია არ ყოფილა', 'It has been a while since your last period');
  return {
    kind: 'longGap',
    state: null,
    from: null,
    to: null,
    title,
    detail:
      days != null
        ? tx(`ბოლო სისხლდენიდან ${days} დღე გავიდა. ესაუბრე ექიმს, თუ გაწუხებს.`, `${days} days since your last bleeding. Talk to a doctor if it worries you.`)
        : tx('ესაუბრე ექიმს, თუ გაწუხებს.', 'Talk to a doctor if it worries you.'),
    basis: null,
    short: title,
  };
}

function noBleeding12m(): PeriForecastView {
  const title = tx('12 თვეა სისხლდენა არ აღგირიცხავს', 'No bleeding logged for 12 months');
  return {
    kind: 'noBleeding12m',
    state: null,
    from: null,
    to: null,
    title,
    detail: tx(
      'ექიმს შეუძლია დაადასტუროს, დადგა თუ არა მენოპაუზა. თუ სისხლდენა ისევ გამოჩნდება, ესაუბრე ექიმს.',
      'A doctor can confirm whether this is menopause. If bleeding comes back, talk to a doctor.',
    ),
    basis: null,
    short: title,
  };
}

/**
 * The perimenopause hero's forecast block. An older server (no `status`) or no window → learning;
 * a long gap / 12 months win over the window the server already ruled out.
 */
export function periForecastView({ forecast, predictions, today }: PeriForecastInput): PeriForecastView {
  const status = forecast?.status ?? null;
  const since = forecast?.daysSinceBleeding ?? null;
  if (status === 'no_bleeding_12m') return noBleeding12m();
  if (status === 'long_gap') return longGap(since);
  const range = predictions?.nextPeriodRange;
  const next = predictions?.nextPeriodStart ?? null;
  if (status !== 'range' || !range?.from || !range?.to || !next) return learning();
  const spread = cycleSpreadModel({ isIrregular: true, usedCycleLength: null, cycleLengths: null, nextPeriodStart: next, serverRange: range });
  const win = cyclePeriodWindow({ today, nextPeriodStart: next, spread });
  if (!win) return learning();
  const title = likelyRange(win.from, win.to);
  const basis = basisLine(forecast?.range?.basedOn);
  if (win.state === 'before') {
    return { kind: 'range', state: 'before', from: win.from, to: win.to, title, detail: inDaysRange(win.startsIn, daysBetweenKeys(today, win.to)), basis, short: title };
  }
  if (win.state === 'open') {
    return { kind: 'range', state: 'open', from: win.from, to: win.to, title, detail: openTail(win.daysLeft), basis, short: title };
  }
  // The window passed without a logged bleed: calm, never „late“ in this mode (the server turns a gap
  // over LONG_GAP_DAYS into the long-gap state above).
  if (since != null && since > LONG_GAP_DAYS) return longGap(since);
  const passed = tx('სავარაუდო ფანჯარა გავიდა', 'The estimated window has passed');
  return {
    kind: 'range',
    state: 'late',
    from: win.from,
    to: win.to,
    title: passed,
    detail: tx(
      `${shortDateRange(win.from, win.to, false)} · როცა დაიწყება, უბრალოდ აღნიშნე.`,
      `${shortDateRange(win.from, win.to, true)} · When it starts, just log it.`,
    ),
    basis,
    short: passed,
  };
}
