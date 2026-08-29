import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, Camera, Mic } from 'lucide-react-native';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder?: string;
  onMicPress?: () => void;
  onCameraPress?: () => void;
  multiline?: boolean;
};

export function ChatInputBar({
  value,
  onChangeText,
  onSend,
  sending = false,
  placeholder = ka.chat.writeMessage,
  onMicPress,
  onCameraPress,
  multiline = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const FIGMA_CHAT = useFigmaChat();
  const canSend = value.trim().length >= 2 && !sending;

  return (
    <View
      style={{
        backgroundColor: FIGMA_CHAT.white,
        borderTopWidth: 1,
        borderTopColor: FIGMA_CHAT.border,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: FIGMA_CHAT.white,
            borderWidth: 1,
            borderColor: FIGMA_CHAT.border,
            borderRadius: FIGMA_CHAT.inputRadius,
            paddingLeft: 16,
            paddingRight: 4,
            paddingVertical: 4,
            minHeight: 48,
            ...FIGMA_CHAT.shadowXs,
          }}
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={FIGMA_CHAT.textSecondary}
            multiline={multiline}
            style={{
              flex: 1,
              fontSize: 14,
              lineHeight: 20,
              color: FIGMA_CHAT.textPrimary,
              maxHeight: 96,
              paddingVertical: 8,
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: FIGMA_CHAT.brandQuaternary,
              borderWidth: 1,
              borderColor: FIGMA_CHAT.brandBorderLight,
              borderRadius: 999,
            }}
          >
            <Pressable onPress={onMicPress} hitSlop={8} style={{ padding: 8 }}>
              <Mic size={24} color={FIGMA_CHAT.brand} strokeWidth={2} />
            </Pressable>
            <Pressable onPress={onCameraPress} hitSlop={8} style={{ padding: 8 }}>
              <Camera size={24} color={FIGMA_CHAT.brand} strokeWidth={2} />
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={{
            width: FIGMA_CHAT.sendBtnSize,
            height: FIGMA_CHAT.sendBtnSize,
            borderRadius: 999,
            backgroundColor: canSend ? FIGMA_CHAT.inverse : `${FIGMA_CHAT.inverse}55`,
            alignItems: 'center',
            justifyContent: 'center',
            ...FIGMA_CHAT.shadowXs,
          }}
        >
          <ArrowUp size={24} color={FIGMA_CHAT.onInverse} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}
