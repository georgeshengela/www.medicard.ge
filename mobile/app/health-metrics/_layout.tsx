import { Stack } from 'expo-router';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function HealthMetricsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...STACK_PUSH,
      }}
    >
      <Stack.Screen name="weight/goal/pace" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
    </Stack>
  );
}
