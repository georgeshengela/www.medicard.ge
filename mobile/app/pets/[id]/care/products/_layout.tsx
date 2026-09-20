import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { usePetStackOptions } from '@/components/pets/PetUi';

export default function PetCareProductsLayout() {
  const options = usePetStackOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ title: ka.pets.productsTitle }} />
      <Stack.Screen name="new" options={{ title: ka.pets.productAdd }} />
      <Stack.Screen name="[productId]" options={{ title: ka.pets.productEdit }} />
    </Stack>
  );
}
