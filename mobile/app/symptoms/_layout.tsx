import { Stack } from 'expo-router';
import { STACK_PUSH } from '@/theme/stackMotion';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';

export default function SymptomsLayout() {
  const FIGMA_SYMPTOMS = useFigmaSymptoms();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: FIGMA_SYMPTOMS.white },
        ...STACK_PUSH,
      }}
    />
  );
}
