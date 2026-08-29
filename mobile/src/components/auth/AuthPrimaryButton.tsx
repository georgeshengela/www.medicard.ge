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
};

/** Figma primary auth CTA — background lives on inner View (NativeWind breaks Pressable style fns). */
export function AuthPrimaryButton({ label, onPress, loading = false, disabled = false, style }: Props) {
  const auth = useFigmaAuth();
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
      <View
        pointerEvents="none"
        style={[
          {
            width: '100%',
            minHeight: auth.primaryMinHeight,
            borderRadius: auth.primaryRadius,
            backgroundColor: auth.primaryBg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: auth.primaryPaddingX,
            paddingVertical: auth.primaryPaddingY,
            gap: auth.primaryGap,
            ...FIGMA_AUTH_SHADOW,
          },
          inactive && !loading ? { opacity: 0.45 } : null,
        ]}
      >
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
