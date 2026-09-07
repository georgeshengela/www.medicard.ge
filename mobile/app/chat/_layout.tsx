import { Stack } from 'expo-router';
import { STACK_PUSH } from '@/theme/stackMotion';
import { useFigmaChat } from '@/constants/figmaChatLayout';

export default function ChatLayout() {
  const FIGMA_CHAT = useFigmaChat();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: FIGMA_CHAT.cardBg },
        ...STACK_PUSH,
      }}
    />
  );
}
