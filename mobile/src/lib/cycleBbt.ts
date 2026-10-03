/**
 * Basal body temperature (BBT) for the wheel picker (`CycleBbtPicker`, brief §8.3 item 9): one value per
 * 0.05 °C from 35.50 to 38.00 — the range a fertility-awareness thermometer reads — instead of a typed
 * number. Pure (node tests load it).
 *
 * Storage is unchanged: the form keeps BBT as a string (`CycleLogForm.bbt`, '' = not measured) that
 * `parseBbt` turns into the number the server stores in °C. The wheel writes `bbtStorage(value)` —
 * „36.55“ — and only when the person moves it, so an older typed value (e.g. 36.63) stays exactly as
 * it was until she changes it.
 *
 * Privacy: BBT is a SENSITIVE observation. `lastLoggedBbt` is a local, in-screen starting point for the
 * wheel only — it never fills the form by itself and never leaves the cycle screens.
 */
import { appLang, type AppLang } from '../i18n/locale.js';

export const BBT_MIN = 35.5;
export const BBT_MAX = 38;
export const BBT_STEP = 0.05;
/** Where the wheel starts when nothing was ever logged. */
export const BBT_DEFAULT = 36.5;
/** 51 values: 35.50, 35.55 … 38.00. */
export const BBT_COUNT = Math.round((BBT_MAX - BBT_MIN) / BBT_STEP) + 1;

/** Two decimals without float noise (35.5 + 21 × 0.05 = 36.550000000000004 → 36.55). */
function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampBbt(value: number): number {
  if (!Number.isFinite(value)) return BBT_DEFAULT;
  return Math.min(BBT_MAX, Math.max(BBT_MIN, value));
}

/** The wheel index for a temperature: clamped into range, rounded to the nearest 0.05 step. */
export function bbtIndex(value: number): number {
  return Math.round((clampBbt(value) - BBT_MIN) / BBT_STEP);
}

/** The temperature at a wheel index (indices outside 0…50 are clamped). */
export function bbtAt(index: number): number {
  const i = Math.min(BBT_COUNT - 1, Math.max(0, Math.round(Number.isFinite(index) ? index : 0)));
  return cents(BBT_MIN + i * BBT_STEP);
}

/** Clamp and round to the nearest 0.05 (36.63 → 36.65, 34.9 → 35.50, 38.4 → 38.00). */
export function roundBbt(value: number): number {
  return bbtAt(bbtIndex(value));
}

export function bbtValues(): number[] {
  return Array.from({ length: BBT_COUNT }, (_, i) => bbtAt(i));
}

/** One step up (+1) or down (−1), never past the ends. */
export function stepBbt(value: number, dir: 1 | -1): number {
  return bbtAt(bbtIndex(value) + dir);
}

/** The form/storage string the wheel writes — the same shape `parseBbt` already reads („36.55“). */
export function bbtStorage(value: number): string {
  return roundBbt(value).toFixed(2);
}

/** The form string as a number, or null when nothing (or nothing readable) was logged. */
export function bbtFromForm(raw: string | null | undefined): number | null {
  const trimmed = String(raw ?? '').trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Display: „36.55°“ — two decimals with a point in both languages, the way a thermometer shows it
 * (and the way the rest of the app writes temperatures).
 */
export function formatBbt(value: number, _lang: AppLang = appLang()): string {
  return `${cents(value).toFixed(2)}°`;
}

/** What a screen reader says for the wheel's value. */
export function spokenBbt(value: number, lang: AppLang = appLang()): string {
  const n = cents(value).toFixed(2);
  return lang === 'en' ? `${n} degrees Celsius` : `${n} გრადუსი ცელსიუსით`;
}

/**
 * Where the wheel starts: the day's own value if it has one, else the most recent BBT logged before
 * `date` (else the most recent at all), else 36.50 — always on the 0.05 grid.
 */
export function lastLoggedBbt(
  logs: readonly { date: string; bbt?: number | null }[] | null | undefined,
  date: string,
): number | null {
  let before: { date: string; bbt: number } | null = null;
  let any: { date: string; bbt: number } | null = null;
  for (const log of logs ?? []) {
    const bbt = typeof log?.bbt === 'number' && Number.isFinite(log.bbt) ? log.bbt : null;
    if (bbt == null || log.date === date) continue;
    if (!any || log.date > any.date) any = { date: log.date, bbt };
    if (log.date < date && (!before || log.date > before.date)) before = { date: log.date, bbt };
  }
  const pick = before ?? any;
  return pick ? roundBbt(pick.bbt) : null;
}

export function wheelStart(formValue: string | null | undefined, lastLogged: number | null | undefined): number {
  const own = bbtFromForm(formValue);
  if (own != null) return roundBbt(own);
  if (typeof lastLogged === 'number' && Number.isFinite(lastLogged)) return roundBbt(lastLogged);
  return BBT_DEFAULT;
}
