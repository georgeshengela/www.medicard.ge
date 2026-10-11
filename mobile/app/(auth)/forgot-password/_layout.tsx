import React from 'react';
import { Stack } from 'expo-router';
import { useVelvet } from '@/theme/velvet';
import { useStackMotion } from '@/hooks/useStackMotion';

export default function ForgotPasswordLayout() {
  const motion = useStackMotion();
  const { palette } = useVelvet();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.surface }, ...motion }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="email" />
      <Stack.Screen name="sent" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="reset" />
      <Stack.Screen name="sms" />
    </Stack>
  );
}
