import React from 'react';
import { Stack } from 'expo-router';
import { useThemeColors } from '@/theme/colors';
import { useStackMotion } from '@/hooks/useStackMotion';

export default function ForgotPasswordLayout() {
  const motion = useStackMotion();
  const colors = useThemeColors();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg100 }, ...motion }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="email" />
      <Stack.Screen name="sent" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="reset" />
    </Stack>
  );
}
