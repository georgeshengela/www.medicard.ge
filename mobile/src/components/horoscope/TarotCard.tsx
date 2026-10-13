import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { tx } from '@/i18n/locale';
import { GlyphAt } from './AstroGlyph';
import { BRASS, IVORY } from './SkyWheel';
import { SERIF } from './HoroUI';

type Card = { roman: string; name: string; glyph: string };

function Face({ card, w, h }: { card: Card; w: number; h: number }) {
  const r = w * 0.3;
  return (
    <View style={{ width: w, height: h, borderRadius: 14, overflow: 'hidden' }}>
      <LinearGradient colors={['#0A1030', '#1B2A66']} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={StyleSheet.absoluteFill} />
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Rect x={6} y={6} width={w - 12} height={h - 12} rx={10} fill="none" stroke="rgba(233,199,126,0.6)" strokeWidth={1} />
        <Rect x={10} y={10} width={w - 20} height={h - 20} rx={8} fill="none" stroke="rgba(233,199,126,0.22)" strokeWidth={0.8} />
        <SvgText x={w / 2} y={h * 0.15} fontSize={w * 0.12} fill={BRASS} textAnchor="middle" fontFamily={SERIF}>{card.roman}</SvgText>
        <Circle cx={w / 2} cy={h * 0.48} r={r} fill="rgba(233,199,126,0.06)" stroke="rgba(233,199,126,0.35)" strokeWidth={1} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return <Line key={i} x1={w / 2 + Math.cos(a) * r * 1.08} y1={h * 0.48 + Math.sin(a) * r * 1.08} x2={w / 2 + Math.cos(a) * r * 1.22} y2={h * 0.48 + Math.sin(a) * r * 1.22} stroke="rgba(233,199,126,0.45)" strokeWidth={1} />;
        })}
        <GlyphAt name={card.glyph} x={w / 2} y={h * 0.48} size={r * 1.15} color={IVORY} />
        <SvgText x={w / 2} y={h * 0.87} fontSize={w * 0.1} fill={IVORY} textAnchor="middle" fontFamily={SERIF}>{card.name}</SvgText>
      </Svg>
    </View>
  );
}

function Back({ w, h }: { w: number; h: number }) {
  return (
    <View style={{ width: w, height: h, borderRadius: 14, overflow: 'hidden' }}>
      <LinearGradient colors={['#141B48', '#0A1030']} style={StyleSheet.absoluteFill} />
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Rect x={6} y={6} width={w - 12} height={h - 12} rx={10} fill="none" stroke="rgba(233,199,126,0.55)" strokeWidth={1} />
        {[0.2, 0.32, 0.44].map((k) => <Circle key={k} cx={w / 2} cy={h / 2} r={w * k} fill="none" stroke="rgba(233,199,126,0.2)" strokeWidth={0.8} />)}
        <GlyphAt name="moon" x={w / 2} y={h / 2} size={w * 0.28} color={BRASS} />
        {[[0.18, 0.16], [0.82, 0.2], [0.24, 0.84], [0.78, 0.8], [0.5, 0.1], [0.5, 0.9]].map(([x, y], i) => <Circle key={i} cx={w * x} cy={h * y} r={1.4} fill={IVORY} opacity={0.7} />)}
      </Svg>
    </View>
  );
}

/**
 * A tarot card that turns over (Y-axis flip) after `delay` ms, or on tap while still face down. Reduced motion
 * shows the face at once.
 */
export function TarotCard({ card, width = 128, delay = 400, onReveal }: { card: Card; width?: number; delay?: number; onReveal?: () => void }) {
  const h = Math.round(width * 1.62);
  const reduced = usePrefersReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) { p.value = 1; return; }
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
    const t = setTimeout(() => onReveal?.(), delay + 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.roman, reduced]);
  const front = useAnimatedStyle(() => ({
    opacity: p.value > 0.5 ? 1 : 0,
    transform: [{ perspective: 800 }, { rotateY: `${interpolate(p.value, [0, 1], [180, 360])}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    opacity: p.value > 0.5 ? 0 : 1,
    transform: [{ perspective: 800 }, { rotateY: `${interpolate(p.value, [0, 1], [0, 180])}deg` }],
  }));
  return (
    <Pressable accessibilityRole="image" accessibilityLabel={tx(`ტაროს კარტი: ${card.roman} ${card.name}`, `Tarot card: ${card.roman} ${card.name}`)}
      onPress={() => { if (p.value < 1) p.value = withTiming(1, { duration: 600 }); }} style={{ width, height: h }}>
      <Animated.View style={[{ position: 'absolute', backfaceVisibility: 'hidden' }, back]}><Back w={width} h={h} /></Animated.View>
      <Animated.View style={[{ position: 'absolute', backfaceVisibility: 'hidden' }, front]}><Face card={card} w={width} h={h} /></Animated.View>
    </Pressable>
  );
}
