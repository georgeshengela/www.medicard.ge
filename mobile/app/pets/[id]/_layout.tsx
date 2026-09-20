import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { usePetStackOptions } from '@/components/pets/PetUi';

export default function PetDetailLayout() {
  const options = usePetStackOptions();
  return (
    <Stack
      screenOptions={options}
    >
      <Stack.Screen name="index" options={{ title: ka.pets.profileTitle }} />
      <Stack.Screen name="edit" options={{ title: ka.pets.editTitle }} />
      <Stack.Screen name="weight" options={{ headerShown: false }} />
      <Stack.Screen name="allergies" options={{ headerShown: false }} />
      <Stack.Screen name="conditions" options={{ headerShown: false }} />
      <Stack.Screen name="care" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{ headerShown: false, title: ka.pets.vetName }} />
    </Stack>
  );
}
