import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { CompanionMoodKey, CompanionStage } from '@/lib/companion/api';
import { POSE_TRANSFORMS } from '@/lib/companion/cosmeticVisuals';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

const STAGE_SIZE: Record<CompanionStage, number> = {
  STAGE_1: 96,
  STAGE_2: 112,
  STAGE_3: 128,
  STAGE_4: 140,
  STAGE_5: 152,
  STAGE_6: 160,
  STAGE_7: 176,
};

type Props = {
  stage?: CompanionStage | string;
  moodKey?: CompanionMoodKey | string;
  reducedMotion?: boolean;
  size?: number;
  accentColor?: string;
  poseKey?: string | null;
  accessoryKey?: string | null;
  preview?: boolean;
  /** Pause idle loop when screen unfocused. */
  animate?: boolean;
  accessibilityLabel?: string | null;
};

/**
 * Soft teal Medi figure (robot-2 lineage) with composable accent / pose / accessory layers.
 */
export function MediCompanionFigure({
  stage = 'STAGE_1',
  moodKey = 'CALM',
  reducedMotion: reducedProp,
  size: sizeProp,
  accentColor,
  poseKey,
  accessoryKey,
  preview,
  animate = true,
  accessibilityLabel: a11yLabel,
}: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const prefersReduce = usePrefersReducedMotion();
  const reduce = Boolean(reducedProp ?? prefersReduce) || !animate || Boolean(preview);
  const stageKey = (STAGE_SIZE[stage as CompanionStage] ? stage : 'STAGE_1') as CompanionStage;
  const size = sizeProp ?? (preview ? 40 : STAGE_SIZE[stageKey]);
  const brand = accentColor || (dark ? colors.primary200 : QUEST.accent.medi);
  const bodyFill = dark ? QUEST.wash.dark : QUEST.wash.light;
  const ink = brand;
  const pose = poseKey && POSE_TRANSFORMS[poseKey] ? POSE_TRANSFORMS[poseKey] : null;

  const bounce = useSharedValue(0);
  // Capture pose/mood offsets on JS thread — do not call helpers inside worklets.
  const poseTranslateY = pose?.translateY || 0;
  const poseRotateDeg = (pose?.rotate || 0) + moodTilt(moodKey);

  useEffect(() => {
    if (reduce) {
      cancelAnimation(bounce);
      bounce.value = 0;
      return;
    }
    bounce.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(bounce);
    };
  }, [reduce, bounce]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bounce.value + poseTranslateY },
      { rotate: `${poseRotateDeg}deg` },
    ],
  }));

  const detail = stageDetail(stageKey);
  const eyeR = moodKey === 'EXCITED' || moodKey === 'PROUD' ? 1.15 : 1;
  const resting = moodKey === 'RESTING' || poseKey === 'pose.resting';

  const svg = (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {detail >= 2 ? <Circle cx={12} cy={12} r={10.2} fill={bodyFill} opacity={dark ? 0.55 : 0.7} /> : null}
      <G>
        {/* Arms stay static paths — pose is applied via Animated.View rotate/translate only
            (RN SVG Path/G transform strings previously crashed Choreographer). */}
        <Path
          d="M2 10.25C2.41421 10.25 2.75 10.5858 2.75 11V17C2.75 17.4142 2.41421 17.75 2 17.75C1.58579 17.75 1.25 17.4142 1.25 17V11C1.25 10.5858 1.58579 10.25 2 10.25Z"
          fill={ink}
          opacity={pose?.armLift === 'left' || pose?.armLift === 'both' ? 1 : 0.95}
        />
        <Path
          d="M22 10.25C22.4142 10.25 22.75 10.5858 22.75 11V17C22.75 17.4142 22.4142 17.75 22 17.75C21.5858 17.75 21.25 17.4142 21.25 17V11C21.25 10.5858 21.5858 10.25 22 10.25Z"
          fill={ink}
          opacity={pose?.armLift === 'right' || pose?.armLift === 'both' ? 1 : 0.95}
        />
        {/* Raised-arm cue without SVG rotation: small tip dots when waving/proud */}
        {pose?.armLift === 'right' || pose?.armLift === 'both' ? (
          <Circle cx={22} cy={8.6} r={0.7} fill={ink} opacity={0.85} />
        ) : null}
        {pose?.armLift === 'left' || pose?.armLift === 'both' ? (
          <Circle cx={2} cy={8.6} r={0.7} fill={ink} opacity={0.85} />
        ) : null}
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 4.25C16.2802 4.25 19.75 7.71979 19.75 12V19C19.75 19.4142 19.4142 19.75 19 19.75H5C4.58579 19.75 4.25 19.4142 4.25 19V12C4.25 7.71979 7.71979 4.25 12 4.25ZM14.9072 14.4453C14.8124 14.4833 14.7501 14.5747 14.75 14.6768V15C14.75 15.9665 13.9665 16.75 13 16.75H11C10.0335 16.75 9.25 15.9665 9.25 15V14.6768C9.24989 14.5747 9.18756 14.4833 9.09277 14.4453L5.75 13.1074V18.25H18.25V13.1074L14.9072 14.4453ZM12 5.75C8.71657 5.75 6.02627 8.28207 5.77148 11.5L9.65039 13.0518C10.3146 13.3175 10.7499 13.9614 10.75 14.6768V15C10.75 15.1381 10.8619 15.25 11 15.25H13C13.1381 15.25 13.25 15.1381 13.25 15V14.6768C13.2501 13.9614 13.6854 13.3175 14.3496 13.0518L18.2275 11.5C17.9727 8.2821 15.2834 5.75 12 5.75Z"
          fill={ink}
        />
        <Ellipse cx={12} cy={13.2} rx={2.2} ry={1.4} fill={ink} opacity={0.22} />
        {resting ? (
          <>
            <Path d="M8 10.15H10" stroke={dark ? colors.bg100 : '#FFFFFF'} strokeWidth={1.1} strokeLinecap="round" />
            <Path d="M14 10.15H16" stroke={dark ? colors.bg100 : '#FFFFFF'} strokeWidth={1.1} strokeLinecap="round" />
          </>
        ) : (
          <>
            <Circle cx={9} cy={10} r={eyeR} fill={dark ? colors.bg100 : '#FFFFFF'} />
            <Circle cx={15} cy={10} r={eyeR} fill={dark ? colors.bg100 : '#FFFFFF'} />
            <Circle cx={9.15} cy={9.85} r={0.35} fill={ink} />
            <Circle cx={15.15} cy={9.85} r={0.35} fill={ink} />
          </>
        )}
        {detail >= 3 ? (
          <>
            <Path d="M12 2.35V4.05" stroke={ink} strokeWidth={1.2} strokeLinecap="round" />
            <Circle cx={12} cy={2.05} r={0.85} fill={ink} />
          </>
        ) : null}
        <AccessoryOverlay accessoryKey={accessoryKey} ink={ink} dark={dark} />
      </G>
    </Svg>
  );

  if (preview) {
    return <View style={{ width: size, height: size, alignSelf: 'center' }}>{svg}</View>;
  }

  return (
    <Animated.View
      accessible={a11yLabel !== null}
      accessibilityLabel={a11yLabel === null ? undefined : a11yLabel || `Medi, ${stage}, ${moodKey}`}
      accessibilityRole="image"
      style={[{ width: size, height: size, alignSelf: 'center' }, floatStyle]}
    >
      {svg}
    </Animated.View>
  );
}

