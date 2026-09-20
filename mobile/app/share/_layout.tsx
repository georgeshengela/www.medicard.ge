import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { useStackMotion } from '@/hooks/useStackMotion';

export default function ShareLayout() {
  const motion = useStackMotion();
  return <Stack screenOptions={{ headerBackTitle: ka.common.back, ...motion }} />;
}
