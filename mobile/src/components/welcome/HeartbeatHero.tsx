import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { ECG_BOX_H, ecgTrace } from '@/components/welcome/ecgTrace';
import { useFontsFamily } from '@/store/FontsContext';
import { velvetRaised, velvetWell, type VelvetPalette } from '@/theme/velvet';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Length of the lit pulse, its speed (pt/s) and the quiet stretch before the next one. */
const SEG = 64;
const SPEED = 270;
const GAP = 120;
const RIPPLE_S = 1.5;

type Props = {
  palette: VelvetPalette;
  dark: boolean;
  wordmark: string;
  reduceMotion: boolean;
};

/**
 * Welcome hero (owner's pick „C · გულისცემა“, 2026-10-11): a raised velvet disc holding the logo, a
 * heartbeat line carved into the material on both sides, and a pulse of light running along it. When the
 * pulse reaches the disc the disc beats twice (lub-dub), the logo lights up and a ring spreads out.
 * Everything runs on the UI thread from one clock.
 */
export function HeartbeatHero({ palette: p, dark, wordmark, reduceMotion }: Props) {
  const { width } = useWindowDimensions();
  const { brandBold } = useFontsFamily();
  const disc = Math.round(Math.min(200, width * 0.52));
  const well = Math.round(disc * 0.69);
  const logo = Math.round(disc * 0.38);
  const trace = useMemo(() => ecgTrace(width, disc), [width, disc]);
  const period = trace.length + SEG + GAP;
  const hit = trace.hit;

  // distance the pulse has travelled along the line in this round
  const s = useSharedValue(hit - 1);
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(s);
      s.value = hit - 1;
      return undefined;
    }
    s.value = 0;
    s.value = withRepeat(withTiming(period, { duration: (period / SPEED) * 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(s);
  }, [reduceMotion, period, hit, s]);

  const dash = useAnimatedProps(() => ({ strokeDashoffset: SEG - s.value }));

  const discStyle = useAnimatedStyle(() => {
    const since = (s.value - hit + period) % period / SPEED;
    const k = interpolate(since, [0, 0.1, 0.22, 0.33, 0.5], [1, 1.045, 0.995, 1.025, 1], Extrapolation.CLAMP);
    return { transform: [{ scale: k }] };
  });
  const rippleStyle = useAnimatedStyle(() => {
    const since = (s.value - hit + period) % period / SPEED;
    const t = Math.min(1, since / RIPPLE_S);
    return {
      opacity: reduceMotion ? 0 : interpolate(t, [0, 1], [0.55, 0]),
      transform: [{ scale: 1 + 0.75 * (1 - (1 - t) ** 3) }],
    };
  });
  const glowStyle = useAnimatedStyle(() => {
    const since = (s.value - hit + period) % period / SPEED;
    const flash = interpolate(since, [0, 0.12, 0.6], [0, 1, 0], Extrapolation.CLAMP);
    return { opacity: Math.min(1, (dark ? 0.55 : 0) + flash * 0.7) };
  });

  const halo = Math.round(logo * 1.9);

  return (
    <View style={{ width, alignItems: 'center' }}>
      <View style={{ width, height: disc, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={width} height={ECG_BOX_H} style={{ position: 'absolute', left: 0, top: disc / 2 - ECG_BOX_H / 2 }}>
          {/* the groove: shade above-left, light below-right, surface in the middle */}
          <G transform="translate(-1.2 -1.2)">
            <Path d={trace.d} fill="none" stroke={p.shade} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </G>
          <G transform="translate(1.2 1.2)">
            <Path d={trace.d} fill="none" stroke={p.light} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          </G>
          <Path d={trace.d} fill="none" stroke={p.surface} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
          {/* the pulse: a soft wide glow under a thin bright core */}
          <AnimatedPath
            d={trace.d}
            fill="none"
            stroke={p.pulse}
            strokeOpacity={0.22}
            strokeWidth={8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[SEG, trace.length + SEG]}
            animatedProps={dash}
          />
          <AnimatedPath
            d={trace.d}
            fill="none"
            stroke={p.pulse}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[SEG, trace.length + SEG]}
            animatedProps={dash}
          />
        </Svg>

        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', width: disc, height: disc, borderRadius: disc / 2, borderWidth: 2, borderColor: p.pulse },
            rippleStyle,
          ]}
        />

        <Animated.View
          style={[
            { width: disc, height: disc, borderRadius: disc / 2, backgroundColor: p.surface, boxShadow: velvetRaised(p) },
            discStyle,
          ]}
        >
          <LinearGradient
            colors={[p.discTop, p.surface]}
            locations={[0, 0.55]}
            start={{ x: 0.21, y: 0.09 }}
            end={{ x: 0.79, y: 0.91 }}
            style={[StyleSheet.absoluteFill, { borderRadius: disc / 2 }]}
          />
          <View
            style={{
              position: 'absolute',
              left: (disc - well) / 2,
              top: (disc - well) / 2,
              width: well,
              height: well,
              borderRadius: well / 2,
              backgroundColor: p.surface,
              boxShadow: velvetWell(p),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: halo, height: halo }, glowStyle]}>
              <Svg width={halo} height={halo}>
                <Defs>
                  <RadialGradient id="welcomeLogoGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={p.pulse} stopOpacity={0.45} />
                    <Stop offset="1" stopColor={p.pulse} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={halo / 2} cy={halo / 2} r={halo / 2} fill="url(#welcomeLogoGlow)" />
              </Svg>
            </Animated.View>
            <MedicardLogoMark size={logo} />
          </View>
        </Animated.View>
      </View>

      <View style={{ marginTop: 40 }}>
        {/* light catches the top-left edge of the letters, shade falls bottom-right: pressed into velvet */}
        <Text
          aria-hidden
          style={{ position: 'absolute', left: -1, top: -1, fontFamily: brandBold, fontSize: 38, lineHeight: 44, color: p.light }}
        >
          {wordmark}
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: brandBold,
            fontSize: 38,
            lineHeight: 44,
            color: p.wordmark,
            textShadowColor: p.shade,
            textShadowOffset: { width: 2, height: 2 },
            textShadowRadius: 3,
          }}
        >
          {wordmark}
        </Text>
      </View>
    </View>
  );
}
