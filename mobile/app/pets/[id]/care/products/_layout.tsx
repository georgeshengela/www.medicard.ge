import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function PetCareProductsLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: ka.common.back, headerTitleStyle: { fontWeight: '700' }, ...STACK_PUSH }}>
      <Stack.Screen name="index" options={{ title: ka.pets.productsTitle }} />
      <Stack.Screen name="new" options={{ title: ka.pets.productAdd }} />
      <Stack.Screen name="[productId]" options={{ title: ka.pets.productEdit }} />
    </Stack>
  );
}
