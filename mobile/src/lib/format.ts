import { ka } from '@/i18n/ka';

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

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${KA_MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${formatDate(iso)} · ${time}`;
}

export function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return 'ახლახან';
  if (minutes < 60) return `${minutes} წუთის წინ`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} საათის წინ`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'გუშინ';
  if (days < 7) return `${days} დღის წინ`;

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
    if (hours === 0) return `${days} დღეში`;
    return `${days} დღე ${hours} სთ-ში`;
  }
  if (hours === 0 && days === 0) return `${minutes} წუთში`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (minutes === 0) return `${totalHours} საათში`;
  return `${totalHours} სთ ${minutes} წთ-ში`;
}

/** Live reset clock — `23:59:05` for a 24h window; days only if 48h+. */
export function formatResetClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  if (days >= 2) {
    const hours = Math.floor((total % 86_400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${days} დღე ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
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
  if (resetDay === today) return `განახლდება დღეს, ${time}-ზე`;
  if (resetDay === nextYmd(today)) return `განახლდება ხვალ, ${time}-ზე`;
  return `განახლდება ${reset.getDate()} ${KA_MONTHS[reset.getMonth()]}, ${time}-ზე`;
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
