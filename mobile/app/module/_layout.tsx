import { Stack } from 'expo-router';
import { useFigmaChat } from '@/constants/figmaChatLayout';

export default function ModuleLayout() {
  const FIGMA_CHAT = useFigmaChat();
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
