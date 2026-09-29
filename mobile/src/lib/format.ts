import { ka } from '@/i18n/ka';
import { isEn, tx } from '@/i18n/locale';

const KA_MONTHS = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
];

const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function monthName(index: number): string {
  return (isEn() ? EN_MONTHS : KA_MONTHS)[index];
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${monthName(date.getMonth())}, ${date.getFullYear()}`;
}

/** Home header — `9 სექტემბერი 2026` / `9 September 2026`. Avoids RN `ka-GE` locale dropping the day. */
export function formatDayMonthYearKa(date = new Date()): string {
  return `${date.getDate()} ${monthName(date.getMonth())} ${date.getFullYear()}`;
}

/** `YYYY-MM-DD` → `5 ოქტომბერი` / `5 October` (add the year with `withYear`). Unparseable input comes back unchanged. */
export function formatYmd(ymd: string, withYear = false): string {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d || m > 12) return ymd;
  return withYear ? `${d} ${monthName(m - 1)} ${y}` : `${d} ${monthName(m - 1)}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${formatDate(iso)} · ${time}`;
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return tx('ახლახან', 'just now');
  if (minutes < 60) return tx(`${minutes} წუთის წინ`, `${minutes} min ago`);

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tx(`${hours} საათის წინ`, hours === 1 ? '1 hour ago' : `${hours} hours ago`);

  const days = Math.floor(hours / 24);
  if (days === 1) return tx('გუშინ', 'yesterday');
  if (days < 7) return tx(`${days} დღის წინ`, `${days} days ago`);

  return formatDate(iso);
}

export const DAY_MS = 86_400_000;

/** "4 საათსა და 12 წუთში" — used for the free-tier reset countdown. */
export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days >= 2) {
    if (hours === 0) return tx(`${days} დღეში`, `in ${days} days`);
    return tx(`${days} დღე ${hours} სთ-ში`, `in ${days} d ${hours} h`);
  }
  if (hours === 0 && days === 0) return tx(`${minutes} წუთში`, `in ${minutes} min`);
  const totalHours = Math.floor(totalMinutes / 60);
  if (minutes === 0) return tx(`${totalHours} საათში`, totalHours === 1 ? 'in 1 hour' : `in ${totalHours} hours`);
  return tx(`${totalHours} სთ ${minutes} წთ-ში`, `in ${totalHours} h ${minutes} min`);
}

/** Live reset clock — `23:59:05` for a 24h window; days only if 48h+. */
export function formatResetClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  if (days >= 2) {
    const hours = Math.floor((total % 86_400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${days} ${tx('დღე', 'd')} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function localYmd(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function nextYmd(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  const next = new Date(year, month - 1, day + 1);
  return localYmd(next);
}

/** "განახლდება ხვალ, 14:32-ზე" — wall clock on the user's phone. */
export function formatResetSentence(iso: string): string {
  const reset = new Date(iso);
  if (Number.isNaN(reset.getTime())) return ka.usage.exhaustedBody;
  const time = `${pad(reset.getHours())}:${pad(reset.getMinutes())}`;
  const today = localYmd(new Date());
  const resetDay = localYmd(reset);
  if (resetDay === today) return tx(`განახლდება დღეს, ${time}-ზე`, `Resets today at ${time}`);
  if (resetDay === nextYmd(today)) return tx(`განახლდება ხვალ, ${time}-ზე`, `Resets tomorrow at ${time}`);
  return tx(
    `განახლდება ${reset.getDate()} ${KA_MONTHS[reset.getMonth()]}, ${time}-ზე`,
    `Resets on ${reset.getDate()} ${EN_MONTHS[reset.getMonth()]} at ${time}`,
  );
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return ka.home.greetingMorning;
  if (hour < 18) return ka.home.greetingDay;
  return ka.home.greetingEvening;
}

/** Next upcoming dose today, or the first dose of tomorrow if the day is done. */
export function nextDoseTime(times: string[]): string | null {
  if (times.length === 0) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const sorted = [...times].sort();

  const upcoming = sorted.find((time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m > nowMinutes;
  });

  return upcoming ?? sorted[0];
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
