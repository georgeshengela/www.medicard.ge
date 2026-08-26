import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, Settings, type LucideIcon } from 'lucide-react-native';
import { FIGMA_CHAT } from '@/constants/figmaChatLayout';
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

export function ChatTopNav({
  title,
  subtitle,
  icon: Icon,
  remainingLabel,
  modelBadge = ka.chat.navModelBadge,
  onBack,
  onSettings,
}: Props) {
  return (
    <View
      style={{
        backgroundColor: FIGMA_CHAT.white,
        borderBottomWidth: 1,
        borderBottomColor: FIGMA_CHAT.border,
        ...FIGMA_CHAT.shadowXs,
      }}
    >
      <View
        style={{
          minHeight: 72,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={24} color={FIGMA_CHAT.textPrimary} strokeWidth={2} />
          </Pressable>
        ) : null}

        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            backgroundColor: FIGMA_CHAT.brandQuaternary,
            borderWidth: 1,
            borderColor: FIGMA_CHAT.brandBorderLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={28} color={FIGMA_CHAT.brand} strokeWidth={2} />
        </View>

        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text
              style={{ fontSize: 16, lineHeight: 22, fontWeight: '600', color: FIGMA_CHAT.textPrimary }}
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
              }}
            >
              <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '500', color: FIGMA_CHAT.success }}>{modelBadge}</Text>
            </View>
          </View>
          {remainingLabel ? (
            <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_CHAT.textSecondary }} numberOfLines={1}>
              {remainingLabel}
            </Text>
          ) : subtitle ? (
            <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_CHAT.textSecondary }} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {onSettings ? (
          <Pressable
            onPress={onSettings}
            hitSlop={12}
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
