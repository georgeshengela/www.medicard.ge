import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import type { CycleCustomTag, CyclePainEntry, CyclePainSeverity, CyclePainType } from '@/lib/api';
import {
  ALCOHOL_LEVELS,
  CAFFEINE_LEVELS,
  CYCLE_NOTE_MAX,
  CYCLE_TAG_NAME_MAX,
  ENERGY_LEVELS,
  EXERCISE_LEVELS,
  PAIN_SEVERITIES,
  PAIN_TYPES,
  SLEEP_QUALITIES,
  STRESS_LEVELS,
  activeCustomTags,
  alcoholLabel,
  caffeineLabel,
  energyLabel,
  exerciseLabel,
  painSeverityLabel,
  painTypeLabel,
  removePainEntry,
  sleepLabel,
  stressLabel,
  upsertPainEntry,
} from '@/lib/cycleObservations';
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

/** Chips where several can be on at once (pain locations). */
function ChipMulti<T extends string>({
  options,
  values,
  onToggle,
  labelFor,
}: {
  options: readonly T[];
  values: readonly T[];
  onToggle: (id: T) => void;
  labelFor: (id: T) => string;
}) {
  const c = useCycleColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((id) => {
        const on = values.includes(id);
        return (
          <Pressable
            key={id}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              onToggle(id);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={labelFor(id)}
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
 * Pain for one day. A day can hurt in several places, so locations are always multi-select
 * (owner 2026-10-03) — in the quick logs (`compact`: one strength for the day, then where) and in
 * the full log (each place keeps its own strength). The last place cannot be unticked while a
 * strength is chosen; „არა“ / untapping the strength clears the day's pain.
 */
export function CyclePainEditor({
  entries,
  onChange,
  compact,
  types,
  typesFirst,
}: {
  entries: CyclePainEntry[];
  onChange: (next: CyclePainEntry[]) => void;
  compact?: boolean;
  types?: CyclePainType[];
  typesFirst?: boolean;
}) {
  const c = useCycleColors();
  const typeOptions = types?.length ? types : PAIN_TYPES;
  /** Places ticked before a strength is chosen (compact, places first). */
  const [draftTypes, setDraftTypes] = useState<CyclePainType[]>([typeOptions[0] ?? 'cramps']);
  const multiHint = tx('შეგიძლია რამდენიმე მონიშნო', 'You can pick more than one');
  const whereLabel = (
    <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>
      {ka.cycle.painLocation} · {multiHint}
    </Text>
  );

  if (compact) {
    const severity = entries[0]?.severity ?? null;
    const selected = entries.length ? entries.map((e) => e.type) : draftTypes;
    const toggleType = (type: CyclePainType) => {
      if (!entries.length) {
        setDraftTypes((prev) => (prev.includes(type) ? (prev.length > 1 ? prev.filter((t) => t !== type) : prev) : [...prev, type]));
        return;
      }
      const has = entries.some((e) => e.type === type);
      if (has) {
        if (entries.length > 1) onChange(removePainEntry(entries, type));
        return;
      }
      onChange([...entries, { type, severity: severity ?? 'moderate' }]);
    };
    const setSeverity = (next: CyclePainSeverity | null) => {
      if (!next) {
        // Remember where it hurt, in case the strength is tapped again.
        if (entries.length) setDraftTypes(entries.map((e) => e.type));
        onChange([]);
        return;
      }
      onChange(selected.map((type) => ({ type, severity: next })));
    };
    const places = (
      <View>
        {whereLabel}
        <ChipMulti options={typeOptions} values={selected} onToggle={toggleType} labelFor={painTypeLabel} />
      </View>
    );
    return (
      <View>
        {typesFirst ? <View style={{ marginBottom: 10 }}>{places}</View> : null}
        <ChipRow
          options={['none', ...PAIN_SEVERITIES] as const}
          value={severity ?? 'none'}
          onChange={(next) => setSeverity(next === 'none' || next == null ? null : next)}
          labelFor={(id) => (id === 'none' ? ka.cycle.painNone : painSeverityLabel(id))}
        />
        {entries.length && !typesFirst ? <View style={{ marginTop: 10 }}>{places}</View> : null}
      </View>
    );
  }

  const toggleEntry = (type: CyclePainType) => {
    if (entries.some((e) => e.type === type)) onChange(removePainEntry(entries, type));
    else onChange(upsertPainEntry(entries, type, 'moderate'));
  };

  return (
    <View>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>{ka.cycle.painHint}</Text>
      {whereLabel}
      <ChipMulti options={typeOptions} values={entries.map((e) => e.type)} onToggle={toggleEntry} labelFor={painTypeLabel} />
      {entries.map((entry) => (
        <View key={`${entry.type}-sev`} style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ flex: 1, color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
              {painTypeLabel(entry.type)} · <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_500Medium' }}>{ka.cycle.painSeverityTitle}</Text>
            </Text>
            <Pressable
              onPress={() => onChange(removePainEntry(entries, entry.type))}
              accessibilityRole="button"
              accessibilityLabel={`${ka.cycle.painRemove} ${painTypeLabel(entry.type)}`}
              hitSlop={8}
              style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} color={c.muted} />
            </Pressable>
          </View>
          <ChipRow
            options={PAIN_SEVERITIES}
            value={entry.severity}
            onChange={(severity) => {
              if (!severity) onChange(removePainEntry(entries, entry.type));
              else onChange(entries.map((e) => (e.type === entry.type ? { ...e, severity } : e)));
            }}
            labelFor={painSeverityLabel}
          />
        </View>
      ))}
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
