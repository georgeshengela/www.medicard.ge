import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';

export default function VisitsLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: ka.common.back,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: ka.visits.title }} />
      <Stack.Screen name="editor" options={{ headerShown: false, animation: 'slide_from_right' }} />
    </Stack>
  );
}
