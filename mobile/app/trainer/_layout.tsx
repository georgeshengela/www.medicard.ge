import { Stack } from 'expo-router';
import { useStackMotion } from '@/hooks/useStackMotion';

export default function TrainerLayout() {
  const motion = useStackMotion();
  return <Stack screenOptions={{ headerShown: false, ...motion }} />;
}
