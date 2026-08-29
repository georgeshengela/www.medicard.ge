import React from 'react';

import { Pressable, ScrollView, Text, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronLeft } from 'lucide-react-native';

import { AssessmentContinueButton } from '@/components/assessment/AssessmentContinueButton';

import { AssessmentIntroIllustration } from '@/components/assessment/AssessmentIntroIllustration';

import { AssessmentPhaseStepper } from '@/components/assessment/AssessmentPhaseStepper';

import { useFigmaAssessmentIntro } from '@/constants/figmaAssessmentIntro';

import { FIGMA_PROGRESS_HEIGHT, welcomeTopInset } from '@/constants/figmaWelcomeLayout';

import { ka } from '@/i18n/ka';

import { lightColors } from '@/theme/colors';



const TEAL = lightColors.primary200;



type ProgressState = {

  visible: boolean;

  fraction: number;

};



type Props = {

  variant?: 'intro' | 'step' | 'phase-complete';

  title: string;

  body?: string;

  progress: ProgressState;

  children: React.ReactNode;

  footerExtra?: React.ReactNode;

  footerBelow?: React.ReactNode;

  primaryLabel: string;

  onPrimary: () => void;

  onBack?: () => void;

  onSkip?: () => void;

  canBack?: boolean;

  skippable?: boolean;

  loading?: boolean;

  primaryDisabled?: boolean;

  scrollContent?: boolean;

  centerContent?: boolean;

  fillBody?: boolean;

  primaryVariant?: 'primary' | 'recording';

  showPrimary?: boolean;

  largeTitle?: boolean;

};



/** Figma Comprehensive Health Assessment — intro + step flows. */

