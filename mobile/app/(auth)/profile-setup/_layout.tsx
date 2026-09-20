import { Stack } from 'expo-router';
import { useStackMotion } from '@/hooks/useStackMotion';

export default function ProfileSetupLayout() {
  const motion = useStackMotion();
  return (
    <Stack screenOptions={{ headerShown: false, ...motion }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="avatar" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="success" />
      <Stack.Screen name="face-id" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="location" />
      <Stack.Screen name="analyzing" />
      <Stack.Screen name="results" />
      <Stack.Screen name="dev-launcher" />
    </Stack>
  );
}
