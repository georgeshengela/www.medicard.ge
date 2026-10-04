/**
 * „არ გამოგრჩეს“ on the standard Home (owner 2026-10-04): rows that appear only while they are true —
 * a doctor's visit in the next 7 days, a lab result from the last 14 days. On an ordinary day the
 * section is empty and Home shows nothing for it. Pure: no I/O.
 */

export type VisitLike = { id: string; visitDate: string; visitTime: string; active: boolean; doctorType: string };
export type LabPanelLike = { date: string; parameters: { flag: string }[] };

export const VISIT_WINDOW_DAYS = 7;
export const LAB_WINDOW_DAYS = 14;

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** The nearest active visit from today (time not yet compared: a visit today stays until the day ends). */
export function upcomingVisit<T extends VisitLike>(visits: readonly T[], today: string): T | null {
  const until = addDays(today, VISIT_WINDOW_DAYS);
  const next = visits
    .filter((v) => v.active && v.visitDate >= today && v.visitDate <= until)
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate) || a.visitTime.localeCompare(b.visitTime));
  return next[0] ?? null;
}

/** Days from today to `ymd` (0 = today). */
export function daysUntil(ymd: string, today: string): number {
  return Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** The newest lab date within the window, with how many values sit outside the printed range. */
export function recentLab(panels: readonly LabPanelLike[], today: string): { date: string; outside: number; total: number } | null {
  const from = addDays(today, -LAB_WINDOW_DAYS);
  const latest = panels.map((p) => p.date).filter((d) => d >= from && d <= today).sort().at(-1);
  if (!latest) return null;
  const params = panels.filter((p) => p.date === latest).flatMap((p) => p.parameters);
  if (!params.length) return null;
  return { date: latest, outside: params.filter((p) => p.flag === 'H' || p.flag === 'L').length, total: params.length };
}
