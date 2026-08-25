import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { ASSESSMENT } from '@/constants/assessmentLayout';
import { FIGMA_FRAME } from '@/constants/figmaWelcomeLayout';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedImage = Animated.createAnimatedComponent(Image);

const SCREEN_W = Dimensions.get('window').width;
const SCALE = SCREEN_W / FIGMA_FRAME.width;
const SIZE_CENTER = 148 * SCALE;
const SIZE_NEAR = 80 * SCALE;
const SIZE_FAR = 48 * SCALE;
const GAP = 8 * SCALE;
const ITEM_W = SIZE_CENTER / 2 + GAP + SIZE_NEAR / 2;
const SIDE_PAD = (SCREEN_W - ITEM_W) / 2;
const ARROW = 32 * SCALE;
const COL_GAP = 24 * SCALE;
const RINGS = [388, 294, 206] as const;

type MoodItem = { key: string; image: ImageSourcePropType; label: string };

type Props = {
  items: MoodItem[];
  value: string | null;
  onChange: (key: string) => void;
};

function ArrowDownIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M16.0003 3C16.5526 3 17.0003 3.44772 17.0003 4V16.3333H26.667C27.0714 16.3333 27.4367 16.5769 27.5915 16.9505C27.7462 17.3242 27.66 17.7544 27.374 18.0404L16.7074 28.707C16.5198 28.8944 16.2654 29 16.0003 29C15.7353 28.9999 15.4807 28.8945 15.2933 28.707L4.62663 18.0404C4.34086 17.7544 4.25458 17.324 4.40918 16.9505C4.56391 16.577 4.92936 16.3335 5.33366 16.3333H15.0003V4C15.0003 3.44786 15.4482 3.00023 16.0003 3Z"
        fill="#14B8A6"
      />
    </Svg>
  );
}

function GlowRing({ size }: { size: number }) {
  const id = `moodRing${Math.round(size)}`;
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#14B8A6" stopOpacity={0.12} />
          <Stop offset="1" stopColor="#14B8A6" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - 0.5}
        fill={`url(#${id})`}
        stroke="#FFFFFF"
      />
    </Svg>
  );
}

function MoodFace({
  index,
  source,
  scrollX,
  onPress,
}: {
  index: number;
  source: ImageSourcePropType;
  scrollX: SharedValue<number>;
  onPress: (index: number) => void;
}) {
  const imageStyle = useAnimatedStyle(() => {
    const dist = Math.abs(index - scrollX.value / ITEM_W);
    const size = interpolate(dist, [0, 1, 2], [SIZE_CENTER, SIZE_NEAR, SIZE_FAR], Extrapolation.CLAMP);
    const elevation = interpolate(dist, [0, 1], [1, 0], Extrapolation.CLAMP);
    return {
      width: size,
      height: size,
      shadowColor: '#000',
      shadowOpacity: elevation * 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 12 },
      elevation: elevation * 8,
    };
  });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(index)}
      style={{
        width: ITEM_W,
        height: SIZE_CENTER,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
      }}
    >
      <AnimatedImage source={source} resizeMode="contain" style={imageStyle} />
    </Pressable>
  );
}

/** Figma 9217:164703 — 148/80/48 face carousel, teal arrow, glow rings. */
export function MoodCarousel({ items, value, onChange }: Props) {
  const scrollRef = useRef<Animated.ScrollView>(null);
  const initial = Math.max(0, items.findIndex((item) => item.key === value));
  const [centerIndex, setCenterIndex] = useState(initial);
  const scrollX = useSharedValue(initial * ITEM_W);

  const syncCenter = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      setCenterIndex(clamped);
      const item = items[clamped];
      if (item && item.key !== value) {
        pickerSelectionTick();
        onChange(item.key);
      }
    },
    [items, onChange, value],
  );

  useEffect(() => {
    const x = initial * ITEM_W;
    scrollX.value = x;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x, animated: false });
    });
    setCenterIndex(initial);
  }, [initial, scrollX]);

  const previewIndex = useCallback((offsetX: number) => {
    const next = Math.max(0, Math.min(items.length - 1, Math.round(offsetX / ITEM_W)));
    setCenterIndex(next);
  }, [items.length]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
      runOnJS(previewIndex)(event.contentOffset.x);
    },
  });

  const scrollToIndex = (index: number, animated = true) => {
    scrollRef.current?.scrollTo({ x: index * ITEM_W, animated });
    syncCenter(index);
  };

  const active = items[centerIndex] ?? items[0];
  const faceTop = ARROW + COL_GAP;
  const stageH = faceTop + SIZE_CENTER;

  return (
    <View style={{ width: '100%', alignItems: 'center', paddingVertical: 24, gap: COL_GAP }}>
      <View style={{ width: SCREEN_W, height: stageH, overflow: 'visible' }}>
        {RINGS.map((frame) => {
          const size = frame * SCALE;
          return (
            <View
              key={frame}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: (SCREEN_W - size) / 2,
                top: faceTop + SIZE_CENTER / 2 - size / 2,
              }}
            >
              <GlowRing size={size} />
            </View>
          );
        })}

        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ width: ARROW, height: ARROW }}>
            <ArrowDownIcon size={ARROW} />
          </View>
        </View>

        <AnimatedScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_W}
          decelerationRate="fast"
          disableIntervalMomentum
          style={{ position: 'absolute', top: faceTop, left: 0, right: 0, height: SIZE_CENTER, overflow: 'visible' }}
          contentContainerStyle={{
            paddingHorizontal: SIDE_PAD,
            alignItems: 'center',
            height: SIZE_CENTER,
          }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => syncCenter(Math.round(e.nativeEvent.contentOffset.x / ITEM_W))}
          onScrollEndDrag={(e) => {
            if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.15) {
              syncCenter(Math.round(e.nativeEvent.contentOffset.x / ITEM_W));
            }
          }}
        >
          {items.map((item, index) => (
            <MoodFace
              key={item.key}
              index={index}
              source={item.image}
              scrollX={scrollX}
              onPress={scrollToIndex}
            />
          ))}
        </AnimatedScrollView>
      </View>

      {active ? (
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 24,
            lineHeight: 32,
            letterSpacing: -0.25,
            color: ASSESSMENT.textSecondary,
            textAlign: 'center',
            paddingHorizontal: 16,
          }}
        >
          {active.label}
        </Text>
      ) : null}
    </View>
  );
}
