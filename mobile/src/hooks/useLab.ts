import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { resolveCanonicalLabKey, titledLabName, titledLabPanel } from '@/lib/labNames';
import { loadCanonicalLabPanels, mergeImportedLabPanels, removeLabPanel, removeLabParameter, replaceLabPanels, setLabPanelAnalysis, upsertLabPanel } from '@/lib/labStore';
import { pullLabPanels } from '@/lib/accountSync';
import { useAuth } from '@/store/AuthContext';
import type { LabPanel, LabParameter } from '@/types/lab';

function panelsFromProfile(extra: Record<string, unknown> | undefined): LabPanel[] {
  const raw = extra?.labPanels;
  return Array.isArray(raw) ? (raw as LabPanel[]) : [];
}

export function useLab() {
  const { user, healthProfile } = useAuth();
  const [panels, setPanels] = useState<LabPanel[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setPanels([]);
      setLoading(false);
      return;
    }
    const seeded = panelsFromProfile((healthProfile?.extraAnswers ?? {}) as Record<string, unknown>);
    let raw = seeded.length ? await mergeImportedLabPanels(seeded) : await loadCanonicalLabPanels();
    try {
      const synced = await pullLabPanels();
      if (synced.length) raw = synced;
    } catch {
      /* keep local */
    }
    const next = raw.map(titledLabPanel);
    setPanels(next);
    setLoading(false);
  }, [user?.id, healthProfile?.extraAnswers]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const byDate = useMemo(() => {
    const map = new Map<string, LabPanel[]>();
    const sorted = [...panels].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    for (const panel of sorted) {
      const list = map.get(panel.date) ?? [];
      list.push(panel);
      map.set(panel.date, list);
    }
    return map;
  }, [panels]);

  const dates = useMemo(() => [...byDate.keys()], [byDate]);

  const seriesFor = useCallback(
    (key: string) =>
      [...panels]
        .sort((a, b) => a.date.localeCompare(b.date))
        .flatMap((panel) => {
          const want = resolveCanonicalLabKey({ key, nameEn: key, nameKa: key });
          const hit = panel.parameters.find((row) => resolveCanonicalLabKey(row) === want);
          return hit ? [{ date: panel.date, panelId: panel.id, param: hit }] : [];
        }),
    [panels],
  );

  const save = useCallback(async (panel: LabPanel) => {
    setPanels((await upsertLabPanel(panel)).map(titledLabPanel));
  }, []);

  const remove = useCallback(async (id: string) => {
    setPanels((await removeLabPanel(id)).map(titledLabPanel));
  }, []);

  const removeParam = useCallback(async (panelId: string, key: string) => {
    setPanels((await removeLabParameter(panelId, key)).map(titledLabPanel));
  }, []);

  const setAnalysis = useCallback(async (date: string, analysis: string) => {
    setPanels((await setLabPanelAnalysis(date, analysis)).map(titledLabPanel));
  }, []);

  const replaceAll = useCallback(async (next: LabPanel[]) => {
    setPanels((await replaceLabPanels(next)).map(titledLabPanel));
  }, []);

  return { panels, dates, byDate, loading, refresh, seriesFor, save, remove, removeParam, setAnalysis, replaceAll };
}

export function latestParamName(param: LabParameter): string {
  return titledLabName(param);
}
