import React from 'react';
import { Stack } from 'expo-router';
import { useThemeColors } from '@/theme/colors';

export default function ForgotPasswordLayout() {
  const colors = useThemeColors();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg100 } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="email" />
      <Stack.Screen name="sent" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="reset" />
    </Stack>
  );
}
