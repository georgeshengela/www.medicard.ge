import { Stack } from 'expo-router';
import { useStackMotion } from '@/hooks/useStackMotion';
import { useFigmaChat } from '@/constants/figmaChatLayout';

export default function ChatLayout() {
  const motion = useStackMotion();
  const FIGMA_CHAT = useFigmaChat();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: FIGMA_CHAT.cardBg },
        ...motion,
      }}
    />
  );
}
