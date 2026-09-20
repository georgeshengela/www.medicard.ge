import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { usePetStackOptions } from '@/components/pets/PetUi';

export default function PetConditionsLayout() {
  const options = usePetStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: ka.pets.conditionsTitle }} />
      <Stack.Screen name="new" options={{ title: ka.pets.conditionAdd }} />
      <Stack.Screen name="[conditionId]" options={{ title: ka.pets.conditionEdit }} />
    </Stack>
  );
}
