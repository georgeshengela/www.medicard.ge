/**
 * TTC fertility signs read on the device (MEDICARD Cycle brief §9 wave 2 item 4, [კ-11]): at most ONE
 * calm, hedged line for the current cycle from what she logged herself — basal body temperature (BBT),
 * ovulation tests (OPK) and cervical mucus.
 *
 *  1. BBT thermal shift — the fertility-awareness „3 over 6“ coverline rule → „BBT 3 დღეა მომატებულია —
 *     სავარაუდოდ ოვულაცია უკვე მოხდა“.
 *  2. A positive OPK today or yesterday, no thermal shift yet → „OPK დადებითია — ოვულაცია სავარაუდოდ
 *     მომდევნო 1–2 დღეშია“.
 *  3. Egg-white or watery mucus logged today, no thermal shift yet → „ლორწო ნაყოფიერ დღეებს ჰგავს“.
 *  Priority: thermal shift > OPK > mucus.
 *
 * The „3 over 6“ rule as implemented here:
 *  - Only this cycle's readings count: logs from the last period start on or before `date` up to `date`,
 *    one per day, with a plausible value (35.0–39.0 °C; anything else is a typo and is skipped).
 *  - Readings are taken in date order and a day she did not measure is simply skipped — it does NOT break
 *    a run. „Consecutive“ and „previous six“ therefore mean consecutive recorded readings.
 *  - The coverline for reading i is the highest of the six readings before it, so at least 6 readings
 *    must exist in the cycle before the rise. A shift starts at the first i where readings i, i+1 and
 *    i+2 are each at least 0.20 °C above that coverline (compared in hundredths, so 0.19 is not enough
 *    and 0.20 is, without float noise).
 *  - Once found, the shift lasts while readings stay above the coverline. The line is shown only while
 *    that run reaches her latest reading and that reading is no older than 2 days — otherwise it says
 *    nothing (a stale or broken run is not announced). A shift found anywhere in the cycle still means
 *    „not yet“ is over: the OPK and mucus lines are no longer shown.
 *  - „N დღეა“ counts the high readings in the run (days measured), never extrapolated days.
 *
 * Gates: TRY_TO_CONCEIVE only, fertile-days display on (`showFertilityUi`: her switch, Tracking and
 * hormonal contraception), and the cycle lock open or not set (the /cycle stack renders only after
 * `requireCycleUnlock`, so the screens pass `locked: false`). Sex ids are never read.
 *
 * Privacy: BBT, OPK and mucus are SENSITIVE (`cycleObservationRegistry`). This module runs only on the
 * device, inside the cycle screens (/cycle TTC card and today's day sheet). Nothing here is sent to AI,
 * a partner, analytics, push or Home — `cycleTtcSignals.test.ts` guards the import sites.
 *
 * Pure (no React Native, relative imports): `node --experimental-strip-types --test` loads it.
 */
import { tx } from '../i18n/locale.js';
import { bundlePeriodStarts } from './cycleExpectations.ts';
import { showFertilityUi } from './cycleContraception.ts';

export type TtcSignalKind = 'thermalShift' | 'opkPositive' | 'fertileMucus';

export type TtcSignal = {
  kind: TtcSignalKind;
  /** The one line, already in the app language. */
  text: string;
  /** Thermal shift: how many high readings the run holds (≥ 3). */
  days?: number;
  /** OPK: whether the positive test was today or yesterday. */
  opkWhen?: 'today' | 'yesterday';
};

export type TtcSignalLog = {
  date: string;
  bbt?: number | null;
  ovulationTest?: string | null;
  cervicalMucus?: string | null;
};

export type TtcSignalInput = {
  mode: string | null | undefined;
  /** Fertile-days display (and fertility not hidden by contraception). */
  fertilityDisplay: boolean;
  /** True while the cycle lock is set and not opened. */
  locked: boolean;
  logs: readonly TtcSignalLog[];
  periodStarts: readonly string[];
  /** The day the line is for — today (the screens never ask for another day). */
  date: string;
};

