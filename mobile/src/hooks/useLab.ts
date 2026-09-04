import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { loadLabPanels, removeLabPanel, removeLabParameter, setLabPanelAnalysis, upsertLabPanel } from '@/lib/labStore';
import type { LabPanel, LabParameter } from '@/types/lab';

export function useLab() {
  const [panels, setPanels] = useState<LabPanel[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setPanels(await loadLabPanels());
    setLoading(false);
  }, []);

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
          const hit = panel.parameters.find((row) => row.key === key);
          return hit ? [{ date: panel.date, panelId: panel.id, param: hit }] : [];
        }),
    [panels],
  );

  const save = useCallback(async (panel: LabPanel) => {
    setPanels(await upsertLabPanel(panel));
  }, []);

  const remove = useCallback(async (id: string) => {
    setPanels(await removeLabPanel(id));
  }, []);

  const removeParam = useCallback(async (panelId: string, key: string) => {
    setPanels(await removeLabParameter(panelId, key));
  }, []);

  const setAnalysis = useCallback(async (date: string, analysis: string) => {
    setPanels(await setLabPanelAnalysis(date, analysis));
  }, []);

  return { panels, dates, byDate, loading, refresh, seriesFor, save, remove, removeParam, setAnalysis };
}

export function latestParamName(param: LabParameter): string {
  return param.nameKa || param.nameEn;
}
