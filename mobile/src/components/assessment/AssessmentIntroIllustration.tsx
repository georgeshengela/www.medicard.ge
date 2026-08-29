import React from 'react';
import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useFigmaAssessmentIntro, FIGMA_ASSESSMENT_SHADOW } from '@/constants/figmaAssessmentIntro';

/** Figma intro card mock — logo, skeleton rows, selected check tiles. */
export function AssessmentIntroIllustration() {
  const FIGMA_ASSESSMENT_INTRO = useFigmaAssessmentIntro();
  return (
    <View
      style={{
        width: FIGMA_ASSESSMENT_INTRO.cardWidth,
        height: FIGMA_ASSESSMENT_INTRO.cardHeight,
        backgroundColor: FIGMA_ASSESSMENT_INTRO.cardBg,
        borderWidth: 1,
        borderColor: FIGMA_ASSESSMENT_INTRO.cardBorder,
        borderRadius: FIGMA_ASSESSMENT_INTRO.cardRadius,
        padding: 16,
        justifyContent: 'space-between',
        ...FIGMA_ASSESSMENT_SHADOW,
      }}
    >
      <BrandLogo size={32} variant="plain" />

      <View style={{ gap: 24 }}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonBar width={80} />
              <SkeletonBar width={128} />
            </View>
            <SkeletonBar width={32} />
          </View>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <ChoiceTile />
            <ChoiceTile selected />
            <ChoiceTile />
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <View style={{ gap: 8 }}>
            <SkeletonBar width={80} />
            <SkeletonBar width={128} />
          </View>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <ChoiceTile />
            <ChoiceTile selected />
            <ChoiceTile />
            <ChoiceTile />
            <ChoiceTile />
          </View>
        </View>
      </View>
    </View>
  );
}

function SkeletonBar({ width }: { width: number }) {
  const FIGMA_ASSESSMENT_INTRO = useFigmaAssessmentIntro();
  return (
    <View
      style={{
        width,
        height: 8,
        borderRadius: 4,
        backgroundColor: FIGMA_ASSESSMENT_INTRO.trackGrey,
      }}
    />
  );
}

function ChoiceTile({ selected = false }: { selected?: boolean }) {
  const FIGMA_ASSESSMENT_INTRO = useFigmaAssessmentIntro();
  return (
    <View
      style={{
        flex: 1,
        height: 40,
        borderRadius: 8,
        backgroundColor: selected ? FIGMA_ASSESSMENT_INTRO.selectedSoft : FIGMA_ASSESSMENT_INTRO.trackGrey,
        borderWidth: selected ? 1 : 0,
        borderColor: selected ? '#22C55E' : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? <Check size={24} color="#22C55E" strokeWidth={2.2} /> : null}
    </View>
  );
}
