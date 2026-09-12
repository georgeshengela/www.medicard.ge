import { Stack } from 'expo-router';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function MediWorldLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...STACK_PUSH,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="care-space" />
      <Stack.Screen name="collection" />
      <Stack.Screen name="adventure" />
      <Stack.Screen name="adventure-preferences" />
      <Stack.Screen name="explore" />
      <Stack.Screen name="explore-history" />
      <Stack.Screen name="explore-settings" />
      <Stack.Screen name="movement" />
      <Stack.Screen name="movement-history" />
      <Stack.Screen name="garden" />
    </Stack>
  );
}
