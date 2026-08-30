import { SEXUAL_OPTIONS } from '@/constants/cycle';
import type { CycleLog } from '@/lib/api';
import { syncCycleLogToHealth } from '@/lib/healthSync';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { saveCycleObservation, type CycleView } from '@/lib/cycleOffline';

const SEX_IDS = new Set(SEXUAL_OPTIONS.map((o) => o.id));

export const EMPTY_CYCLE_LOG: CycleLogForm = {
  flow: null,
  symptoms: [],
  moods: [],
  sexTags: [],
  sexual: false,
  libido: null,
  bbt: '',
  mucus: null,
  ovulationTest: null,
  pregnancyTest: null,
  notes: '',
};

export function parseBbt(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function formFromCycleLog(log: CycleLog | undefined): CycleLogForm {
  if (!log) return { ...EMPTY_CYCLE_LOG };
  const all = log.symptoms || [];
  return {
    flow: log.flow,
    symptoms: all.filter((id) => !SEX_IDS.has(id)),
    sexTags: all.filter((id) => SEX_IDS.has(id)),
    moods: log.moods || [],
    sexual: Boolean(log.sexualActivity) || all.some((id) => SEX_IDS.has(id)),
    libido: log.libido,
    bbt: log.bbt != null ? String(log.bbt) : '',
    mucus: log.cervicalMucus,
    ovulationTest: log.ovulationTest ?? null,
    pregnancyTest: log.pregnancyTest ?? null,
    notes: log.notes || '',
  };
}

export function isBleedFlow(flow: string | null | undefined): boolean {
  return flow === 'light' || flow === 'medium' || flow === 'heavy';
}

export type PersistCycleLogResult = {
  view: CycleView | null;
  synced: boolean;
  persistedLocally: boolean;
  sessionOnly?: boolean;
};

export async function persistCycleLog(
  userId: string,
  date: string,
  form: CycleLogForm,
  options?: { markStart?: boolean },
): Promise<PersistCycleLogResult> {
  const bbtNum = parseBbt(form.bbt);
  const result = await saveCycleObservation(
    userId,
    date,
    {
      flow: form.flow,
      symptoms: [...form.symptoms, ...(form.sexual ? form.sexTags : [])],
      moods: form.moods,
      sexualActivity: form.sexual,
      libido: form.libido,
      bbt: bbtNum,
      cervicalMucus: form.mucus,
      ovulationTest: form.ovulationTest,
      pregnancyTest: form.pregnancyTest,
      notes: form.notes.trim() || null,
    },
    { markStart: Boolean(options?.markStart && isBleedFlow(form.flow)) },
  );
  try {
    await syncCycleLogToHealth({
      date,
      flow: form.flow,
      bbt: bbtNum,
      cervicalMucus: form.mucus,
      isPeriodStart: options?.markStart || isBleedFlow(form.flow),
    });
  } catch {
    /* Health is best-effort and must not drop a queued observation */
  }
  return result;
}
