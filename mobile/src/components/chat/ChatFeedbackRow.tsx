import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { FIGMA_CHAT } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';

type Props = {
  feedbackRating?: 1 | -1;
  onRate: (rating: 1 | -1) => void;
};

export function ChatFeedbackRow({ feedbackRating, onRate }: Props) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: FIGMA_CHAT.border, paddingTop: 12, marginTop: 4, gap: 8 }}>
      <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_CHAT.textSecondary }}>
        {feedbackRating ? ka.chat.feedbackThanks : ka.chat.feedbackPrompt}
      </Text>
      {!feedbackRating ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => onRate(1)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: FIGMA_CHAT.border,
              backgroundColor: FIGMA_CHAT.cardBg,
            }}
          >
            <ThumbsUp size={14} color={FIGMA_CHAT.brand} strokeWidth={2.2} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: FIGMA_CHAT.textSecondary }}>{ka.chat.feedbackHelpful}</Text>
          </Pressable>
          <Pressable
            onPress={() => onRate(-1)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: FIGMA_CHAT.border,
              backgroundColor: FIGMA_CHAT.cardBg,
            }}
          >
            <ThumbsDown size={14} color={FIGMA_CHAT.textMuted} strokeWidth={2.2} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: FIGMA_CHAT.textSecondary }}>{ka.chat.feedbackNotHelpful}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
