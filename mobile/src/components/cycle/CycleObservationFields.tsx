import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { CycleIconRow, CycleIconTile, CycleTileGrid, levelLabel } from '@/components/cycle/CycleIconTile';
import { CycleLevelTiles } from '@/components/cycle/CycleModeTiles';
import { usePainCoachMark } from '@/components/cycle/usePainCoachMark';
import type { CycleCustomTag, CyclePainEntry, CyclePainSeverity, CyclePainType } from '@/lib/api';
import { cycleGlyphFor, type LifestyleField } from '@/lib/cycleIconMap';
import { CYCLE_TAGS_PER_DAY_MAX, toggleDayTagId } from '@/lib/cycleOfflineCore';
import {
  ALCOHOL_LEVELS,
  CAFFEINE_LEVELS,
  CYCLE_NOTE_MAX,
  CYCLE_TAG_NAME_MAX,
  ENERGY_LEVELS,
  EXERCISE_LEVELS,
  PAIN_TYPES,
  SLEEP_QUALITIES,
  STRESS_LEVELS,
  activeCustomTags,
  alcoholLabel,
  caffeineLabel,
  energyLabel,
  exerciseLabel,
  painTypeLabel,
  removePainEntry,
  sleepLabel,
  stressLabel,
  upsertPainEntry,
} from '@/lib/cycleObservations';
import { nextPainSeverity, painLevel } from '@/lib/cycleQuickLogCopy';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { useCycleColors } from '@/theme/cycle';

/**
 * Pain for one day as tiles (brief §8.3, 2026-10-03): one tile per place, several places at once,
 * each with its own strength by re-tap — nothing → ზომიერი (●●○) → ძლიერი (●●●) → მსუბუქი (●○○) →
 * off (`nextPainSeverity`). A long press opens a small inline pill (მსუბუქი · ზომიერი · ძლიერი) to pick
 * the strength directly, and a one-time coach mark teaches both gestures (`usePainCoachMark`, per
 * device). The same editor in every quick log and in the full log, so pain behaves the same wherever it
 * is logged. Stored in the existing `painEntries[].severity`.
 *
 * `visible` folds the row behind a „+N“ tile (`CycleIconRow`); `expected` draws the places the local
 * expectation engine expects as dashed tiles. `compact` drops the full-log prose; `typesFirst` is kept for
 * callers.
 */
