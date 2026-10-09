/**
 * The cycle day form ↔ stored log mapping, and the body a save sends. Pure (relative imports only),
 * so node tests load it; `cycleLogSave.ts` re-exports it for the app.
 */
import type { CycleLog } from './api';
import type { CycleLogForm } from '../components/cycle/CycleLogTabs';
import { SEXUAL_OPTIONS, SEX_ACTIVITY_OPTIONS } from '../constants/cycle.ts';
import {
  isBbtFromHealth,
  isOvulationMarked,
  ovulationMarkPatch,
  pregnancyChecklistFrom,
  pregnancyChecklistPatch,
} from './cycleObservationRegistry.ts';

const SEX_IDS = new Set(SEXUAL_OPTIONS.map((o) => o.id));
const SEX_ACTIVITY_IDS = new Set(SEX_ACTIVITY_OPTIONS.map((o) => o.id));

export const EMPTY_CYCLE_LOG: CycleLogForm = {
  flow: null,
  symptoms: [],
  moods: [],
  sexTags: [],
  /** null = not answered (nothing sent as "no"); false = the person chose "no". */
  sexual: null,
  sexualStored: null,
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
  pregnancyChecklist: null,
};

export function parseBbt(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function isBleedFlow(flow: string | null | undefined): boolean {
  return flow === 'light' || flow === 'medium' || flow === 'heavy';
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
    // …but keep what is stored, so an untouched answer is saved back as it was (CYC-11).
    sexualStored: log.sexualActivity ?? null,
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
    pregnancyChecklist: pregnancyChecklistFrom(log.observations),
    bbtFromHealth: log.bbt != null && isBbtFromHealth(log.observations) ? log.bbt : null,
  };
}

/**
 * What a save sends for „სექსი“: her answer when she gave one (yes / „არ მქონია“); unanswered keeps a
 * stored „no“ — the form shows a stored false as unanswered, so without this every later save of the
 * day (a mood, the ♥ undo, the full log) erased her explicit „არ მქონია“ (CYC-11). Clearing a stored
 * „yes“ still sends null.
 */
export function sexualActivityForSave(form: Pick<CycleLogForm, 'sexual' | 'sexualStored'>): boolean | null {
  if (form.sexual === true || form.sexual === false) return form.sexual;
  return form.sexualStored === false ? false : null;
}

/** The log body a save of the whole day sends (offline queue → `PUT /api/cycle/logs/:date`). */
export function cycleLogBodyFromForm(form: CycleLogForm) {
  return {
    flow: form.flow,
    // Activity tags only when the answer is "yes"; sex drive is its own answer and is always kept.
    symptoms: [...form.symptoms, ...form.sexTags.filter((id) => form.sexual === true || !SEX_ACTIVITY_IDS.has(id))],
    moods: form.moods,
    sexualActivity: sexualActivityForSave(form),
    libido: form.libido,
    bbt: parseBbt(form.bbt),
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
    observations: { energy: form.energy, ...ovulationMarkPatch(form.ovulationMarked), ...pregnancyChecklistPatch(form.pregnancyChecklist) },
    energy: form.energy,
    observationAssessments: form.observationAssessments || {},
  };
}
