import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { ka } from '@/i18n/ka';
import { formatKaInt } from '@/lib/tbilisiMoves/format';
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

function easeOut(u: number) {
  const t = Math.max(0, Math.min(1, u));
  return 1 - (1 - t) ** 3;
}

function useEased(target: number, ms = 900) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const started = Date.now();
    let raf = 0;
    const tick = () => {
      const u = easeOut((Date.now() - started) / ms);
      const next = from + (target - from) * u;
      setValue(next);
      if (u < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms, target]);
  return value;
}

type Props = {
  value: number;
  max: number;
  caption?: string;
};

export function TbilisiMovesScoreRing({ value, max, caption }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const { width } = useWindowDimensions();
  const size = Math.min(width - 32, VB_W);
  const height = (size * VB_H) / VB_W;
  const sx = size / VB_W;
  const sy = height / VB_H;

  const ceiling = Math.max(1, Math.round(Number(max) || 0));
  const raw = Math.max(0, Math.round(Number(value) || 0));
  const shown = useEased(raw);
  const shownInt = Math.round(shown);
  const t = Math.max(0, Math.min(1, shown / ceiling));
  const pct = Math.round(t * 100);
  const complete = raw >= ceiling;

  const g = useMemo(() => {
    return {
      track: horseshoe(R, 1),
      fill: t > 0.004 ? horseshoe(R, t) : '',
      knob: polar(START + SWEEP * t),
    };
  }, [t]);

  const digits = String(shownInt).length;
  const valueSize = digits >= 5 ? 34 : digits >= 4 ? 42 : 52;
  const discLeft = (CX - DISC_R) * sx;
  const discTop = (CY - DISC_R) * sy;
  const discSize = DISC_R * 2 * sx;
  const track = dark ? colors.surfaceRaised : '#FFFFFF';
  const outer = dark ? colors.bg300 : '#D1D5DB';
  const discBg = dark ? colors.surface : '#FFFFFF';
  const restStart = dark ? colors.accent100 : '#F0FDFA';
  const low = polar(200, OUTER_R + 14);
  const mid = polar(270, OUTER_R + 10);
  const high = polar(48, OUTER_R + 14);
  const fillStart = complete ? '#F59E0B' : '#0D9488';
  const fillEnd = complete ? '#FDE68A' : '#2DD4BF';
  const knobRing = complete ? '#F59E0B' : '#14B8A6';

  return (
    <View
      style={{ width: size, height, alignSelf: 'center' }}
      accessibilityRole="image"
      accessibilityLabel={`${formatKaInt(raw)} ${ka.tbilisiMoves.steps}, ${pct} ${ka.tbilisiMoves.outOf100} ${caption || ka.tbilisiMoves.cap}`}
    >
      <Svg width={size} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <LinearGradient id="tmRingFill" x1={String(CX)} y1={String(CY - R)} x2={String(CX)} y2={String(CY + R)} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={fillStart} />
            <Stop offset="1" stopColor={fillEnd} />
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
        <Circle cx={g.knob.x} cy={g.knob.y} r={18} fill="none" stroke={knobRing} strokeWidth={4} />
        <Circle cx={g.knob.x} cy={g.knob.y} r={16} fill={discBg} />
        <SvgText
          x={low.x}
          y={low.y}
          fill={colors.text300}
          fontSize="10"
          fontFamily={GEO.semibold}
          textAnchor="middle"
        >
          {ka.tbilisiMoves.bandLow}
        </SvgText>
        <SvgText
          x={mid.x}
          y={mid.y}
          fill={colors.text300}
          fontSize="10"
          fontFamily={GEO.semibold}
          textAnchor="middle"
        >
          {ka.tbilisiMoves.bandMid}
        </SvgText>
        <SvgText
          x={high.x}
          y={high.y}
          fill={colors.text300}
          fontSize="10"
          fontFamily={GEO.semibold}
          textAnchor="middle"
        >
          {ka.tbilisiMoves.bandHigh}
        </SvgText>
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
          paddingHorizontal: 14,
          paddingBottom: LOGO * 0.42 * sy,
        }}
      >
        <Text
          style={{
            fontFamily: GEO.title,
            fontSize: Math.round(valueSize * sx),
            lineHeight: Math.round((valueSize + 6) * sx),
            color: colors.text100,
            letterSpacing: -1,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatKaInt(shownInt)}
        </Text>
        <Text style={{ fontFamily: GEO.semibold, fontSize: 14, lineHeight: 20, color: colors.text100, textAlign: 'center' }}>
          {ka.tbilisiMoves.steps}
        </Text>
        <Text style={{ marginTop: 4, fontFamily: GEO.regular, fontSize: 12, lineHeight: 16, color: colors.text300, textAlign: 'center' }}>
          {caption || ka.tbilisiMoves.cap}
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
          backgroundColor: complete ? '#D97706' : '#0D9488',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MedicardLogoMark size={Math.round(34 * sx)} tone="inverse" />
      </View>
    </View>
  );
}
