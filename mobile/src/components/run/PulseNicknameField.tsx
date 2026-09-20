import React from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { useThemeColors } from '@/theme/colors';
import { BOLD, Copy } from './PulseUi';

export function PulseNicknameField({ value, onChange, placeholder, disabled = false }: { value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean }) {
  const c = useThemeColors();
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Copy bold size={14} style={{ flex: 1 }}>შენი მეტსახელი</Copy><Copy muted size={11}>{value.length}/30</Copy></View>
    <TextInput
      accessibilityLabel="სახელი ლიდერბორდში"
      value={value}
      onChangeText={onChange}
      editable={!disabled}
      maxLength={30}
      placeholder={placeholder || 'შენი სახელი'}
      placeholderTextColor={c.text300}
      selectionColor={c.primary100}
      autoCorrect={false}
      autoCapitalize="none"
      returnKeyType="done"
      submitBehavior="blurAndSubmit"
      onSubmitEditing={() => Keyboard.dismiss()}
      style={{ minHeight: 52, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: c.bg300, backgroundColor: c.surface, color: c.text100, fontFamily: BOLD, fontSize: 16 }}
    />
  </View>;
}
