import { getScopedPreference, setScopedPreferenceStrict } from '@/lib/localAccount';
import type { LabPanel } from '@/types/lab';

const KEY = 'medicard.lab.panels.v1';

function parsePanels(raw: string | null): LabPanel[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LabPanel[];
    return Array.isArray(parsed) ? parsed.filter((row) => row?.id && row.date && Array.isArray(row.parameters)) : [];
  } catch {
    return [];
  }
}

export async function loadLabPanels(): Promise<LabPanel[]> {
  return parsePanels(await getScopedPreference(KEY));
}

export async function saveLabPanels(panels: LabPanel[]): Promise<void> {
  await setScopedPreferenceStrict(KEY, JSON.stringify(panels));
}

export async function upsertLabPanel(panel: LabPanel): Promise<LabPanel[]> {
  const current = await loadLabPanels();
  const existing = current.find((row) => row.date === panel.date);
  if (existing) {
    const params = new Map(existing.parameters.map((row) => [row.key, row]));
    for (const row of panel.parameters) params.set(row.key, row);
    const merged: LabPanel = {
      ...existing,
      createdAt: panel.createdAt || existing.createdAt,
      recordIds: [...new Set([...existing.recordIds, ...panel.recordIds])],
      analysis: panel.analysis || existing.analysis,
      visionNotes: panel.visionNotes || existing.visionNotes,
      parameters: [...params.values()],
    };
    const next = [merged, ...current.filter((row) => row.id !== existing.id)];
    await saveLabPanels(next);
    return next;
  }
  const next = [panel, ...current.filter((row) => row.id !== panel.id)];
  await saveLabPanels(next);
  return next;
}

export async function setLabPanelAnalysis(date: string, analysis: string): Promise<LabPanel[]> {
  const current = await loadLabPanels();
  const next = current.map((row) => (row.date === date ? { ...row, analysis } : row));
  await saveLabPanels(next);
  return next;
}

export async function removeLabPanel(id: string): Promise<LabPanel[]> {
  const next = (await loadLabPanels()).filter((row) => row.id !== id);
  await saveLabPanels(next);
  return next;
}

export async function removeLabParameter(panelId: string, key: string): Promise<LabPanel[]> {
  const current = await loadLabPanels();
  const next = current
    .map((row) => (row.id === panelId ? { ...row, parameters: row.parameters.filter((item) => item.key !== key) } : row))
    .filter((row) => row.parameters.length > 0);
  await saveLabPanels(next);
  return next;
}
