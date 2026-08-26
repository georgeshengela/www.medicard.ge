import { Stack } from 'expo-router';
import { FIGMA_CHAT } from '@/constants/figmaChatLayout';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: FIGMA_CHAT.cardBg },
        animation: 'slide_from_right',
      }}
    />
  );
}
