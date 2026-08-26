import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FIGMA_CHAT } from '@/constants/figmaChatLayout';

export function ChatSuggestionChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: FIGMA_CHAT.bubbleRadius,
        borderWidth: 1,
        borderColor: FIGMA_CHAT.border,
        backgroundColor: FIGMA_CHAT.white,
        marginBottom: 8,
        ...FIGMA_CHAT.shadowXs,
      }}
    >
      <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_CHAT.textSecondary }}>{label}</Text>
    </Pressable>
  );
}

export function ChatWidgetCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        width: '100%',
        backgroundColor: FIGMA_CHAT.cardBg,
        borderWidth: 1,
        borderColor: FIGMA_CHAT.border,
        borderRadius: 8,
        padding: 12,
        gap: 12,
      }}
    >
      {children}
    </View>
  );
}

export function ChatEmptyHero({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 8, paddingVertical: 8 }}>
      <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: '700', color: FIGMA_CHAT.textPrimary }}>{title}</Text>
      <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_CHAT.textSecondary }}>{body}</Text>
    </View>
  );
}
