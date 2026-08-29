import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';

type Props = {
  label: string;
  checked: boolean;
  onToggle: () => void;
};

/** Figma checkbox — 4px radius teal fill when checked. Inline styles only. */
export function AuthCheckbox({ label, checked, onToggle }: Props) {
  const auth = useFigmaAuth();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          borderWidth: checked ? 0 : 1,
          borderColor: auth.inputBorder,
          backgroundColor: checked ? auth.primaryBg : auth.inputBg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
        }}
      >
        {checked ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
      <Text
        style={{
          marginLeft: 8,
          flex: 1,
          fontFamily: 'NotoSansGeorgian_500Medium',
          fontSize: 16,
          lineHeight: 22,
          color: auth.labelColor,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
