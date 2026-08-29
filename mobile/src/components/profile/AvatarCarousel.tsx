import React, { useCallback, useEffect, useRef } from 'react';
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
import Svg, { Path } from 'react-native-svg';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { AVATAR_IDS, AVATAR_SOURCES, type AvatarId } from '@/constants/avatarAssets';
import { FIGMA_FRAME } from '@/constants/figmaWelcomeLayout';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedImage = Animated.createAnimatedComponent(Image);

const SCREEN_W = Dimensions.get('window').width;
const SCALE = SCREEN_W / FIGMA_FRAME.width;
const SIZE_CENTER = 128 * SCALE;
const SIZE_NEAR = 72 * SCALE;
const SIZE_FAR = 48 * SCALE;
const GAP = 16 * SCALE;
const ITEM_W = SIZE_CENTER / 2 + GAP + SIZE_NEAR / 2;
const SIDE_PAD = (SCREEN_W - ITEM_W) / 2;
const ARROW = 32 * SCALE;

type Props = {
  value: AvatarId;
  onChange: (id: AvatarId) => void;
  avatarIds?: readonly AvatarId[];
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

function ArrowUpIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M16.0003 29C15.4482 29 15.0003 28.5523 15.0003 28V15.6667H5.33366C4.92936 15.6665 4.56391 15.423 4.40918 15.0495C4.25458 14.676 4.34086 14.2458 4.62663 13.9598L15.2933 3.293C15.4807 3.10554 15.7353 3.00008 16.0003 3C16.2654 3.00008 16.5198 3.10554 16.7074 3.293L27.374 13.9598C27.66 14.2458 27.7462 14.676 27.5915 15.0495C27.4367 15.423 27.374 15.6665 26.667 15.6667H17.0003V28C17.0003 28.5523 16.5526 29 16.0003 29Z"
        fill="#14B8A6"
      />
    </Svg>
  );
}

function AvatarFace({
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
  const colors = useThemeColors();
  const faceBg = colors.surfaceRaised;
  const idleBorder = colors.bg300;
  const containerStyle = useAnimatedStyle(() => {
    const dist = Math.abs(index - scrollX.value / ITEM_W);
    const size = interpolate(dist, [0, 1, 2], [SIZE_CENTER, SIZE_NEAR, SIZE_FAR], Extrapolation.CLAMP);
    const border = interpolate(dist, [0, 0.5], [4, 1], Extrapolation.CLAMP);
    const opacity = interpolate(dist, [0, 1, 2], [1, 0.55, 0.35], Extrapolation.CLAMP);
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: border,
      borderColor: dist < 0.35 ? '#14B8A6' : idleBorder,
      opacity,
      overflow: 'hidden' as const,
      backgroundColor: faceBg,
    };
  });

  const imageStyle = useAnimatedStyle(() => {
    const dist = Math.abs(index - scrollX.value / ITEM_W);
    const pad = interpolate(dist, [0, 1, 2], [8, 6, 4], Extrapolation.CLAMP);
    return {
      width: '100%' as const,
      height: '100%' as const,
      padding: pad,
    };
  });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(index)}
      style={{
        width: ITEM_W,
        height: SIZE_CENTER + 8,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View style={containerStyle}>
        <AnimatedImage source={source} resizeMode="contain" style={imageStyle} />
      </Animated.View>
    </Pressable>
  );
}

/** Figma 8845:308753 — horizontal avatar picker with scaled center focus. */
export function AvatarCarousel({ value, onChange, avatarIds = AVATAR_IDS }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);
  const ids = avatarIds.length ? avatarIds : AVATAR_IDS;
  const lastIndex = useRef(Math.max(0, ids.indexOf(value)));

  const selectedIndex = Math.max(0, ids.indexOf(value));

  useEffect(() => {
    const index = ids.indexOf(value);
    if (index < 0) return;
    lastIndex.current = index;
    scrollX.value = index * ITEM_W;
    scrollRef.current?.scrollTo({ x: index * ITEM_W, animated: false });
  }, [scrollX, value, ids]);

  const commitIndex = useCallback(
    (index: number) => {
      const id = ids[index];
      if (!id || id === value) return;
      if (index !== lastIndex.current) {
        lastIndex.current = index;
        pickerSelectionTick();
      }
      onChange(id);
    },
    [ids, onChange, value],
  );

  const settle = useCallback(
    (offsetX: number) => {
      const index = Math.max(0, Math.min(ids.length - 1, Math.round(offsetX / ITEM_W)));
      scrollRef.current?.scrollTo({ x: index * ITEM_W, animated: true });
      runOnJS(commitIndex)(index);
    },
    [commitIndex, ids.length],
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  return (
    <View style={{ width: '100%', alignItems: 'center', gap: 24, paddingVertical: 16 }}>
      <ArrowDownIcon size={ARROW} />
      <AnimatedScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_W}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SIDE_PAD, alignItems: 'center' }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
        onScrollEndDrag={(e) => {
          if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.08) {
            settle(e.nativeEvent.contentOffset.x);
          }
        }}
      >
        {ids.map((id, index) => (
          <AvatarFace
            key={id}
            index={index}
            source={AVATAR_SOURCES[id]}
            scrollX={scrollX}
            onPress={(i) => {
              scrollRef.current?.scrollTo({ x: i * ITEM_W, animated: true });
              commitIndex(i);
            }}
          />
        ))}
      </AnimatedScrollView>
      <ArrowUpIcon size={ARROW} />
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 24,
          lineHeight: 32,
          letterSpacing: -0.25,
          color: '#4B5563',
          textAlign: 'center',
        }}
      >
        {ka.profileSetup.avatarCounter(selectedIndex + 1, ids.length)}
      </Text>
    </View>
  );
}
