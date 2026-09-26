import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpRight, AudioLines } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkColors, useIsDark } from '@/theme/colors';

export function AssistantEntry({ tabBar }: { tabBar: boolean }) {
  const router = useRouter(), segments = useSegments(), insets = useSafeAreaInsets(), dark = useIsDark();
  const [keyboard, setKeyboard] = useState(false);
  const [focused, setFocused] = useState(false);
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const setPressed = (pressed: boolean) => {
    scale.value = withTiming(pressed ? 0.96 : 1, { duration: reducedMotion ? 0 : 130 });
  };
  const openAssistant = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    router.push('/assistant' as never);
  };
  useEffect(() => { const a = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true)); const b = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false)); return () => { a.remove(); b.remove(); }; }, []);
  // Keep camera, maps, onboarding and conversations clear. Main screens retain one compact entry.
  // The AI consent screen decides whether Medi may run at all; its own primary button must stay uncovered.
  if (['(tabs)/home', 'profile/ai-data'].includes(segments.join('/')) || segments[0] === 'explore' || keyboard || ['assistant', '(auth)', 'chat', 'module', 'run', 'medipulsi', 'symptoms'].includes(segments[0]) || segments.includes('chat')) return null;
  return <Animated.View style={[styles.position, { right: Math.max(insets.right, 16), bottom: Math.max(insets.bottom, 12) + (tabBar ? 78 : 10) }, pressStyle]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Medi — ხმოვანი ასისტენტის გახსნა"
      accessibilityHint="ხსნის საუბრის გვერდს" onPress={openAssistant}
      onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
      onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setPressed(false); }}
      style={[styles.button, { backgroundColor: dark ? darkColors.surfaceRaised : darkColors.surface,
        borderColor: focused ? darkColors.primary100 : dark ? darkColors.bg300 : darkColors.surface }]}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.emblem}>
        <AudioLines size={24} strokeWidth={2} color="#042F2E" />
      </View>
      <View pointerEvents="none" style={styles.label}>
        <Text style={styles.name}>Medi</Text>
        <Text style={styles.invitation}>მომიყევი</Text>
      </View>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.arrow}>
        <ArrowUpRight size={14} strokeWidth={1.8} color={darkColors.text200} />
      </View>
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  position: { position: 'absolute' },
  button: { minHeight: 56, padding: 6, paddingRight: 12, borderRadius: 30, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  // A quiet voice mark, not a listening indicator. Recording starts inside the conversation.
  emblem: { width: 40, height: 40, borderRadius: 20, borderBottomRightRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#14B8A6' },
  label: { paddingVertical: 1 },
  name: { color: darkColors.text100, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22 },
  invitation: { color: darkColors.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 10, lineHeight: 15 },
  arrow: { marginLeft: 2 },
});
