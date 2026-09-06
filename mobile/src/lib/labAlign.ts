import { titledLabPanel } from './labNames.ts';
import type { LabPanel } from '@/types/lab';

export type LabAlignMap = {
  from: string;
  to: string;
  nameKa: string;
  nameEn: string;
};

export function uniqueLabAnalytes(panels: LabPanel[]): Array<{ key: string; nameKa: string; nameEn: string; unit: string }> {
  const seen = new Map<string, { key: string; nameKa: string; nameEn: string; unit: string }>();
  for (const panel of panels) {
    for (const row of panel.parameters) {
      if (!row.key || seen.has(row.key)) continue;
      seen.set(row.key, {
        key: row.key,
        nameKa: row.nameKa,
        nameEn: row.nameEn,
        unit: row.unit,
      });
    }
  }
  return [...seen.values()];
}

export function applyLabMaps(panels: LabPanel[], maps: LabAlignMap[]): LabPanel[] {
  const byFrom = new Map(maps.map((row) => [row.from, row]));
  return panels.map((panel) =>
    titledLabPanel({
      ...panel,
      parameters: panel.parameters.map((row) => {
        const hit = byFrom.get(row.key);
        if (!hit) return row;
        return {
          ...row,
          key: hit.to,
          nameKa: hit.nameKa || row.nameKa,
          nameEn: hit.nameEn || row.nameEn,
        };
      }),
    }),
  );
}
