import type { DoctorVisit, VisitReminderConfig } from '@/lib/api';

export function parseVisitDateTime(visitDate: string, visitTime: string): Date {
  const [y, mo, d] = visitDate.split('-').map(Number);
  const [h, mi] = visitTime.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

export function visitDateTimeMs(visit: Pick<DoctorVisit, 'visitDate' | 'visitTime'>): number {
  return parseVisitDateTime(visit.visitDate, visit.visitTime).getTime();
}

export function isVisitPast(visit: Pick<DoctorVisit, 'visitDate' | 'visitTime'>): boolean {
  return visitDateTimeMs(visit) < Date.now();
}

export function doctorDisplayName(visit: Pick<DoctorVisit, 'doctorFirstName' | 'doctorLastName' | 'doctorType'>, typeLabel: string): string {
  const parts = [visit.doctorFirstName, visit.doctorLastName].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return typeLabel;
}

/** Build notification fire times from reminder rules. */
export function buildVisitReminderDates(
  visitDate: string,
  visitTime: string,
  config: VisitReminderConfig,
): Date[] {
  if (!config.enabled) return [];

  const visitAt = parseVisitDateTime(visitDate, visitTime);
  const now = Date.now();
  const dates = new Set<number>();

  for (const minutesBefore of config.offsetsMinutes) {
    const at = visitAt.getTime() - minutesBefore * 60_000;
    if (at > now) dates.add(at);
  }

  const repeat = Math.min(3, Math.max(1, config.repeatCount));
  for (let i = 1; i < repeat; i += 1) {
    const at = visitAt.getTime() - i * 15 * 60_000;
    if (at > now) dates.add(at);
  }

  return [...dates]
    .sort((a, b) => a - b)
    .map((ms) => new Date(ms));
}

export function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function defaultVisitTime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60 - (d.getMinutes() % 30));
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
