import React, { useEffect, useState } from 'react';
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
  streaming?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function ChatBubbleAssistant({ icon, timestamp, streaming, children, footer }: AssistantProps) {
  const FIGMA_CHAT = useFigmaChat();
  const time = !streaming && timestamp ? formatChatTime(timestamp) : '';

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
          {streaming ? <ChatStreamCursor /> : null}
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
    <ChatBubbleAssistant icon={icon} streaming>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 16 }}>
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
    </ChatBubbleAssistant>
  );
}

function ChatStreamCursor() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((value) => !value), 530);
    return () => clearInterval(id);
  }, []);
  return (
    <View
      style={{
        width: 7,
        height: 16,
        borderRadius: 1.5,
        marginTop: 2,
        backgroundColor: '#0D9488',
        opacity: on ? 1 : 0.18,
      }}
    />
  );
}
