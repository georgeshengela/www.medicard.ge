import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { AssessmentContinueButton } from '@/components/assessment/AssessmentContinueButton';
import { AssessmentPhaseStepper } from '@/components/assessment/AssessmentPhaseStepper';
import { FIGMA_ASSESSMENT_INTRO } from '@/constants/figmaAssessmentIntro';
import { welcomeTopInset } from '@/constants/figmaWelcomeLayout';

type Props = {
  title: string;
  body?: string;
  children?: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  onBack?: () => void;
  canBack?: boolean;
  loading?: boolean;
  primaryDisabled?: boolean;
  phaseActiveIndex?: number;
  phaseCompletedThrough?: number;
  showStepper?: boolean;
  showLogo?: boolean;
  centerContent?: boolean;
};

/** Profile setup shell — Figma 8906:236916 intro + 8845:308753 avatar. */
export function ProfileSetupShell({
  title,
  body,
  children,
  primaryLabel,
  onPrimary,
  onBack,
  canBack = false,
  loading = false,
  primaryDisabled = false,
  phaseActiveIndex = 1,
  phaseCompletedThrough = 0,
  showStepper = true,
  showLogo = false,
  centerContent = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const topInset = welcomeTopInset(insets.top);

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ paddingTop: topInset, paddingHorizontal: 16 }}>
        {canBack ? (
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            hitSlop={12}
            style={{ width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center', marginBottom: 4 }}
          >
            <ChevronLeft size={24} color="#1F2937" strokeWidth={2.2} />
          </Pressable>
        ) : showStepper ? (
          <AssessmentPhaseStepper activeIndex={phaseActiveIndex} completedThrough={phaseCompletedThrough} />
        ) : (
          <View style={{ height: 8 }} />
        )}
      </View>

      <View style={{ flex: 1, justifyContent: centerContent ? 'center' : 'flex-start' }}>
        {showLogo ? (
          <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 8 }}>
            <Image
              source={require('../../../assets/logo-light.png')}
              style={{ width: 64, height: 64 }}
              resizeMode="contain"
            />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 16, paddingTop: showLogo ? 0 : 16, paddingBottom: 8 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: FIGMA_ASSESSMENT_INTRO.titleSize,
              lineHeight: FIGMA_ASSESSMENT_INTRO.titleLineHeight,
              letterSpacing: -0.25,
              color: FIGMA_ASSESSMENT_INTRO.titleColor,
              textAlign: 'center',
            }}
          >
            {title}
          </Text>
          {body ? (
            <Text
              style={{
                marginTop: 16,
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: FIGMA_ASSESSMENT_INTRO.bodySize,
                lineHeight: FIGMA_ASSESSMENT_INTRO.bodyLineHeight,
                color: FIGMA_ASSESSMENT_INTRO.bodyColor,
                textAlign: 'center',
              }}
            >
              {body}
            </Text>
          ) : null}
        </View>

        {children}
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
        <AssessmentContinueButton
          label={primaryLabel}
          onPress={onPrimary}
          loading={loading}
          disabled={primaryDisabled}
        />
      </View>
    </View>
  );
}
