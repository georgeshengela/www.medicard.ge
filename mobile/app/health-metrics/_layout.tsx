import { Stack } from 'expo-router';
import { useStackMotion } from '@/hooks/useStackMotion';

export default function HealthMetricsLayout() {
  const motion = useStackMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...motion,
      }}
    >
      <Stack.Screen name="weight/goal/pace" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
    </Stack>
  );
}
