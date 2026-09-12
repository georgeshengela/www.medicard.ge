import React from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { ka } from '@/i18n/ka';
import { cycleChipLabel } from '@/lib/cycleLabels';
import {
  ASSESSMENT_STATES,
  applyAssessmentState,
  resolveObservationAssessment,
} from '@/lib/cycleObservationAssessment';
import { useCycleColors } from '@/theme/cycle';

type AssessmentState = 'UNKNOWN' | 'ABSENT' | 'PRESENT';

function stateLabel(state: AssessmentState) {
  if (state === ASSESSMENT_STATES.PRESENT) return ka.cycle.assessmentPresent;
  if (state === ASSESSMENT_STATES.ABSENT) return ka.cycle.assessmentAbsent;
  return ka.cycle.assessmentUnanswered;
}

function Choice({
  label,
  selected,
  onPress,
  observation,
  state,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  observation: string;
  state: AssessmentState;
}) {
  const c = useCycleColors();
  const bg = selected
    ? state === ASSESSMENT_STATES.UNKNOWN
      ? c.card
      : c.cta
    : c.cardSoft;
  const border = selected ? c.ink : c.border;
  const color = selected && state !== ASSESSMENT_STATES.UNKNOWN ? c.white : c.ink;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${observation}, ${stateLabel(state)}${selected ? `, ${ka.cycle.pregnancySelected}` : ''}`}
      style={{
        flexGrow: 1,
        flexBasis: 0,
        minHeight: 44,
        paddingHorizontal: 8,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: bg,
        borderWidth: 1.5,
        borderColor: border,
      }}
    >
      <Text
        style={{
          color,
          fontFamily: selected ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_600SemiBold',
          fontSize: 12,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CycleObservationAssessment({
  keys,
  form,
  onChange,
  ready = true,
}: {
  keys: readonly string[];
  form: CycleLogForm;
  onChange: (patch: Partial<CycleLogForm>) => void;
  ready?: boolean;
}) {
  const c = useCycleColors();

  if (!keys.length) return null;

  if (!ready) {
    return (
      <View style={{ marginBottom: 16 }} accessibilityState={{ busy: true }}>
        <Text
          style={{
            color: c.ink,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 13,
            marginBottom: 6,
          }}
        >
          {ka.cycle.assessmentTitle}
        </Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>{ka.cycle.assessmentLoading}</Text>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 13,
          marginBottom: 4,
        }}
      >
        {ka.cycle.assessmentTitle}
      </Text>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
        {ka.cycle.assessmentHint}
      </Text>
      {keys.map((key) => {
        const name = cycleChipLabel(key);
        const resolved = resolveObservationAssessment(
          { symptoms: form.symptoms, observationAssessments: form.observationAssessments },
          key,
        );
        const state = resolved.state as AssessmentState;
        return (
          <View key={key} style={{ marginBottom: 12 }}>
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              {name}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Choice
                observation={name}
                state={ASSESSMENT_STATES.UNKNOWN}
                label={ka.cycle.assessmentUnanswered}
                selected={state === ASSESSMENT_STATES.UNKNOWN}
                onPress={() => onChange(applyAssessmentState(form, key, ASSESSMENT_STATES.UNKNOWN))}
              />
              <Choice
                observation={name}
                state={ASSESSMENT_STATES.PRESENT}
                label={ka.cycle.assessmentPresent}
                selected={state === ASSESSMENT_STATES.PRESENT}
                onPress={() => onChange(applyAssessmentState(form, key, ASSESSMENT_STATES.PRESENT))}
              />
              <Choice
                observation={name}
                state={ASSESSMENT_STATES.ABSENT}
                label={ka.cycle.assessmentAbsent}
                selected={state === ASSESSMENT_STATES.ABSENT}
                onPress={() => onChange(applyAssessmentState(form, key, ASSESSMENT_STATES.ABSENT))}
              />
            </View>
            {state !== ASSESSMENT_STATES.UNKNOWN ? (
              <Pressable
                onPress={() => onChange(applyAssessmentState(form, key, ASSESSMENT_STATES.UNKNOWN))}
                accessibilityRole="button"
                accessibilityLabel={`${name}, ${ka.cycle.assessmentClear}`}
                style={{ minHeight: 36, justifyContent: 'center', marginTop: 4 }}
              >
                <Text style={{ color: c.mutedSoft, fontSize: 12, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
                  {ka.cycle.assessmentClear}
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
