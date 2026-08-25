import { Stack } from 'expo-router';

export default function ProfileSetupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="avatar" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}
