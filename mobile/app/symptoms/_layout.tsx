import { Stack } from 'expo-router';
import { FIGMA_SYMPTOMS } from '@/constants/figmaSymptomsLayout';

export default function SymptomsLayout() {
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
