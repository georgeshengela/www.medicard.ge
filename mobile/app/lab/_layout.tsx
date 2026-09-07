import { Stack } from 'expo-router';
import { STACK_PUSH } from '@/theme/stackMotion';
import { useFigmaLab } from '@/constants/figmaLabLayout';

export default function LabLayout() {
  const T = useFigmaLab();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: T.pageBg },
        ...STACK_PUSH,
      }}
    />
  );
}
