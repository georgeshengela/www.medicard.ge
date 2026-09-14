import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function PetWeightLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: ka.common.back, headerTitleStyle: { fontWeight: '700' }, ...STACK_PUSH }}>
      <Stack.Screen name="index" options={{ title: ka.pets.weightTitle }} />
      <Stack.Screen name="new" options={{ title: ka.pets.weightAdd }} />
      <Stack.Screen name="[logId]" options={{ title: ka.pets.weightEdit }} />
    </Stack>
  );
}