export type BbtReading = { date: string; bbt: number };

export type ThermalShift = {
  /** Date of the first of the three high readings. */
  start: string;
  /** Highest of the six readings before the rise, in °C. */
  coverline: number;
  /** High readings in the run (from `start` while above the coverline). */
  days: number;
  /** Date of the last reading in the run. */
  last: string;
  /** The run reaches her latest reading in this cycle. */
  ongoing: boolean;
};

export const SHIFT_PRIOR_READINGS = 6;
export const SHIFT_HIGH_READINGS = 3;
/** 0.20 °C, in hundredths. */
export const SHIFT_MIN_RISE_CENTI = 20;
/** The latest high reading may be at most this many days before `date` for the line to show. */
export const SHIFT_MAX_AGE_DAYS = 2;
/** Mucus types that look like fertile days. */
export const FERTILE_MUCUS = new Set(['eggwhite', 'watery']);

const BBT_PLAUSIBLE_MIN = 35;
const BBT_PLAUSIBLE_MAX = 39;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(fromKey: string, toKey: string): number {
  const [ay, am, ad] = fromKey.split('-').map(Number);
  const [by, bm, bd] = toKey.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

const centi = (value: number) => Math.round(value * 100);

/** The first day of the cycle `date` belongs to (last start on or before it), or null. */
export function currentCycleStart(periodStarts: readonly string[], date: string): string | null {
  let best: string | null = null;
  for (const start of periodStarts) {
    if (!DATE_KEY.test(start) || start > date) continue;
    if (!best || start > best) best = start;
  }
  return best;
}

/** This cycle's BBT readings up to `date`: one per day, plausible values only, in date order. */
export function cycleBbtReadings(logs: readonly TtcSignalLog[], cycleStart: string, date: string): BbtReading[] {
  const byDate = new Map<string, number>();
  for (const log of logs) {
    if (!log || !DATE_KEY.test(log.date) || log.date < cycleStart || log.date > date) continue;
    const bbt = typeof log.bbt === 'number' && Number.isFinite(log.bbt) ? log.bbt : null;
    if (bbt == null || bbt < BBT_PLAUSIBLE_MIN || bbt > BBT_PLAUSIBLE_MAX) continue;
    byDate.set(log.date, bbt);
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, bbt]) => ({ date: d, bbt }));
}

/** The „3 over 6“ thermal shift in a cycle's readings (see the header for the exact rule), or null. */
export function findThermalShift(readings: readonly BbtReading[]): ThermalShift | null {
  for (let i = SHIFT_PRIOR_READINGS; i + SHIFT_HIGH_READINGS <= readings.length; i += 1) {
    const coverCenti = Math.max(...readings.slice(i - SHIFT_PRIOR_READINGS, i).map((r) => centi(r.bbt)));
    const high = readings.slice(i, i + SHIFT_HIGH_READINGS).every((r) => centi(r.bbt) >= coverCenti + SHIFT_MIN_RISE_CENTI);
    if (!high) continue;
    let end = i + SHIFT_HIGH_READINGS - 1;
    while (end + 1 < readings.length && centi(readings[end + 1].bbt) > coverCenti) end += 1;
    return {
      start: readings[i].date,
      coverline: coverCenti / 100,
      days: end - i + 1,
      last: readings[end].date,
      ongoing: end === readings.length - 1,
    };
  }
  return null;
}

export function thermalShiftLine(days: number): string {
  return tx(
    `BBT ${days} დღეა მომატებულია — სავარაუდოდ ოვულაცია უკვე მოხდა`,
    `BBT has been higher for ${days} days — ovulation has likely already happened`,
  );
}

