import React from 'react';
import { Text, View } from 'react-native';

type Props = {
  children: string;
};

/** Auth page heading — UI font (Noto), not brand MediFont. */
export function AuthScreenTitle({ children }: Props) {
  return (
    <View className="mb-6 items-center pt-2">
      <Text className="text-center font-sans-bold text-[28px] leading-9 text-text-100">{children}</Text>
    </View>
  );
}