function AccessoryOverlay({
  accessoryKey,
  ink,
  dark,
}: {
  accessoryKey?: string | null;
  ink: string;
  dark: boolean;
}) {
  if (!accessoryKey) return null;
  const contrast = dark ? '#0B1220' : '#FFFFFF';
  switch (accessoryKey) {
    case 'accessory.pin':
      return (
        <G>
          <Circle cx={17.2} cy={7.2} r={1.35} fill={ink} />
          <Circle cx={17.2} cy={7.2} r={0.55} fill={contrast} />
        </G>
      );
    case 'accessory.visor':
      return (
        <Rect x={7.2} y={8.4} width={9.6} height={2.2} rx={1.1} fill={contrast} opacity={0.85} stroke={ink} strokeWidth={0.5} />
      );
    case 'accessory.scarf':
      return (
        <Path
          d="M6.2 15.2C8.5 16.6 10.2 17.1 12 17.1C13.8 17.1 15.5 16.6 17.8 15.2L16.8 18.4C14.8 17.6 13 17.3 12 17.3C11 17.3 9.2 17.6 7.2 18.4L6.2 15.2Z"
          fill={ink}
          opacity={0.85}
        />
      );
    case 'accessory.orbit':
      return <Ellipse cx={12} cy={12} rx={9.4} ry={4.2} stroke={ink} strokeWidth={0.7} fill="none" opacity={0.55} />;
    case 'accessory.badge':
      return (
        <G>
          <Rect x={10.2} y={15.4} width={3.6} height={2.4} rx={0.5} fill={contrast} stroke={ink} strokeWidth={0.45} />
          <Path d="M11 15.4V14.7H13V15.4" stroke={ink} strokeWidth={0.45} />
        </G>
      );
    default:
      return null;
  }
}

function stageDetail(stage: CompanionStage): number {
  const map: Record<CompanionStage, number> = {
    STAGE_1: 1,
    STAGE_2: 2,
    STAGE_3: 3,
    STAGE_4: 4,
    STAGE_5: 5,
    STAGE_6: 5,
    STAGE_7: 5,
  };
  return map[stage] || 1;
}

function moodTilt(mood: string): number {
  if (mood === 'WELCOME_BACK' || mood === 'CHEERFUL') return -2.5;
  if (mood === 'FOCUSED') return 1.5;
  if (mood === 'RESTING') return 2;
  return 0;
}
