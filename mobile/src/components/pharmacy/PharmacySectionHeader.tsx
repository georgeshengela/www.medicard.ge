import React from 'react';
import { Text, View } from 'react-native';

type Props = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function PharmacySectionHeader({ title, subtitle, action }: Props) {
  return (
    <View className="mb-3 flex-row items-end justify-between">
      <View className="flex-1 pr-3">
        <Text className="text-[12px] font-bold uppercase tracking-[1.3px] text-primary-200">{title}</Text>
        {subtitle ? <Text className="mt-1 text-[13px] leading-[18px] text-text-300">{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}
