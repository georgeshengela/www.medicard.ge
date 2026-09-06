import React, { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';
import { ka } from '@/i18n/ka';
import { PACE_KG, paceFromSlider, sliderFromPace } from '@/lib/weightGoal';
import type { WeightPace } from '@/types/weightGoal';

type Props = {
  pace: WeightPace;
  currentKg: number;
  recommended?: WeightPace;
  onChange: (pace: WeightPace) => void;
};

const TRACK_H = 36;
const TRACK_RADIUS = 16;
const THUMB = 48;
const THUMB_BORDER = 4;
const THUMB_OUTER = THUMB + THUMB_BORDER * 2;
const DOT = 10;
const STEPS: WeightPace[] = ['slow', 'moderate', 'fast'];

const LABELS: Record<WeightPace, string> = {
  slow: ka.weightGoal.paceSlow,
  moderate: ka.weightGoal.paceModerate,
  fast: ka.weightGoal.paceFast,
};

const HINTS: Record<WeightPace, string> = {
  slow: ka.weightGoal.paceSlowHint,
  moderate: ka.weightGoal.paceModerateHint,
  fast: ka.weightGoal.paceFastHint,
};

function GripIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      {[
        'M8.5 17.75C9.19036 17.75 9.75 18.3096 9.75 19C9.75 19.6904 9.19036 20.25 8.5 20.25C7.80964 20.25 7.25 19.6904 7.25 19C7.25 18.3096 7.25 17.75 8.5 17.75Z',
        'M15.5 17.75C16.1904 17.75 16.75 18.3096 16.75 19C16.75 19.6904 16.1904 20.25 15.5 20.25C14.8096 20.25 14.25 19.6904 14.25 19C14.25 18.3096 14.25 17.75 15.5 17.75Z',
        'M8.5 10.75C9.19036 10.75 9.75 11.3096 9.75 12C9.75 12.6904 9.19036 13.25 8.5 13.25C7.80964 13.25 7.25 12.6904 7.25 12C7.25 11.3096 7.25 10.75 8.5 10.75Z',
        'M15.5 10.75C16.1904 10.75 16.75 11.3096 16.75 12C16.75 12.6904 16.1904 13.25 15.5 13.25C14.8096 13.25 14.25 12.6904 14.25 12C14.25 11.3096 14.25 10.75 15.5 10.75Z',
        'M8.5 3.75C9.19036 3.75 9.75 4.30964 9.75 5C9.75 5.69036 9.19036 6.25 8.5 6.25C7.80964 6.25 7.25 5.69036 7.25 5C7.25 4.30964 7.25 3.75 8.5 3.75Z',
        'M15.5 3.75C16.1904 3.75 16.75 4.30964 16.75 5C16.75 5.69036 16.1904 6.25 15.5 6.25C14.8096 6.25 14.25 5.69036 14.25 5C14.25 4.30964 14.25 3.75 15.5 3.75Z',
      ].map((d) => (
        <Path key={d} d={d} fill="#FFFFFF" />
      ))}
    </Svg>
  );
}

export function WeightPaceSlider({ pace, currentKg, recommended, onChange }: Props) {
  const T = useFigmaWeight();
  const trackRef = useRef<View>(null);
  const widthRef = useRef(1);
  const originX = useRef(0);
  const paceRef = useRef(pace);
  const onChangeRef = useRef(onChange);
  const [width, setWidth] = useState(1);
  paceRef.current = pace;
  onChangeRef.current = onChange;

  const syncGeometry = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      originX.current = x;
      if (w > 0) {
        widthRef.current = w;
        setWidth(w);
      }
    });
  };

  const applyFromPageX = (pageX: number) => {
    const w = widthRef.current;
    if (w <= 0) return;
    const next = paceFromSlider(Math.max(0, Math.min(1, (pageX - originX.current) / w)));
    if (next === paceRef.current) return;
    pickerSelectionTick();
    onChangeRef.current(next);
  };

  const gesture = useMemo(
    () =>
      Gesture.Exclusive(
        Gesture.Pan()
          .runOnJS(true)
          .minDistance(0)
          .activeOffsetX([-2, 2])
          .failOffsetY([-24, 24])
          .onBegin((e) => {
            syncGeometry();
            applyFromPageX(e.absoluteX);
          })
          .onUpdate((e) => {
            applyFromPageX(e.absoluteX);
          }),
        Gesture.Tap()
          .runOnJS(true)
          .onEnd((e) => {
            syncGeometry();
            applyFromPageX(e.absoluteX);
          }),
      ),
    [],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width || 1;
    widthRef.current = next;
    setWidth(next);
    syncGeometry();
  };

  const fill = width * sliderFromPace(pace);
  const thumbLeft = Math.max(0, Math.min(width - THUMB_OUTER, fill - THUMB_OUTER / 2));
  const kg = PACE_KG[pace];
  const bw = currentKg > 0 ? ((kg / currentKg) * 100).toFixed(1) : '0.0';

  return (
    <View style={{ width: '100%', alignItems: 'center', gap: 20 }}>
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: T.brandSoft,
          borderWidth: 1,
          borderColor: T.brandBorder,
        }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: T.brand }}>
          {LABELS[pace]}
        </Text>
      </View>

      <GestureDetector gesture={gesture}>
        <View
          ref={trackRef}
          onLayout={onLayout}
          style={{ width: '100%', height: THUMB_OUTER, justifyContent: 'center' }}
          collapsable={false}
        >
          <View
            style={{
              height: TRACK_H,
              borderRadius: TRACK_RADIUS,
              backgroundColor: T.track,
              overflow: 'hidden',
            }}
          >
            <LinearGradient
              colors={['#5EEAD4', '#14B8A6', '#0D9488']}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: Math.max(TRACK_H, fill),
                borderRadius: TRACK_RADIUS,
              }}
            />
            {STEPS.map((step, index) => {
              const filled = sliderFromPace(pace) >= sliderFromPace(step);
              const cx = (width / 3) * index + width / 6 - DOT / 2;
              return (
                <View
                  key={step}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: cx,
                    top: (TRACK_H - DOT) / 2,
                    width: DOT,
                    height: DOT,
                    borderRadius: DOT / 2,
                    backgroundColor: filled ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)',
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
              left: thumbLeft,
              top: (THUMB_OUTER - THUMB) / 2 - THUMB_BORDER,
              width: THUMB_OUTER,
              height: THUMB_OUTER,
              borderRadius: THUMB_OUTER / 2,
              backgroundColor: T.brand,
              borderWidth: THUMB_BORDER,
              borderColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.14,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }}
          >
            <GripIcon />
          </View>
        </View>
      </GestureDetector>

      <View style={{ width: '100%', flexDirection: 'row' }}>
        {STEPS.map((step) => {
          const active = pace === step;
          const isRec = recommended === step;
          return (
            <View key={step} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  fontFamily: active ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_400Regular',
                  fontSize: 13,
                  lineHeight: 18,
                  color: active ? T.textPrimary : T.textTertiary,
                  textAlign: 'center',
                }}
              >
                {LABELS[step]}
              </Text>
              {isRec ? (
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10, color: T.brand, textAlign: 'center' }}>
                  {ka.weightGoal.paceRecommendedBadge}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: T.textPrimary, textAlign: 'center' }}>
        {HINTS[pace]}
      </Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 20, color: T.textSecondary, textAlign: 'center' }}>
        {ka.weightGoal.paceApprox(String(kg), bw)}
      </Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: T.textTertiary, textAlign: 'center' }}>
        {ka.assessment.dragSliderHint}
      </Text>
    </View>
  );
}
