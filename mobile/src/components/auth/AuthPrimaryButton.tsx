import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { FIGMA_AUTH, FIGMA_AUTH_SHADOW } from '@/constants/figmaAuthLayout';
import { AuthSignInArrow } from '@/components/auth/AuthSignInArrow';

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

const SURFACE: ViewStyle = {
  width: '100%',
  minHeight: FIGMA_AUTH.primaryMinHeight,
  borderRadius: FIGMA_AUTH.primaryRadius,
  backgroundColor: FIGMA_AUTH.primaryBg,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: FIGMA_AUTH.primaryPaddingX,
  paddingVertical: FIGMA_AUTH.primaryPaddingY,
  gap: FIGMA_AUTH.primaryGap,
  ...FIGMA_AUTH_SHADOW,
};

/** Figma primary auth CTA — background lives on inner View (NativeWind breaks Pressable style fns). */
export function AuthPrimaryButton({ label, onPress, loading = false, disabled = false, style }: Props) {
  const inactive = loading || disabled;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      activeOpacity={0.88}
      disabled={inactive}
      onPress={onPress}
      style={[{ width: '100%', alignSelf: 'stretch' }, style]}
    >
      <View pointerEvents="none" style={[SURFACE, inactive && !loading ? { opacity: 0.45 } : null]}>
        {loading ? (
          <>
            <ActivityIndicator color="#FFFFFF" />
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 16,
                lineHeight: 22,
                color: '#FFFFFF',
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
                color: '#FFFFFF',
              }}
            >
              {label}
            </Text>
            <AuthSignInArrow size={20} color="#FFFFFF" />
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}
