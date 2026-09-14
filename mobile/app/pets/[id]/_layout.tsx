import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function PetDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: ka.common.back,
        headerTitleStyle: { fontWeight: '700' },
        ...STACK_PUSH,
      }}
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
