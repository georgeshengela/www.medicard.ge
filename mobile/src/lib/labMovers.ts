import type { LabFlag, LabPanel } from '@/types/lab';

export type LabMover = {
  key: string;
  name: string;
  unit: string;
  values: number[];
  prev: number;
  last: number;
  prevDisplay: string;
  lastDisplay: string;
  pct: number;
  ratio: number;
  up: boolean;
  flag: LabFlag;
  prevFlag: LabFlag;
  date: string;
};

export function summarizeLabMovers(panels: LabPanel[], limit = 3): LabMover[] {
  const byKey = new Map<string, { name: string; unit: string; rows: { value: number; display: string; flag: LabFlag; date: string }[] }>();
  const ordered = [...panels].sort((a, b) => a.date.localeCompare(b.date));
  for (const panel of ordered) {
    for (const row of panel.parameters) {
      const cur = byKey.get(row.key) ?? { name: row.nameKa || row.nameEn, unit: row.unit, rows: [] };
      cur.unit = row.unit || cur.unit;
      cur.name = row.nameKa || row.nameEn || cur.name;
      cur.rows.push({ value: row.value, display: row.display || String(row.value), flag: row.flag, date: panel.date });
      byKey.set(row.key, cur);
    }
  }
  return [...byKey.entries()]
    .map(([key, row]) => {
      if (row.rows.length < 2) return null;
      const prev = row.rows[row.rows.length - 2];
      const last = row.rows[row.rows.length - 1];
      if (!prev.value && prev.value !== 0) return null;
      if (prev.value === 0 && last.value === 0) return null;
      const pct = prev.value === 0 ? 100 : Math.round((Math.abs(last.value - prev.value) / Math.abs(prev.value)) * 100);
      if (pct < 1) return null;
      const ratio = prev.value === 0 ? 0 : last.value / prev.value;
      return {
        key,
        name: row.name,
        unit: row.unit,
        values: row.rows.map((item) => item.value).slice(-8),
        prev: prev.value,
        last: last.value,
        prevDisplay: prev.display,
        lastDisplay: last.display,
        pct,
        ratio,
        up: last.value > prev.value,
        flag: last.flag,
        prevFlag: prev.flag,
        date: last.date,
      };
    })
    .filter((row): row is LabMover => Boolean(row))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit);
}

export function moverChangeLabel(mover: LabMover): string {
  if (mover.ratio >= 10) return `×${mover.ratio.toFixed(1)}`;
  if (mover.ratio > 0 && mover.ratio <= 0.1) return `×${mover.ratio.toFixed(2)}`;
  return `${mover.up ? '+' : '−'}${mover.pct}%`;
}
