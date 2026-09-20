import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { usePetStackOptions } from '@/components/pets/PetUi';

export default function PetWeightLayout() {
  const options = usePetStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: ka.pets.weightTitle }} />
      <Stack.Screen name="new" options={{ title: ka.pets.weightAdd }} />
      <Stack.Screen name="[logId]" options={{ title: ka.pets.weightEdit }} />
    </Stack>
  );
}
