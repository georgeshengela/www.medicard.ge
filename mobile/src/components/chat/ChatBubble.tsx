import React from 'react';
import { Text, View } from 'react-native';
import { CheckCheck } from 'lucide-react-native';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { formatChatTime } from '@/lib/chatUiConfig';
import { ChatAiAvatar, ChatUserAvatar } from '@/components/chat/ChatAiAvatar';

type Props = {
  content: string;
  timestamp: string;
  userInitials?: string;
  userAvatarUri?: string | null;
};

export function ChatBubbleUser({ content, timestamp, userInitials, userAvatarUri }: Props) {
  const FIGMA_CHAT = useFigmaChat();
  const time = formatChatTime(timestamp);

  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', alignItems: 'flex-start' }}>
      <View style={{ maxWidth: '82%', alignItems: 'flex-end' }}>
        <View
          style={{
            backgroundColor: FIGMA_CHAT.brand,
            borderRadius: FIGMA_CHAT.bubbleRadius,
            padding: 12,
            gap: 4,
            ...FIGMA_CHAT.shadowSm,
          }}
        >
          <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_CHAT.textOnBrand }}>{content}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }}>
            <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_CHAT.textOnBrand }}>{time}</Text>
            <CheckCheck size={16} color={FIGMA_CHAT.textOnBrand} strokeWidth={2.2} />
          </View>
        </View>
      </View>
      <ChatUserAvatar initials={userInitials} uri={userAvatarUri} />
    </View>
  );
}

type AssistantProps = {
  icon: React.ComponentProps<typeof ChatAiAvatar>['icon'];
  timestamp?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function ChatBubbleAssistant({ icon, timestamp, children, footer }: AssistantProps) {
  const FIGMA_CHAT = useFigmaChat();
  const time = timestamp ? formatChatTime(timestamp) : '';

  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <ChatAiAvatar icon={icon} size="md" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            backgroundColor: FIGMA_CHAT.white,
            borderRadius: FIGMA_CHAT.bubbleRadius,
            borderWidth: 1,
            borderColor: FIGMA_CHAT.border,
            padding: 12,
            gap: 8,
            ...FIGMA_CHAT.shadowSm,
          }}
        >
          {children}
          {footer}
          {time ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }}>
              <Text style={{ fontSize: 12, lineHeight: 16, color: FIGMA_CHAT.textSecondary }}>{time}</Text>
              <CheckCheck size={16} color={FIGMA_CHAT.success} strokeWidth={2.2} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ChatTypingBubble({ icon }: { icon: React.ComponentProps<typeof ChatAiAvatar>['icon'] }) {
  const FIGMA_CHAT = useFigmaChat();
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <ChatAiAvatar icon={icon} size="md" />
      <View
        style={{
          backgroundColor: FIGMA_CHAT.white,
          borderRadius: FIGMA_CHAT.bubbleRadius,
          borderWidth: 1,
          borderColor: FIGMA_CHAT.border,
          paddingHorizontal: 16,
          paddingVertical: 14,
          ...FIGMA_CHAT.shadowSm,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: FIGMA_CHAT.textMuted,
                opacity: 0.45 + i * 0.2,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
