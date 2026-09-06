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
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { pickerScrollTick, pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { ASSESSMENT, useAssessment } from '@/constants/assessmentLayout';

const SCREEN_W = Dimensions.get('window').width;
const DEFAULT_TICK_W = 10;
const TICK_MINOR = ASSESSMENT.weightTickMinor;
const TICK_MAJOR = ASSESSMENT.weightTickMajor;
const RULER_H = ASSESSMENT.weightRulerH;
const NEEDLE_W = ASSESSMENT.weightNeedleW;
const NEEDLE_H = ASSESSMENT.weightNeedleH;
const NEEDLE_TOP = (RULER_H - NEEDLE_H) / 2;
const AXIS_Y = NEEDLE_TOP + NEEDLE_H / 2;
const LABEL_H = 16;
const LABEL_W = 36;
const LABEL_TOP = 144.5;

type Props = {
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
  labelEvery?: number;
  labelOrigin?: number;
  tickWidth?: number;
  labelFontSize?: number;
};

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

function shouldLabel(value: number, labelEvery: number, labelOrigin: number) {
  const step = (value - labelOrigin) / labelEvery;
  return Math.abs(step - Math.round(step)) < 1e-6;
}

function formatTickLabel(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function tickTop(height: number) {
  return AXIS_Y - height / 2;
}

/** Figma 9217:164581 needle — `assets/figma/icons/weight-needle.svg`. */
function WeightNeedle({ color }: { color: string }) {
  return (
    <Svg width={NEEDLE_W} height={NEEDLE_H} viewBox="0 0 4 141" fill="none">
      <Path d="M2 139V2" stroke={color} strokeWidth={4} strokeLinecap="round" />
    </Svg>
  );
}

/** Figma horizontal weight ruler — 10pt ticks, 72/36 bars, 137pt teal needle. */
export function WeightRulerPicker({
  values,
  selected,
  onSelect,
  labelEvery = 5,
  labelOrigin = 0,
  tickWidth = DEFAULT_TICK_W,
  labelFontSize = 12,
}: Props) {
  const ASSESSMENT = useAssessment();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const dragging = useRef(false);
  const settling = useRef(false);
  const lastHapticIndex = useRef(-1);
  const labelWidth = tickWidth === DEFAULT_TICK_W ? LABEL_W : Math.max(LABEL_W, tickWidth * 2);
  const sidePad = SCREEN_W / 2 - tickWidth / 2;

  const selectedIndex = nearestIndex(values, selected);
  const [centerIndex, setCenterIndex] = useState(selectedIndex);

  const snapOffsets = useMemo(
    () => values.map((_, index) => index * tickWidth),
    [tickWidth, values],
  );

  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    scrollRef.current?.scrollTo({ x: index * tickWidth, animated });
  }, [tickWidth]);

  useEffect(() => {
    if (dragging.current || settling.current) return;
    setCenterIndex(selectedIndex);
    lastHapticIndex.current = selectedIndex;
    requestAnimationFrame(() => {
      scrollToIndex(selectedIndex, false);
    });
  }, [scrollToIndex, selectedIndex]);

  const fireHaptic = useCallback((index: number) => {
    if (index === lastHapticIndex.current) return;
    lastHapticIndex.current = index;
    if (dragging.current) pickerScrollTick();
    else pickerSelectionTick();
  }, []);

  const settleAtOffset = useCallback(
    (offsetX: number) => {
      if (settling.current) return;
      settling.current = true;
      dragging.current = false;

      const index = clampIndex(Math.round(offsetX / tickWidth), values.length);
      scrollToIndex(index, true);
      setCenterIndex(index);
      fireHaptic(index);

      const value = values[index];
      if (value !== undefined && value !== selected) onSelect(value);

      setTimeout(() => {
        settling.current = false;
      }, 280);
    },
    [fireHaptic, onSelect, scrollToIndex, selected, tickWidth, values],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = clampIndex(Math.round(e.nativeEvent.contentOffset.x / tickWidth), values.length);
    if (index !== centerIndex) setCenterIndex(index);
    if (dragging.current) fireHaptic(index);
  };

  return (
    <View
      collapsable={false}
      style={{ width: '100%', height: RULER_H, maxHeight: RULER_H, overflow: 'hidden', flexGrow: 0, flexShrink: 0 }}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(20,184,166,0.4)', 'rgba(20,184,166,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: 'absolute',
          top: tickTop(TICK_MINOR),
          left: 0,
          width: SCREEN_W / 2,
          height: TICK_MINOR,
          zIndex: 2,
        }}
      />

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: NEEDLE_TOP,
          left: SCREEN_W / 2 - NEEDLE_W / 2,
          width: NEEDLE_W,
          height: NEEDLE_H,
          zIndex: 10,
        }}
      >
        <WeightNeedle color={ASSESSMENT.brand} />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        style={{ height: RULER_H, width: '100%' }}
        contentContainerStyle={{ alignItems: 'flex-start' }}
        showsHorizontalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.9}
        scrollEventThrottle={16}
        nestedScrollEnabled
        directionalLockEnabled
        disableIntervalMomentum
        bounces={false}
        overScrollMode="never"
        onScrollBeginDrag={() => {
          dragging.current = true;
          settling.current = false;
        }}
        onScroll={onScroll}
        onMomentumScrollEnd={(e) => settleAtOffset(e.nativeEvent.contentOffset.x)}
        onScrollEndDrag={(e) => {
          const velocity = e.nativeEvent.velocity?.x ?? 0;
          if (Math.abs(velocity) < 0.12) settleAtOffset(e.nativeEvent.contentOffset.x);
        }}
      >
        <View style={{ width: sidePad }} />

        {values.map((value, index) => {
          const active = index === centerIndex;
          const labeled = shouldLabel(value, labelEvery, labelOrigin);
          const barH = labeled ? TICK_MAJOR : TICK_MINOR;

          return (
            <View
              key={`${value}-${index}`}
              style={{
                width: tickWidth,
                height: RULER_H,
                alignItems: 'center',
              }}
            >
              {active ? null : (
                <View
                  style={{
                    position: 'absolute',
                    top: tickTop(barH),
                    width: labeled ? 2 : 1,
                    height: barH,
                    borderRadius: 1,
                    backgroundColor: labeled ? ASSESSMENT.textSecondary : ASSESSMENT.faint,
                  }}
                />
              )}

              {labeled && !active ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: LABEL_TOP,
                    left: (tickWidth - labelWidth) / 2,
                    width: labelWidth,
                    height: LABEL_H,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: 'NotoSansGeorgian_400Regular',
                      fontSize: labelFontSize,
                      lineHeight: 16,
                      color: ASSESSMENT.textPrimary,
                      textAlign: 'center',
                    }}
                  >
                    {formatTickLabel(value)}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={{ width: sidePad }} />
      </ScrollView>
    </View>
  );
}
