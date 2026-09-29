import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AssessmentPhaseStepper } from '@/components/assessment/AssessmentPhaseStepper';
import { useFigmaAssessmentIntro } from '@/constants/figmaAssessmentIntro';
import type { AssessmentFormState } from '@/lib/assessmentForm';
import { ACTIVE_ASSESSMENT_STEPS } from '@/constants/assessmentSteps';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';

/** Assessment phase complete — transition to personal info (Figma stepper state). */
export function AssessmentCompleteContent({
  form,
  onEdit,
}: {
  form: AssessmentFormState;
  onEdit: (index: number) => void;
}) {
  const confirmed = new Set(form.confirmedSteps ?? []);
  const rows = [
    { type: 'legal-name', label: tx('სახელი', 'Name'), value: form.legalName },
    {
      type: 'weight',
      label: tx('წონა', 'Weight'),
      value: confirmed.has('weight') ? `${form.weightKg} ${tx('კგ', 'kg')}` : '',
    },
    {
      type: 'height',
      label: tx('სიმაღლე', 'Height'),
      value: confirmed.has('height') ? `${form.heightCm} ${tx('სმ', 'cm')}` : '',
    },
    { type: 'blood-type', label: tx('სისხლის ჯგუფი', 'Blood type'), value: form.bloodType },
    {
      type: 'medications-gate',
      label: tx('მედიკამენტები', 'Medications'),
      value:
        form.takesMedications === false
          ? tx('არ ვიღებ', "I don't take any")
          : form.medications.join(', '),
    },
    {
      type: 'allergies',
      label: tx('ალერგიები', 'Allergies'),
      value:
        form.allergies.join(', ') ||
        (confirmed.has('allergies') ? tx('არ მაქვს', "I don't have any") : ''),
    },
    {
      type: 'conditions-gate',
      label: tx('ქრონიკული მდგომარეობები', 'Chronic conditions'),
      value:
        form.hasConditions === false
          ? tx('არ მაქვს', "I don't have any")
          : form.chronicConditions.join(', '),
    },
  ];
  const FIGMA_ASSESSMENT_INTRO = useFigmaAssessmentIntro();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 16, gap: 24 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: FIGMA_ASSESSMENT_INTRO.selectedSoft,
          borderWidth: 2,
          borderColor: '#14B8A6',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 40, color: '#14B8A6' }}>✓</Text>
      </View>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_400Regular',
          fontSize: 16,
          lineHeight: 26,
          color: FIGMA_ASSESSMENT_INTRO.bodyColor,
          textAlign: 'center',
          paddingHorizontal: 8,
        }}
      >
        {ka.assessment.steps.completeBody}
      </Text>
      <View style={{ width: '100%', paddingHorizontal: 20 }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 16,
            color: FIGMA_ASSESSMENT_INTRO.titleColor,
            marginBottom: 8,
          }}
        >
          {tx('გადაამოწმე შენი პასუხები', 'Check your answers')}
        </Text>
        {rows.map((row) => (
          <Pressable
            key={row.type}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}: ${row.value || tx('არ არის მითითებული', 'Not provided')}. ${tx('შეცვლა', 'Edit')}`}
            onPress={() =>
              onEdit(
                ACTIVE_ASSESSMENT_STEPS.findIndex(
                  (step) => step.type === row.type,
                ),
              )
            }
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              minHeight: 60,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderColor: FIGMA_ASSESSMENT_INTRO.trackGrey,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_500Medium',
                  fontSize: 13,
                  color: FIGMA_ASSESSMENT_INTRO.bodyColor,
                }}
              >
                {row.label}
              </Text>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 15,
                  lineHeight: 23,
                  color: FIGMA_ASSESSMENT_INTRO.titleColor,
                }}
              >
                {row.value || tx('არ არის მითითებული', 'Not provided')}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_500Medium',
                fontSize: 12,
                color: FIGMA_ASSESSMENT_INTRO.brandTeal,
              }}
            >
              {tx('შეცვლა', 'Edit')}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function AssessmentCompleteStepper() {
  return (
    <View style={{ paddingBottom: 4 }}>
      <AssessmentPhaseStepper activeIndex={1} completedThrough={0} />
    </View>
  );
}
