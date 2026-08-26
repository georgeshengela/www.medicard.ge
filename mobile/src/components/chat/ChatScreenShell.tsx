import React from 'react';
import { KeyboardAvoidingView, Platform, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FIGMA_CHAT } from '@/constants/figmaChatLayout';

type Props = {
  header: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
};

/** Full-screen chat chrome with proper iOS safe area (Dynamic Island / notch). */
export function ChatScreenShell({ header, footer, children, style }: Props) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[{ flex: 1, backgroundColor: FIGMA_CHAT.cardBg }, style]}>
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >
        {children}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
