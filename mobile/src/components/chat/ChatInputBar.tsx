import React from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, Camera, Mic } from 'lucide-react-native';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { CHAT_MESSAGE_LIMIT } from '@/lib/analysisFlow';
import { useChatKeyboardOpen } from './ChatScreenShell';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onMicPress?: () => void;
  onCameraPress?: () => void;
  multiline?: boolean;
  showTools?: boolean;
};

export function ChatInputBar({
  value,
  onChangeText,
  onSend,
  sending = false,
  disabled = false,
  placeholder = ka.chat.writeMessage,
  onMicPress,
  onCameraPress,
  multiline = true,
  showTools = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const FIGMA_CHAT = useFigmaChat();
  const keyboardOpen = useChatKeyboardOpen();
  const canSend = value.trim().length >= 2 && value.trim().length <= CHAT_MESSAGE_LIMIT && !sending && !disabled;

  return (
    <View
      style={{
        backgroundColor: FIGMA_CHAT.white,
        borderTopWidth: 1,
        borderTopColor: FIGMA_CHAT.border,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 8),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: FIGMA_CHAT.white,
            borderWidth: 1,
            borderColor: FIGMA_CHAT.border,
            borderRadius: 22,
            paddingLeft: 16,
            paddingRight: 4,
            paddingVertical: 4,
            minHeight: 48,
          }}
        >
          <TextInput
            accessibilityLabel={placeholder}
            maxLength={CHAT_MESSAGE_LIMIT}
            editable={!disabled}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={FIGMA_CHAT.textSecondary}
            multiline={multiline}
            style={{
              flex: 1,
              fontSize: 14,
              fontFamily: 'NotoSansGeorgian_400Regular',
              lineHeight: 20,
              color: FIGMA_CHAT.textPrimary,
              maxHeight: 96,
              paddingVertical: 8,
            }}
          />
            {showTools && (onMicPress || onCameraPress) ? (
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
              {onMicPress ? <Pressable accessibilityRole="button" accessibilityLabel="ხმოვანი შეტყობინება" onPress={onMicPress} style={{ padding: 10 }}>
                <Mic size={24} color={FIGMA_CHAT.brand} strokeWidth={2} />
              </Pressable> : null}
              {onCameraPress ? <Pressable accessibilityRole="button" accessibilityLabel={ka.upload.fromCamera} onPress={onCameraPress} style={{ padding: 10 }}>
                <Camera size={24} color={FIGMA_CHAT.brand} strokeWidth={2} />
              </Pressable> : null}
            </View>
            ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sending ? 'Medi პასუხს ამზადებს' : 'შეტყობინების გაგზავნა'}
          accessibilityState={{ disabled: !canSend, busy: sending }}
          onPress={onSend}
          disabled={!canSend}
          style={{
            width: FIGMA_CHAT.sendBtnSize,
            height: FIGMA_CHAT.sendBtnSize,
            borderRadius: 999,
            backgroundColor: canSend || sending ? '#0D9488' : FIGMA_CHAT.border,
            alignItems: 'center',
            justifyContent: 'center',
            ...FIGMA_CHAT.shadowXs,
          }}
        >
          {sending ? <ActivityIndicator color="#FFFFFF" /> : <ArrowUp size={24} color={canSend ? '#FFFFFF' : FIGMA_CHAT.textSecondary} strokeWidth={2.4} />}
        </Pressable>
      </View>
    </View>
  );
}
