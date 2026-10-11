import React, { useCallback, useEffect, useRef } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { petFocusScrollOffset } from '@/lib/petKeyboardLayout';
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
  /** Page colour (velvet screens pass their surface); default the theme surface. */
  backgroundColor?: string;
  /** Replaces the brand hero; `compact` is true while the keyboard is up. */
  renderHeader?: (compact: boolean, durationMs: number) => React.ReactNode;
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
  backgroundColor,
  renderHeader,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const page = backgroundColor ?? colors.surface;
  const { height: keyboardHeight, durationMs } = useKeyboardMetrics();
  const keyboardOpen = keyboardHeight > AUTH_KEYBOARD_OPEN_PX;
  const footerBottom = useSharedValue(authFooterBottomPad(0, insets.bottom));
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  // Keep the focused field visible above the footer (long forms like sign-up on small phones).
  const revealFocus = useCallback(() => {
    if (Platform.OS === 'web') return;
    requestAnimationFrame(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const scroll = scrollRef.current;
      if (!input || !scroll) return;
      scroll.getNativeScrollRef?.()?.measureInWindow((_x, top, _w, height) => {
        input.measureInWindow((_ix, inputTop, _iw, inputHeight) => {
          if (TextInput.State.currentlyFocusedInput() !== input) return;
          const next = petFocusScrollOffset(offset.current, top, height, inputTop, inputHeight);
          if (Math.abs(next - offset.current) > 1) scroll.scrollTo({ y: next, animated: true });
        });
      });
    });
  }, []);
  useEffect(() => {
    if (keyboardHeight > AUTH_KEYBOARD_OPEN_PX) {
      const t = setTimeout(revealFocus, durationMs + 30);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [durationMs, keyboardHeight, revealFocus]);

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
    <View className="flex-1 font-sans" style={{ flex: 1, backgroundColor: page }}>
      <View className="flex-1">
        <ScrollView
          ref={scrollRef}
          onFocus={() => setTimeout(revealFocus, 60)}
          onScroll={(e) => {
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
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
            {renderHeader ? (
              renderHeader(keyboardOpen, durationMs)
            ) : hero ? (
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
                backgroundColor: page,
              },
              footerPadStyle,
            ]}
          >
            {footer}
          </AnimatedPressable>
        ) : null}
      </View>
    </View>
  );
}