export function opkLine(when: 'today' | 'yesterday'): string {
  return when === 'today'
    ? tx('OPK დადებითია — ოვულაცია სავარაუდოდ მომდევნო 1–2 დღეშია', 'Your OPK is positive — ovulation is likely in the next 1–2 days')
    : tx('OPK გუშინ დადებითი იყო — ოვულაცია სავარაუდოდ დღეს ან ხვალაა', 'Yesterday’s OPK was positive — ovulation is likely today or tomorrow');
}

export function mucusLine(): string {
  return tx(
    'ლორწო ნაყოფიერ დღეებს ჰგავს — სავარაუდო ნიშანია, არა გარანტია',
    'Your mucus looks like fertile days — a likely sign, not a promise',
  );
}

/** The one line for `date`, or null. Gated by mode, fertile-days display and the cycle lock. */
export function ttcSignal(input: TtcSignalInput): TtcSignal | null {
  const { mode, fertilityDisplay, locked, logs, periodStarts, date } = input;
  if (mode !== 'TRY_TO_CONCEIVE' || !fertilityDisplay || locked) return null;
  if (!DATE_KEY.test(date)) return null;
  const start = currentCycleStart(periodStarts, date);
  if (!start) return null;

  const shift = findThermalShift(cycleBbtReadings(logs, start, date));
  if (shift) {
    // A shift means ovulation has likely passed: OPK and mucus no longer speak, even if the run went stale.
    if (shift.ongoing && daysBetween(shift.last, date) <= SHIFT_MAX_AGE_DAYS) {
      return { kind: 'thermalShift', text: thermalShiftLine(shift.days), days: shift.days };
    }
    return null;
  }

  const inCycle = (d: string) => logs.find((l) => l?.date === d && d >= start);
  const yesterday = (() => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  })();
  if (inCycle(date)?.ovulationTest === 'positive') return { kind: 'opkPositive', text: opkLine('today'), opkWhen: 'today' };
  if (inCycle(yesterday)?.ovulationTest === 'positive') return { kind: 'opkPositive', text: opkLine('yesterday'), opkWhen: 'yesterday' };

  const mucus = inCycle(date)?.cervicalMucus;
  if (mucus && FERTILE_MUCUS.has(mucus)) return { kind: 'fertileMucus', text: mucusLine() };
  return null;
}

/** The slice of a cycle bundle the line reads (the screens hold the full `CycleBundle`). */
export type TtcSignalBundle = Parameters<typeof showFertilityUi>[0] & {
  logs: readonly TtcSignalLog[];
};

/** The line for `date` from a bundle. `locked` is false on the cycle screens (the stack is gated). */
export function ttcSignalFromBundle(
  bundle: TtcSignalBundle | null | undefined,
  date: string,
  { locked }: { locked: boolean },
): TtcSignal | null {
  if (!bundle) return null;
  return ttcSignal({
    mode: bundle.profile?.mode ?? null,
    fertilityDisplay: showFertilityUi(bundle),
    locked,
    logs: bundle.logs ?? [],
    periodStarts: bundlePeriodStarts(bundle as Parameters<typeof bundlePeriodStarts>[0]),
    date,
  });
}

export type TtcSignalExplain = {
  title: string;
  body: string[];
  caption: string;
  sourceIds: readonly ['menstrualCycle'];
};

