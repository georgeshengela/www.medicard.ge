import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CycleIconTile } from '@/components/cycle/CycleIconTile';
import { FLOW_OPTIONS, MOOD_OPTIONS, PHYSICAL_SYMPTOMS, PREGNANCY_CHECKLIST, type CycleChip } from '@/constants/cycle';
import { tx } from '@/i18n/locale';
import { cycleGlyphFor, flowGlyphStyle, LEVEL_FIELD_GLYPH, levelGlyphOpacity, levelOf } from '@/lib/cycleIconMap';
import { useCycleColors } from '@/theme/cycle';

/**
 * The tile rows the pregnancy, postpartum and perimenopause quick logs are built from (2026-10-03):
 * the same `CycleIconTile` as the classic quick log, so every mode looks like one app. Each mode keeps
 * its own option lists and copy; these rows only know how to draw a list.
 */

/** A titled block: the name above the row, an optional short hint on the right (never inside a card). */
export function CycleModeSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const c = useCycleColors();
  return (
    <View style={s.section}>
      <View style={s.head}>
        <Text accessibilityRole="header" style={[s.title, { color: c.ink }]}>
          {title}
        </Text>
        {hint ? (
          <Text numberOfLines={1} style={[s.hint, { color: c.mutedSoft }]}>
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A small sub-heading inside a section (ენერგია · ძილი · სტრესი). */
export function CycleModeSubtitle({ children }: { children: string }) {
  const c = useCycleColors();
  return <Text style={[s.subtitle, { color: c.muted }]}>{children}</Text>;
}

/** Soft explanatory copy under a row. */
export function CycleModeNote({ children }: { children: string }) {
  const c = useCycleColors();
  return <Text style={[s.note, { color: c.mutedSoft }]}>{children}</Text>;
}

/** Bleeding: five drops, one choice, tapping the chosen one clears it (brief §8.3 single-choice rows). */
export function CycleFlowTiles({
  value,
  onChange,
  options = FLOW_OPTIONS,
  hint,
  disabled = false,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  options?: readonly CycleChip[];
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={s.row}>
        {options.map((opt) => {
          const style = flowGlyphStyle(opt.id);
          return (
            <CycleIconTile
              key={opt.id}
              role="radio"
              group="bleeding"
              glyph={cycleGlyphFor('flow', opt.id)}
              label={opt.label}
              selected={value === opt.id}
              disabled={disabled}
              glyphScale={style.scale}
              glyphOpacity={style.opacity}
              hollow={style.hollow}
              onPress={() => onChange(value === opt.id ? null : opt.id)}
            />
          );
        })}
      </View>
      {hint ? <CycleModeNote>{hint}</CycleModeNote> : null}
    </View>
  );
}

/** Symptoms, moods or checklist items — several can be on at once. */
export function CycleChipTiles({
  options,
  kind,
  selectedIds,
  onToggle,
  disabled = false,
}: {
  options: readonly CycleChip[];
  kind: 'symptom' | 'mood' | 'checklist';
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.row}>
      {options.map((opt) => (
        <CycleIconTile
          key={opt.id}
          glyph={cycleGlyphFor(kind, opt.id)}
          label={opt.label}
          selected={selectedIds.includes(opt.id)}
          disabled={disabled}
          onPress={() => onToggle(opt.id)}
        />
      ))}
    </View>
  );
}

/**
 * A level field (energy, sleep, stress): one glyph on every tile, the level as dots under the label and
 * a glyph that fades towards the low end; one choice, tapping the chosen one clears it.
 */
export function CycleLevelTiles({
  field,
  options,
  value,
  onChange,
  labelFor,
  disabled = false,
}: {
  field: keyof typeof LEVEL_FIELD_GLYPH;
  options: readonly string[];
  value: string | null;
  onChange: (next: string | null) => void;
  labelFor: (id: string) => string;
  disabled?: boolean;
}) {
  const max = options.length;
  return (
    <View style={s.row}>
      {options.map((id) => {
        const level = levelOf(options, id) ?? 1;
        return (
          <CycleIconTile
            key={id}
            role="radio"
            glyph={LEVEL_FIELD_GLYPH[field]}
            label={labelFor(id)}
            selected={value === id}
            disabled={disabled}
            glyphOpacity={levelGlyphOpacity(level, max)}
            level={level}
            levelMax={max}
            levelName={null}
            onPress={() => onChange(value === id ? null : id)}
          />
        );
      })}
    </View>
  );
}

/** The pregnancy checklist (`PREGNANCY_CHECKLIST`) as tiles — habits and appointments ticked for the day. */
export function CyclePregnancyChecklistTiles({
  selectedIds,
  onToggle,
  disabled = false,
}: {
  selectedIds: readonly string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  return <CycleChipTiles kind="checklist" options={PREGNANCY_CHECKLIST} selectedIds={selectedIds} onToggle={onToggle} disabled={disabled} />;
}

/** The catalog rows for a list of ids, in the list's order (unknown ids are skipped). */
export function symptomChips(ids: readonly string[]): CycleChip[] {
  return ids.map((id) => PHYSICAL_SYMPTOMS.find((o) => o.id === id)).filter((o): o is CycleChip => Boolean(o));
}

export function moodChips(ids: readonly string[]): CycleChip[] {
  return ids.map((id) => MOOD_OPTIONS.find((o) => o.id === id)).filter((o): o is CycleChip => Boolean(o));
}

export const ONE_CHOICE_HINT = () => tx('ერთი არჩევანი', 'one choice');
export const PAIN_TAP_HINT = () => tx('ხელახალი შეხება — ინტენსივობა', 'tap again for strength');

const s = StyleSheet.create({
  section: { gap: 10, marginTop: 18 },
  // A long title („ტკივილი / თავის ტკივილი“) pushes the hint onto its own line instead of truncating either.
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 10, rowGap: 2 },
  title: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, flexShrink: 1 },
  hint: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 16, flexShrink: 1 },
  subtitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  note: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11.5, lineHeight: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: 12 },
});
