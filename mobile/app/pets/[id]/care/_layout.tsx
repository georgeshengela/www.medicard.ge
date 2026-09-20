import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { usePetStackOptions } from '@/components/pets/PetUi';

export default function PetCareLayout() {
  const options = usePetStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: ka.pets.careTitle }} />
      <Stack.Screen name="add" options={{ title: ka.pets.careAdd }} />
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
