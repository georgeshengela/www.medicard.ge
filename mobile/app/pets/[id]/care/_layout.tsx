import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function PetCareLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: ka.common.back, headerTitleStyle: { fontWeight: '700' }, ...STACK_PUSH }}>
      <Stack.Screen name="index" options={{ title: ka.pets.careTitle }} />
      <Stack.Screen name="record" options={{ title: ka.pets.recordAdmin }} />
      <Stack.Screen name="plan" options={{ title: ka.pets.planCare }} />
      <Stack.Screen name="history" options={{ title: ka.pets.careHistory }} />
      <Stack.Screen name="products" options={{ headerShown: false }} />
      <Stack.Screen name="schedule" options={{ headerShown: false }} />
      <Stack.Screen name="event" options={{ headerShown: false }} />
      <Stack.Screen name="complete" options={{ title: ka.pets.confirmCare }} />
    </Stack>
  );
}
