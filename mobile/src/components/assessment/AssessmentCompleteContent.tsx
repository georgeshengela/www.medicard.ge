import React from 'react';
import { Text, View } from 'react-native';
import { AssessmentPhaseStepper } from '@/components/assessment/AssessmentPhaseStepper';
import { FIGMA_ASSESSMENT_INTRO } from '@/constants/figmaAssessmentIntro';
import { ka } from '@/i18n/ka';

/** Assessment phase complete — transition to personal info (Figma stepper state). */
export function AssessmentCompleteContent() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 16, gap: 24 }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: '#F0FDFA',
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
