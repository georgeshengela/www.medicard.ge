import { ka } from '../i18n/ka.ts';
import { tx } from '../i18n/locale.js';
import type { CycleLog } from './api';
import { cycleGlyphFor, flowGlyphStyle, levelGlyphOpacity, levelOf, type CycleIconGroup, type CycleIconKind } from './cycleIconMap.ts';
import { canonicalPregnancyChecklist, chipGroup, stripPainManagedSymptoms } from './cycleObservationRegistry.ts';
import { painLevel } from './cycleQuickLogCopy.ts';
import { CYCLE_TEST_OPTIONS, FLOW_OPTIONS, MOOD_OPTIONS, MUCUS_OPTIONS, PHYSICAL_SYMPTOMS, PREGNANCY_CHECKLIST, SEXUAL_OPTIONS } from '../constants/cycle.ts';
import type { CycleIconGlyph } from '../constants/cycleIconSvg.ts';

/**
 * What a day holds, as read-only tiles for the day sheet (brief §8.4: facts as tiles, not
 * „სისხლდენა: ზომიერი · სიმპტომები: 3“). Everything private — sex, sex drive, intimate symptoms,
 * the journal, tags — never becomes a tile; `privateFactCount` folds it into one line
 * („პირადი ჩანაწერი · მხოლოდ შენ“). Fertility signs (mucus, tests, BBT) are tiles only where the
 * mode shows fertility; otherwise they join the private line.
 *
 * Imports stay relative so `node --test` can load this module (same as the other cycle libs).
 */
export type DayFactTile = {
  key: string;
  kind: CycleIconKind;
  id: string;
  glyph: CycleIconGlyph;
  label: string;
  group: CycleIconGroup;
  level?: number | null;
  levelMax?: number;
  levelName?: string | null;
  glyphScale?: number;
  glyphOpacity?: number;
  hollow?: boolean;
};

export type DayFactSectionId = 'bleeding' | 'pain' | 'mood' | 'symptoms' | 'fertility' | 'lifestyle' | 'checklist';

export type DayFactSection = { id: DayFactSectionId; title: string; tiles: DayFactTile[] };

const SEX_IDS = new Set(SEXUAL_OPTIONS.map((o) => o.id));
const CATALOG = [...PHYSICAL_SYMPTOMS, ...MOOD_OPTIONS, ...FLOW_OPTIONS, ...MUCUS_OPTIONS, ...CYCLE_TEST_OPTIONS];

const ENERGY_LEVELS = ['very_low', 'low', 'normal', 'high', 'very_high'] as const;
const SLEEP_QUALITIES = ['poor', 'okay', 'good'] as const;
const STRESS_LEVELS = ['low', 'medium', 'high'] as const;
const EXERCISE_LEVELS = ['none', 'light', 'moderate', 'intense'] as const;
const CAFFEINE_LEVELS = ['none', 'low', 'moderate', 'high'] as const;
const ALCOHOL_LEVELS = ['none', 'light', 'moderate', 'heavy'] as const;

function chipLabel(id: string): string {
  return CATALOG.find((item) => item.id === id)?.label ?? id;
}

function fromTable(table: Record<string, string>, value: string): string {
  return table[value] ?? value;
}

function isTestResult(value: unknown): value is 'negative' | 'positive' | 'unclear' {
  return value === 'negative' || value === 'positive' || value === 'unclear';
}

function testLabel(title: string, result: 'negative' | 'positive' | 'unclear'): string {
  return `${title} · ${ka.cycle.testResult[result]}`;
}

/** Public (non-private) symptom ids of a log: pain-managed ones are shown as pain, intimate ones never. */
export function publicSymptomIds(log: Pick<CycleLog, 'symptoms' | 'painEntries'>): string[] {
  return stripPainManagedSymptoms(log.symptoms ?? [], log.painEntries).filter((id) => !SEX_IDS.has(id) && chipGroup(id) !== 'private');
}

