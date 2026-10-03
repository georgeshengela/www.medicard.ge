import { SEXUAL_OPTIONS, SEX_ACTIVITY_OPTIONS } from '@/constants/cycle';
import type { CycleLog } from '@/lib/api';
import { syncCycleLogToHealth } from '@/lib/healthSync';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { saveCycleObservation, type CycleView } from '@/lib/cycleOffline';
import { isOvulationMarked, ovulationMarkPatch } from '@/lib/cycleObservationRegistry';

const SEX_IDS = new Set(SEXUAL_OPTIONS.map((o) => o.id));
const SEX_ACTIVITY_IDS = new Set(SEX_ACTIVITY_OPTIONS.map((o) => o.id));

export const EMPTY_CYCLE_LOG: CycleLogForm = {
  flow: null,
  symptoms: [],
  moods: [],
  sexTags: [],
  /** null = not answered (nothing sent as "no"); false = the person chose "no". */
  sexual: null,
  libido: null,
  bbt: '',
  mucus: null,
  ovulationTest: null,
  pregnancyTest: null,
  notes: '',
  painEntries: [],
  sleepQuality: null,
  stressLevel: null,
  exerciseLevel: null,
  caffeine: null,
  alcohol: null,
  customTagIds: [],
  energy: null,
  observationAssessments: {},
  ovulationMarked: null,
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
    // Stored false cannot be told apart from the pre-2026-09-29 default "no" on every log → show as unanswered.
    sexual: log.sexualActivity === true || all.some((id) => SEX_ACTIVITY_IDS.has(id)) ? true : null,
    libido: log.libido,
    bbt: log.bbt != null ? String(log.bbt) : '',
    mucus: log.cervicalMucus,
    ovulationTest: log.ovulationTest ?? null,
    pregnancyTest: log.pregnancyTest ?? null,
    notes: log.notes || '',
    painEntries: log.painEntries ?? [],
    sleepQuality: log.sleepQuality ?? null,
    stressLevel: log.stressLevel ?? null,
    exerciseLevel: log.exerciseLevel ?? null,
    caffeine: log.caffeine ?? null,
    alcohol: log.alcohol ?? null,
    customTagIds: log.customTagIds ?? [],
    energy: log.energy ?? log.observations?.energy ?? null,
    observationAssessments: { ...(log.observationAssessments || {}) },
    ovulationMarked: isOvulationMarked(log.observations) ? true : null,
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
      // Activity tags only when the answer is "yes"; sex drive is its own answer and is always kept.
      symptoms: [...form.symptoms, ...form.sexTags.filter((id) => form.sexual === true || !SEX_ACTIVITY_IDS.has(id))],
      moods: form.moods,
      sexualActivity: form.sexual,
      libido: form.libido,
      bbt: bbtNum,
      cervicalMucus: form.mucus,
      ovulationTest: form.ovulationTest,
      pregnancyTest: form.pregnancyTest,
      notes: form.notes.trim() || null,
      painEntries: form.painEntries,
      sleepQuality: form.sleepQuality,
      stressLevel: form.stressLevel,
      exerciseLevel: form.exerciseLevel,
      caffeine: form.caffeine,
      alcohol: form.alcohol,
      customTagIds: form.customTagIds,
      observations: { energy: form.energy, ...ovulationMarkPatch(form.ovulationMarked) },
      energy: form.energy,
      observationAssessments: form.observationAssessments || {},
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
  // Optional notification refresh must never turn a saved observation into an unhandled rejection.
  void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) => requestEngageRefresh()).catch(() => undefined);
  void import('@/lib/funnel').then(({ trackFirstHealthAction }) => trackFirstHealthAction('cycle')).catch(() => undefined);
  return result;
}
