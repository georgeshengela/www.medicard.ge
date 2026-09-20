import { Stack } from 'expo-router';
import { useStackMotion } from '@/hooks/useStackMotion';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';

export default function SymptomsLayout() {
  const motion = useStackMotion();
  const FIGMA_SYMPTOMS = useFigmaSymptoms();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: FIGMA_SYMPTOMS.white },
        ...motion,
      }}
    />
  );
}
