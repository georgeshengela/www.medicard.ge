import React from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { AssessmentContinueButton } from '@/components/assessment/AssessmentContinueButton';
import { AssessmentPhaseStepper } from '@/components/assessment/AssessmentPhaseStepper';
import { KeyboardDoneAccessory } from '@/components/ui/KeyboardDoneAccessory';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { useFigmaAssessmentIntro } from '@/constants/figmaAssessmentIntro';
import { welcomeTopInset } from '@/constants/figmaWelcomeLayout';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { StepHeader } from '@/components/onboarding/OnboardingKit';
import { ONBOARDING_COUNTED_QUESTIONS, ONBOARDING_TAIL_STEPS } from '@/constants/assessmentSteps';
import { useVelvet } from '@/theme/velvet';

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
  /** Decorative 3D artwork shown centered above the title (replaces the logo slot). */
  heroArt?: ImageSourcePropType;
  centerContent?: boolean;
  /** Rendered above the primary CTA (Figma phone field block). */
  footerSlot?: React.ReactNode;
  primaryTone?: 'step' | 'intro';
  /** When false, hides the default primary CTA (use footerSlot instead). */
  hidePrimary?: boolean;
  /**
   * Onboarding setup pages in the registration velvet (owner 2026-10-11): progress grooves at this
   * index after the registration questions, a left-aligned title, the page's own footer.
   */
  velvetStep?: number;
};

/** Profile setup shell — keyboard-safe scroll + pinned footer CTA. */
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
  heroArt,
  centerContent = false,
  footerSlot,
  primaryTone = 'step',
  hidePrimary = false,
  velvetStep,
}: Props) {
  const FIGMA_ASSESSMENT_INTRO = useFigmaAssessmentIntro();
  const { palette: p } = useVelvet();
  const insets = useSafeAreaInsets();
  const topInset = welcomeTopInset(insets.top);
  const keyboardHeight = useKeyboardHeight();
  const footerPadBottom =
    Platform.OS === 'android' && keyboardHeight > 0
      ? keyboardHeight
      : Math.max(insets.bottom, 16);

  const handlePrimary = () => {
    Keyboard.dismiss();
    onPrimary();
  };

  if (velvetStep !== undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: p.surface }}>
        <StepHeader palette={p} step={velvetStep} total={ONBOARDING_COUNTED_QUESTIONS + ONBOARDING_TAIL_STEPS} onBack={canBack ? onBack : undefined} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        >
          <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 35, color: p.text }}>
            {title}
          </Text>
          {body ? (
            <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 23, color: p.ink2 }}>{body}</Text>
          ) : null}
          <View style={{ marginTop: 22 }}>{children}</View>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16), gap: 8 }}>{footerSlot}</View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: FIGMA_ASSESSMENT_INTRO.pageBg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? topInset : 0}
    >
      <KeyboardDoneAccessory />

      <View style={{ paddingTop: topInset, paddingHorizontal: 16 }}>
        {canBack ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              Keyboard.dismiss();
              onBack?.();
            }}
            hitSlop={12}
            style={{ width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center', marginBottom: 4 }}
          >
            <ChevronLeft size={24} color={FIGMA_ASSESSMENT_INTRO.titleColor} strokeWidth={2.2} />
          </Pressable>
        ) : showStepper ? (
          <AssessmentPhaseStepper activeIndex={phaseActiveIndex} completedThrough={phaseCompletedThrough} />
        ) : (
          <View style={{ height: 8 }} />
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: centerContent ? 'center' : 'flex-start',
          paddingBottom: 8,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {heroArt ? (
          <View style={{ alignItems: 'center', paddingTop: 16 }}>
            <Image
              source={heroArt}
              resizeMode="contain"
              accessible={false}
              accessibilityIgnoresInvertColors
              style={{ width: 140, height: 140 }}
            />
          </View>
        ) : showLogo ? (
          <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 8 }}>
            <MedicardLogoMark size={64} />
          </View>
        ) : null}

        <Pressable onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ paddingHorizontal: 16, paddingTop: showLogo || heroArt ? 0 : 16, paddingBottom: 8 }}>
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
        </Pressable>

        {children}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingBottom: footerPadBottom, gap: 12 }}>
        {footerSlot}
        {!hidePrimary ? (
          <AssessmentContinueButton
            label={primaryLabel}
            onPress={handlePrimary}
            loading={loading}
            disabled={primaryDisabled}
            tone={primaryTone}
          />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
