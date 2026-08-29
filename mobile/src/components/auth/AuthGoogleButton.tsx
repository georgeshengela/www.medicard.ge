import React from 'react';
import { Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { FIGMA_AUTH_SHADOW, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { GoogleLogo } from '@/components/auth/GoogleLogo';

type Props = {
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Figma Google sign-in — background on inner View for reliable paint across NativeWind/RN Web. */
export function AuthGoogleButton({ label, onPress, style }: Props) {
  const auth = useFigmaAuth();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.88}
      onPress={onPress}
      style={[{ width: '100%', alignSelf: 'stretch' }, style]}
    >
      <View
        pointerEvents="none"
        style={{
          width: '100%',
          minHeight: auth.socialButtonMinHeight,
          borderRadius: auth.primaryRadius,
          backgroundColor: auth.socialButtonBg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: auth.socialButtonPaddingX,
          paddingVertical: auth.socialButtonPaddingY,
          gap: auth.socialButtonGap,
          ...FIGMA_AUTH_SHADOW,
        }}
      >
        <View style={{ width: auth.socialIconSize, height: auth.socialIconSize }}>
          <GoogleLogo size={auth.socialIconSize} />
        </View>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 16,
            lineHeight: 22,
            color: auth.socialLabel,
          }}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
