import React from 'react';
import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';

type Props = {
  checked: boolean;
  size?: number;
};

export function SymptomCheckbox({ checked, size = 20 }: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        borderWidth: checked ? 0 : 1,
        borderColor: T.borderTertiary,
        backgroundColor: checked ? T.brand : T.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Check size={12} color={T.white} strokeWidth={3} /> : null}
    </View>
  );
}
