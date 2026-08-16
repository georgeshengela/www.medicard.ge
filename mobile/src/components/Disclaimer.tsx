import React from 'react';
import { Text, View } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

/** Mandatory safety notice shown on every module that produces clinical output. */
export function Disclaimer({ className = '' }: { className?: string }) {
  const colors = useThemeColors();

  return (
    <View className={`flex-row items-start rounded-2xl border border-state-warning/20 bg-state-warningBg p-3.5 ${className}`}>
      <ShieldAlert size={17} color={colors.warning} strokeWidth={2.2} />
      <Text className="ml-2.5 flex-1 text-sm leading-5 text-state-warning">{ka.app.disclaimer}</Text>
    </View>
  );
}
