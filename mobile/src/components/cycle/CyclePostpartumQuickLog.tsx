import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CycleFlowPicker } from '@/components/cycle/CycleFlowPicker';
import { CyclePainEditor } from '@/components/cycle/CycleObservationFields';
import { PHYSICAL_SYMPTOMS, MOOD_OPTIONS } from '@/constants/cycle';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import type { CyclePainType } from '@/lib/api';
import { ka } from '@/i18n/ka';
import { ENERGY_LEVELS, energyLabel, SLEEP_QUALITIES, sleepLabel } from '@/lib/cycleObservations';
import { PREGNANCY_FLOW_OPTIONS } from '@/lib/pregnancyObservationPresent';
import { useCycleColors } from '@/theme/cycle';

const BODY_KEYS = ['fatigue', 'dizziness', 'headache', 'migraine', 'swelling', 'frequent_urination'] as const;
const DIGEST_KEYS = ['nausea', 'constipation'] as const;
const MOOD_KEYS = ['tired_mood', 'anxious', 'irritable', 'sad', 'mood_swings'] as const;
const PAIN_TYPES: CyclePainType[] = ['cramps', 'pelvic', 'lower_back', 'headache', 'breast', 'other'];

function toggleList(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function ObservationChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{
        minHeight: 44,
        paddingHorizontal: 12,
        borderRadius: 12,
        justifyContent: 'center',
        backgroundColor: selected ? c.cta : c.cardSoft,
        borderWidth: 1.5,
        borderColor: selected ? c.ink : c.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        maxWidth: '100%',
      }}
    >
      {selected ? <Check size={14} color={c.white} strokeWidth={3} /> : null}
      <Text
        style={{
          color: selected ? c.white : c.ink,
          fontFamily: selected ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_600SemiBold',
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ children }: { children: string }) {
  const c = useCycleColors();
  return (
    <Text
      style={{
        color: c.ink,
        fontFamily: 'NotoSansGeorgian_700Bold',
        fontSize: 13,
        marginTop: 16,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

function chipsFor(ids: readonly string[]) {
  return PHYSICAL_SYMPTOMS.filter((item) => ids.includes(item.id));
}

export function CyclePostpartumQuickLog({
  form,
  onChange,
}: {
  form: CycleLogForm;
  onChange: (patch: Partial<CycleLogForm>) => void;
}) {
  return (
    <View>
      <SectionTitle>{ka.cycle.postpartumBleeding}</SectionTitle>
      <CycleFlowPicker
        value={form.flow}
        onChange={(flow) => onChange({ flow })}
        options={[...PREGNANCY_FLOW_OPTIONS]}
      />

      <SectionTitle>{ka.cycle.sleep}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SLEEP_QUALITIES.map((id) => (
          <ObservationChip
            key={id}
            label={sleepLabel(id)}
            selected={form.sleepQuality === id}
            onPress={() => onChange({ sleepQuality: form.sleepQuality === id ? null : id })}
          />
        ))}
      </View>

      <SectionTitle>{ka.cycle.moods}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {MOOD_OPTIONS.filter((item) => MOOD_KEYS.includes(item.id as (typeof MOOD_KEYS)[number])).map((opt) => (
          <ObservationChip
            key={opt.id}
            label={opt.label}
            selected={form.moods.includes(opt.id)}
            onPress={() => onChange({ moods: toggleList(form.moods, opt.id) })}
          />
        ))}
      </View>

      <SectionTitle>{ka.cycle.energy}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ENERGY_LEVELS.map((id) => (
          <ObservationChip
            key={id}
            label={energyLabel(id)}
            selected={form.energy === id}
            onPress={() => onChange({ energy: form.energy === id ? null : id })}
          />
        ))}
      </View>

      <SectionTitle>{ka.cycle.pain}</SectionTitle>
      <CyclePainEditor
        compact
        typesFirst
        types={PAIN_TYPES}
        entries={form.painEntries}
        onChange={(painEntries) => onChange({ painEntries })}
      />

      <SectionTitle>{ka.cycle.trackGroup.physical}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chipsFor(BODY_KEYS).map((opt) => (
          <ObservationChip
            key={opt.id}
            label={opt.label}
            selected={form.symptoms.includes(opt.id)}
            onPress={() => onChange({ symptoms: toggleList(form.symptoms, opt.id) })}
          />
        ))}
      </View>

      <SectionTitle>{ka.cycle.trackGroup.digestion}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chipsFor(DIGEST_KEYS).map((opt) => (
          <ObservationChip
            key={opt.id}
            label={opt.label}
            selected={form.symptoms.includes(opt.id)}
            onPress={() => onChange({ symptoms: toggleList(form.symptoms, opt.id) })}
          />
        ))}
      </View>
    </View>
  );
}
