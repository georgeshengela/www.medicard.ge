import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useFigmaHealthMetricsCarousel } from '@/constants/figmaHealthMetricsCarouselLayout';

type Props = {
  icon: LucideIcon;
  iconColor: string;
  iconBg?: string;
  value: string;
  unit?: string;
  label: string;
  onPress?: () => void;
};

export function HomeHealthMetricCarouselCard({
  icon: Icon,
  iconColor,
  iconBg,
  value,
  unit,
  label,
  onPress,
}: Props) {
  const C = useFigmaHealthMetricsCarousel();
  const body = (
    <View
      style={{
        width: C.cardWidth,
        minHeight: 140,
        backgroundColor: C.cardBg,
        borderRadius: C.cardRadius,
        borderWidth: 1,
        borderColor: C.cardBorder,
        padding: C.cardPadding,
        gap: C.cardGapInner,
        ...C.shadow,
      }}
    >
      <View
        style={{
          width: C.iconSize,
          height: C.iconSize,
          borderRadius: C.iconSize / 2,
          backgroundColor: iconBg ?? `${iconColor}12`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={22} color={iconColor} strokeWidth={2.2} />
      </View>

      <View style={{ gap: 4, marginTop: 'auto' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: C.valueSize,
              lineHeight: C.valueLine,
              letterSpacing: -0.25,
              color: C.textPrimary,
            }}
          >
            {value}
          </Text>
          {unit ? (
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_500Medium',
                fontSize: C.unitSize,
                lineHeight: 20,
                color: C.textSecondary,
                paddingBottom: 2,
              }}
            >
              {unit}
            </Text>
          ) : null}
        </View>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: C.labelSize,
            lineHeight: 20,
            color: C.textSecondary,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
      {body}
    </Pressable>
  );
}
