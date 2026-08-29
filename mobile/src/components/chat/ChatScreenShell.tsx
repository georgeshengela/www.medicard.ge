import React from 'react';
import { KeyboardAvoidingView, Platform, View, type ViewStyle } from 'react-native';
import { useFigmaChat } from '@/constants/figmaChatLayout';

type Props = {
  header: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Chat canvas. The header owns the top inset so the status bar and
 * AI details share one `bg/default/primary` fill (Figma 11416:74415).
 */
export function ChatScreenShell({ header, footer, children, style }: Props) {
  const FIGMA_CHAT = useFigmaChat();
  return (
    <View style={[{ flex: 1, backgroundColor: FIGMA_CHAT.cardBg }, style]}>
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >
        {children}
        {footer}
      </KeyboardAvoidingView>
    </View>
  );
}
