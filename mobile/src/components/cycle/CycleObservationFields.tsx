import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import type { CycleCustomTag, CyclePainEntry, CyclePainSeverity, CyclePainType } from '@/lib/api';
import {
  ALCOHOL_LEVELS,
  CAFFEINE_LEVELS,
  CYCLE_NOTE_MAX,
  CYCLE_TAG_NAME_MAX,
  EXERCISE_LEVELS,
  PAIN_SEVERITIES,
  PAIN_TYPES,
  SLEEP_QUALITIES,
  STRESS_LEVELS,
  activeCustomTags,
  alcoholLabel,
  caffeineLabel,
  exerciseLabel,
  formatPainEntry,
  painSeverityLabel,
  painTypeLabel,
  removePainEntry,
  sleepLabel,
  stressLabel,
  upsertPainEntry,
} from '@/lib/cycleObservations';
import { ka } from '@/i18n/ka';
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
            accessibilityLabel={labelFor(id)}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 14,
              justifyContent: 'center',
              backgroundColor: on ? c.cta : c.cardSoft,
              borderWidth: 1.5,
              borderColor: on ? c.ink : c.border,
            }}
          >
            <Text
              style={{
                color: on ? c.white : c.ink,
                fontFamily: on ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_600SemiBold',
                fontSize: 13,
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

export function CyclePainEditor({
  entries,
  onChange,
  compact,
}: {
  entries: CyclePainEntry[];
  onChange: (next: CyclePainEntry[]) => void;
  compact?: boolean;
}) {
  const c = useCycleColors();
  const [draftType, setDraftType] = useState<CyclePainType>('cramps');

  const setQuickSeverity = (severity: CyclePainSeverity | null) => {
    if (!severity) {
      onChange([]);
      return;
    }
    const type = entries[0]?.type ?? 'cramps';
    onChange([{ type, severity }]);
  };

  if (compact) {
    const current = entries[0] ?? null;
    return (
      <View>
        <ChipRow
          options={['none', ...PAIN_SEVERITIES] as const}
          value={current ? current.severity : 'none'}
          onChange={(next) => setQuickSeverity(next === 'none' || next == null ? null : next)}
          labelFor={(id) => (id === 'none' ? ka.cycle.painNone : painSeverityLabel(id))}
        />
        {current ? (
          <View style={{ marginTop: 10 }}>
            <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>{ka.cycle.painLocation}</Text>
            <ChipRow
              options={PAIN_TYPES}
              value={current.type}
              onChange={(type) => {
                if (!type) return;
                onChange([{ type, severity: current.severity }]);
              }}
              labelFor={painTypeLabel}
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>{ka.cycle.painHint}</Text>
      {entries.map((entry) => (
        <View
          key={entry.type}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 48,
            marginBottom: 8,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: c.cardSoft,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Text style={{ flex: 1, color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14 }}>
            {formatPainEntry(entry)}
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
      ))}
      {entries.map((entry) => (
        <View key={`${entry.type}-sev`} style={{ marginBottom: 12 }}>
          <Text style={{ color: c.muted, fontSize: 12, marginBottom: 6 }}>
            {painTypeLabel(entry.type)} · {ka.cycle.painSeverityTitle}
          </Text>
          <ChipRow
            options={PAIN_SEVERITIES}
            value={entry.severity}
            onChange={(severity) => {
              if (!severity) onChange(removePainEntry(entries, entry.type));
              else onChange(upsertPainEntry(entries, entry.type, severity));
            }}
            labelFor={painSeverityLabel}
          />
        </View>
      ))}
      <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>{ka.cycle.painAdd}</Text>
      <ChipRow options={PAIN_TYPES} value={draftType} onChange={(type) => type && setDraftType(type)} labelFor={painTypeLabel} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {PAIN_SEVERITIES.map((severity) => (
          <Pressable
            key={severity}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              onChange(upsertPainEntry(entries, draftType, severity));
            }}
            accessibilityRole="button"
            accessibilityLabel={`${painTypeLabel(draftType)} ${painSeverityLabel(severity)}`}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 14,
              justifyContent: 'center',
              backgroundColor: c.brand,
            }}
          >
            <Text style={{ color: c.white, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>
              {painSeverityLabel(severity)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function CycleLifestyleFields({
  sleepQuality,
  stressLevel,
  exerciseLevel,
  caffeine,
  alcohol,
  onChange,
}: {
  sleepQuality: string | null;
  stressLevel: string | null;
  exerciseLevel: string | null;
  caffeine: string | null;
  alcohol: string | null;
  onChange: (patch: {
    sleepQuality?: string | null;
    stressLevel?: string | null;
    exerciseLevel?: string | null;
    caffeine?: string | null;
    alcohol?: string | null;
  }) => void;
}) {
  const c = useCycleColors();
  const rows = [
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
                  {on ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
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
                borderColor: c.border,
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
              <Text style={{ color: c.white, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.customTagAdd}</Text>
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
          borderColor: c.border,
          fontSize: 15,
          lineHeight: 22,
        }}
      />
      <Text style={{ color: c.muted, fontSize: 11, marginTop: 8 }}>{ka.cycle.journalRemaining(left)}</Text>
    </View>
  );
}
