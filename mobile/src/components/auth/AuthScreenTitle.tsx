import React from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/theme/colors';

type Props = {
  children: string;
};

/** Auth page heading — UI font (Noto), not brand MediFont. */
export function AuthScreenTitle({ children }: Props) {
  const colors = useThemeColors();

  return (
    <View className="mb-6 items-center pt-2">
      <Text
        className="text-center font-sans-bold text-[28px] leading-9"
        style={{ color: colors.text100 }}
      >
        {children}
      </Text>
    </View>
  );
}
