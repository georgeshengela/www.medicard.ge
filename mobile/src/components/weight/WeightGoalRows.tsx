import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Bell, Calendar, ChevronRight, Scale } from 'lucide-react-native';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';

export function WeightInfoRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
}: {
  icon: 'scale' | 'calendar' | 'bell';
  title: string;
  subtitle: string;
  value: string;
  onPress?: () => void;
}) {
  const T = useFigmaWeight();
  const Icon = icon === 'scale' ? Scale : icon === 'calendar' ? Calendar : Bell;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: T.border,
        backgroundColor: T.cardBg,
        ...T.shadowXs,
      }}
    >
      <Icon size={32} color={T.brand} strokeWidth={1.8} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
          {title}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: T.textSecondary }}>
          {subtitle}
        </Text>
      </View>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: T.textSecondary }}>
        {value}
      </Text>
      {onPress ? <ChevronRight size={24} color={T.textTertiary} strokeWidth={2} /> : null}
    </Pressable>
  );
}
