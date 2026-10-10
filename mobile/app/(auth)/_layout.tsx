import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useIsDark, useThemeColors } from '@/theme/colors';
import { useStackMotion } from '@/hooks/useStackMotion';
import { VELVET } from '@/theme/velvet';

export default function AuthLayout() {
  const motion = useStackMotion();
  const peerMotion = useStackMotion('peer');
  const colors = useThemeColors();
  const dark = useIsDark();

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, ...motion }}>
        <Stack.Screen name="index" options={peerMotion} />
        <Stack.Screen name="welcome" options={{ ...peerMotion, contentStyle: { backgroundColor: VELVET[dark ? 'dark' : 'light'].surface } }} />
        <Stack.Screen name="sign-in" options={peerMotion} />
        <Stack.Screen name="sign-up" options={peerMotion} />
        <Stack.Screen name="link-account" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="assessment/index" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="phone" />
      </Stack>
    </>
  );
}

