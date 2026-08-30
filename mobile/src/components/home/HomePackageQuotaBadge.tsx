import React, { useEffect, useId } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { usePlanUsage } from '@/lib/planUsage';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const HEIGHT = 40;
const RING = 30;
const STROKE = 2.75;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const CX = RING / 2;

type Props = {
  onPress?: () => void;
};

function tip(progress: number) {
  const rad = (-Math.PI / 2) + progress * Math.PI * 2;
  return { x: CX + R * Math.cos(rad), y: CX + R * Math.sin(rad) };
}

/** Frosted quota chip for the teal header — pairs with the 40px avatar. */
export function HomePackageQuotaBadge({ onPress }: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const { unlimited, remaining, limit, exhausted, usage, progress } = usePlanUsage();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const anim = useSharedValue(reduceMotion ? progress : 0);

  useEffect(() => {
    if (!usage) return;
    anim.value = reduceMotion
      ? progress
      : withTiming(progress, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [anim, progress, reduceMotion, usage]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - anim.value),
  }));

  if (!usage) return null;

  const valueLabel = unlimited ? '∞' : String(remaining ?? 0);
  const fill = exhausted ? '#FECDD3' : '#FFFFFF';
  const track = exhausted ? 'rgba(254,205,211,0.35)' : 'rgba(255,255,255,0.28)';
  const knob = tip(progress);
  const showKnob = !exhausted && !unlimited && progress > 0.04 && progress < 0.98;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        exhausted ? ka.usage.exhaustedTitle : unlimited ? ka.usage.unlimitedBanner : ka.usage.remainingQueries(remaining ?? 0, limit)
      }
      onPress={onPress}
      style={({ pressed }) => ({
        height: HEIGHT,
        borderRadius: HEIGHT / 2,
        overflow: 'hidden',
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <LinearGradient
        colors={
          exhausted
            ? ['rgba(255,241,242,0.34)', 'rgba(244,63,94,0.22)']
            : ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.12)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          height: HEIGHT,
          minWidth: 72,
          paddingLeft: 5,
          paddingRight: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          borderRadius: HEIGHT / 2,
          borderWidth: 1,
          borderColor: exhausted ? 'rgba(254,205,211,0.55)' : 'rgba(255,255,255,0.42)',
        }}
      >
        <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
            <Defs>
              <SvgGradient id={`quotaArc-${uid}`} x1="0" y1="0" x2={RING} y2={RING} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={fill} />
                <Stop offset="1" stopColor={exhausted ? '#FDA4AF' : '#99F6E4'} />
              </SvgGradient>
            </Defs>
            <Circle
              cx={CX}
              cy={CX}
              r={R}
              stroke={track}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={CX}
              cy={CX}
              r={R}
              stroke={fill}
              strokeWidth={7}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={CIRC * (1 - progress)}
              rotation={-90}
              origin={`${CX}, ${CX}`}
              opacity={0.18}
            />
            <AnimatedCircle
              cx={CX}
              cy={CX}
              r={R}
              stroke={`url(#quotaArc-${uid})`}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRC} ${CIRC}`}
              rotation={-90}
              origin={`${CX}, ${CX}`}
              animatedProps={animatedProps}
            />
            {showKnob ? (
              <>
                <Circle cx={knob.x} cy={knob.y} r={4} fill="rgba(255,255,255,0.35)" />
                <Circle cx={knob.x} cy={knob.y} r={2.2} fill="#FFFFFF" />
              </>
            ) : null}
          </Svg>
        </View>

        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: valueLabel.length > 2 ? 15 : 18,
            lineHeight: 22,
            color: '#FFFFFF',
            letterSpacing: -0.4,
          }}
        >
          {valueLabel}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
