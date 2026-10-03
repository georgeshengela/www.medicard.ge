/**
 * „კატეგორიების მორგება“ (brief §8.3, full log): which groups of the log a person sees and in what order.
 * Pure (node tests load it); stored per device and account by `useCycleLogLayout`.
 *
 * - სისხლდენა is always on and always first — it is never part of the layout.
 * - Groups move only inside their jump-tab section (შეგრძნება / დეტალები), so the three anchors of
 *   `/cycle/log` keep pointing at the right part of the one list.
 * - Hiding never loses data: a hidden group that holds something for the day is shown anyway
 *   (`groupHasContent`), in its place.
 * - The quick log follows the same switches and order for the groups it has (pain, mood, symptoms,
 *   fertility signs); its private lock row stays right after bleeding (owner, 2026-09-29) and only
 *   follows the private switch.
 */
import { FULL_LOG_ORDER, FULL_LOG_TAB_OF, hasPrivateContent, symptomTiles, type FullLogGroupId, type FullLogTab } from './cycleFullLog.ts';

export type LogLayoutGroup = Exclude<FullLogGroupId, 'flow'>;

/** Every group the person can switch off or move, in the default order. */
export const LAYOUT_GROUPS: readonly LogLayoutGroup[] = FULL_LOG_ORDER.filter((g): g is LogLayoutGroup => g !== 'flow');

export type CycleLogLayout = { order: LogLayoutGroup[]; hidden: LogLayoutGroup[] };

export const DEFAULT_LOG_LAYOUT: CycleLogLayout = { order: [...LAYOUT_GROUPS], hidden: [] };

/** „მინიმალური“: სისხლდენა (always), ტკივილი, განწყობა. */
export const MINIMAL_GROUPS: readonly LogLayoutGroup[] = ['pain', 'mood'];

export function minimalLogLayout(): CycleLogLayout {
  return { order: [...LAYOUT_GROUPS], hidden: LAYOUT_GROUPS.filter((g) => !MINIMAL_GROUPS.includes(g)) };
}

const TAB_RANK: Record<FullLogTab, number> = { flow: 0, feel: 1, more: 2 };

function isGroup(value: unknown): value is LogLayoutGroup {
  return typeof value === 'string' && (LAYOUT_GROUPS as readonly string[]).includes(value);
}

/**
 * A stored layout made safe: unknown ids dropped, duplicates removed, groups added by a later app
 * version slotted in at their default place, and every group kept inside its tab section.
 */