/** What the explain sheet says for each line: the rule in plain words, then the same honest close. */
export function ttcSignalExplain(kind: TtcSignalKind): TtcSignalExplain {
  const close = tx(
    'ეს შენი ჩანაწერებიდან გამოტანილი დაკვირვებაა — არა დიაგნოზი და არა კონტრაცეფციის მეთოდი. თუ ორსულობას ცდილობ და კითხვები გაქვს, ესაუბრე ექიმს.',
    'This is an observation from your own logs — not a diagnosis and not a method of contraception. If you are trying to conceive and have questions, talk to a doctor.',
  );
  const caption = tx(
    'ითვლება მხოლოდ შენს ტელეფონზე — Medi-ს, პარტნიორს ან ანალიტიკას არ გადაეცემა.',
    'Worked out on your phone only — never shared with Medi, a partner or analytics.',
  );
  const sourceIds = ['menstrualCycle'] as const;
  if (kind === 'thermalShift') {
    return {
      title: tx('როგორ ვკითხულობთ BBT-ს', 'How we read your BBT'),
      body: [
        tx(
          'ოვულაციის შემდეგ საბაზისო ტემპერატურა ჩვეულებრივ ოდნავ, დაახლოებით 0.2–0.5 °C-ით, იმატებს და მომდევნო მენსტრუაციამდე მაღლა რჩება.',
          'After ovulation, basal body temperature usually rises slightly — by about 0.2–0.5 °C — and stays higher until the next period.',
        ),
        tx(
          'ვიყენებთ „3 ექვსზე“ წესს: სამი ზედიზედ გაზომვა, თითოეული მინიმუმ 0.2 °C-ით მაღალი წინა ექვსი გაზომვიდან ყველაზე მაღალზე. ამ ციკლში მატებამდე მინიმუმ 6 გაზომვაა საჭირო; გამოტოვებული დღე რიგს არ წყვეტს.',
          'We use the “3 over 6” rule: three readings in a row, each at least 0.2 °C above the highest of the six readings before them. This cycle needs at least 6 readings before the rise; a day you did not measure does not break the run.',
        ),
        tx(
          'ტემპერატურა ოვულაციას მხოლოდ მას შემდეგ აჩვენებს, რაც ის მოხდა — წინასწარ არ აფრთხილებს. მას ცვლის ცუდი ძილი, ავადობა, ალკოჰოლი და გაზომვის სხვა დრო.',
          'Temperature only shows ovulation after it has happened — it gives no advance notice. Poor sleep, illness, alcohol or measuring at a different time can change it.',
        ),
        close,
      ],
      caption,
      sourceIds,
    };
  }
  if (kind === 'opkPositive') {
    return {
      title: tx('როგორ ვკითხულობთ OPK-ს', 'How we read your OPK'),
      body: [
        tx(
          'ოვულაციის ტესტი (OPK) LH ჰორმონის მატებას აჩენს. ოვულაცია ჩვეულებრივ ამ მატებიდან დაახლოებით 24–36 საათში ხდება.',
          'An ovulation test (OPK) picks up the rise in the hormone LH. Ovulation usually follows about 24–36 hours after that rise.',
        ),
        tx(
          'ამიტომ დადებითი ტესტის დღეს და მომდევნო დღეს ვამბობთ, რომ ოვულაცია სავარაუდოდ ახლოსაა. როცა BBT-ის მატებაც გამოჩნდება, ეს ხაზი მას დაუთმობს ადგილს. ტესტი ზოგჯერ ოვულაციის გარეშეც შეიძლება დადებითი იყოს.',
          'So on the day of a positive test and the day after, we say ovulation is likely close. Once a BBT rise shows up, that line takes over. A test can sometimes be positive without ovulation following.',
        ),
        close,
      ],
      caption,
      sourceIds,
    };
  }
  return {
    title: tx('როგორ ვკითხულობთ ლორწოს', 'How we read your mucus'),
    body: [
      tx(
        'ოვულაციასთან ახლოს ლორწო ხშირად წყლიანი, გამჭვირვალე და გაწელვადი ხდება — კვერცხის ცილის მსგავსი. ასეთი ლორწო ნაყოფიერი დღეებისთვისაა დამახასიათებელი.',
        'Close to ovulation, mucus often becomes watery, clear and stretchy — like raw egg white. That kind of mucus is typical of fertile days.',
      ),
      tx(
        'ეს ნიშანია, არა გარანტია — ლორწო სხვა მიზეზითაც შეიძლება შეიცვალოს. ხაზი მხოლოდ დღევანდელ ჩანაწერს კითხულობს.',
        'It is a sign, not a guarantee — mucus can change for other reasons too. The line only reads what you logged today.',
      ),
      close,
    ],
    caption,
    sourceIds,
  };
}
