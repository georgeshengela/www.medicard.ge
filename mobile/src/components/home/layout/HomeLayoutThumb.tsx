import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { GOAL_ART, QUEST_ART } from '@/constants/appArt';
import type { HomeLayoutId } from '@/lib/home/homeLayout';
import { homeAccentFor } from '@/theme/homeAccent';
import { useIsDark, useThemeColors } from '@/theme/colors';

const ART = { women: GOAL_ART.cycle, active: QUEST_ART.movement, weight: GOAL_ART.nutrition, standard: GOAL_ART.general } as const;

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  };
  return `M ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`;
}

function Glyph({ layout, ink, track }: { layout: HomeLayoutId; ink: string; track: string }) {
  if (layout === 'women') {
    const arcs: [number, number, string][] = [[3, 62, '#C92A55'], [70, 135, '#F0AE84'], [143, 215, '#2DB7AE'], [223, 355, '#9C83C9']];
    return (
      <Svg width={30} height={30} viewBox="0 0 34 34">
        {arcs.map(([a, b, col]) => (
          <Path key={a} d={arc(17, 17, 13, a, b)} stroke={col} strokeWidth={5} fill="none" strokeLinecap="round" />
        ))}
      </Svg>
    );
  }
  if (layout === 'active') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 28 }}>
        {[14, 24, 9, 20, 15, 26, 18].map((h, i) => (
          <View key={i} style={{ width: 4, height: h, borderRadius: 2, backgroundColor: i === 6 ? ink : `${ink}55` }} />
        ))}
      </View>
    );
  }
  if (layout === 'weight') {
    const c = 2 * Math.PI * 8;
    return (
      <View style={{ width: 38, height: 28, borderRadius: 8, backgroundColor: '#15290E', alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={22} height={22} viewBox="0 0 22 22">
          <Circle cx={11} cy={11} r={8} stroke="rgba(255,255,255,0.15)" strokeWidth={4} fill="none" />
          <Circle cx={11} cy={11} r={8} stroke="#A3E635" strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray={`${c * 0.6} ${c}`} transform="rotate(-90 11 11)" />
        </Svg>
      </View>
    );
  }
  const ring = (r: number, w: number, color: string, p: number) => {
    const c = 2 * Math.PI * r;
    return (
      <React.Fragment key={r}>
        <Circle cx={15} cy={15} r={r} stroke={track} strokeWidth={w} fill="none" />
        <Circle cx={15} cy={15} r={r} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 15 15)" />
      </React.Fragment>
    );
  };
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      {ring(12, 4, '#14B8A6', 0.7)}
      {ring(7, 4, '#3B82F6', 0.5)}
      {ring(2.5, 3, '#7C3AED', 0.35)}
    </Svg>
  );
}

/**
 * A picture of the layout drawn from its accent and its hero — never a screenshot, so it cannot
 * drift from what Home renders. The 3D art is the same object onboarding uses for that goal.
 */
export function HomeLayoutThumb({ layout, height = 104 }: { layout: HomeLayoutId; height?: number }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const accent = homeAccentFor(layout, dark, c);
  const wash = accent.wash ?? (dark ? '#0B1F1E' : '#E6F4F1');
  return (
    <View style={[s.frame, { height, backgroundColor: c.bg100 }]} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={[s.wash, { backgroundColor: wash }]} />
      <View style={s.content}>
        <View style={[s.hero, { backgroundColor: c.surface }]}>
          <Glyph layout={layout} ink={accent.ink} track={c.bg200} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={[s.line, { width: '80%', backgroundColor: accent.ink }]} />
            <View style={[s.line, { width: '55%', backgroundColor: c.bg300 }]} />
          </View>
        </View>
        <View style={[s.pill, { backgroundColor: c.surface, borderColor: c.bg300 }]} />
        <View style={[s.line, { width: '46%', height: 6, backgroundColor: c.bg300 }]} />
      </View>
      <Image source={ART[layout]} style={s.art} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

const s = StyleSheet.create({
  frame: { borderRadius: 14, overflow: 'hidden' },
  wash: { position: 'absolute', left: 0, right: 0, top: 0, height: '58%', opacity: 0.95 },
  content: { position: 'absolute', left: 10, top: 10, right: 10, gap: 6 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9, padding: 6 },
  line: { height: 4, borderRadius: 2 },
  pill: { height: 10, width: '64%', borderRadius: 5, borderWidth: StyleSheet.hairlineWidth },
  art: { position: 'absolute', right: 4, bottom: 2, width: 54, height: 54 },
});
