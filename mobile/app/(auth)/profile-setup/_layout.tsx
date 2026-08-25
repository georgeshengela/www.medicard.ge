import { Stack } from 'expo-router';

export default function ProfileSetupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="avatar" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="success" />
      <Stack.Screen name="face-id" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="analyzing" />
      <Stack.Screen name="results" />
      <Stack.Screen name="recommendations" />
      <Stack.Screen name="dev-launcher" />
    </Stack>
  );
}
