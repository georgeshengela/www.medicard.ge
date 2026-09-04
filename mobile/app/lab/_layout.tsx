import { Stack } from 'expo-router';
import { useFigmaLab } from '@/constants/figmaLabLayout';

export default function LabLayout() {
  const T = useFigmaLab();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: T.pageBg },
        animation: 'slide_from_right',
      }}
    />
  );
}
