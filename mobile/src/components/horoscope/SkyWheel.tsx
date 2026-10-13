import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { SIGN_KEYS, ROMAN, type AspectKey, type PointKey, type SignKey } from '@/lib/horoscope/names';
import { GlyphAt } from './AstroGlyph';
import { moonPath, pointAt, sectorPath, spreadAround } from './skyGeometry';

export const BRASS = '#E9C77E';
export const BRASS_FAINT = 'rgba(233,199,126,0.28)';
export const BRASS_HAIR = 'rgba(233,199,126,0.5)';
export const IVORY = '#FBF3E0';
const HARMONY = 'rgba(143,179,255,0.78)';
const TENSION = 'rgba(240,138,154,0.78)';

type Body = { key: string; lon: number; retro?: boolean; degree?: number };
type ChartLike = {
  angles: { asc: { lon: number }; mc: { lon: number } } | null;
  houses: { lon: number }[] | null;
  aspects: { a: PointKey; b: PointKey; aspect: AspectKey; orb: number }[];
};

type Props = {
  size: number;
  /** 'sky' puts `highlight` at the top; 'chart' puts the ascendant on the left (the astrologer's view). */
  mode: 'sky' | 'chart';
  bodies: Body[];
  highlight?: SignKey | null;
  chart?: ChartLike | null;
  /** Moon phase angle for the centre disc (sky mode). */
  moonAngle?: number | null;
  /** Degree labels beside the planets (chart mode). */
  degrees?: boolean;
};

/**
 * The engraved brass astrolabe: twelve sign sectors with Noto glyphs, a tick for every degree, planets at their
 * true longitudes (spread apart only for legibility, with a leader to the exact tick), houses and aspect lines
 * in chart mode, and the real Moon phase at the centre in sky mode. Same geometry as the approved board.
 */
