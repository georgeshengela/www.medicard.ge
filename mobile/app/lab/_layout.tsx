import { Stack } from 'expo-router';
import { useStackMotion } from '@/hooks/useStackMotion';
import { useFigmaLab } from '@/constants/figmaLabLayout';

export default function LabLayout() {
  const motion = useStackMotion();
  const T = useFigmaLab();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: T.pageBg },
        ...motion,
      }}
    />
  );
}
