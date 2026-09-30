import React from 'react';
import { Image, Text, View, type ImageSourcePropType } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useFigmaChat } from '@/constants/figmaChatLayout';

type AiProps = {
  icon: LucideIcon;
  size?: 'md' | 'lg';
  /** 3D artwork rendered inside the avatar circle instead of the icon. */
  art?: ImageSourcePropType;
};

export function ChatAiAvatar({ icon: Icon, size = 'md', art }: AiProps) {
  const FIGMA_CHAT = useFigmaChat();
  const box = size === 'lg' ? 48 : 40;
  const iconSize = size === 'lg' ? FIGMA_CHAT.navIconSize : FIGMA_CHAT.bubbleIconSize;

  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: 999,
        backgroundColor: FIGMA_CHAT.brandQuaternary,
        borderWidth: 1,
        borderColor: FIGMA_CHAT.brandBorderLight,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {art ? (
        <Image
          source={art}
          resizeMode="contain"
          accessible={false}
          accessibilityIgnoresInvertColors
          style={{ width: box - 6, height: box - 6 }}
        />
      ) : (
        <Icon size={iconSize} color={FIGMA_CHAT.brand} strokeWidth={2} />
      )}
    </View>
  );
}

type UserProps = {
  initials?: string;
  uri?: string | null;
};

export function ChatUserAvatar({ initials = 'M', uri }: UserProps) {
  const FIGMA_CHAT = useFigmaChat();
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
