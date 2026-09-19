import React from 'react';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useIsDark, useThemeColors } from '@/theme/colors';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function AuthLayout() {
  const colors = useThemeColors();
  const dark = useIsDark();
  const segments = useSegments();
  const brandSplash = segments.includes('welcome');

  return (
    <>
      <StatusBar style={brandSplash || dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, ...STACK_PUSH }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" options={{ contentStyle: { backgroundColor: '#14B8A6' } }} />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="assessment/index" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="phone" />
      </Stack>
    </>
  );
}

