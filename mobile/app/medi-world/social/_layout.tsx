import { Stack } from 'expo-router';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function SocialLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, ...STACK_PUSH }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="intro" />
      <Stack.Screen name="eligibility" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="preview" />
      <Stack.Screen name="code" />
      <Stack.Screen name="add" />
      <Stack.Screen name="friends" />
      <Stack.Screen name="friend/[id]" />
      <Stack.Screen name="inbox" />
      <Stack.Screen name="circle" />
      <Stack.Screen name="blocks" />
      <Stack.Screen name="report" />
    </Stack>
  );
}
