import { getScopedPreference, setScopedPreferenceStrict } from '@/lib/localAccount';
import { resolveCanonicalLabKey, titledLabPanel } from '@/lib/labNames';
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

function fingerprint(panels: LabPanel[]): string {
  return panels
    .map((panel) => `${panel.id}:${panel.date}:${panel.parameters.map((row) => row.key).join(',')}`)
    .join('|');
}

export async function loadLabPanels(): Promise<LabPanel[]> {
  return parsePanels(await getScopedPreference(KEY));
}

/** Rewrite French/OCR keys onto the Georgian catalog and persist if anything moved. */
export async function loadCanonicalLabPanels(): Promise<LabPanel[]> {
  const current = await loadLabPanels();
  const next = current.map(titledLabPanel);
  if (fingerprint(current) !== fingerprint(next)) await saveLabPanels(next);
  return next;
}

/** Merge server-seeded history without overwriting a date the user already scanned. */
export async function mergeImportedLabPanels(incoming: LabPanel[]): Promise<LabPanel[]> {
  const valid = incoming.filter((row) => row?.id && row.date && Array.isArray(row.parameters));
  if (!valid.length) return loadCanonicalLabPanels();

  const current = await loadLabPanels();
  const byDate = new Map(current.map((row) => [row.date, row]));
  let changed = false;

  for (const panel of valid) {
    const existing = byDate.get(panel.date);
    if (!existing) {
      byDate.set(panel.date, titledLabPanel(panel));
      changed = true;
      continue;
    }
    const keys = new Set(existing.parameters.map((item) => resolveCanonicalLabKey(item)));
    const extra = panel.parameters.filter((item) => !keys.has(resolveCanonicalLabKey(item)));
    if (!extra.length) continue;
    byDate.set(panel.date, titledLabPanel({
      ...existing,
      analysis: existing.analysis || panel.analysis,
      visionNotes: existing.visionNotes || panel.visionNotes,
      parameters: [...existing.parameters, ...extra],
    }));
    changed = true;
  }

  const next = [...byDate.values()].map(titledLabPanel).sort((a, b) => b.date.localeCompare(a.date));
  if (changed || fingerprint(current) !== fingerprint(next)) await saveLabPanels(next);
  return next;
}

export async function saveLabPanels(panels: LabPanel[]): Promise<void> {
  await setScopedPreferenceStrict(KEY, JSON.stringify(panels));
}

export async function replaceLabPanels(panels: LabPanel[]): Promise<LabPanel[]> {
  const next = panels.map(titledLabPanel).sort((a, b) => b.date.localeCompare(a.date));
  await saveLabPanels(next);
  return next;
}

export async function upsertLabPanel(panel: LabPanel): Promise<LabPanel[]> {
  const current = await loadLabPanels();
  const existing = current.find((row) => row.date === panel.date);
  if (existing) {
    const params = new Map(titledLabPanel(existing).parameters.map((row) => [row.key, row]));
    for (const row of titledLabPanel(panel).parameters) params.set(row.key, row);
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
  const next = [titledLabPanel(panel), ...current.filter((row) => row.id !== panel.id)];
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
    .map((row) =>
      row.id === panelId
        ? {
            ...row,
            parameters: row.parameters.filter((item) => resolveCanonicalLabKey(item) !== resolveCanonicalLabKey({ key, nameEn: key, nameKa: key })),
          }
        : row,
    )
    .filter((row) => row.parameters.length > 0);
  await saveLabPanels(next);
  return next;
}
