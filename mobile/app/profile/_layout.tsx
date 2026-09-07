import { Stack } from 'expo-router';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...STACK_PUSH,
      }}
    />
  );
}
