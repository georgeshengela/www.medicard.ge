import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Settings, type LucideIcon } from 'lucide-react-native';
import { ChatAiAvatar } from '@/components/chat/ChatAiAvatar';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';

type Props = {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  remainingLabel?: string;
  modelBadge?: string;
  onBack?: () => void;
  onSettings?: () => void;
};

/** Figma 11416:74415 — status bar + Chat Top Nav on one primary fill. */
export function ChatTopNav({
  title,
  subtitle,
  icon,
  remainingLabel,
  modelBadge = ka.chat.navModelBadge,
  onBack,
  onSettings,
}: Props) {
  const FIGMA_CHAT = useFigmaChat();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: FIGMA_CHAT.white,
        borderBottomWidth: 1,
        borderBottomColor: FIGMA_CHAT.border,
        paddingTop: insets.top,
        ...FIGMA_CHAT.shadowXs,
      }}
    >
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            hitSlop={12}
            style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={24} color={FIGMA_CHAT.textPrimary} strokeWidth={2} />
          </Pressable>
        ) : null}

        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <ChatAiAvatar icon={icon} size="lg" />

          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 16,
                  lineHeight: 22,
                  color: FIGMA_CHAT.textPrimary,
                }}
                numberOfLines={1}
              >
                {title}
              </Text>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                  backgroundColor: FIGMA_CHAT.successBg,
                  borderWidth: 1,
                  borderColor: FIGMA_CHAT.successBorder,
                  ...FIGMA_CHAT.shadowXs,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_500Medium',
                    fontSize: 12,
                    lineHeight: 16,
                    color: FIGMA_CHAT.success,
                  }}
                >
                  {modelBadge}
                </Text>
              </View>
            </View>
            {remainingLabel ? (
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 14,
                  lineHeight: 20,
                  color: FIGMA_CHAT.textSecondary,
                }}
                numberOfLines={1}
              >
                {remainingLabel}
              </Text>
            ) : subtitle ? (
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 14,
                  lineHeight: 20,
                  color: FIGMA_CHAT.textSecondary,
                }}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {onSettings ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSettings}
            hitSlop={8}
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              backgroundColor: FIGMA_CHAT.cardBg,
              borderWidth: 1,
              borderColor: FIGMA_CHAT.borderTertiary,
              alignItems: 'center',
              justifyContent: 'center',
              ...FIGMA_CHAT.shadowXs,
            }}
          >
            <Settings size={24} color={FIGMA_CHAT.textPrimary} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
