import { Stack } from 'expo-router';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function ProfileSetupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...STACK_PUSH }}>
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
