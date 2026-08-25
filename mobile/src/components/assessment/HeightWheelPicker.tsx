import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { pickerScrollTick, pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { isLatinUnitLabel, unitLabelFontFamily } from '@/components/assessment/unitLabelFont';
import { ASSESSMENT } from '@/constants/assessmentLayout';
import { lightColors } from '@/theme/colors';

/** Figma 9217:164598 selected row — display-sm 96/104. Shrink on short screens. */
const SCREEN_H = Dimensions.get('window').height;
const ITEM_HEIGHT = Math.min(
  ASSESSMENT.displayNumberLineHeight,
  Math.max(64, Math.floor((SCREEN_H - 360) / 5)),
);
const VISIBLE_ROWS = 5;
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
export const HEIGHT_PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

const CM_MIN = 120;
const CM_MAX = 220;
const IN_MIN = 48;
const IN_MAX = 96;
const CM_PER_IN = 2.54;

export const HEIGHT_CM_VALUES = Array.from({ length: CM_MAX - CM_MIN + 1 }, (_, i) => CM_MIN + i);
export const HEIGHT_IN_VALUES = Array.from({ length: IN_MAX - IN_MIN + 1 }, (_, i) => IN_MIN + i);

export function cmToInches(cm: number) {
  return Math.round(cm / CM_PER_IN);
}

export function inchesToCm(inches: number) {
  return inches * CM_PER_IN;
}

export function formatHeightInches(inches: number) {
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(length - 1, index));
}

function nearestIndex(values: number[], target: number) {
  const exact = values.indexOf(target);
  if (exact >= 0) return exact;
  let best = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < values.length; i++) {
    const diff = Math.abs(values[i]! - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

function neighborStyle(distance: number) {
  if (distance === 1) {
    const size = Math.min(60, Math.round(ITEM_HEIGHT * 0.58));
    return {
      fontSize: size,
      color: ASSESSMENT.textSecondary,
      includeFontPadding: false,
    };
  }
  const size = Math.min(30, Math.round(ITEM_HEIGHT * 0.32));
  return {
    fontSize: size,
    color: '#9CA3AF',
    includeFontPadding: false,
  };
}

type Props = {
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
  formatLabel?: (value: number) => string;
};

/** Figma height wheel — 5 rows, 24pt teal pill, 96/60/30 type scale. */
export function HeightWheelPicker({ values, selected, onSelect, formatLabel = (v) => String(v) }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const dragging = useRef(false);
  const settling = useRef(false);
  const lastHapticIndex = useRef(-1);

  const selectedIndex = nearestIndex(values, selected);
  const [centerIndex, setCenterIndex] = useState(selectedIndex);

  const snapOffsets = useMemo(
    () => values.map((_, index) => index * ITEM_HEIGHT),
    [values],
  );

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated });
  }, []);

  useEffect(() => {
    if (dragging.current || settling.current) return;
    setCenterIndex(selectedIndex);
    lastHapticIndex.current = selectedIndex;
    requestAnimationFrame(() => {
      scrollToIndex(selectedIndex, false);
    });
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
      if (value !== undefined && value !== selected) onSelect(value);

      setTimeout(() => {
        settling.current = false;
      }, 280);
    },
    [onSelect, scrollToIndex, selected, values],
  );

  const activeValue = values[centerIndex];
  const activeLabel = activeValue === undefined ? '' : formatLabel(activeValue);
  const selectedSize = Math.min(ASSESSMENT.displayNumber, Math.round(ITEM_HEIGHT * 0.72));

  return (
    <View style={{ width: '100%', height: HEIGHT_PICKER_HEIGHT, position: 'relative' }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        contentContainerStyle={{ paddingVertical: PAD, backgroundColor: 'transparent' }}
        showsVerticalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        decelerationRate={Platform.OS === 'ios' ? 0.992 : 0.98}
        scrollEventThrottle={16}
        nestedScrollEnabled
        bounces={false}
        overScrollMode="never"
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
          const label = formatLabel(value);
          const type = neighborStyle(distance);

          return (
            <View
              key={`${value}-${index}`}
              style={{
                height: ITEM_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 16,
                opacity: active ? 0 : 1,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: isLatinUnitLabel(label)
                    ? unitLabelFontFamily(label, true)
                    : 'NotoSansGeorgian_600SemiBold',
                  fontWeight: isLatinUnitLabel(label) ? '600' : undefined,
                  textAlign: 'center',
                  ...type,
                }}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: PAD,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: lightColors.primary200,
          backgroundColor: '#F0FDFA',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: isLatinUnitLabel(activeLabel)
              ? unitLabelFontFamily(activeLabel, true)
              : 'NotoSansGeorgian_600SemiBold',
            fontWeight: isLatinUnitLabel(activeLabel) ? '600' : undefined,
            fontSize: selectedSize,
            letterSpacing: -2,
            color: lightColors.primary200,
            textAlign: 'center',
            includeFontPadding: false,
          }}
        >
          {activeLabel}
        </Text>
      </View>
    </View>
  );
}