export function CyclePainEditor({
  entries,
  onChange,
  compact,
  types,
  disabled = false,
  trailing,
  visible,
  gap = 2,
  expected,
  hintFor,
}: {
  entries: CyclePainEntry[];
  onChange: (next: CyclePainEntry[]) => void;
  compact?: boolean;
  types?: readonly CyclePainType[];
  typesFirst?: boolean;
  disabled?: boolean;
  /** Extra tiles that belong in the same row (perimenopause keeps „მიგრენი“ beside the pain places). */
  trailing?: React.ReactNode;
  /** Fold after this many tiles (selected tiles always stay visible). Unset = every place in one wrapped row. */
  visible?: number;
  gap?: number;
  /** Places the expectation engine expects for this day — dashed until tapped. */
  expected?: readonly string[];
  /** Spoken hint per place (e.g. why it is expected); defaults to the re-tap hint. */
  hintFor?: (type: CyclePainType) => string | undefined;
}) {
  const c = useCycleColors();
  const typeOptions = types?.length ? types : PAIN_TYPES;
  const [pillFor, setPillFor] = useState<CyclePainType | null>(null);
  const coach = usePainCoachMark(!disabled);
  const severityOf = (type: CyclePainType): CyclePainSeverity | null => entries.find((e) => e.type === type)?.severity ?? null;
  const tap = (type: CyclePainType) => {
    const next = nextPainSeverity(severityOf(type));
    onChange(next ? upsertPainEntry(entries, type, next) : removePainEntry(entries, type));
    if (pillFor && pillFor !== type) setPillFor(null);
  };
  const longPress = (type: CyclePainType) => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    coach.dismiss();
    setPillFor(type);
  };
  const pick = (type: CyclePainType, severity: CyclePainSeverity) => {
    Haptics.selectionAsync().catch(() => undefined);
    onChange(upsertPainEntry(entries, type, severity));
    setPillFor(null);
  };

  const tile = (type: CyclePainType) => {
    const severity = severityOf(type);
    return (
      <CycleIconTile
        key={type}
        glyph={cycleGlyphFor('pain', type)}
        label={painTypeLabel(type)}
        selected={severity != null}
        level={painLevel(severity)}
        dashed={Boolean(expected?.includes(type))}
        disabled={disabled}
        onPress={() => tap(type)}
        onLongPress={() => longPress(type)}
        longPressLabel={tx('ინტენსივობის არჩევა', 'Choose the strength')}
        accessibilityHint={
          hintFor?.(type) ??
          tx('ხელახალი შეხება ინტენსივობას ცვლის; ხანგრძლივი დაჭერა — არჩევა', 'Tap again to change the strength; long press to choose it')
        }
      />
    );
  };

  return (
    <View style={{ gap: 8 }}>
      {!compact ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginBottom: 4 }}>{ka.cycle.painHint}</Text> : null}
      {coach.show ? <PainCoachMark onDismiss={coach.dismiss} /> : null}
      {visible != null ? (
        <CycleIconRow
          items={typeOptions.map((id) => ({ id }))}
          visible={visible}
          gap={gap}
          isSelected={({ id }) => severityOf(id) != null || pillFor === id}
          renderTile={({ id }) => tile(id)}
        />
      ) : (
        <CycleTileGrid minGap={gap}>
          {typeOptions.map(tile)}
          {trailing}
        </CycleTileGrid>
      )}
      {pillFor ? (
        <PainStrengthPill
          place={painTypeLabel(pillFor)}
          value={severityOf(pillFor)}
          onPick={(severity) => pick(pillFor, severity)}
          onClose={() => setPillFor(null)}
        />
      ) : null}
      {/* The quick logs already say „ხელახალი შეხება — ინტენსივობა“ in the section head (same as the classic quick log). */}
      {!compact ? (
        <Text style={{ color: c.mutedSoft, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11.5, lineHeight: 16 }}>
          {tx('ხელახალი შეხება ინტენსივობას ცვლის: ზომიერი → ძლიერი → მსუბუქი → მოხსნა', 'Tap again to change the strength: moderate → severe → mild → off')}
        </Text>
      ) : null}
    </View>
  );
}

const PAIN_STRENGTHS: readonly CyclePainSeverity[] = ['mild', 'moderate', 'severe'];