export const SkyWheel = memo(function SkyWheel({ size, mode, bodies, highlight = null, chart = null, moonAngle = null, degrees = false }: Props) {
  const parts = useMemo(() => {
    const c = size / 2;
    const R = size / 2 - 2;
    const asc = chart?.angles?.asc.lon ?? 0;
    const top = highlight ? SIGN_KEYS.indexOf(highlight) * 30 + 15 : 0;
    const rot = (lon: number) => (mode === 'chart' && chart?.angles ? 180 + (lon - asc) : 90 + (lon - top));
    const pt = (lon: number, r: number) => pointAt(c, r, rot(lon));
    const rOut = R;
    const rTick = R * 0.7;
    const rPl = mode === 'chart' ? R * 0.57 : R * 0.56;
    const rIn = mode === 'chart' ? R * 0.4 : R * 0.36;
    const gSize = size * 0.064;

    const ticks: { x1: number; y1: number; x2: number; y2: number; w: number; o: string }[] = [];
    for (let d = 0; d < 360; d++) {
      const len = d % 10 === 0 ? 0.05 : d % 5 === 0 ? 0.032 : 0.016;
      const [x1, y1] = pt(d, rTick);
      const [x2, y2] = pt(d, rTick - R * len);
      ticks.push({ x1, y1, x2, y2, w: d % 10 ? 0.6 : 1, o: d % 5 ? BRASS_FAINT : BRASS_HAIR });
    }
    const signLines = SIGN_KEYS.map((_, i) => {
      const [x1, y1] = pt(i * 30, rOut);
      const [x2, y2] = pt(i * 30, rTick);
      return { x1, y1, x2, y2 };
    });
    const signGlyphs = SIGN_KEYS.map((s, i) => {
      const [x, y] = pt(i * 30 + 15, (rOut + rTick) / 2);
      const on = s === highlight;
      return { s, x, y, size: size * (on ? 0.07 : 0.058), color: on ? BRASS : 'rgba(233,199,126,0.62)' };
    });
    const sector = highlight
      ? sectorPath(c, rOut, rTick, rot(SIGN_KEYS.indexOf(highlight) * 30), rot(SIGN_KEYS.indexOf(highlight) * 30 + 30))
      : null;

    const minGap = (gSize * 1.25) / rPl / (Math.PI / 180);
    const placed = spreadAround(bodies.map((b) => ({ ...b })), minGap).map((p) => {
      const [tx, ty] = pt(p.lon, rTick);
      const [tx2, ty2] = pt(p.lon, rTick - R * 0.07);
      const [gx, gy] = pt(p.disp, rPl);
      const moved = Math.abs(p.disp - p.lon) > 1.5;
      const [lx, ly] = pt(p.lon, rTick - R * 0.07);
      const [mx, my] = pt(p.disp, rPl + gSize * 0.62);
      const [dx, dy] = pt(p.disp, rPl - R * (mode === 'chart' ? 0.085 : 0.075));
      return { ...p, tx, ty, tx2, ty2, gx, gy, moved, lx, ly, mx, my, dx, dy };
    });

    const houseLines = mode === 'chart' && chart?.houses
      ? chart.houses.map((h, i) => {
        const [x1, y1] = pt(h.lon, rTick - R * 0.05);
        const [x2, y2] = pt(h.lon, rIn);
        const next = chart.houses![(i + 1) % 12].lon;
        const mid = h.lon + ((((next - h.lon) % 360) + 360) % 360) / 2;
        const [nx, ny] = pt(mid, rIn + R * 0.06);
        return { x1, y1, x2, y2, angle: i % 3 === 0, nx, ny, label: ROMAN[i] };
      })
      : [];
    const lonOf: Record<string, number> = Object.fromEntries(bodies.map((b) => [b.key, b.lon]));
    if (chart?.angles) { lonOf.asc = chart.angles.asc.lon; lonOf.mc = chart.angles.mc.lon; }
    const aspectLines = mode === 'chart' && chart
      ? chart.aspects.filter((a) => a.aspect !== 'conjunction' && lonOf[a.a] != null && lonOf[a.b] != null).map((a) => {
        const [x1, y1] = pt(lonOf[a.a], rIn);
        const [x2, y2] = pt(lonOf[a.b], rIn);
        return { x1, y1, x2, y2, color: a.aspect === 'trine' || a.aspect === 'sextile' ? HARMONY : TENSION, w: a.orb < 2 ? 1.2 : 0.7 };
      })
      : [];
    const ascDot = mode === 'chart' && chart?.angles ? pt(chart.angles.asc.lon, rOut) : null;
    return { c, R, rOut, rTick, rIn, gSize, ticks, signLines, signGlyphs, sector, placed, houseLines, aspectLines, ascDot };
  }, [size, mode, bodies, highlight, chart]);

  const { c, rOut, rTick, rIn, gSize } = parts;
  const mr = rIn * 0.5;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="hzMoonGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#E8EDF7" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#E8EDF7" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={rOut} fill="none" stroke={BRASS_HAIR} strokeWidth={1} />
      <Circle cx={c} cy={c} r={rTick} fill="none" stroke={BRASS_HAIR} strokeWidth={1} />
      <Circle cx={c} cy={c} r={rIn} fill="none" stroke={BRASS_FAINT} strokeWidth={1} />
      {parts.sector ? <Path d={parts.sector} fill="rgba(233,199,126,0.14)" /> : null}
      {parts.signLines.map((l, i) => <Line key={`s${i}`} {...l} stroke={BRASS_HAIR} strokeWidth={1} />)}
      {parts.signGlyphs.map((g) => <GlyphAt key={g.s} name={g.s} x={g.x} y={g.y} size={g.size} color={g.color} />)}
      {parts.ticks.map((t, i) => <Line key={`t${i}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.o} strokeWidth={t.w} />)}
      {parts.houseLines.map((h, i) => (
        <G key={`h${i}`}>
          <Line x1={h.x1} y1={h.y1} x2={h.x2} y2={h.y2} stroke={h.angle ? BRASS : BRASS_FAINT} strokeWidth={h.angle ? 1.4 : 0.8} />
          <SvgText x={h.nx} y={h.ny + size * 0.009} fontSize={size * 0.026} fill="rgba(233,199,126,0.55)" textAnchor="middle">{h.label}</SvgText>
        </G>
      ))}
      {parts.ascDot ? <Circle cx={parts.ascDot[0]} cy={parts.ascDot[1]} r={3} fill={BRASS} /> : null}
      {parts.aspectLines.map((a, i) => <Line key={`a${i}`} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={a.color} strokeWidth={a.w} />)}
      {parts.placed.map((p) => (
        <G key={p.key}>
          <Line x1={p.tx} y1={p.ty} x2={p.tx2} y2={p.ty2} stroke={BRASS} strokeWidth={1.2} />
          {p.moved ? <Line x1={p.lx} y1={p.ly} x2={p.mx} y2={p.my} stroke="rgba(233,199,126,0.45)" strokeWidth={0.8} /> : null}
          <GlyphAt name={p.key} x={p.gx} y={p.gy} size={gSize} color={IVORY} />
          {degrees ? (
            <SvgText x={p.dx} y={p.dy + size * 0.009} fontSize={size * 0.026} fill="rgba(251,243,224,0.7)" textAnchor="middle">{`${p.degree ?? ''}°${p.retro ? 'ʀ' : ''}`}</SvgText>
          ) : p.retro ? (
            <SvgText x={p.dx} y={p.dy + size * 0.008} fontSize={size * 0.024} fill="rgba(240,138,154,0.9)" textAnchor="middle">R</SvgText>
          ) : null}
        </G>
      ))}
      {moonAngle != null ? (
        <G>
          <Circle cx={c} cy={c} r={mr * 1.9} fill="url(#hzMoonGlow)" />
          <Circle cx={c} cy={c} r={mr} fill="rgba(255,255,255,0.06)" />
          <Path d={moonPath(c, c, mr, moonAngle)} fill="#E8EDF7" />
        </G>
      ) : null}
    </Svg>
    </View>
  );
});
