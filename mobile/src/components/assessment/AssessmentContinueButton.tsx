import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { FIGMA_ASSESSMENT_SHADOW } from '@/constants/figmaAssessmentIntro';
import { useThemeColors } from '@/theme/colors';

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'recording';
  /** Intro screen CTA — no arrow, 48px height (Figma 9217:164409). */
  tone?: 'step' | 'intro';
};

/** Figma assessment CTA — background on inner View for reliable paint. */
export function AssessmentContinueButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  tone = 'step',
}: Props) {
  const colors = useThemeColors();
  const inactive = loading || disabled;
  const isIntro = tone === 'intro';

  const bg = variant === 'recording' ? '#99F6E4' : colors.primary200;
  const labelColor = variant === 'recording' ? colors.primary100 : colors.white;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      activeOpacity={0.88}
      disabled={inactive}
      onPress={onPress}
      style={{ width: '100%', alignSelf: 'stretch' }}
    >
      <View
        pointerEvents="none"
        style={{
          minHeight: isIntro ? 48 : 52,
          borderRadius: 16,
          backgroundColor: inactive && variant === 'primary' ? '#99F6E4' : bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isIntro ? 10 : 8,
          paddingHorizontal: isIntro ? 20 : 16,
          paddingVertical: isIntro ? 12 : 14,
          opacity: inactive && variant === 'primary' ? 0.85 : 1,
          ...(isIntro ? FIGMA_ASSESSMENT_SHADOW : null),
        }}
      >
        {loading ? (
          <ActivityIndicator color={labelColor} />
        ) : (
          <>
            <Text
              style={{
                fontFamily: isIntro ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_700Bold',
                fontSize: isIntro ? 16 : 17,
                lineHeight: isIntro ? 22 : 24,
                color: labelColor,
              }}
            >
              {label}
            </Text>
            {!isIntro ? <ArrowRight size={20} color={labelColor} strokeWidth={2.4} /> : null}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}