export function dayFactSections(
  log: CycleLog | null | undefined,
  { showFertility = false }: { showFertility?: boolean } = {},
): DayFactSection[] {
  if (!log) return [];
  const sections: DayFactSection[] = [];

  if (log.flow) {
    const style = flowGlyphStyle(log.flow);
    sections.push({
      id: 'bleeding',
      title: tx('სისხლდენა', 'Bleeding'),
      tiles: [
        {
          key: `flow:${log.flow}`,
          kind: 'flow',
          id: log.flow,
          glyph: cycleGlyphFor('flow', log.flow),
          label: chipLabel(log.flow),
          group: 'bleeding',
          glyphScale: style.scale,
          glyphOpacity: style.opacity,
          hollow: style.hollow,
        },
      ],
    });
  }

  const pain = (log.painEntries ?? []).map<DayFactTile>((entry) => ({
    key: `pain:${entry.type}`,
    kind: 'pain',
    id: entry.type,
    glyph: cycleGlyphFor('pain', entry.type),
    label: fromTable(ka.cycle.painType as Record<string, string>, entry.type),
    group: 'neutral',
    level: painLevel(entry.severity),
    levelMax: 3,
  }));
  if (pain.length) sections.push({ id: 'pain', title: ka.cycle.pain, tiles: pain });

  const moods = (log.moods ?? []).map<DayFactTile>((id) => ({
    key: `mood:${id}`,
    kind: 'mood',
    id,
    glyph: cycleGlyphFor('mood', id),
    label: chipLabel(id),
    group: 'neutral',
  }));
  if (moods.length) sections.push({ id: 'mood', title: ka.cycle.moods, tiles: moods });

  const symptoms = publicSymptomIds(log).map<DayFactTile>((id) => ({
    key: `symptom:${id}`,
    kind: 'symptom',
    id,
    glyph: cycleGlyphFor('symptom', id),
    label: chipLabel(id),
    group: 'neutral',
  }));
  if (symptoms.length) sections.push({ id: 'symptoms', title: ka.cycle.symptoms, tiles: symptoms });

  if (showFertility) {
    const fertility: DayFactTile[] = [];
    if (log.cervicalMucus) {
      fertility.push({
        key: `mucus:${log.cervicalMucus}`,
        kind: 'mucus',
        id: log.cervicalMucus,
        glyph: cycleGlyphFor('mucus', log.cervicalMucus),
        label: `${tx('ლორწო', 'Mucus')} · ${chipLabel(log.cervicalMucus)}`,
        group: 'fertility',
      });
    }
    if (isTestResult(log.ovulationTest)) {
      fertility.push({
        key: 'test:ovulationTest',
        kind: 'test',
        id: 'ovulationTest',
        glyph: cycleGlyphFor('test', 'ovulationTest'),
        label: testLabel('OPK', log.ovulationTest),
        group: 'fertility',
      });
    }
    if (isTestResult(log.pregnancyTest)) {
      fertility.push({
        key: 'test:pregnancyTest',
        kind: 'test',
        id: 'pregnancyTest',
        glyph: cycleGlyphFor('test', 'pregnancyTest'),
        label: testLabel(tx('ორსულობის ტესტი', 'Pregnancy test'), log.pregnancyTest),
        group: 'fertility',
      });
    }
    if (log.bbt != null) {
      fertility.push({
        key: 'test:bbt',
        kind: 'test',
        id: 'bbt',
        glyph: cycleGlyphFor('test', 'bbt'),
        label: `BBT ${log.bbt} °C`,
        group: 'fertility',
      });
    }
    if (fertility.length) sections.push({ id: 'fertility', title: ka.cycle.trackGroup.fertility, tiles: fertility });
  }

  const lifestyle: DayFactTile[] = [];
  const energy = log.energy ?? log.observations?.energy ?? null;
  const pushLevel = (id: string, options: readonly string[], value: string | null | undefined, title: string, table: Record<string, string>) => {
    const level = levelOf(options, value);
    if (!value || level == null) return;
    lifestyle.push({
      key: `lifestyle:${id}`,
      kind: 'lifestyle',
      id,
      glyph: cycleGlyphFor('lifestyle', id),
      label: `${title} · ${fromTable(table, value)}`,
      group: 'neutral',
      level,
      levelMax: options.length,
      levelName: null,
      glyphOpacity: levelGlyphOpacity(level, options.length),
    });
  };
  const cy = ka.cycle as unknown as Record<string, Record<string, string>>;
  pushLevel('energy', ENERGY_LEVELS, energy, ka.cycle.energy, cy.energyLevel ?? {});
  pushLevel('sleepQuality', SLEEP_QUALITIES, log.sleepQuality, ka.cycle.sleep, cy.sleepQuality ?? {});
  pushLevel('stressLevel', STRESS_LEVELS, log.stressLevel, ka.cycle.stress, cy.stressLevel ?? {});
  pushLevel('exerciseLevel', EXERCISE_LEVELS, log.exerciseLevel, ka.cycle.exercise, cy.exerciseLevel ?? {});
  pushLevel('caffeine', CAFFEINE_LEVELS, log.caffeine, ka.cycle.caffeine, cy.caffeineLevel ?? {});
  pushLevel('alcohol', ALCOHOL_LEVELS, log.alcohol, ka.cycle.alcohol, cy.alcoholLevel ?? {});
  if (lifestyle.length) sections.push({ id: 'lifestyle', title: tx('ცხოვრების წესი', 'Lifestyle'), tiles: lifestyle });

  // Pregnancy checklist ticks (W2-12b): what she did that day, one tile each, in the checklist's order.
  const checklist = canonicalPregnancyChecklist(log.observations?.pregnancyChecklist).map<DayFactTile>((id) => ({
    key: `checklist:${id}`,
    kind: 'checklist',
    id,
    glyph: cycleGlyphFor('checklist', id),
    label: PREGNANCY_CHECKLIST.find((item) => item.id === id)?.label ?? id,
    group: 'neutral',
  }));
  if (checklist.length) sections.push({ id: 'checklist', title: tx('დღის ჩეკლისტი', 'Checklist for the day'), tiles: checklist });

  return sections;
}

