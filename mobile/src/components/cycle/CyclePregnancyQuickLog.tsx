import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CycleFlowPicker } from '@/components/cycle/CycleFlowPicker';
import { CyclePainEditor } from '@/components/cycle/CycleObservationFields';
import { CycleObservationAssessment } from '@/components/cycle/CycleObservationAssessment';
import { PHYSICAL_SYMPTOMS } from '@/constants/cycle';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { ka } from '@/i18n/ka';
import {
  ENERGY_LEVELS,
  energyLabel,
  SLEEP_QUALITIES,
  sleepLabel,
  STRESS_LEVELS,
  stressLabel,
} from '@/lib/cycleObservations';
import { applySymptomChipToggle, PREGNANCY_DAILY_ASSESSMENT_KEYS } from '@/lib/cycleObservationAssessment';
import {
  PREGNANCY_FLOW_OPTIONS,
  PREGNANCY_PAIN_TYPES,
  PREGNANCY_QUICK_BODY,
  PREGNANCY_QUICK_DIGESTION,
} from '@/lib/pregnancyObservationPresent';
import { useCycleColors } from '@/theme/cycle';

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

export function CyclePregnancyQuickLog({
  form,
  onChange,
  assessmentReady = true,
}: {
  form: CycleLogForm;
  onChange: (patch: Partial<CycleLogForm>) => void;
  assessmentReady?: boolean;
}) {
  const c = useCycleColors();
  const digestionChips = PREGNANCY_QUICK_DIGESTION.filter(
    (id) => !(PREGNANCY_DAILY_ASSESSMENT_KEYS as readonly string[]).includes(id),
  );

  return (
    <View>
      <SectionTitle>{ka.cycle.pregnancyBleeding}</SectionTitle>
      <CycleFlowPicker
        value={form.flow}
        onChange={(flow) => onChange({ flow })}
        options={[...PREGNANCY_FLOW_OPTIONS]}
        hint={ka.cycle.pregnancyFlowHint}
      />

      <CycleObservationAssessment
        keys={PREGNANCY_DAILY_ASSESSMENT_KEYS}
        form={form}
        onChange={onChange}
        ready={assessmentReady}
      />

      <SectionTitle>{ka.cycle.pain}</SectionTitle>
      <CyclePainEditor
        compact
        typesFirst
        types={[...PREGNANCY_PAIN_TYPES]}
        entries={form.painEntries}
        onChange={(painEntries) => onChange({ painEntries })}
      />

      <SectionTitle>{ka.cycle.pregnancyDigestion}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chipsFor(digestionChips).map((opt) => (
          <ObservationChip
            key={opt.id}
            label={opt.label}
            selected={form.symptoms.includes(opt.id)}
            onPress={() => onChange(applySymptomChipToggle(form, opt.id))}
          />
        ))}
      </View>

      <SectionTitle>{ka.cycle.pregnancyEnergyFatigue}</SectionTitle>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 8 }}>
        {ka.cycle.energyVsFatigueHint}
      </Text>
      <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>{ka.cycle.energy}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {ENERGY_LEVELS.map((id) => (
          <ObservationChip
            key={id}
            label={energyLabel(id)}
            selected={form.energy === id}
            onPress={() => onChange({ energy: form.energy === id ? null : id })}
          />
        ))}
      </View>
      <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>{ka.cycle.sleep}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {SLEEP_QUALITIES.map((id) => (
          <ObservationChip
            key={id}
            label={sleepLabel(id)}
            selected={form.sleepQuality === id}
            onPress={() => onChange({ sleepQuality: form.sleepQuality === id ? null : id })}
          />
        ))}
      </View>
      <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>{ka.cycle.stress}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {STRESS_LEVELS.map((id) => (
          <ObservationChip
            key={id}
            label={stressLabel(id)}
            selected={form.stressLevel === id}
            onPress={() => onChange({ stressLevel: form.stressLevel === id ? null : id })}
          />
        ))}
      </View>

      <SectionTitle>{ka.cycle.pregnancyCommonBody}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chipsFor(PREGNANCY_QUICK_BODY).map((opt) => (
          <ObservationChip
            key={opt.id}
            label={opt.label}
            selected={form.symptoms.includes(opt.id)}
            onPress={() => onChange(applySymptomChipToggle(form, opt.id))}
          />
        ))}
      </View>
    </View>
  );
}
