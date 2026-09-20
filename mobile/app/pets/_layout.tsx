import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { usePetStackOptions } from '@/components/pets/PetUi';

export default function PetsLayout() {
  const options = usePetStackOptions();
  return (
    <Stack
      screenOptions={options}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: ka.pets.hubTitle }} />
      <Stack.Screen name="new" options={{ title: ka.pets.add }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