/** The inline strength pill a long press opens: მსუბუქი · ზომიერი · ძლიერი, one choice, closes on pick. */
function PainStrengthPill({
  place,
  value,
  onPick,
  onClose,
}: {
  place: string;
  value: CyclePainSeverity | null;
  onPick: (severity: CyclePainSeverity) => void;
  onClose: () => void;
}) {
  const c = useCycleColors();
  const title = `${place} · ${tx('ინტენსივობა', 'strength')}`;
  return (
    <View style={[pill.wrap, { backgroundColor: c.cardSoft }]}>
      <View style={pill.head}>
        <Text numberOfLines={1} style={[pill.title, { color: c.ink }]}>
          {title}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={onClose} hitSlop={10} style={pill.close}>
          <X size={16} color={c.muted} strokeWidth={2.4} />
        </Pressable>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={title} style={pill.row}>
        {PAIN_STRENGTHS.map((severity) => {
          const on = value === severity;
          const level = painLevel(severity) ?? 1;
          return (
            <Pressable
              key={severity}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={levelLabel(level)}
              onPress={() => onPick(severity)}
              style={[pill.seg, { backgroundColor: on ? c.ink : c.card }]}
            >
              <View style={pill.dots}>
                {[1, 2, 3].map((n) => (
                  <View key={n} style={[pill.dot, { backgroundColor: n <= level ? (on ? c.card : c.ink) : on ? c.muted : c.border }]} />
                ))}
              </View>
              <Text numberOfLines={1} style={[pill.segText, { color: on ? c.card : c.ink }]}>
                {levelLabel(level)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** One-time hint above the pain row; any tap on it dismisses it for good (per device). */
function PainCoachMark({ onDismiss }: { onDismiss: () => void }) {
  const c = useCycleColors();
  const text = tx('ხელახლა შეხება ინტენსივობას ცვლის · ხანგრძლივი დაჭერა — არჩევა', 'Tap again to change the strength · long press to choose');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={tx('დამალავს მინიშნებას', 'Hides this hint')}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onDismiss();
      }}
      style={[pill.coach, { backgroundColor: c.ink }]}
    >
      <Text style={[pill.coachText, { color: c.card }]}>{text}</Text>
      <X size={14} color={c.card} strokeWidth={2.4} />
      <View style={[pill.coachTail, { borderTopColor: c.ink }]} />
    </Pressable>
  );
}

const pill = StyleSheet.create({
  wrap: { borderRadius: 16, padding: 10, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  title: { flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, lineHeight: 17 },
  close: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  segText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, lineHeight: 16 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  coach: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 6 },
  coachText: { flex: 1, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 17 },
  coachTail: {
    position: 'absolute',
    bottom: -6,
    left: 30,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

/**
 * „ცხოვრების წესი“ (brief §8.3): six objects — energy, sleep, stress, activity, caffeine, alcohol — each a
 * row of level tiles with the level as dots under the label (`CycleLevelTiles`), one choice per row.
 */
export function CycleLifestyleFields({
  sleepQuality,
  stressLevel,
  exerciseLevel,
  caffeine,
  alcohol,
  energy,
  onChange,
  gap = 0,
  inset = 10,
}: {
  sleepQuality: string | null;
  stressLevel: string | null;
  exerciseLevel: string | null;
  caffeine: string | null;
  alcohol: string | null;
  energy?: string | null;
  onChange: (patch: {
    sleepQuality?: string | null;
    stressLevel?: string | null;
    exerciseLevel?: string | null;
    caffeine?: string | null;
    alcohol?: string | null;
    energy?: string | null;
  }) => void;
  /** Column gap of the tiles (0 lets five 70 pt tiles share one card). */
  gap?: number;
  /** Side inset of the titles, to line them up with the tiles' labels. */
  inset?: number;
}) {
  const c = useCycleColors();
  const rows: { key: LifestyleField; title: string; options: readonly string[]; value: string | null; labelFor: (id: string) => string }[] = [
    { key: 'energy', title: ka.cycle.energy, options: ENERGY_LEVELS, value: energy ?? null, labelFor: energyLabel },
    { key: 'sleepQuality', title: ka.cycle.sleep, options: SLEEP_QUALITIES, value: sleepQuality, labelFor: sleepLabel },
    { key: 'stressLevel', title: ka.cycle.stress, options: STRESS_LEVELS, value: stressLevel, labelFor: stressLabel },
    { key: 'exerciseLevel', title: ka.cycle.exercise, options: EXERCISE_LEVELS, value: exerciseLevel, labelFor: exerciseLabel },
    { key: 'caffeine', title: ka.cycle.caffeine, options: CAFFEINE_LEVELS, value: caffeine, labelFor: caffeineLabel },
    { key: 'alcohol', title: ka.cycle.alcohol, options: ALCOHOL_LEVELS, value: alcohol, labelFor: alcoholLabel },
  ];
  return (
    <View style={{ gap: 16 }}>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: inset }}>{ka.cycle.lifestyleHint}</Text>
      {rows.map((row) => (
        <View key={row.key} style={{ gap: 10 }}>
          <Text
            accessibilityRole="header"
            style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, paddingHorizontal: inset }}
          >
            {row.title}
          </Text>
          <CycleLevelTiles
            field={row.key}
            options={row.options}
            value={row.value}
            onChange={(next) => onChange({ [row.key]: next })}
            labelFor={row.labelFor}
            gap={gap}
          />
        </View>
      ))}
    </View>
  );
}

export function CycleTagPicker({
  tags,
  selectedIds,
  onChange,
  onCreate,
  creating,
}: {
  tags: CycleCustomTag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreate?: (name: string) => Promise<void>;
  creating?: boolean;
}) {
  const c = useCycleColors();
  const [name, setName] = useState('');
  const active = activeCustomTags(tags);
  // The server keeps 8 tags a day (CYC-10): a 9th tick is refused here, with the hint below.
  const atLimit = selectedIds.length >= CYCLE_TAGS_PER_DAY_MAX;

  const toggle = (id: string) => {
    onChange(toggleDayTagId(selectedIds, id).ids);
  };

  return (
    <View>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>{ka.cycle.customTagsHint}</Text>
      {!active.length ? (
        <Text style={{ color: c.muted, marginBottom: 12 }}>{ka.cycle.customTagEmpty}</Text>
      ) : (
        <View style={{ gap: 8, marginBottom: 12 }}>
          {active.map((tag) => {
            const on = selectedIds.includes(tag.id);
            const blocked = !on && atLimit;
            return (
              <Pressable
                key={tag.id}
                disabled={blocked}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  toggle(tag.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: blocked }}
                accessibilityLabel={tag.name}
                style={{
                  minHeight: 48,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: on ? c.cardSoft : c.card,
                  borderWidth: 1.5,
                  borderColor: on ? c.ink : c.border,
                  opacity: blocked ? 0.45 : 1,
                }}
              >
                <Text style={{ flex: 1, color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15 }}>
                  {tag.name}
                </Text>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? c.cta : 'transparent',
                    borderWidth: on ? 0 : 2,
                    borderColor: c.mutedSoft,
                  }}
                >
                  {on ? <Check size={16} color={c.onPrimary} strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
          {atLimit ? (
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{ka.cycle.customTagDayLimit(CYCLE_TAGS_PER_DAY_MAX)}</Text>
          ) : null}
        </View>
      )}
      {onCreate ? (
        <View>
          <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>{ka.cycle.customTagOnlineOnly}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={CYCLE_TAG_NAME_MAX}
              placeholder={ka.cycle.customTagPlaceholder}
              placeholderTextColor={c.mutedSoft}
              accessibilityLabel={ka.cycle.customTagAdd}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: c.controlBorder,
                backgroundColor: c.cardSoft,
                color: c.ink,
                paddingHorizontal: 14,
              }}
            />
            <Pressable
              disabled={creating || !name.trim()}
              onPress={async () => {
                const next = name.trim();
                if (!next) return;
                await onCreate(next);
                setName('');
              }}
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.customTagAdd}
              style={{
                minHeight: 48,
                paddingHorizontal: 14,
                borderRadius: 14,
                justifyContent: 'center',
                backgroundColor: c.cta,
                opacity: creating || !name.trim() ? 0.5 : 1,
              }}
            >
              <Text style={{ color: c.onPrimary, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.customTagAdd}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={{ color: c.muted, fontSize: 12 }}>{ka.cycle.customTagOnlineOnly}</Text>
      )}
    </View>
  );
}

export function CycleJournalField({
  value,
  onChange,
}: {
  value: string;
  onChange: (notes: string) => void;
}) {
  const c = useCycleColors();
  const left = Math.max(0, CYCLE_NOTE_MAX - value.length);
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={CYCLE_NOTE_MAX}
        placeholder={ka.cycle.logNotesPlaceholder}
        placeholderTextColor={c.mutedSoft}
        accessibilityLabel={ka.cycle.journalTitle}
        style={{
          backgroundColor: c.cardSoft,
          borderRadius: 16,
          padding: 16,
          color: c.ink,
          minHeight: 140,
          textAlignVertical: 'top',
          borderWidth: 1.5,
          borderColor: c.controlBorder,
          fontSize: 15,
          lineHeight: 22,
        }}
      />
      <Text style={{ color: c.muted, fontSize: 11, marginTop: 8 }}>{ka.cycle.journalRemaining(left)}</Text>
    </View>
  );
}
