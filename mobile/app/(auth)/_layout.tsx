import React from 'react';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useIsDark, useThemeColors } from '@/theme/colors';
import { useStackMotion } from '@/hooks/useStackMotion';

export default function AuthLayout() {
  const motion = useStackMotion();
  const peerMotion = useStackMotion('peer');
  const colors = useThemeColors();
  const dark = useIsDark();
  const segments = useSegments();
  const brandSplash = segments.includes('welcome');

  return (
    <>
      <StatusBar style={brandSplash || dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, ...motion }}>
        <Stack.Screen name="index" options={peerMotion} />
        <Stack.Screen name="welcome" options={{ ...peerMotion, contentStyle: { backgroundColor: '#14B8A6' } }} />
        <Stack.Screen name="sign-in" options={peerMotion} />
        <Stack.Screen name="sign-up" options={peerMotion} />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="assessment/index" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="phone" />
      </Stack>
    </>
  );
}

