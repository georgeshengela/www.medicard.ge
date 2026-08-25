import React from 'react';
import { Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { FIGMA_AUTH, FIGMA_AUTH_SHADOW } from '@/constants/figmaAuthLayout';
import { GoogleLogo } from '@/components/auth/GoogleLogo';

type Props = {
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
};

const SURFACE: ViewStyle = {
  width: '100%',
  minHeight: FIGMA_AUTH.socialButtonMinHeight,
  borderRadius: FIGMA_AUTH.socialButtonRadius,
  backgroundColor: FIGMA_AUTH.socialButtonBg,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: FIGMA_AUTH.socialButtonPaddingX,
  paddingVertical: FIGMA_AUTH.socialButtonPaddingY,
  gap: FIGMA_AUTH.socialButtonGap,
  ...FIGMA_AUTH_SHADOW,
};

/** Figma Google sign-in — background on inner View for reliable paint across NativeWind/RN Web. */
export function AuthGoogleButton({ label, onPress, style }: Props) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.88}
      onPress={onPress}
      style={[{ width: '100%', alignSelf: 'stretch' }, style]}
    >
      <View pointerEvents="none" style={SURFACE}>
        <View style={{ width: FIGMA_AUTH.socialIconSize, height: FIGMA_AUTH.socialIconSize }}>
          <GoogleLogo size={FIGMA_AUTH.socialIconSize} />
        </View>
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
      </View>
    </TouchableOpacity>
  );
}
