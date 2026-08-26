import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { FIGMA_HEALTH_METRICS_CAROUSEL as C } from '@/constants/figmaHealthMetricsCarouselLayout';

type Props = {
  label: string;
  onPress: () => void;
};

export function HomeHealthMetricAddCard({ label, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
    >
      <View
        style={{
          width: C.cardWidth,
          minHeight: 140,
          backgroundColor: '#FFFFFF',
          borderRadius: C.cardRadius,
          borderWidth: 1.5,
          borderColor: C.brand,
          borderStyle: 'dashed',
          padding: C.cardPadding,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: `${C.brand}14`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={22} color={C.brand} strokeWidth={2.4} />
        </View>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 13,
            lineHeight: 18,
            color: C.brand,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
