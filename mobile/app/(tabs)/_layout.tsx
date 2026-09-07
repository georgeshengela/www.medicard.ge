import React from 'react';
import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useThemeColors } from '@/theme/colors';
import { STACK_PUSH, STACK_REDUCED } from '@/theme/stackMotion';

/** Tab screens only. The pill lives in the root layout, outside this stack. */
export default function TabsLayout() {
  const colors = useThemeColors();
  const reduceMotion = usePrefersReducedMotion();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg100 },
        headerTitleStyle: { color: colors.text100, fontSize: 17, fontWeight: '700' },
        headerShadowVisible: false,
        headerTintColor: colors.primary200,
        contentStyle: { backgroundColor: colors.bg100 },
        ...(reduceMotion ? STACK_REDUCED : STACK_PUSH),
      }}
    >
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="records" options={{ title: ka.records.title }} />
      <Stack.Screen name="medications" options={{ title: ka.meds.hubTitle }} />
      <Stack.Screen name="profile" options={{ title: ka.profile.title }} />
    </Stack>
  );
}
