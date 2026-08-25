import React, { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { ASSESSMENT } from '@/constants/assessmentLayout';
import { ka } from '@/i18n/ka';

const TRACK_H = 36;
const TRACK_RADIUS = 16;
const THUMB = 48;
const THUMB_BORDER = 4;
const THUMB_OUTER = THUMB + THUMB_BORDER * 2;
const DOT = 10;
const STEPS = 5;

const THUMB_COLORS = ['#F43F5E', '#F59E0B', '#EAB308', '#22C55E', '#22C55E'] as const;
const GRIP_PATHS = [
  'M8.5 17.75C9.19036 17.75 9.75 18.3096 9.75 19C9.75 19.6904 9.19036 20.25 8.5 20.25C7.80964 20.25 7.25 19.6904 7.25 19C7.25 18.3096 7.80964 17.75 8.5 17.75Z',
  'M15.5 17.75C16.1904 17.75 16.75 18.3096 16.75 19C16.75 19.6904 16.1904 20.25 15.5 20.25C14.8096 20.25 14.25 19.6904 14.25 19C14.25 18.3096 14.8096 17.75 15.5 17.75Z',
  'M8.5 10.75C9.19036 10.75 9.75 11.3096 9.75 12C9.75 12.6904 9.19036 13.25 8.5 13.25C7.80964 13.25 7.25 12.6904 7.25 12C7.25 11.3096 7.80964 10.75 8.5 10.75Z',
  'M15.5 10.75C16.1904 10.75 16.75 11.3096 16.75 12C16.75 12.6904 16.1904 13.25 15.5 13.25C14.8096 13.25 14.25 12.6904 14.25 12C14.25 11.3096 14.8096 10.75 15.5 10.75Z',
  'M8.5 3.75C9.19036 3.75 9.75 4.30964 9.75 5C9.75 5.69036 9.19036 6.25 8.5 6.25C7.80964 6.25 7.25 5.69036 7.25 5C7.25 4.30964 7.80964 3.75 8.5 3.75Z',
  'M15.5 3.75C16.1904 3.75 16.75 4.30964 16.75 5C16.75 5.69036 16.1904 6.25 15.5 6.25C14.8096 6.25 14.25 5.69036 14.25 5C14.25 4.30964 14.8096 3.75 15.5 3.75Z',
];

type Props = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  labelForValue: (value: number) => string;
  hint?: string;
};

function GripIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {GRIP_PATHS.map((d) => (
        <Path key={d} d={d} fill="#FFFFFF" />
      ))}
    </Svg>
  );
}

function HandSwipeIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M5.8334 1.87494C6.17858 1.87494 6.4584 2.15476 6.4584 2.49994V13.3333C6.45838 13.5605 6.33484 13.77 6.13614 13.8801C5.93749 13.9901 5.69473 13.9834 5.50218 13.8631L3.1682 12.4047C3.00128 12.3004 2.80969 12.2599 2.62458 12.2794L6.15404 16.6918C6.66798 17.3342 7.44643 17.7082 8.26911 17.7083H12.5001C13.9958 17.7083 15.2084 16.4957 15.2084 14.9999V9.1666C15.2084 8.82146 15.4883 8.54167 15.8334 8.5416C16.1786 8.5416 16.4584 8.82142 16.4584 9.1666V14.9999C16.4584 17.186 14.6862 18.9583 12.5001 18.9583H8.26911C7.0667 18.9582 5.92863 18.412 5.17748 17.4731L1.17845 12.4739C0.979556 12.2252 0.999734 11.8666 1.22484 11.6414C1.91837 10.9478 2.99888 10.8246 3.83063 11.3443L5.2084 12.2053V2.49994C5.2084 2.1548 5.48828 1.875 5.8334 1.87494Z"
        fill="#9CA3AF"
      />
      <Path
        d="M9.16673 5.20827C9.51191 5.20827 9.79173 5.48809 9.79173 5.83327V11.6666C9.79171 12.0118 9.5119 12.2916 9.16673 12.2916C8.82163 12.2915 8.54176 12.0117 8.54173 11.6666V5.83327C8.54173 5.48813 8.82161 5.20833 9.16673 5.20827Z"
        fill="#9CA3AF"
      />
      <Path
        d="M12.5001 6.87494C12.8452 6.87494 13.1251 7.15476 13.1251 7.49994V11.6666C13.125 12.0118 12.8452 12.2916 12.5001 12.2916C12.155 12.2915 11.8751 12.0117 11.8751 11.6666V7.49994C11.8751 7.1548 12.1549 6.875 12.5001 6.87494Z"
        fill="#9CA3AF"
      />
      <Path
        d="M16.2248 1.22471C16.4689 0.980641 16.8645 0.980664 17.1086 1.22471L19.6086 3.72471C19.8527 3.96879 19.8527 4.36442 19.6086 4.6085L17.1086 7.1085C16.8645 7.35249 16.4689 7.35255 16.2248 7.1085C15.9808 6.86444 15.9809 6.46878 16.2248 6.22471L17.6579 4.7916H12.5001C12.155 4.79154 11.8751 4.51172 11.8751 4.1666C11.8751 3.82146 12.1549 3.54167 12.5001 3.5416H17.6579L16.2248 2.1085C15.9808 1.86444 15.9809 1.46878 16.2248 1.22471Z"
        fill="#9CA3AF"
      />
    </Svg>
  );
}

