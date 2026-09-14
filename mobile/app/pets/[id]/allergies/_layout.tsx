import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function PetAllergiesLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: ka.common.back, headerTitleStyle: { fontWeight: '700' }, ...STACK_PUSH }}>
      <Stack.Screen name="index" options={{ title: ka.pets.allergiesTitle }} />
      <Stack.Screen name="new" options={{ title: ka.pets.allergyAdd }} />
      <Stack.Screen name="[allergyId]" options={{ title: ka.pets.allergyEdit }} />
    </Stack>
  );
}
