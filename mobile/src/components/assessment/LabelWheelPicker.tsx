import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { pickerScrollTick, pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { useAssessment } from '@/constants/assessmentLayout';

const ITEM_HEIGHT = 56;
const VISIBLE_ROWS = 5;
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
export const LABEL_WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

type Props = {
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
  formatLabel: (value: string) => string;
};

function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(length - 1, index));
}

function nearestIndex(values: string[], target: string) {
  const exact = values.indexOf(target);
  if (exact >= 0) return exact;
  return 0;
}

/** Full-width wheel for Georgian option labels (checkup frequency). */
export function LabelWheelPicker({ values, selected, onSelect, formatLabel }: Props) {
  const ASSESSMENT = useAssessment();
  const scrollRef = useRef<ScrollView>(null);
  const dragging = useRef(false);
  const settling = useRef(false);
  const lastHapticIndex = useRef(-1);

  const selectedIndex = nearestIndex(values, selected);
  const [centerIndex, setCenterIndex] = useState(selectedIndex);

  const snapOffsets = useMemo(() => values.map((_, index) => index * ITEM_HEIGHT), [values]);

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated });
  }, []);

  useEffect(() => {
    if (dragging.current || settling.current) return;
    setCenterIndex(selectedIndex);
    lastHapticIndex.current = selectedIndex;
    requestAnimationFrame(() => scrollToIndex(selectedIndex, false));
  }, [scrollToIndex, selectedIndex]);

  const settleAtOffset = useCallback(
    (offsetY: number) => {
      if (settling.current) return;
      settling.current = true;
      dragging.current = false;
      const index = clampIndex(Math.round(offsetY / ITEM_HEIGHT), values.length);
      scrollToIndex(index, true);
      setCenterIndex(index);
      if (index !== lastHapticIndex.current) {
        lastHapticIndex.current = index;
        pickerSelectionTick();
      }
      const value = values[index];
      if (value && value !== selected) onSelect(value);
      setTimeout(() => {
        settling.current = false;
      }, 280);
    },
    [onSelect, scrollToIndex, selected, values],
  );

  return (
    <View style={{ width: '100%', height: LABEL_WHEEL_HEIGHT, position: 'relative' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: PAD,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: ASSESSMENT.brand,
          backgroundColor: ASSESSMENT.tint,
          zIndex: 0,
        }}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, zIndex: 1 }}
        contentContainerStyle={{ paddingVertical: PAD }}
        showsVerticalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        decelerationRate={Platform.OS === 'ios' ? 0.992 : 0.98}
        scrollEventThrottle={16}
        nestedScrollEnabled
        bounces={false}
        onScrollBeginDrag={() => {
          dragging.current = true;
          settling.current = false;
        }}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const index = clampIndex(Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT), values.length);
          if (index !== centerIndex) setCenterIndex(index);
          if (dragging.current && index !== lastHapticIndex.current) {
            lastHapticIndex.current = index;
            pickerScrollTick();
          }
        }}
        onMomentumScrollEnd={(e) => settleAtOffset(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => {
          if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.08) settleAtOffset(e.nativeEvent.contentOffset.y);
        }}
      >
        {values.map((value, index) => {
          const active = index === centerIndex;
          const distance = Math.abs(index - centerIndex);
          const fontSize = active ? 20 : distance === 1 ? 16 : 14;
          const opacity = active ? 1 : Math.max(0.25, 0.7 - distance * 0.2);
          return (
            <View key={value} style={{ height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
              <Text
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{
                  fontFamily: active ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_400Regular',
                  fontSize,
                  lineHeight: fontSize + 6,
                  color: active ? ASSESSMENT.brandInk : ASSESSMENT.muted,
                  opacity,
                  textAlign: 'center',
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
