import React, { useEffect } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { FIGMA_AUTH } from '@/constants/figmaAuthLayout';
import { AuthBrandHeader } from '@/components/auth/AuthBrandHeader';
import {
  AUTH_KEYBOARD_OPEN_PX,
  AUTH_SCREEN_GUTTER,
  authFooterBottomPad,
  authScrollTopPad,
} from '@/lib/authChrome';
import { useKeyboardMetrics } from '@/lib/useKeyboardHeight';
import { useThemeColors } from '@/theme/colors';
import { ka } from '@/i18n/ka';

type Props = {
  /** Nightingale hero header (logo + app name). */
  hero?: boolean;
  heroSubtitle?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const KEYBOARD_EASE = Easing.bezier(0.17, 0.59, 0.4, 0.77);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function dismissKeyboard() {
  Keyboard.dismiss();
}

/** Shared chrome for splash-adjacent auth screens. */
export function AuthShell({
  hero,
  heroSubtitle,
  title,
  subtitle,
  children,
  footer,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { height: keyboardHeight, durationMs } = useKeyboardMetrics();
  const keyboardOpen = keyboardHeight > AUTH_KEYBOARD_OPEN_PX;
  const footerBottom = useSharedValue(authFooterBottomPad(0, insets.bottom));

  useEffect(() => {
    footerBottom.value = withTiming(authFooterBottomPad(keyboardHeight, insets.bottom), {
      duration: durationMs,
      easing: KEYBOARD_EASE,
    });
  }, [durationMs, footerBottom, insets.bottom, keyboardHeight]);

  const footerPadStyle = useAnimatedStyle(() => ({
    paddingBottom: footerBottom.value,
  }));

  return (
    <View className="flex-1 font-sans" style={{ flex: 1, backgroundColor: colors.surface }}>
      <View className="flex-1">
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: authScrollTopPad(insets.top),
            paddingBottom: footer
              ? AUTH_SCREEN_GUTTER
              : authFooterBottomPad(keyboardHeight, insets.bottom),
            paddingHorizontal: FIGMA_AUTH.screenPaddingX,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={false}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={dismissKeyboard} accessible={false}>
            {hero ? (
              <AuthBrandHeader
                subtitle={heroSubtitle ?? ka.app.tagline}
                compact={keyboardOpen}
                durationMs={durationMs}
              />
            ) : title ? (
              <View className="mb-6">
                <Text className="font-sans-bold text-2xl" style={{ color: colors.text100 }}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text className="mt-1.5 font-sans text-base" style={{ color: colors.text200 }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Pressable>

          {children}

          <Pressable onPress={dismissKeyboard} accessible={false} style={{ flexGrow: 1, minHeight: 12 }} />
        </ScrollView>

        {footer ? (
          <AnimatedPressable
            accessible={false}
            onPress={dismissKeyboard}
            style={[
              {
                paddingHorizontal: FIGMA_AUTH.screenPaddingX,
                paddingTop: AUTH_SCREEN_GUTTER,
                backgroundColor: colors.surface,
              },
              footerPadStyle,
            ]}
          >
            {keyboardOpen ? (
              <LinearGradient
                pointerEvents="none"
                colors={['transparent', colors.surface]}
                style={{ position: 'absolute', left: 0, right: 0, top: -28, height: 28 }}
              />
            ) : null}
            {footer}
          </AnimatedPressable>
        ) : null}
      </View>
    </View>
  );
}
