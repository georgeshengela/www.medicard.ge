import { Stack } from 'expo-router';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function RunLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...STACK_PUSH }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="active" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <Stack.Screen name="summary" options={{ gestureEnabled: false }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
