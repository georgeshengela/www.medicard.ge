import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { CycleIconTile } from '@/components/cycle/CycleIconTile';
import type { CycleCustomTag, CyclePainEntry, CyclePainSeverity, CyclePainType } from '@/lib/api';
import { cycleGlyphFor } from '@/lib/cycleIconMap';
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

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (next: T | null) => void;
  labelFor: (id: T) => string;
}) {
  const c = useCycleColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((id) => {
        const on = value === id;
        return (
          <Pressable
            key={id}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              onChange(on ? null : id);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={on ? `${labelFor(id)}, ${ka.cycle.pregnancySelected}` : labelFor(id)}
            style={{
              minHeight: 44,
              paddingHorizontal: 10,
              borderRadius: 14,
              justifyContent: 'center',
              backgroundColor: on ? c.accentSoft : c.cardSoft,
              borderWidth: 1,
              borderColor: on ? c.brand : c.controlBorder,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {on ? <Check size={12} color={c.brand} strokeWidth={2.5} /> : null}
            <Text
              style={{
                color: on ? c.brand : c.ink,
                fontFamily: 'NotoSansGeorgian_500Medium',
                fontSize: 12,
              }}
            >
              {labelFor(id)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Pain for one day as tiles (brief §8.3, 2026-10-03): one tile per place, several places at once,
 * each with its own strength by re-tap — nothing → ზომიერი (●●○) → ძლიერი (●●●) → მსუბუქი (●○○) →
 * off (`nextPainSeverity`). The same tiles in every quick log and in the full log, so pain looks the
 * same wherever it is logged. Stored in the existing `painEntries[].severity`.
 *
 * `compact` and `typesFirst` are kept for callers; both render the same row (the full log adds the
 * owner's „არა დიაგნოზი“ hint above it).
 */
export function CyclePainEditor({
  entries,
  onChange,
  compact,
  types,
  disabled = false,
  trailing,
}: {
  entries: CyclePainEntry[];
  onChange: (next: CyclePainEntry[]) => void;
  compact?: boolean;
  types?: readonly CyclePainType[];
  typesFirst?: boolean;
  disabled?: boolean;
  /** Extra tiles that belong in the same row (perimenopause keeps „მიგრენი“ beside the pain places). */
  trailing?: React.ReactNode;
}) {
  const c = useCycleColors();
  const typeOptions = types?.length ? types : PAIN_TYPES;
  const severityOf = (type: CyclePainType): CyclePainSeverity | null => entries.find((e) => e.type === type)?.severity ?? null;
  const tap = (type: CyclePainType) => {
    const next = nextPainSeverity(severityOf(type));
    onChange(next ? upsertPainEntry(entries, type, next) : removePainEntry(entries, type));
  };
  return (
    <View style={{ gap: 8 }}>
      {!compact ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginBottom: 4 }}>{ka.cycle.painHint}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: 12 }}>
        {typeOptions.map((type) => {
          const severity = severityOf(type);
          return (
            <CycleIconTile
              key={type}
              glyph={cycleGlyphFor('pain', type)}
              label={painTypeLabel(type)}
              selected={severity != null}
              level={painLevel(severity)}
              disabled={disabled}
              onPress={() => tap(type)}
              accessibilityHint={tx('ხელახალი შეხება ინტენსივობას ცვლის', 'Tap again to change the strength')}
            />
          );
        })}
        {trailing}
      </View>
      {/* The quick logs already say „ხელახალი შეხება — ინტენსივობა“ in the section head (same as the classic quick log). */}
      {!compact ? (
        <Text style={{ color: c.mutedSoft, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11.5, lineHeight: 16 }}>
          {tx('ხელახალი შეხება ინტენსივობას ცვლის: ზომიერი → ძლიერი → მსუბუქი → მოხსნა', 'Tap again to change the strength: moderate → severe → mild → off')}
        </Text>
      ) : null}
    </View>
  );
}

export function CycleLifestyleFields({
  sleepQuality,
  stressLevel,
  exerciseLevel,
  caffeine,
  alcohol,
  energy,
  onChange,
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
}) {
  const c = useCycleColors();
  const rows = [
    { key: 'energy' as const, title: ka.cycle.energy, options: ENERGY_LEVELS, value: energy ?? null, labelFor: energyLabel },
    { key: 'sleepQuality' as const, title: ka.cycle.sleep, options: SLEEP_QUALITIES, value: sleepQuality, labelFor: sleepLabel },
    { key: 'stressLevel' as const, title: ka.cycle.stress, options: STRESS_LEVELS, value: stressLevel, labelFor: stressLabel },
    { key: 'exerciseLevel' as const, title: ka.cycle.exercise, options: EXERCISE_LEVELS, value: exerciseLevel, labelFor: exerciseLabel },
    { key: 'caffeine' as const, title: ka.cycle.caffeine, options: CAFFEINE_LEVELS, value: caffeine, labelFor: caffeineLabel },
    { key: 'alcohol' as const, title: ka.cycle.alcohol, options: ALCOHOL_LEVELS, value: alcohol, labelFor: alcoholLabel },
  ];
  return (
    <View>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>{ka.cycle.lifestyleHint}</Text>
      {rows.map((row) => (
        <View key={row.key} style={{ marginBottom: 14 }}>
          <Text
            style={{
              color: c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 14,
              marginBottom: 8,
            }}
          >
            {row.title}
          </Text>
          <ChipRow
            options={row.options}
            value={row.value as never}
            onChange={(next) => onChange({ [row.key]: next })}
            labelFor={row.labelFor}
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

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
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
            return (
              <Pressable
                key={tag.id}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  toggle(tag.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
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
