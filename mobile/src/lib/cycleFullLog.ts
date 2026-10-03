/**
 * The full log (`/cycle/log`) as group cards — Clue's structure, our order (brief §8.3):
 * სისხლდენა · ტკივილი · განწყობა · სხეული · მონელება · კანი · ენერგია · ნაყოფიერების ნიშნები ·
 * პირადი · then lifestyle, tags and the journal. Pure: node tests load it. The three jump tabs of the
 * screen (სისხლდენა / შეგრძნება / დეტალები) are anchors into this one list, never separate pages.
 *
 * Privacy: the private group holds only the two intimate symptoms; sex and sex drive are rendered by
 * `CycleSexSection` behind the same lock row and never appear as tiles here.
 */
import { FLOW_OPTIONS, MOOD_OPTIONS, MUCUS_OPTIONS, PHYSICAL_SYMPTOMS, type CycleChip } from '../constants/cycle.ts';
import { chipGroup, PAIN_MANAGED_SYMPTOM_IDS } from './cycleObservationRegistry.ts';

export type FullLogTab = 'flow' | 'feel' | 'more';

export type FullLogGroupId =
  | 'flow'
  | 'pain'
  | 'mood'
  | 'physical'
  | 'digestion'
  | 'skin'
  | 'energy'
  | 'fertility'
  | 'private'
  | 'lifestyle'
  | 'tags'
  | 'journal';

/** Group order on the screen. */
export const FULL_LOG_ORDER: readonly FullLogGroupId[] = [
  'flow',
  'pain',
  'mood',
  'physical',
  'digestion',
  'skin',
  'energy',
  'fertility',
  'private',
  'lifestyle',
  'tags',
  'journal',
];

/** Which jump tab a group belongs to (the tab scrolls to its first group). */
export const FULL_LOG_TAB_OF: Readonly<Record<FullLogGroupId, FullLogTab>> = {
  flow: 'flow',
  pain: 'feel',
  mood: 'feel',
  physical: 'feel',
  digestion: 'feel',
  skin: 'feel',
  energy: 'feel',
  fertility: 'more',
  private: 'more',
  lifestyle: 'more',
  tags: 'more',
  journal: 'more',
};

export const FULL_LOG_TABS: readonly FullLogTab[] = ['flow', 'feel', 'more'];

/** Tiles shown before the „+N“ tile — one neat row of five with it. */
export const FULL_LOG_VISIBLE = 4;

export type SymptomGroupId = 'physical' | 'digestion' | 'skin' | 'energy' | 'private';
export const SYMPTOM_GROUPS: readonly SymptomGroupId[] = ['physical', 'digestion', 'skin', 'energy', 'private'];

/** The two intimate symptoms — the only private tiles; sex ids are never tiles. */
const PRIVATE_TILE_IDS = ['vaginal_dryness', 'itching_vulva'];

/** The symptom tiles of a group, in catalog order. Pain-managed ids live in the pain group. */
export function symptomTiles(group: SymptomGroupId): CycleChip[] {
  if (group === 'private') return PHYSICAL_SYMPTOMS.filter((o) => PRIVATE_TILE_IDS.includes(o.id));
  return PHYSICAL_SYMPTOMS.filter((o) => !PAIN_MANAGED_SYMPTOM_IDS.has(o.id) && chipGroup(o.id) === group);
}

export function moodTiles(): CycleChip[] {
  return MOOD_OPTIONS;
}

export function flowTiles(): CycleChip[] {
  return FLOW_OPTIONS;
}

export function mucusTiles(): CycleChip[] {
  return MUCUS_OPTIONS;
}

/**
 * Fold a group: the first `visible` tiles plus every selected one (so an edited day never hides what
 * it holds), in catalog order; `hidden` is what „+N“ unfolds. Nothing is folded when at most one tile
 * would hide — a „+1“ tile costs the same space as the tile itself.
 */
export function foldTiles<T extends { id: string }>(
  items: readonly T[],
  visible: number,
  isSelected: (item: T) => boolean,
): { shown: T[]; hidden: number } {
  const hiddenCandidates = items.slice(visible).filter((item) => !isSelected(item));
  if (hiddenCandidates.length <= 1) return { shown: [...items], hidden: 0 };
  return {
    shown: items.filter((item, i) => i < visible || isSelected(item)),
    hidden: hiddenCandidates.length,
  };
}

/** Which jump tab is active for a scroll offset: the last anchor at or above the offset (plus slack). */
export function activeTabForOffset(
  anchors: Partial<Record<FullLogTab, number>>,
  offsetY: number,
  { slack = 24, endReached = false }: { slack?: number; endReached?: boolean } = {},
): FullLogTab {
  if (endReached) {
    for (const tab of [...FULL_LOG_TABS].reverse()) if (anchors[tab] != null) return tab;
  }
  let active: FullLogTab = 'flow';
  for (const tab of FULL_LOG_TABS) {
    const y = anchors[tab];
    if (y != null && y <= offsetY + slack) active = tab;
  }
  return active;
}

/** Whether a day's form has anything in the given tab (the dot on the jump bar). */
export function tabHasContent(
  tab: FullLogTab,
  form: {
    flow: string | null;
    symptoms: string[];
    moods: string[];
    painEntries: unknown[];
    observationAssessments?: Record<string, unknown>;
    sexual: boolean | null;
    sexTags: string[];
    notes: string;
    bbt: string;
    mucus: string | null;
    ovulationTest: string | null;
    pregnancyTest: string | null;
    sleepQuality: string | null;
    stressLevel: string | null;
    exerciseLevel: string | null;
    caffeine: string | null;
    alcohol: string | null;
    energy: string | null;
    customTagIds: string[];
  },
): boolean {
  const privateSymptoms = form.symptoms.filter((id) => PRIVATE_TILE_IDS.includes(id));
  if (tab === 'flow') return Boolean(form.flow);
  if (tab === 'feel') {
    return (
      form.symptoms.length > privateSymptoms.length ||
      form.moods.length > 0 ||
      form.painEntries.length > 0 ||
      Object.keys(form.observationAssessments || {}).length > 0
    );
  }
  return (
    privateSymptoms.length > 0 ||
    form.sexual != null ||
    form.sexTags.length > 0 ||
    form.notes.trim().length > 0 ||
    Boolean(form.bbt.trim()) ||
    Boolean(form.mucus) ||
    Boolean(form.ovulationTest) ||
    Boolean(form.pregnancyTest) ||
    Boolean(form.sleepQuality) ||
    Boolean(form.stressLevel) ||
    Boolean(form.exerciseLevel) ||
    Boolean(form.caffeine) ||
    Boolean(form.alcohol) ||
    Boolean(form.energy) ||
    form.customTagIds.length > 0
  );
}

/** True when the day holds something behind the lock row (shown as „აღრიცხულია“, never unfolded by itself). */
export function hasPrivateContent(form: { sexual: boolean | null; sexTags: string[]; symptoms: string[] }): boolean {
  return form.sexual != null || form.sexTags.length > 0 || form.symptoms.some((id) => PRIVATE_TILE_IDS.includes(id));
}
