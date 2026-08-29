import { Stack } from 'expo-router';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';

export default function SymptomsLayout() {
  const FIGMA_SYMPTOMS = useFigmaSymptoms();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: FIGMA_SYMPTOMS.white },
        animation: 'slide_from_right',
      }}
    />
  );
}
