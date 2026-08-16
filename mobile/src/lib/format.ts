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

/** "4 საათსა და 12 წუთში" — used for the free-tier reset countdown. */
export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} წუთში`;
  if (minutes === 0) return `${hours} საათში`;
  return `${hours} სთ ${minutes} წთ-ში`;
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
