import type { MedicationConfig, MedicationDoseLog, PillShape } from '@/types/medications';

export function parseMedicationConfig(raw: unknown): MedicationConfig {
  if (!raw || typeof raw !== 'object') return {};
  return raw as MedicationConfig;
}

export function parseFrequencyTimes(frequency: string): string[] {
  return frequency
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function formatFrequencyTimes(times: string[]): string {
  return [...new Set(times)].sort().join(', ');
}

export const DAY_LABELS_KA = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვ'] as const;
export const DAY_LABELS_FULL_KA = [
  'ორშაბათი',
  'სამშაბათი',
  'ოთხშაბათი',
  'ხუთშაბათი',
  'პარასკევი',
  'შაბათი',
  'კვირა',
] as const;

export function daysSummaryKa(days: number[] | undefined): string {
  if (!days?.length) return '';
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS_FULL_KA[d] ?? '')
    .filter(Boolean)
    .join(', ');
}

export function pillShapePath(shape: PillShape): string {
  switch (shape) {
    case 'diamond':
      return 'M12 2L22 12L12 22L2 12Z';
    case 'triangle':
      return 'M12 3L22 21H2Z';
    case 'circle':
      return 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z';
    case 'hexagon':
      return 'M12 2l8.66 5v10L12 22l-8.66-5V7Z';
    case 'rectangle':
    case 'long':
      return 'M6 8h12a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v0a4 4 0 0 1 4-4z';
    case 'pentagon':
      return 'M12 2l9 7v8l-9 7-9-7V9z';
    case 'shield':
      return 'M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z';
    case 'teardrop':
      return 'M12 2c3 6 8 10 8 14a8 8 0 1 1-16 0c0-4 5-8 8-14z';
    case 'trapezoid':
      return 'M7 7h10l3 10H4z';
    case 'square':
      return 'M5 5h14v14H5z';
    default:
      return 'M6 8h12a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v0a4 4 0 0 1 4-4z';
  }
}

const DOSE_LOG_KEY = 'medicard.meds.doseLogs';

export async function loadDoseLogs(): Promise<MedicationDoseLog[]> {
  try {
    const { getScopedPreference } = await import('@/lib/localAccount');
    const raw = await getScopedPreference(DOSE_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MedicationDoseLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveDoseLog(entry: MedicationDoseLog): Promise<void> {
  const { setScopedPreference } = await import('@/lib/localAccount');
  const existing = await loadDoseLogs();
  const key = `${entry.medicationId}|${entry.date}|${entry.time}`;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const next = [
    ...existing.filter((e) => `${e.medicationId}|${e.date}|${e.time}` !== key && e.date >= cutoffKey),
    { ...entry, updatedAt: new Date().toISOString() },
  ];
  await setScopedPreference(DOSE_LOG_KEY, JSON.stringify(next));
}

export function doseLogKey(medicationId: string, date: string, time: string): string {
  return `${medicationId}|${date}|${time}`;
}

export function findDoseLog(
  logs: MedicationDoseLog[],
  medicationId: string,
  date: string,
  time: string,
): MedicationDoseLog | undefined {
  return logs.find((l) => l.medicationId === medicationId && l.date === date && l.time === time);
}

export function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = mStr ?? '00';
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function defaultTimesForCount(count: number): string[] {
  const safe = Math.max(1, Math.min(12, count));
  if (safe === 1) return ['08:00'];
  if (safe === 2) return ['08:00', '20:00'];
  if (safe === 3) return ['08:00', '14:00', '20:00'];
  const startMin = 7 * 60;
  const endMin = 21 * 60;
  const step = (endMin - startMin) / safe;
  return Array.from({ length: safe }, (_, i) => {
    const total = Math.round(startMin + step * i + step / 2);
    const h = Math.floor(total / 60);
    const m = total % 60 >= 30 ? 30 : 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });
}

export function formatDateDisplay(iso: string): string {
  const [y, mo, d] = iso.split('-');
  return `${d}  /  ${mo}  /  ${y}`;
}

export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addYearsToIso(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setFullYear(date.getFullYear() + years);
  return todayYmdFromDate(date);
}

function todayYmdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function adherenceStats(logs: MedicationDoseLog[]): { onTime: number; late: number; skipped: number } {
  let onTime = 0;
  let skipped = 0;
  for (const log of logs) {
    if (log.status === 'taken') onTime += 1;
    if (log.status === 'skipped') skipped += 1;
  }
  const total = onTime + skipped;
  const onTimePct = total ? Math.round((onTime / total) * 100) : 0;
  const skippedPct = total ? Math.round((skipped / total) * 100) : 0;
  return { onTime: onTimePct, late: Math.max(0, 100 - onTimePct - skippedPct), skipped: skippedPct };
}
