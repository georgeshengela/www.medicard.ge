import React from 'react';
import { Text, View } from 'react-native';
import { useFigmaAssessmentIntro } from '@/constants/figmaAssessmentIntro';
import { ka } from '@/i18n/ka';

type Props = {
  activeIndex?: number;
  /** Highest fully finished phase index (assessment complete => 0). */
  completedThrough?: number;
};

type PhaseStatus = 'completed' | 'active' | 'upcoming';

function phaseStatus(index: number, activeIndex: number, completedThrough: number): PhaseStatus {
  if (index <= completedThrough) return 'completed';
  if (index === activeIndex) return 'active';
  return 'upcoming';
}

/** Figma Step Group Horizontal — Assessment / Personal Info / Choose Plan. */
export function AssessmentPhaseStepper({ activeIndex = 0, completedThrough = -1 }: Props) {
  const FIGMA_ASSESSMENT_INTRO = useFigmaAssessmentIntro();
  const labels = [
    ka.assessment.phases.assessment,
    ka.assessment.phases.personalInfo,
    ka.assessment.phases.choosePlan,
  ];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 }}>
      {labels.map((label, index) => {
        const status = phaseStatus(index, activeIndex, completedThrough);
        const leftLineColor =
          index === 0
            ? status !== 'upcoming' || activeIndex === 0
              ? FIGMA_ASSESSMENT_INTRO.brandTeal
              : FIGMA_ASSESSMENT_INTRO.trackGrey
            : index - 1 <= completedThrough
              ? FIGMA_ASSESSMENT_INTRO.brandTeal
              : FIGMA_ASSESSMENT_INTRO.trackGrey;
        const rightLineColor =
          index <= completedThrough ? FIGMA_ASSESSMENT_INTRO.brandTeal : FIGMA_ASSESSMENT_INTRO.trackGrey;

        return (
          <View key={label} style={{ flex: 1, alignItems: 'center', gap: FIGMA_ASSESSMENT_INTRO.stepperGap }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', gap: 4 }}>
              <View style={{ flex: 1, height: FIGMA_ASSESSMENT_INTRO.stepperLineHeight, backgroundColor: leftLineColor }} />
              <StepDot status={status} />
              <View style={{ flex: 1, height: FIGMA_ASSESSMENT_INTRO.stepperLineHeight, backgroundColor: rightLineColor }} />
            </View>
            <Text
              style={{
                paddingHorizontal: 8,
                width: '100%',
                textAlign: 'center',
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: FIGMA_ASSESSMENT_INTRO.stepperLabelSize,
                lineHeight: FIGMA_ASSESSMENT_INTRO.stepperLabelLineHeight,
                color: FIGMA_ASSESSMENT_INTRO.titleColor,
              }}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function StepDot({ status }: { status: PhaseStatus }) {
  const FIGMA_ASSESSMENT_INTRO = useFigmaAssessmentIntro();
  const active = status === 'active';
  const completed = status === 'completed';

  return (
    <View
      style={{
        width: FIGMA_ASSESSMENT_INTRO.stepperDotSize,
        height: FIGMA_ASSESSMENT_INTRO.stepperDotSize,
        borderRadius: 999,
        backgroundColor: completed ? FIGMA_ASSESSMENT_INTRO.brandTeal : FIGMA_ASSESSMENT_INTRO.cardBg,
        borderWidth: completed ? 0 : 1,
        borderColor: active ? FIGMA_ASSESSMENT_INTRO.brandTeal : FIGMA_ASSESSMENT_INTRO.inactiveBorder,
        alignItems: 'center',
        justifyContent: 'center',
        ...(active
          ? {
              shadowColor: FIGMA_ASSESSMENT_INTRO.brandTeal,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.35,
              shadowRadius: 4,
            }
          : null),
      }}
    >
      <View
        style={{
          width: FIGMA_ASSESSMENT_INTRO.stepperInnerDot,
          height: FIGMA_ASSESSMENT_INTRO.stepperInnerDot,
          borderRadius: 999,
          backgroundColor: completed ? '#FFFFFF' : active ? FIGMA_ASSESSMENT_INTRO.brandTeal : FIGMA_ASSESSMENT_INTRO.inactiveDot,
        }}
      />
    </View>
  );
}
