import type { LabPanel } from '@/types/lab';
import { resolveCanonicalLabKey, titledLabPanel } from './labNames.ts';

export function mergeLabPanelLists(current: LabPanel[], incoming: LabPanel[]): LabPanel[] {
  const byDate = new Map<string, LabPanel>();

  for (const raw of [...current, ...incoming]) {
    if (!raw?.id || !raw.date || !Array.isArray(raw.parameters)) continue;
    const panel = titledLabPanel(raw);
    const existing = byDate.get(panel.date);
    if (!existing) {
      byDate.set(panel.date, panel);
      continue;
    }
    const params = new Map(existing.parameters.map((item) => [resolveCanonicalLabKey(item), item]));
    for (const item of panel.parameters) params.set(resolveCanonicalLabKey(item), item);
    byDate.set(panel.date, titledLabPanel({
      ...existing,
      createdAt: existing.createdAt || panel.createdAt,
      recordIds: [...new Set([...existing.recordIds, ...panel.recordIds])],
      analysis: existing.analysis || panel.analysis,
      visionNotes: existing.visionNotes || panel.visionNotes,
      parameters: [...params.values()],
    }));
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}
