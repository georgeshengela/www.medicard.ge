import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { useStackMotion } from '@/hooks/useStackMotion';

export default function VisitsLayout() {
  const motion = useStackMotion();
  return (
    <Stack
      screenOptions={{
        headerBackTitle: ka.common.back,
        headerTitleStyle: { fontWeight: '700' },
        ...motion,
      }}
    >
      <Stack.Screen name="index" options={{ title: ka.visits.title }} />
      <Stack.Screen name="editor" options={{ headerShown: false }} />
    </Stack>
  );
}
