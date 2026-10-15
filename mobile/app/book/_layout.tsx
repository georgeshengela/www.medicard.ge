import React from 'react';
import { Stack } from 'expo-router';
import { useStackMotion } from '@/hooks/useStackMotion';
import { ModuleToneProvider, useThemeColors } from '@/theme/colors';

/** MEDIBOOK: every page speaks the module's lilac (ModuleToneProvider) under the standard module header; the booking flow is five pages. */
export default function BookLayout() {
  return (
    <ModuleToneProvider tone="book">
      <BookStack />
    </ModuleToneProvider>
  );
}

function BookStack() {
  const c = useThemeColors();
  const motion = useStackMotion();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg100 }, ...motion }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="map" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="business" options={{ headerShown: false }} />
      <Stack.Screen name="b/[id]/index" options={{ headerShown: false }} />
      <Stack.Screen name="b/[id]/book/index" options={{ headerShown: false }} />
      <Stack.Screen name="b/[id]/book/who" options={{ headerShown: false }} />
      <Stack.Screen name="b/[id]/book/when" options={{ headerShown: false }} />
      <Stack.Screen name="appointments/index" options={{ headerShown: false }} />
      <Stack.Screen name="b/[id]/book/confirm" options={{ headerShown: false }} />
      <Stack.Screen name="appointments/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
