import React from 'react';
import { Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';

export function QuestMediLine({ text }: { text: string }) {
  const colors = useThemeColors();
  if (!text) return null;
  return (
    <View className="flex-row items-start" style={{ gap: 8 }}>
      <View style={{ marginTop: 2 }}>
        <Sparkles size={13} color={colors.primary200} strokeWidth={2.1} />
      </View>
      <Text className="flex-1 font-sans text-sm leading-5 text-text-200">{text}</Text>
    </View>
  );
}
