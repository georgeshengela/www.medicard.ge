import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';

export default function PharmacyLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: ka.common.back,
      }}
    >
      <Stack.Screen name="index" options={{ title: ka.pharmacy.title }} />
      <Stack.Screen name="category/[slug]" options={{ title: ka.pharmacy.categories }} />
      <Stack.Screen name="product/[id]" options={{ title: ka.pharmacy.compareTitle }} />
    </Stack>
  );
}
