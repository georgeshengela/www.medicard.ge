import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { ASSESSMENT, useAssessment } from '@/constants/assessmentLayout';
import { FIGMA_FRAME } from '@/constants/figmaWelcomeLayout';
import { bodyTypeImage } from '@/constants/illustrationAssets';
import { ka } from '@/i18n/ka';
import type { Gender } from '@/lib/api';

const SCREEN_W = Dimensions.get('window').width;
const SCALE = SCREEN_W / FIGMA_FRAME.width;
const FIGURE_W = ASSESSMENT.bodyFigureW * SCALE;
const FIGURE_H = ASSESSMENT.bodyFigureH * SCALE;
const GAP = ASSESSMENT.bodyFigureGap * SCALE;
const CARD_W = FIGURE_W + GAP;
const SIDE_PAD = (SCREEN_W - FIGURE_W) / 2;
const ICON = ASSESSMENT.swipeIcon;

/** Figma 9217:164506 — endomorph | ectomorph | mesomorph, selected stays centered. */
const BODY_TYPES = ['ENDOMORPH', 'ECTOMORPH', 'MESOMORPH'] as const;

type BodyType = (typeof BODY_TYPES)[number];

type Props = {
  gender: Gender | null;
  value: string | null;
  labelFor: (type: string) => string;
  onChange: (type: string) => void;
};

type ItemProps = {
  index: number;
  gender: Gender | null;
  type: BodyType;
  active: boolean;
  onPress: (index: number) => void;
};

/** Figma hand-swipe-right (20×20) — `assets/figma/icons/hand-swipe-right.svg`. */
function HandSwipeRightIcon({ size = ICON }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
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

function BodyFigure({ source }: { source: ImageSourcePropType | null }) {
  if (!source) return null;
  return (
    <Image
      source={source}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      style={{ width: FIGURE_W, height: FIGURE_H }}
    />
  );
}

function BodyTypeItem({ index, gender, type, active, onPress }: ItemProps) {
  const source = bodyTypeImage(gender, type, active);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => onPress(index)}
      style={{
        width: CARD_W,
        height: FIGURE_H,
        paddingRight: GAP,
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <View style={{ width: FIGURE_W, height: FIGURE_H, alignItems: 'center', justifyContent: 'center' }}>
        <BodyFigure source={source} />
      </View>
    </Pressable>
  );
}

/** Figma body type — three equal silhouettes, swipe/tap to select. */
export function BodyTypeCarousel({ gender, value, labelFor, onChange }: Props) {
  const ASSESSMENT = useAssessment();
  const scrollRef = useRef<ScrollView>(null);
  const initial = Math.max(0, BODY_TYPES.indexOf((value as BodyType) ?? 'ECTOMORPH'));
  const [centerIndex, setCenterIndex] = useState(initial);
  const labelOpacity = useSharedValue(1);
  const lastType = useRef<string | null>(value);

  const syncCenter = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(BODY_TYPES.length - 1, index));
      setCenterIndex(clamped);
      const type = BODY_TYPES[clamped];
      if (!type || type === lastType.current) return;
      lastType.current = type;
      pickerSelectionTick();
      labelOpacity.value = withTiming(0, { duration: 100 }, () => {
        labelOpacity.value = withTiming(1, { duration: 220 });
      });
      onChange(type);
    },
    [labelOpacity, onChange],
  );

  useEffect(() => {
    lastType.current = (value as BodyType) ?? 'ECTOMORPH';
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: initial * CARD_W, animated: false });
    });
    setCenterIndex(initial);
    // Snap once per gender — don't reset when the user picks a type.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial is derived from first value
  }, [gender]);

  const previewFromOffset = (offsetX: number) => {
    const next = Math.max(0, Math.min(BODY_TYPES.length - 1, Math.round(offsetX / CARD_W)));
    setCenterIndex(next);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    previewFromOffset(event.nativeEvent.contentOffset.x);
  };

  const scrollToIndex = (index: number, animated = true) => {
    scrollRef.current?.scrollTo({ x: index * CARD_W, animated });
    syncCenter(index);
  };

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
    transform: [{ translateY: interpolate(labelOpacity.value, [0, 1], [6, 0]) }],
  }));

  const activeType = BODY_TYPES[centerIndex] ?? 'ECTOMORPH';

  return (
    <View style={{ width: '100%', alignItems: 'center', paddingVertical: 32 }}>
      <View style={{ width: SCREEN_W, height: FIGURE_H, overflow: 'visible' }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_W}
          decelerationRate="fast"
          disableIntervalMomentum
          style={{ overflow: 'visible' }}
          contentContainerStyle={{
            paddingHorizontal: SIDE_PAD,
            alignItems: 'flex-end',
            minHeight: FIGURE_H,
          }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => syncCenter(Math.round(e.nativeEvent.contentOffset.x / CARD_W))}
          onScrollEndDrag={(e) => {
            if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.15) {
              syncCenter(Math.round(e.nativeEvent.contentOffset.x / CARD_W));
            }
          }}
        >
          {BODY_TYPES.map((type, index) => (
            <BodyTypeItem
              key={`${gender ?? 'male'}-${type}`}
              index={index}
              gender={gender}
              type={type}
              active={index === centerIndex}
              onPress={scrollToIndex}
            />
          ))}
        </ScrollView>
      </View>

      <View style={{ marginTop: 16, alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: ICON, height: ICON }}>
            <HandSwipeRightIcon />
          </View>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 14,
              lineHeight: 20,
              color: ASSESSMENT.textSecondary,
              textAlign: 'center',
            }}
          >
            {ka.assessment.swipeHint}
          </Text>
        </View>

        <Animated.Text
          style={[
            {
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 20,
              lineHeight: 28,
              letterSpacing: -0.25,
              color: ASSESSMENT.textPrimary,
              textAlign: 'center',
              paddingHorizontal: 8,
            },
            labelStyle,
          ]}
        >
          {ka.assessment.bodyTypeSelected(labelFor(activeType))}
        </Animated.Text>
      </View>
    </View>
  );
}
