import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function VisitsLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: ka.common.back,
        headerTitleStyle: { fontWeight: '700' },
        ...STACK_PUSH,
      }}
    >
      <Stack.Screen name="index" options={{ title: ka.visits.title }} />
      <Stack.Screen name="editor" options={{ headerShown: false, animation: 'slide_from_right' }} />
    </Stack>
  );
}
