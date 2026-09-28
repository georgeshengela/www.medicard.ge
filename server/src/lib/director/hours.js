/** Support working hours: Monday–Friday 10:00–19:00, Asia/Tbilisi (UTC+4, no DST). */
export const WORK_DAYS = Object.freeze([1, 2, 3, 4, 5]);
export const WORK_START_HOUR = 10;
export const WORK_END_HOUR = 19;
const TBILISI_OFFSET_MS = 4 * 60 * 60 * 1000;

export function tbilisiParts(now = new Date()) {
  const t = new Date(now.getTime() + TBILISI_OFFSET_MS);
  return { day: t.getUTCDay(), hour: t.getUTCHours(), minute: t.getUTCMinutes(), ymd: t.toISOString().slice(0, 10) };
}

export function isWorkingHours(now = new Date()) {
  const { day, hour } = tbilisiParts(now);
  return WORK_DAYS.includes(day) && hour >= WORK_START_HOUR && hour < WORK_END_HOUR;
}

export function tbilisiLabel(now = new Date()) {
  const days = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
  const { day, hour, minute, ymd } = tbilisiParts(now);
  return `${ymd}, ${days[day]}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} (თბილისი)`;
}
