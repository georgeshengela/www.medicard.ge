import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { FIGMA_AUTH_SHADOW, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { AuthSignInArrow } from '@/components/auth/AuthSignInArrow';

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** White fill + teal label — brand splash / teal surfaces. */
  tone?: 'brand' | 'inverse';
};

const INVERSE_INK = '#0D9488';
const INVERSE_SHADOW = {
  shadowColor: '#042F2E',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.18,
  shadowRadius: 16,
  elevation: 6,
} as const;

/** Figma primary auth CTA — background lives on inner View (NativeWind breaks Pressable style fns). */
export function AuthPrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  tone = 'brand',
}: Props) {
  const auth = useFigmaAuth();
  const inactive = loading || disabled;
  const inverse = tone === 'inverse';
  const ink = inverse ? INVERSE_INK : '#FFFFFF';

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      activeOpacity={0.88}
      disabled={inactive}
      onPress={onPress}
      style={[{ width: '100%', alignSelf: 'stretch' }, style]}
    >
      <View
        pointerEvents="none"
        style={[
          {
            width: '100%',
            minHeight: auth.primaryMinHeight,
            borderRadius: auth.primaryRadius,
            backgroundColor: inverse ? '#FFFFFF' : auth.primaryBg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: auth.primaryPaddingX,
            paddingVertical: auth.primaryPaddingY,
            gap: auth.primaryGap,
            ...(inverse ? INVERSE_SHADOW : FIGMA_AUTH_SHADOW),
          },
          inactive && !loading ? { opacity: 0.45 } : null,
        ]}
      >
        {loading ? (
          <>
            <ActivityIndicator color={ink} />
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 16,
                lineHeight: 22,
                color: ink,
              }}
            >
              {label}
            </Text>
          </>
        ) : (
          <>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 16,
                lineHeight: 22,
                color: ink,
              }}
            >
              {label}
            </Text>
            <AuthSignInArrow size={20} color={ink} />
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}
