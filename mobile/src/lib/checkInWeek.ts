import type { CheckInDay, CheckInDayStatus } from '@/lib/api';

const TBILISI = 'Asia/Tbilisi';

export function tbilisiYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TBILISI }).format(now);
}

/** Older APIs painted every past weekday as skipped — hide days before this account existed. */
export function weekFromJoin(week: CheckInDay[], createdAt?: string | null, today = tbilisiYmd()): CheckInDay[] {
  if (!week.length) return week;
  const joined = createdAt ? tbilisiYmd(new Date(createdAt)) : today;
  return week.map((day) => {
    if (day.status !== 'skipped') return day;
    if (day.date < joined) return { ...day, status: 'empty' as CheckInDayStatus };
    return day;
  });
}
