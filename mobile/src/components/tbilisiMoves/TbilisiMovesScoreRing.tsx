import React, { useMemo } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { ka } from '@/i18n/ka';
import { useIsDark, useThemeColors } from '@/theme/colors';

/** Figma 9004:246907 horseshoe. Paths (not Circle rotation) so Android matches iOS. */
const VB_W = 375;
const VB_H = 336;
const CX = 188;
const CY = 176;
const R = 112;
const START = 137;
const SWEEP = 266;
const STROKE = 32;
const TRACK = 40;
const DISC_R = 93;
const OUTER_R = 150;
const LOGO = 56;

function polar(deg: number, radius = R) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function horseshoe(radius: number, t = 1) {
  const sweep = SWEEP * Math.max(0, Math.min(1, t));
  const p0 = polar(START, radius);
  const p1 = polar(START + sweep, radius);
  const large = sweep > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

type Props = {
  percent: number;
  caption?: string;
};

export function TbilisiMovesScoreRing({ percent, caption }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const { width } = useWindowDimensions();
  const size = Math.min(width - 32, VB_W);
  const height = (size * VB_H) / VB_W;
  const sx = size / VB_W;
  const sy = height / VB_H;

  const g = useMemo(() => {
    const p = Math.max(0, Math.round(Number(percent) || 0));
    const t = Math.max(0, Math.min(1, p / 100));
    return {
      p,
      track: horseshoe(R, 1),
      fill: t > 0.004 ? horseshoe(R, t) : '',
      knob: polar(START + SWEEP * t),
    };
  }, [percent]);

  const discLeft = (CX - DISC_R) * sx;
  const discTop = (CY - DISC_R) * sy;
  const discSize = DISC_R * 2 * sx;
  const track = dark ? colors.surfaceRaised : '#FFFFFF';
  const outer = dark ? colors.bg300 : '#D1D5DB';
  const discBg = dark ? colors.surface : '#FFFFFF';
  const restStart = dark ? colors.accent100 : '#F0FDFA';

  return (
    <View
      style={{ width: size, height, alignSelf: 'center' }}
      accessibilityRole="image"
      accessibilityLabel={`${caption || ka.tbilisiMoves.dayGoal} ${g.p} ${ka.tbilisiMoves.outOf100}`}
    >
      <Svg width={size} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <LinearGradient id="tmRingFill" x1={String(CX)} y1={String(CY - R)} x2={String(CX)} y2={String(CY + R)} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#0D9488" />
            <Stop offset="1" stopColor="#2DD4BF" />
          </LinearGradient>
          <LinearGradient id="tmRingRest" x1={String(CX)} y1={String(CY - R)} x2={String(CX)} y2={String(CY + R)} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={restStart} />
            <Stop offset="1" stopColor="#99F6E4" />
          </LinearGradient>
        </Defs>
        <Circle cx={CX} cy={CY} r={OUTER_R} stroke={outer} strokeWidth={1} strokeDasharray="8 8" strokeLinecap="round" fill="none" />
        <Path d={g.track} stroke={track} strokeWidth={TRACK} strokeLinecap="round" fill="none" />
        <Path d={g.track} stroke="url(#tmRingRest)" strokeWidth={STROKE} strokeLinecap="round" fill="none" />
        {g.fill ? <Path d={g.fill} stroke="url(#tmRingFill)" strokeWidth={STROKE} strokeLinecap="round" fill="none" /> : null}
        <Circle cx={CX} cy={CY} r={DISC_R} fill={discBg} stroke={dark ? colors.bg300 : '#E5E7EB'} strokeWidth={1} />
        <Circle cx={g.knob.x} cy={g.knob.y} r={18} fill="none" stroke="#14B8A6" strokeWidth={4} />
        <Circle cx={g.knob.x} cy={g.knob.y} r={16} fill="#FFFFFF" />
      </Svg>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: discLeft,
          top: discTop,
          width: discSize,
          height: discSize,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 12,
          paddingBottom: LOGO * 0.45 * sy,
        }}
      >
        <Text
          style={{
            fontFamily: GEO.title,
            fontSize: Math.round(52 * sx),
            lineHeight: Math.round(58 * sx),
            color: colors.text100,
            letterSpacing: -1,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
          }}
        >
          {g.p}
        </Text>
        <Text style={{ fontFamily: GEO.semibold, fontSize: 16, lineHeight: 22, color: colors.text100, textAlign: 'center' }}>
          {ka.tbilisiMoves.outOf100}
        </Text>
        <Text style={{ marginTop: 4, fontFamily: GEO.regular, fontSize: 12, lineHeight: 16, color: colors.text300, textAlign: 'center' }}>
          {caption || ka.tbilisiMoves.dayGoal}
        </Text>
      </View>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: (CX - LOGO / 2) * sx,
          top: (CY + DISC_R - LOGO / 2) * sy,
          width: LOGO * sx,
          height: LOGO * sx,
          borderRadius: (LOGO * sx) / 2,
          backgroundColor: '#0D9488',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MedicardLogoMark size={Math.round(34 * sx)} tone="inverse" />
      </View>
    </View>
  );
}
