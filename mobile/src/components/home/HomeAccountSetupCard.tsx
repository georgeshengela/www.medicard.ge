import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FIGMA_HOME_DASHBOARD } from '@/constants/figmaHomeDashboardLayout';
import { ka } from '@/i18n/ka';
import type { AccountSetupProgress, AccountSetupStep } from '@/lib/homeAccountSetup';

type Props = {
  progress: AccountSetupProgress;
  onStepPress: (step: AccountSetupStep) => void;
};

function SetupCheckbox({ checked }: { checked: boolean }) {
  if (!checked) {
    return (
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: FIGMA_HOME_DASHBOARD.borderTertiary,
          backgroundColor: '#FFFFFF',
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        backgroundColor: FIGMA_HOME_DASHBOARD.brand,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
      }}
    >
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Path
          d="M10.1113 2.88867C10.3775 3.15488 10.3775 3.586 10.1113 3.85221L4.88867 9.07487C4.62246 9.34108 4.19134 9.34108 3.92513 9.07487L1.88867 7.03841C1.62246 6.7722 1.62246 6.34108 1.88867 6.07487C2.15488 5.80866 2.58599 5.80866 2.85221 6.07487L4.4069 7.62955L9.14779 2.88867C9.414 2.62246 9.84512 2.62246 10.1113 2.88867Z"
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
}

/** Figma 8911:62396 — account setup checklist. */
export function HomeAccountSetupCard({ progress, onStepPress }: Props) {
  const filledSegments = progress.completedCount;

  return (
    <View
      style={{
        backgroundColor: FIGMA_HOME_DASHBOARD.setupCardBg,
        borderRadius: FIGMA_HOME_DASHBOARD.cardRadius,
        borderWidth: 1,
        borderColor: FIGMA_HOME_DASHBOARD.border,
        padding: 16,
        gap: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View style={{ gap: 8 }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 12,
            lineHeight: 16,
            letterSpacing: 1,
            color: FIGMA_HOME_DASHBOARD.textSecondary,
            textTransform: 'uppercase',
          }}
        >
          {ka.home.setupStepLabel(progress.currentStep, progress.total)}
        </Text>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 20,
            lineHeight: 28,
            color: FIGMA_HOME_DASHBOARD.textPrimary,
            letterSpacing: -0.25,
          }}
        >
          {ka.home.setupTitle}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: progress.total }).map((_, idx) => (
          <View
            key={idx}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 999,
              backgroundColor:
                idx < filledSegments ? FIGMA_HOME_DASHBOARD.brand : FIGMA_HOME_DASHBOARD.border,
            }}
          />
        ))}
      </View>

      <View>
        {progress.steps.map((step, idx) => (
          <Pressable
            key={step.key}
            accessibilityRole="button"
            onPress={() => onStepPress(step)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              borderBottomWidth: idx < progress.steps.length - 1 ? 1 : 0,
              borderBottomColor: FIGMA_HOME_DASHBOARD.border,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: FIGMA_HOME_DASHBOARD.brandQuaternary,
                borderWidth: 1,
                borderColor: FIGMA_HOME_DASHBOARD.brandBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 14,
                  lineHeight: 20,
                  color: FIGMA_HOME_DASHBOARD.brand,
                }}
              >
                {step.index}
              </Text>
            </View>
            <Text
              style={{
                flex: 1,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 14,
                lineHeight: 20,
                color: FIGMA_HOME_DASHBOARD.textPrimary,
              }}
            >
              {step.label}
            </Text>
            <SetupCheckbox checked={step.done} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
