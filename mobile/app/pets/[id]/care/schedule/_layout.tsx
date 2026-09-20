import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { usePetStackOptions } from '@/components/pets/PetUi';

export default function PetCareScheduleLayout() {
  const options = usePetStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="[scheduleId]" options={{ title: ka.pets.scheduleActive }} />
    </Stack>
  );
}
