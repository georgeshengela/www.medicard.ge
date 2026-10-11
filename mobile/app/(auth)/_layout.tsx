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
  // the launch splash, welcome, sign-in, sign-up and password reset are velvet pages (owner 2026-10-11)
  const velvet = VELVET[dark ? 'dark' : 'light'].surface;

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, ...motion }}>
        <Stack.Screen name="index" options={{ ...peerMotion, contentStyle: { backgroundColor: velvet } }} />
        <Stack.Screen name="welcome" options={{ ...peerMotion, contentStyle: { backgroundColor: velvet } }} />
        <Stack.Screen name="sign-in" options={{ ...peerMotion, contentStyle: { backgroundColor: velvet } }} />
        <Stack.Screen name="sign-up" options={{ ...peerMotion, contentStyle: { backgroundColor: velvet } }} />
        <Stack.Screen name="link-account" options={{ contentStyle: { backgroundColor: velvet } }} />
        <Stack.Screen name="forgot-password" options={{ contentStyle: { backgroundColor: velvet } }} />
        <Stack.Screen name="assessment/index" />
        <Stack.Screen name="profile-setup" />
        <Stack.Screen name="phone" />
      </Stack>
    </>
  );
}

