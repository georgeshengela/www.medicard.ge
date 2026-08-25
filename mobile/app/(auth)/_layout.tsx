import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useThemeColors } from '@/theme/colors';

export default function AuthLayout() {
  const colors = useThemeColors();

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg100 } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
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