/** Figma 9217:164626 — 36pt gradient track, green level badge, drag thumb. */
export function FitnessLevelSlider({
  value,
  min = 1,
  max = 5,
  onChange,
  labelForValue,
  hint,
}: Props) {
  const [trackW, setTrackW] = useState(0);
  const trackWRef = useRef(0);
  const lastValue = useRef(value);
  const steps = max - min + 1;

  const setFromX = (x: number) => {
    const w = trackWRef.current;
    if (w <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / w));
    const next = Math.round(ratio * (steps - 1)) + min;
    if (next !== lastValue.current) {
      lastValue.current = next;
      pickerSelectionTick();
      onChange(next);
    }
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
      }),
    [min, onChange, steps],
  );

  lastValue.current = value;

  const segmentW = trackW > 0 ? trackW / steps : 0;
  const fillW = segmentW * (value - min + 1);
  const thumbLeft = segmentW > 0 ? (value - min) * segmentW + segmentW / 2 - THUMB_OUTER / 2 : 0;
  const thumbColor = THUMB_COLORS[value - min] ?? THUMB_COLORS[0];

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWRef.current = w;
    setTrackW(w);
  };

  return (
    <View style={{ width: '100%', alignItems: 'center', paddingVertical: 24, gap: 32 }}>
      <View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: '#F0FDF4',
          borderWidth: 1,
          borderColor: '#BBF7D0',
        }}
      >
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_500Medium',
            fontSize: 14,
            lineHeight: 20,
            color: '#22C55E',
          }}
        >
          {ka.assessment.levelBadge(value)}
        </Text>
      </View>

      <View
        style={{ width: '100%', height: THUMB_OUTER, justifyContent: 'center' }}
        onLayout={onTrackLayout}
        {...pan.panHandlers}
      >
        <View
          style={{
            height: TRACK_H,
            borderRadius: TRACK_RADIUS,
            backgroundColor: '#FFFFFF',
            overflow: 'hidden',
            shadowColor: '#0F172A',
            shadowOpacity: 0.05,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }}
        >
          <LinearGradient
            colors={['#F43F5E', '#F59E0B', '#10B981']}
            locations={[0, 0.515, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: Math.max(TRACK_H, fillW),
              borderRadius: TRACK_RADIUS,
            }}
          />

          {Array.from({ length: steps }, (_, i) => {
            const filled = i < value;
            const cx = segmentW * i + segmentW / 2 - DOT / 2;
            return (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: cx,
                  top: (TRACK_H - DOT) / 2,
                  width: DOT,
                  height: DOT,
                  borderRadius: DOT / 2,
                  backgroundColor: filled ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
                  borderWidth: filled ? 1 : 0,
                  borderColor: '#FFFFFF',
                }}
              />
            );
          })}
        </View>

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: Math.max(0, Math.min(trackW - THUMB_OUTER, thumbLeft)),
            top: (THUMB_OUTER - THUMB) / 2 - THUMB_BORDER,
            width: THUMB_OUTER,
            height: THUMB_OUTER,
            borderRadius: THUMB_OUTER / 2,
            backgroundColor: thumbColor,
            borderWidth: THUMB_BORDER,
            borderColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          }}
        >
          <View style={{ width: 24, height: 24 }}>
            <GripIcon />
          </View>
        </View>
      </View>

      <View style={{ width: '100%', alignItems: 'center', gap: 16 }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 36,
            lineHeight: 44,
            letterSpacing: -0.5,
            color: ASSESSMENT.textPrimary,
            textAlign: 'center',
          }}
        >
          {labelForValue(value)}
        </Text>
        {hint ? (
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 16,
              lineHeight: 22,
              color: ASSESSMENT.textPrimary,
              textAlign: 'center',
            }}
          >
            {hint}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 20, height: 20 }}>
          <HandSwipeIcon />
        </View>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 14,
            lineHeight: 20,
            color: ASSESSMENT.textSecondary,
          }}
        >
          {ka.assessment.dragSliderHint}
        </Text>
      </View>
    </View>
  );
}
