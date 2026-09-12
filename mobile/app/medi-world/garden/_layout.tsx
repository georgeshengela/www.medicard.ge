import { Stack } from 'expo-router';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function GardenLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...STACK_PUSH }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="intro" />
      <Stack.Screen name="catalog" />
      <Stack.Screen name="stored" />
      <Stack.Screen name="history" />
      <Stack.Screen name="plant/[id]" />
    </Stack>
  );
}
