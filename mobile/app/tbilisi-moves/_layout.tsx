import { Stack } from 'expo-router';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function TbilisiMovesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...STACK_PUSH }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="enroll" />
      <Stack.Screen name="membership" />
      <Stack.Screen name="history/index" />
      <Stack.Screen name="history/[date]" />
      <Stack.Screen name="awards" />
    </Stack>
  );
}
