import type { LabPanel } from '@/types/lab';
import { resolveCanonicalLabKey, titledLabPanel } from './labNames.ts';

/**
 * Server-made panels carry `auto`; older ones are recognised by their `lab-<date>-<recordId>` id.
 * Mirrors `isAutoLabPanel` in server/src/lib/appState.js.
 */
export function isAutoLabPanel(panel: LabPanel): boolean {
  if (panel?.auto === true) return true;
  const ids = panel?.recordIds ?? [];
  return ids.length === 1 && panel.id === `lab-${panel.date}-${ids[0]}`;
}

/**
 * One lab record is one panel: the same record under another date showed the same values two or three
 * times in MEDILAB and its charts (2026-10-06). Later input wins among equals, the app's own panels win
 * over server-made ones, same-date copies stay and merge by date. Mirrors the server.
 */
export function dedupeLabPanelsByRecord(panels: LabPanel[]): LabPanel[] {
  const claimed = new Map<string, string>();
  const keep = panels.map(() => true);
  for (const auto of [false, true]) {
    for (let i = panels.length - 1; i >= 0; i -= 1) {
      const panel = panels[i];
      if (!panel || isAutoLabPanel(panel) !== auto) continue;
      const ids = panel.recordIds ?? [];
      if (ids.some((id) => claimed.has(id) && claimed.get(id) !== panel.date)) {
        keep[i] = false;
        continue;
      }
      for (const id of ids) if (!claimed.has(id)) claimed.set(id, panel.date);
    }
  }
  return panels.filter((_, i) => keep[i]);
}

export function mergeLabPanelLists(current: LabPanel[], incoming: LabPanel[]): LabPanel[] {
  const byDate = new Map<string, LabPanel>();
  const valid = [...current, ...incoming].filter((raw) => raw?.id && raw.date && Array.isArray(raw.parameters));

  for (const raw of dedupeLabPanelsByRecord(valid)) {
    const panel = titledLabPanel(raw);
    const existing = byDate.get(panel.date);
    if (!existing) {
      byDate.set(panel.date, panel);
      continue;
    }
    const params = new Map(existing.parameters.map((item) => [resolveCanonicalLabKey(item), item]));
    for (const item of panel.parameters) params.set(resolveCanonicalLabKey(item), item);
    const auto = existing.auto === true && panel.auto === true;
    const { auto: _auto, ...base } = existing;
    byDate.set(panel.date, titledLabPanel({
      ...base,
      id: !auto && isAutoLabPanel(existing) && !isAutoLabPanel(panel) ? panel.id : existing.id,
      ...(auto ? { auto: true } : {}),
      createdAt: existing.createdAt || panel.createdAt,
      recordIds: [...new Set([...existing.recordIds, ...panel.recordIds])],
      analysis: existing.analysis || panel.analysis,
      visionNotes: existing.visionNotes || panel.visionNotes,
      parameters: [...params.values()],
    }));
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}
