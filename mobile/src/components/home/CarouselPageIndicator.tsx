import React from 'react';
import { View } from 'react-native';
import { FIGMA_HEALTH_METRICS_CAROUSEL as C } from '@/constants/figmaHealthMetricsCarouselLayout';

type Props = {
  count: number;
  activeIndex: number;
};

export function CarouselPageIndicator({ count, activeIndex }: Props) {
  if (count <= 1) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 }}>
      {Array.from({ length: count }, (_, i) => {
        const active = i === activeIndex;
        return (
          <View
            key={i}
            style={{
              height: C.dotHeight,
              width: active ? C.dotActiveWidth : C.dotInactiveWidth,
              borderRadius: 999,
              backgroundColor: active ? C.dotActive : C.dotInactive,
            }}
          />
        );
      })}
    </View>
  );
}
