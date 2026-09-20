import { Stack } from 'expo-router';
import { useStackMotion } from '@/hooks/useStackMotion';

export default function ProfileLayout() {
  const motion = useStackMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...motion,
      }}
    />
  );
}
