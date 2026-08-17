import { ka } from '@/i18n/ka';

/**
 * Birth date entry.
 *
 * The field stores raw digits and renders them as DD.MM.YYYY — the format Georgian
 * users expect — while the API speaks ISO `YYYY-MM-DD`. A masked text input rather
 * than a native picker keeps behaviour identical on iOS, Android and web.
 */

const MAX_AGE = 120;

export function toDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

/** `15051990` → `15.05.1990`, and every partial state in between. */
export function formatBirthDateInput(value: string): string {
  const digits = toDigits(value);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('.');
}

/** Mirrors the server's age rule: birthday in UTC, today in local time. */
export function ageFromBirthDate(date: Date, now = new Date()): number {
  const bornMonth = date.getUTCMonth();
  const bornDay = date.getUTCDate();

  let age = now.getFullYear() - date.getUTCFullYear();
  if (now.getMonth() < bornMonth || (now.getMonth() === bornMonth && now.getDate() < bornDay)) {
    age -= 1;
  }
  return age;
}

export type BirthDateResult = { ok: true; iso: string; age: number } | { ok: false; error: string };

export function parseBirthDate(value: string): BirthDateResult {
  const digits = toDigits(value);
  if (digits.length !== 8) return { ok: false, error: ka.auth.invalidBirthDate };

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!real) return { ok: false, error: ka.auth.unrealBirthDate };

  const now = new Date();
  if (date.getTime() > now.getTime()) return { ok: false, error: ka.auth.futureBirthDate };

  const age = ageFromBirthDate(date, now);
  if (age > MAX_AGE) return { ok: false, error: ka.auth.outOfRangeBirthDate };

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { ok: true, iso, age };
}

/** `1990-05-15` → `15.05.1990`, for rendering a stored value. */
export function isoToDisplay(iso: string | null): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}.${month}.${year}` : null;
}

/** `1990-05-15` or `1990-05-15T00:00:00.000Z` → `1990-05-15` */
export function normalizeIsoDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const trimmed = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return '';
}

/** `1990-05-15` → `15051990`, for seeding the input from a stored value. */
export function isoToDigits(iso: string | null): string {
  const normalized = normalizeIsoDate(iso);
  if (!normalized) return '';
  const [year, month, day] = normalized.split('-');
  return `${day}${month}${year}`;
}

export function ymdToDigits(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
}

export function digitsToYmd(value: string): { year: number; month: number; day: number } | null {
  const digits = toDigits(value);
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (!day || !month || !year) return null;
  return { year, month, day };
}

export type CalendarCell = {
  year: number;
  month: number;
  day: number;
  inMonth: boolean;
  disabled: boolean;
  isToday: boolean;
  digits: string;
};

const MIN_AGE_YEAR_SPAN = MAX_AGE;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isSelectableBirthDate(year: number, month: number, day: number, now = new Date()): boolean {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;
  if (startOfDay(date) > startOfDay(now)) return false;
  return ageFromBirthDate(new Date(Date.UTC(year, month - 1, day)), now) <= MIN_AGE_YEAR_SPAN;
}

export function birthYearBounds(now = new Date()): { minYear: number; maxYear: number } {
  return { minYear: now.getFullYear() - MIN_AGE_YEAR_SPAN, maxYear: now.getFullYear() };
}

/** Monday-first 6×7 grid, including the spill from the neighbouring months. */
export function monthGrid(year: number, month: number, now = new Date()): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const cells: CalendarCell[] = [];

  for (let i = startPad - 1; i >= 0; i -= 1) {
    const day = prevMonthDays - i;
    const wrap = month === 1;
    cells.push(makeCell(wrap ? year - 1 : year, wrap ? 12 : month - 1, day, false, now));
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(makeCell(year, month, day, true, now));
  }

  let nextDay = 1;
  while (cells.length < 42) {
    const wrap = month === 12;
    cells.push(makeCell(wrap ? year + 1 : year, wrap ? 1 : month + 1, nextDay, false, now));
    nextDay += 1;
  }

  return cells;
}

function makeCell(year: number, month: number, day: number, inMonth: boolean, now: Date): CalendarCell {
  return {
    year,
    month,
    day,
    inMonth,
    disabled: !isSelectableBirthDate(year, month, day, now),
    isToday: now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day,
    digits: ymdToDigits(year, month, day),
  };
}
