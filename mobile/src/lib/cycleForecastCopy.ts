/**
 * Copy for forecast honesty (brief §1 point 6, §8.2 items 5 + 9, §9 items 12–13). Plain module (relative
 * imports only) so node tests load it. The rules themselves live in `cycleForecastEligibility.js`
 * (mirror of the server's `cycleForecastHonesty.js`); this file only words them.
 */
import { isEn, tx } from '../i18n/locale.js';

const MONTHS_SHORT_KA = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const MONTHS_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayMonth(ymd: string, en: boolean): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${d} ${(en ? MONTHS_SHORT_EN : MONTHS_SHORT_KA)[m - 1]}`;
}

/** „13–15 ოქტ“ inside one month, „30 სექ – 2 ოქტ“ across two. */
export function shortDateRange(start: string, end: string, en: boolean = isEn()): string {
  if (!start || !end || start === end) return dayMonth(start || end, en);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${Number(start.slice(8, 10))}–${dayMonth(end, en)}`;
  return `${dayMonth(start, en)} – ${dayMonth(end, en)}`;
}

/** The quiet badge where fertile days would be: „ვსწავლობთ შენს რიტმს · 2/3 ციკლი“. */
export function learningBadgeText(done: number, required = 3): string {
  const n = Math.max(0, Math.min(required, Math.floor(done) || 0));
  return tx(`ვსწავლობთ შენს რიტმს · ${n}/${required} ციკლი`, `Learning your rhythm · ${n}/${required} ${required === 1 ? 'cycle' : 'cycles'}`);
}

/** Why there are no fertile days yet (explain sheet / accessibility). */
export function learningBadgeExplain(required = 3): string {
  return tx(
    `ნაყოფიერ დღეებს და სავარაუდო ოვულაციას ${required} სრული ციკლის აღრიცხვის შემდეგ ვაჩვენებთ — მანამდე ნებისმიერი თარიღი გამოცნობა იქნებოდა.`,
    `We show fertile days and estimated ovulation after ${required} logged, completed cycles — before that any date would be a guess.`,
  );
}

/** The stats tiles' chip while verdicts wait: „ვსწავლობთ · 2/3“. */
export function statsLearningChip(done: number, required = 3): string {
  const n = Math.max(0, Math.min(required, Math.floor(done) || 0));
  return tx(`ვსწავლობთ · ${n}/${required}`, `Learning · ${n}/${required}`);
}

/** Trying to conceive before 3 cycles (Flo's „widen rather than guess“). */
export function wideWindowLabel(): string {
  return tx('ფართო დიაპაზონი, სანამ 3 ციკლს დავითვლით', 'A wide range until we have counted 3 cycles');
}

/** Where this cycle's ovulation band comes from, when it is her own data. */
export function ovulationSourceLabel(source: string | null | undefined): string | null {
  if (source === 'manual') return tx('შენი აღნიშვნით', 'From your own mark');
  if (source === 'opk') return tx('OPK-ის მიხედვით', 'Based on your OPK');
  return null;
}

/** „სავარაუდო ოვულაცია · 13–15 ოქტ“ (+ „ · OPK-ის მიხედვით“) — a band, never one date. */
export function ovulationBandLine(range: { start: string; end: string }, source?: string | null): string {
  const base = tx(`სავარაუდო ოვულაცია · ${shortDateRange(range.start, range.end, false)}`, `Estimated ovulation · ${shortDateRange(range.start, range.end, true)}`);
  const from = ovulationSourceLabel(source);
  return from ? `${base} · ${from}` : base;
}

/** The day sheet's manual mark row. */
export function ovulationMarkLabel(): string {
  return tx('ოვულაცია ამ დღეს იყო', 'Ovulation was on this day');
}

export function ovulationMarkHint(): string {
  return tx(
    'შენი აღნიშვნა ამ ციკლის სავარაუდო ოვულაციას ამ დღეზე გადაიტანს. ხედავ მხოლოდ შენ.',
    'Your mark moves this cycle’s estimated ovulation to this day. Only you can see it.',
  );
}