export function AssessmentShell({

  variant = 'step',

  title,

  body,

  progress,

  children,

  footerExtra,

  footerBelow,

  primaryLabel,

  onPrimary,

  onBack,

  onSkip,

  canBack = false,

  skippable = false,

  loading = false,

  primaryDisabled = false,

  scrollContent = true,

  centerContent = false,

  fillBody = false,

  primaryVariant = 'primary',

  showPrimary = true,

  largeTitle = false,

}: Props) {
  const FIGMA_ASSESSMENT_INTRO = useFigmaAssessmentIntro();

  const insets = useSafeAreaInsets();

  const topInset = welcomeTopInset(insets.top);



  if (variant === 'intro') {

    return (

      <View style={{ flex: 1, backgroundColor: FIGMA_ASSESSMENT_INTRO.pageBg }}>

        <View style={{ paddingTop: topInset, paddingHorizontal: FIGMA_ASSESSMENT_INTRO.contentPaddingX }}>

          <AssessmentPhaseStepper activeIndex={0} />

        </View>



        <View style={{ flex: 1, justifyContent: 'center' }}>

          <View

            style={{

              height: FIGMA_ASSESSMENT_INTRO.heroHeight,

              alignItems: 'center',

              justifyContent: 'center',

            }}

          >

            <AssessmentIntroIllustration />

          </View>



          <View

            style={{

              paddingHorizontal: FIGMA_ASSESSMENT_INTRO.contentPaddingX,

              paddingVertical: FIGMA_ASSESSMENT_INTRO.contentPaddingY,

            }}

          >

            <View style={{ gap: FIGMA_ASSESSMENT_INTRO.textGap }}>

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

          </View>

        </View>



        <View

          style={{

            paddingHorizontal: FIGMA_ASSESSMENT_INTRO.contentPaddingX,

            paddingTop: 8,

            paddingBottom: Math.max(insets.bottom, 16),

          }}

        >

          {footerExtra}

          {showPrimary ? (

            <AssessmentContinueButton

              label={primaryLabel}

              onPress={onPrimary}

              loading={loading}

              disabled={primaryDisabled}

              variant={primaryVariant}

              tone="intro"

            />

          ) : null}

          {footerBelow}

        </View>

      </View>

    );

  }

  if (variant === 'phase-complete') {
    return (
      <View style={{ flex: 1, backgroundColor: FIGMA_ASSESSMENT_INTRO.pageBg }}>
        <View style={{ paddingTop: topInset, paddingHorizontal: FIGMA_ASSESSMENT_INTRO.contentPaddingX }}>
          <AssessmentPhaseStepper activeIndex={1} completedThrough={0} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View
            style={{
              paddingHorizontal: FIGMA_ASSESSMENT_INTRO.contentPaddingX,
              paddingVertical: FIGMA_ASSESSMENT_INTRO.contentPaddingY,
            }}
          >
            <View style={{ gap: FIGMA_ASSESSMENT_INTRO.textGap }}>
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
          </View>

          {children}
        </View>

        <View
          style={{
            paddingHorizontal: FIGMA_ASSESSMENT_INTRO.contentPaddingX,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          {showPrimary ? (
            <AssessmentContinueButton
              label={primaryLabel}
              onPress={onPrimary}
              loading={loading}
              disabled={primaryDisabled}
              variant={primaryVariant}
            />
          ) : null}
        </View>
      </View>
    );
  }

  const titleSize = largeTitle ? 30 : 22;

  const titleLineHeight = largeTitle ? 38 : 30;



  const headerBlock = (

    <>

      <Text

        style={{

          fontFamily: 'NotoSansGeorgian_700Bold',

          fontSize: titleSize,

          lineHeight: titleLineHeight,

          letterSpacing: largeTitle ? -0.25 : 0,

          color: FIGMA_ASSESSMENT_INTRO.titleColor,

          textAlign: 'center',

          marginTop: centerContent ? 0 : 12,

        }}

      >

        {title}

      </Text>



      {body ? (

        <Text

          style={{

            fontFamily: 'NotoSansGeorgian_400Regular',

            fontSize: 15,

            lineHeight: 22,

            color: FIGMA_ASSESSMENT_INTRO.bodyColor,

            textAlign: 'center',

            marginTop: 10,

          }}

        >

          {body}

        </Text>

      ) : null}

    </>

  );



  const bodyBlock = (

    <View

      style={

        centerContent

          ? { flex: 1, justifyContent: 'center', width: '100%', paddingVertical: 8 }

          : fillBody

            ? { flex: 1, marginTop: 20, width: '100%' }

            : scrollContent

              ? { flex: 1, marginTop: 8, minHeight: 120 }

              : { marginTop: 20 }

      }

    >

      {children}

    </View>

  );



  return (

    <View style={{ flex: 1, backgroundColor: FIGMA_ASSESSMENT_INTRO.pageBg }}>

      <View style={{ paddingTop: topInset, paddingHorizontal: 16, paddingBottom: 8 }}>

        <StepHeader

          canBack={canBack}

          onBack={onBack}

          skippable={skippable}

          onSkip={onSkip}

          fraction={progress.visible ? progress.fraction : 0}

        />

      </View>



      {scrollContent ? (

        <ScrollView

          style={{ flex: 1 }}

          contentContainerStyle={{

            flexGrow: 1,

            paddingHorizontal: 16,

            paddingBottom: 16,

          }}

          keyboardShouldPersistTaps="handled"

          showsVerticalScrollIndicator={false}

        >

          {headerBlock}

          {bodyBlock}

        </ScrollView>

      ) : (

        <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 16 }}>

          {centerContent ? (

            <>

              <View style={{ paddingTop: 4 }}>{headerBlock}</View>

              {bodyBlock}

            </>

          ) : (

            <>

              {headerBlock}

              {bodyBlock}

            </>

          )}

        </View>

      )}



      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) }}>

        {footerExtra}

        {showPrimary ? (

          <AssessmentContinueButton

            label={primaryLabel}

            onPress={onPrimary}

            loading={loading}

            disabled={primaryDisabled}

            variant={primaryVariant}

          />

        ) : null}

        {footerBelow}

      </View>

    </View>

  );

}



function StepHeader({

  canBack,

  onBack,

  skippable,

  onSkip,

  fraction,

}: {

  canBack: boolean;

  onBack?: () => void;

  skippable: boolean;

  onSkip?: () => void;

  fraction: number;

}) {

  const FIGMA_ASSESSMENT_INTRO = useFigmaAssessmentIntro();

  return (

    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 }}>

      {canBack && onBack ? (

        <Pressable

          accessibilityRole="button"

          accessibilityLabel={ka.common.back}

          onPress={onBack}

          hitSlop={8}

          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}

        >

          <ChevronLeft size={24} color={FIGMA_ASSESSMENT_INTRO.bodyColor} strokeWidth={2.2} />

        </Pressable>

      ) : (

        <View style={{ width: 36 }} />

      )}



      <View style={{ flex: 1, height: FIGMA_PROGRESS_HEIGHT, borderRadius: 99, backgroundColor: FIGMA_ASSESSMENT_INTRO.trackGrey, overflow: 'hidden' }}>

        <View

          style={{

            height: '100%',

            width: `${Math.round(fraction * 100)}%`,

            backgroundColor: TEAL,

            borderRadius: 99,

          }}

        />

      </View>



      {skippable && onSkip ? (

        <Pressable accessibilityRole="button" onPress={onSkip} hitSlop={8} style={{ paddingHorizontal: 4 }}>

          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: TEAL }}>

            {ka.assessment.skipStep}

          </Text>

        </Pressable>

      ) : (

        <View style={{ width: 48 }} />

      )}

    </View>

  );

}