export function normalizeLogLayout(raw: unknown): CycleLogLayout {
  const obj = raw && typeof raw === 'object' ? (raw as { order?: unknown; hidden?: unknown }) : {};
  const seen = new Set<LogLayoutGroup>();
  const order: LogLayoutGroup[] = [];
  for (const id of Array.isArray(obj.order) ? obj.order : []) {
    if (isGroup(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of LAYOUT_GROUPS) {
    if (seen.has(id)) continue;
    // A missing group goes right after its default predecessor (or first when it has none).
    const prev = LAYOUT_GROUPS.slice(0, LAYOUT_GROUPS.indexOf(id)).reverse().find((g) => order.includes(g));
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, id);
    seen.add(id);
  }
  // Stable: keeps the person's order inside each section.
  const sorted = order
    .map((id, i) => ({ id, i }))
    .sort((a, b) => TAB_RANK[FULL_LOG_TAB_OF[a.id]] - TAB_RANK[FULL_LOG_TAB_OF[b.id]] || a.i - b.i)
    .map((x) => x.id);
  const hidden = [...new Set((Array.isArray(obj.hidden) ? obj.hidden : []).filter(isGroup))];
  return { order: sorted, hidden: LAYOUT_GROUPS.filter((g) => hidden.includes(g)) };
}

export function sameLayout(a: CycleLogLayout, b: CycleLogLayout): boolean {
  const x = normalizeLogLayout(a);
  const y = normalizeLogLayout(b);
  return x.order.join() === y.order.join() && x.hidden.join() === y.hidden.join();
}

export function isGroupVisible(layout: CycleLogLayout, id: LogLayoutGroup): boolean {
  return !layout.hidden.includes(id);
}

export function setGroupVisible(layout: CycleLogLayout, id: LogLayoutGroup, visible: boolean): CycleLogLayout {
  const hidden = layout.hidden.filter((g) => g !== id);
  return normalizeLogLayout({ order: layout.order, hidden: visible ? hidden : [...hidden, id] });
}

/** The neighbour a group swaps with (same section only), or null at the section's edge. */
function neighbour(layout: CycleLogLayout, id: LogLayoutGroup, dir: -1 | 1): LogLayoutGroup | null {
  const i = layout.order.indexOf(id);
  const other = layout.order[i + dir];
  if (i < 0 || !other || FULL_LOG_TAB_OF[other] !== FULL_LOG_TAB_OF[id]) return null;
  return other;
}

export function canMoveLogGroup(layout: CycleLogLayout, id: LogLayoutGroup, dir: -1 | 1): boolean {
  return neighbour(layout, id, dir) != null;
}

export function moveLogGroup(layout: CycleLogLayout, id: LogLayoutGroup, dir: -1 | 1): CycleLogLayout {
  const other = neighbour(layout, id, dir);
  if (!other) return layout;
  const order = [...layout.order];
  const i = order.indexOf(id);
  order[i] = other;
  order[i + dir] = id;
  return normalizeLogLayout({ order, hidden: layout.hidden });
}

/** The groups of one jump-tab section in the person's order (for the customize sheet). */
export function sectionGroups(layout: CycleLogLayout, tab: Exclude<FullLogTab, 'flow'>): LogLayoutGroup[] {
  return layout.order.filter((g) => FULL_LOG_TAB_OF[g] === tab);
}

/** Device storage key — per account, so two people on one phone keep their own layout. */
export function logLayoutKey(userId: string | null | undefined): string {
  return `medicard.cycle.logLayout.v1:${userId || 'anon'}`;
}

export type LogLayoutForm = {
  flow: string | null;
  symptoms: string[];
  moods: string[];
  painEntries: unknown[];
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
};

const SYMPTOM_GROUP_IDS: Record<'physical' | 'digestion' | 'skin' | 'energy', Set<string>> = {
  physical: new Set(symptomTiles('physical').map((o) => o.id)),
  digestion: new Set(symptomTiles('digestion').map((o) => o.id)),
  skin: new Set(symptomTiles('skin').map((o) => o.id)),
  energy: new Set(symptomTiles('energy').map((o) => o.id)),
};

/** Whether the day already holds something in a group (then it shows even when switched off). */
export function groupHasContent(group: FullLogGroupId, form: LogLayoutForm): boolean {
  switch (group) {
    case 'flow':
      return Boolean(form.flow);
    case 'pain':
      return form.painEntries.length > 0;
    case 'mood':
      return form.moods.length > 0;
    case 'physical':
    case 'digestion':
    case 'skin':
    case 'energy':
      return form.symptoms.some((id) => SYMPTOM_GROUP_IDS[group].has(id));
    case 'fertility':
      return Boolean(form.bbt.trim() || form.mucus || form.ovulationTest || form.pregnancyTest);
    case 'private':
      return hasPrivateContent(form);
    case 'lifestyle':
      return Boolean(form.sleepQuality || form.stressLevel || form.exerciseLevel || form.caffeine || form.alcohol || form.energy);
    case 'tags':
      return form.customTagIds.length > 0;
    case 'journal':
      return form.notes.trim().length > 0;
    default:
      return false;
  }
}

/**
 * What the full log renders per section: bleeding alone in its section, then the person's order of
 * every group that is switched on or already holds something today. `available` drops groups the mode
 * does not log (e.g. fertility signs outside TTC).
 */
export function fullLogSections(
  layout: CycleLogLayout,
  form: LogLayoutForm,
  available: (group: LogLayoutGroup) => boolean = () => true,
): Record<FullLogTab, FullLogGroupId[]> {
  const shown = (g: LogLayoutGroup) => available(g) && (isGroupVisible(layout, g) || groupHasContent(g, form));
  return {
    flow: ['flow'],
    feel: sectionGroups(layout, 'feel').filter(shown),
    more: sectionGroups(layout, 'more').filter(shown),
  };
}

export type QuickLogGroup = 'private' | 'pain' | 'mood' | 'symptoms' | 'fertility';

const QUICK_SYMPTOM_GROUPS = ['physical', 'digestion', 'skin', 'energy'] as const;
const DEFAULT_QUICK_ORDER: readonly QuickLogGroup[] = ['private', 'pain', 'mood', 'symptoms', 'fertility'];

/**
 * The classic quick log's groups after bleeding: the private lock row first (fixed), then pain, mood,
 * symptoms and fertility signs in the person's order. Symptoms count as on while any symptom group is
 * on; a switched-off group with something logged today still shows.
 */
export function quickLogGroups(layout: CycleLogLayout, form: LogLayoutForm, { fertility }: { fertility: boolean }): QuickLogGroup[] {
  const rank = (g: LogLayoutGroup) => layout.order.indexOf(g);
  const symptomOn = QUICK_SYMPTOM_GROUPS.filter((g) => isGroupVisible(layout, g));
  const nonPrivateSymptom = form.symptoms.some((id) => QUICK_SYMPTOM_GROUPS.some((g) => SYMPTOM_GROUP_IDS[g].has(id)));
  const entries: { id: QuickLogGroup; rank: number; on: boolean }[] = [
    { id: 'pain', rank: rank('pain'), on: isGroupVisible(layout, 'pain') || groupHasContent('pain', form) },
    { id: 'mood', rank: rank('mood'), on: isGroupVisible(layout, 'mood') || groupHasContent('mood', form) },
    {
      id: 'symptoms',
      rank: Math.min(...(symptomOn.length ? symptomOn : QUICK_SYMPTOM_GROUPS).map(rank)),
      on: symptomOn.length > 0 || nonPrivateSymptom,
    },
    { id: 'fertility', rank: rank('fertility'), on: fertility && (isGroupVisible(layout, 'fertility') || groupHasContent('fertility', form)) },
  ];
  const ordered = entries
    .filter((e) => e.on)
    .sort((a, b) => a.rank - b.rank || DEFAULT_QUICK_ORDER.indexOf(a.id) - DEFAULT_QUICK_ORDER.indexOf(b.id))
    .map((e) => e.id);
  const privateOn = isGroupVisible(layout, 'private') || groupHasContent('private', form);
  return privateOn ? ['private', ...ordered] : ordered;
}
