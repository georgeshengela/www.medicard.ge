import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function PetConditionsLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: ka.common.back, headerTitleStyle: { fontWeight: '700' }, ...STACK_PUSH }}>
      <Stack.Screen name="index" options={{ title: ka.pets.conditionsTitle }} />
      <Stack.Screen name="new" options={{ title: ka.pets.conditionAdd }} />
      <Stack.Screen name="[conditionId]" options={{ title: ka.pets.conditionEdit }} />
    </Stack>
  );
}
