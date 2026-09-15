import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function PetsLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: ka.common.back,
        headerTitleStyle: { fontWeight: '700' },
        ...STACK_PUSH,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: ka.pets.hubTitle }} />
      <Stack.Screen name="new" options={{ title: ka.pets.add }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
