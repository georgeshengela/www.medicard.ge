import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CycleFlowPicker } from '@/components/cycle/CycleFlowPicker';
import { CyclePainEditor } from '@/components/cycle/CycleObservationFields';
import { CycleObservationAssessment } from '@/components/cycle/CycleObservationAssessment';
import { PHYSICAL_SYMPTOMS } from '@/constants/cycle';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import type { CyclePainType } from '@/lib/api';
import { ka } from '@/i18n/ka';
import {
  ENERGY_LEVELS,
  energyLabel,
  SLEEP_QUALITIES,
  sleepLabel,
} from '@/lib/cycleObservations';
import { applySymptomChipToggle, PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS } from '@/lib/cycleObservationAssessment';
import { MOOD_OPTIONS } from '@/constants/cycle';
import { useCycleColors } from '@/theme/cycle';

const PERI_HEADACHE = ['migraine'] as const;
const PERI_BODY_MORE = ['dry_skin', 'hair_loss', 'breast_tenderness'] as const;
const PERI_MOODS = ['irritable', 'anxious', 'mood_swings', 'tired_mood', 'unfocused'] as const;
const PERI_PAIN: CyclePainType[] = ['headache', 'cramps', 'lower_back', 'pelvic', 'other'];

function toggle(list: string[], id: string) {
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
      accessibilityLabel={selected ? `${label}, ${ka.cycle.pregnancySelected}` : label}
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

function moodChips(ids: readonly string[]) {
  return MOOD_OPTIONS.filter((item) => ids.includes(item.id));
}

export function CyclePerimenopauseQuickLog({
  form,
  onChange,
  assessmentReady = true,
}: {
  form: CycleLogForm;
  onChange: (patch: Partial<CycleLogForm>) => void;
  assessmentReady?: boolean;
}) {
  const c = useCycleColors();

  return (
    <View>
      <SectionTitle>{ka.cycle.periBleeding}</SectionTitle>
      <CycleFlowPicker value={form.flow} onChange={(flow) => onChange({ flow })} />

      <CycleObservationAssessment
        keys={PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS}
        form={form}
        onChange={onChange}
        ready={assessmentReady}
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
        {moodChips(PERI_MOODS).map((opt) => (
          <ObservationChip
            key={opt.id}
            label={opt.label}
            selected={form.moods.includes(opt.id)}
            onPress={() => onChange({ moods: toggle(form.moods, opt.id) })}
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

      <SectionTitle>{ka.cycle.periPainHeadache}</SectionTitle>
      <CyclePainEditor
        compact
        typesFirst
        types={[...PERI_PAIN]}
        entries={form.painEntries}
        onChange={(painEntries) => onChange({ painEntries })}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {chipsFor(PERI_HEADACHE).map((opt) => (
          <ObservationChip
            key={opt.id}
            label={opt.label}
            selected={form.symptoms.includes(opt.id)}
            onPress={() => onChange(applySymptomChipToggle(form, opt.id))}
          />
        ))}
      </View>

      <SectionTitle>{ka.cycle.periBodyChanges}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chipsFor(PERI_BODY_MORE).map((opt) => (
          <ObservationChip
            key={opt.id}
            label={opt.label}
            selected={form.symptoms.includes(opt.id)}
            onPress={() => onChange(applySymptomChipToggle(form, opt.id))}
          />
        ))}
      </View>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }}>
        {ka.cycle.periNotDiagnosis}
      </Text>
    </View>
  );
}
