import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { lightColors } from '@/theme/colors';

type Props = {
  values: (string | number)[];
  selected: string | number;
  onSelect: (value: string | number) => void;
  formatLabel?: (value: string | number) => string;
  itemHeight?: number;
  width?: number;
  variant?: 'default' | 'hero';
};

const BRAND = {
  primary: lightColors.primary100,
  primaryBright: lightColors.primary200,
  accent: lightColors.accent100,
  text: lightColors.text100,
  muted: lightColors.text300,
};

function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(length - 1, index));
}

/** iOS-style snap wheel — selection band sits *behind* labels (never washes them out). */
export function WheelPicker({
  values,
  selected,
  onSelect,
  formatLabel = (v) => String(v),
  itemHeight = 56,
  width = 240,
  variant = 'default',
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const dragging = useRef(false);
  const settling = useRef(false);
  const selectedIndex = clampIndex(Math.max(0, values.indexOf(selected)), values.length);
  const [centerIndex, setCenterIndex] = useState(selectedIndex);

  const visibleRows = 5;
  const pad = itemHeight * Math.floor(visibleRows / 2);
  const height = itemHeight * visibleRows;
  const isHero = variant === 'hero';

  useEffect(() => {
    if (dragging.current || settling.current) return;
    setCenterIndex(selectedIndex);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * itemHeight, animated: false });
    });
  }, [selectedIndex, itemHeight]);

  const settleAtOffset = useCallback(
    (offsetY: number) => {
      settling.current = true;
      dragging.current = false;
      const index = clampIndex(Math.round(offsetY / itemHeight), values.length);
      const targetY = index * itemHeight;

      scrollRef.current?.scrollTo({ y: targetY, animated: true });
      setCenterIndex(index);

      const value = values[index];
      if (value !== selected) onSelect(value);

      setTimeout(() => {
        settling.current = false;
      }, 280);
    },
    [itemHeight, onSelect, selected, values],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clampIndex(Math.round(e.nativeEvent.contentOffset.y / itemHeight), values.length);
    if (index !== centerIndex) setCenterIndex(index);
  };

  const activeSize = isHero ? 38 : 24;
  const idleSize = isHero ? 17 : 16;

  return (
    <View style={{ height, width, overflow: 'hidden', backgroundColor: 'transparent' }}>
      {/* Selection pill — behind scroll content */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: pad,
          left: 12,
          right: 12,
          height: itemHeight,
          borderRadius: isHero ? 999 : 14,
          backgroundColor: isHero ? BRAND.accent : 'rgba(20, 184, 166, 0.1)',
          borderWidth: isHero ? 2 : 1,
          borderColor: isHero ? BRAND.primaryBright : 'rgba(20, 184, 166, 0.35)',
          zIndex: 0,
        }}
      />

      <ScrollView
        ref={scrollRef}
        style={{ zIndex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={{ paddingVertical: pad, backgroundColor: 'transparent' }}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        snapToAlignment="start"
        decelerationRate={Platform.OS === 'ios' ? 0.992 : 0.98}
        scrollEventThrottle={16}
        nestedScrollEnabled
        bounces={false}
        overScrollMode="never"
        onScrollBeginDrag={() => {
          dragging.current = true;
        }}
        onScroll={onScroll}
        onMomentumScrollEnd={(e) => settleAtOffset(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => {
          const velocity = e.nativeEvent.velocity?.y ?? 0;
          if (Math.abs(velocity) < 0.05) {
            settleAtOffset(e.nativeEvent.contentOffset.y);
          }
        }}
      >
        {values.map((value, index) => {
          const active = index === centerIndex;
          const distance = Math.abs(index - centerIndex);
          const fade = isHero
            ? Math.max(0.12, 1 - distance * 0.42)
            : Math.max(0.25, 1 - distance * 0.32);

          return (
            <View
              key={String(value)}
              style={{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text
                style={{
                  fontFamily: active ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_400Regular',
                  fontWeight: active ? '700' : '400',
                  fontSize: active ? activeSize : idleSize,
                  lineHeight: active ? activeSize + 10 : idleSize + 8,
                  color: active ? (isHero ? BRAND.primary : BRAND.primaryBright) : BRAND.muted,
                  opacity: active ? 1 : fade * 0.55,
                  letterSpacing: active && isHero ? 0.2 : 0,
                }}
              >
                {formatLabel(value)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
