import React from 'react';
import { Image, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { FIGMA_CHAT } from '@/constants/figmaChatLayout';

type AiProps = {
  icon: LucideIcon;
  size?: 'md' | 'lg';
};

export function ChatAiAvatar({ icon: Icon, size = 'md' }: AiProps) {
  const pad = size === 'lg' ? 8 : 8;
  const iconSize = size === 'lg' ? FIGMA_CHAT.navIconSize : FIGMA_CHAT.bubbleIconSize;

  return (
    <View
      style={{
        padding: pad,
        borderRadius: 999,
        backgroundColor: FIGMA_CHAT.brandQuaternary,
        borderWidth: 1,
        borderColor: FIGMA_CHAT.brandBorderLight,
      }}
    >
      <Icon size={iconSize} color={FIGMA_CHAT.brand} strokeWidth={2} />
    </View>
  );
}

type UserProps = {
  initials?: string;
  uri?: string | null;
};

export function ChatUserAvatar({ initials = 'M', uri }: UserProps) {
  return (
    <View style={{ width: FIGMA_CHAT.userAvatarSize, height: FIGMA_CHAT.userAvatarSize }}>
      <View
        style={{
          width: FIGMA_CHAT.userAvatarSize,
          height: FIGMA_CHAT.userAvatarSize,
          borderRadius: 999,
          backgroundColor: FIGMA_CHAT.cardBg,
          borderWidth: 1,
          borderColor: FIGMA_CHAT.border,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {uri ? (
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={{ fontSize: 14, fontWeight: '700', color: FIGMA_CHAT.textSecondary }}>{initials}</Text>
        )}
      </View>
      <View
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: FIGMA_CHAT.success,
          borderWidth: 1.5,
          borderColor: FIGMA_CHAT.white,
        }}
      />
    </View>
  );
}