/**
 * How many private things the day holds (sex, sex drive, intimate symptoms, journal, tags, and the
 * fertility signs when the mode hides fertility). The sheet shows one line without detail.
 */
export function privateFactCount(
  log: CycleLog | null | undefined,
  { showFertility = false }: { showFertility?: boolean } = {},
): number {
  if (!log) return 0;
  let n = 0;
  if (log.sexualActivity === true || (log.symptoms ?? []).some((id) => SEX_IDS.has(id))) n += 1;
  if (log.libido != null) n += 1;
  n += (log.symptoms ?? []).filter((id) => !SEX_IDS.has(id) && chipGroup(id) === 'private').length;
  if (log.notes?.trim()) n += 1;
  if (log.customTagIds?.length) n += 1;
  if (!showFertility) {
    if (log.cervicalMucus) n += 1;
    if (isTestResult(log.ovulationTest)) n += 1;
    if (isTestResult(log.pregnancyTest)) n += 1;
    if (log.bbt != null) n += 1;
  }
  return n;
}

export function privateFactsLine(): string {
  return tx('პირადი ჩანაწერი · მხოლოდ შენ', 'Private entry · only you');
}

/** Whether the day has anything to show at the top of the sheet. */
export function dayHasFacts(log: CycleLog | null | undefined, opts?: { showFertility?: boolean }): boolean {
  return dayFactSections(log, opts).length > 0 || privateFactCount(log, opts) > 0;
}

/** Stable comparison for „unsaved changes“: forms are plain JSON (arrays of ids, strings, nulls). */
export function sameLogForm<T extends object>(a: T, b: T): boolean {
  return stableJson(a) === stableJson(b);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}
