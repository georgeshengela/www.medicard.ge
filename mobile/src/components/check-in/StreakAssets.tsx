import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { FIGMA_STREAK } from '@/constants/figmaStreakLayout';

/** Figma 11425:139560 — flame union 109×133.913. */
export function StreakFlameShape({ width = FIGMA_STREAK.flameWidth, height = FIGMA_STREAK.flameHeight }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 109 133.913" fill="none">
      <Path
        d="M2 79.3419V42.4932C2 35.9526 9.42237 32.1759 14.7096 36.0264L20.1539 39.9913C20.7154 39.2412 21.0382 38.8306 21.0382 38.8306L44.8768 6.83106C49.6754 0.389655 59.3246 0.389644 64.1232 6.83104L87.9618 38.8306C87.9618 38.8306 107 63.0413 107 79.3419C107 108.376 83.4949 131.913 54.5 131.913C25.505 131.913 1.99999 108.376 2 79.3419Z"
        fill="url(#streakFlameFill)"
        stroke="url(#streakFlameStroke)"
        strokeWidth={4}
      />
      <Defs>
        <LinearGradient id="streakFlameFill" x1="54.5" y1="-6.08663" x2="54.5" y2="131.913" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#F59E0B" />
          <Stop offset="1" stopColor="#FCD34D" />
        </LinearGradient>
        <LinearGradient id="streakFlameStroke" x1="54.5" y1="-6.08663" x2="54.5" y2="131.913" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#F59E0B" />
          <Stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
        </LinearGradient>
      </Defs>
    </Svg>
  );
}

/** Figma 11425:139561 — inner rose highlight 55×76.36. */
export function StreakFlameHighlight({
  width = FIGMA_STREAK.highlightWidth,
  height = FIGMA_STREAK.highlightHeight,
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 55 76.3586" fill="none">
      <Path
        opacity={0.64}
        d="M52.9067 59.3824C54.2887 56.0459 55 52.4699 55 48.8586C55 39.409 52.1692 30.1761 46.8727 22.3504L34.1252 3.51595C30.9523 -1.17199 24.0477 -1.17198 20.8748 3.51596L8.12733 22.3504C2.83078 30.1761 0 39.409 0 48.8586C0 52.4699 0.711308 56.0459 2.09331 59.3824C3.47532 62.7188 5.50095 65.7504 8.05456 68.304C10.6082 70.8576 13.6398 72.8833 16.9762 74.2653C20.3127 75.6473 23.8886 76.3586 27.5 76.3586C31.1113 76.3586 34.6873 75.6473 38.0238 74.2653C41.3602 72.8833 44.3918 70.8576 46.9454 68.304C49.499 65.7504 51.5247 62.7188 52.9067 59.3824Z"
        fill="url(#streakFlameHighlight)"
      />
      <Defs>
        <LinearGradient id="streakFlameHighlight" x1="27.5" y1="-6.27282" x2="27.5" y2="76.3586" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#F43F5E" />
          <Stop offset="1" stopColor="#F43F5E" stopOpacity="0" />
        </LinearGradient>
      </Defs>
    </Svg>
  );
}

function GlowCircle({ size, opacity }: { size: number; opacity: number }) {
  const c = size / 2;
  const id = `streakGlow${size}`;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <Circle
        opacity={opacity}
        cx={c}
        cy={c}
        r={c - 0.5}
        fill={`url(#${id}Fill)`}
        stroke={`url(#${id}Stroke)`}
      />
      <Defs>
        <LinearGradient id={`${id}Fill`} x1={c} y1={0} x2={c} y2={size} gradientUnits="userSpaceOnUse">
          <Stop stopColor="#F59E0B" />
          <Stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id={`${id}Stroke`} x1={c} y1={0} x2={c} y2={size} gradientUnits="userSpaceOnUse">
          <Stop stopColor="#F59E0B" stopOpacity="0" />
          <Stop offset="1" stopColor="#F59E0B" />
        </LinearGradient>
      </Defs>
    </Svg>
  );
}

export function StreakGlowOuter() {
  return <GlowCircle size={FIGMA_STREAK.glowOuter} opacity={0.08} />;
}

export function StreakGlowMid() {
  return <GlowCircle size={FIGMA_STREAK.glowMid} opacity={0.16} />;
}

export function StreakGlowInner() {
  return <GlowCircle size={FIGMA_STREAK.glowInner} opacity={0.24} />;
}

/** Figma completed streak — outer 32×32, leaf 32×40.655 overflowing the top. */
export function StreakDayCompleted({ size = FIGMA_STREAK.daySize }: { size?: number }) {
  const height = (FIGMA_STREAK.completedHeight / FIGMA_STREAK.daySize) * size;
  const lift = size - height;
  return (
    <Svg
      width={size}
      height={height}
      viewBox="0 0 32 40.6552"
      style={{ marginTop: lift }}
      fill="none"
    >
      <Path
        d="M0 24.6552V12.5827C0 10.9481 1.8544 10.0038 3.17634 10.9652L5.5326 12.6789C5.70375 12.4506 5.80213 12.3256 5.80213 12.3256L14.3969 0.804131C15.1967 -0.268043 16.8033 -0.268044 17.6031 0.80413L26.1979 12.3256C26.1979 12.3256 32 19.6941 32 24.6552C32 33.4917 24.8366 40.6552 16 40.6552C7.16344 40.6552 -3.81469e-06 33.4917 0 24.6552Z"
        fill="#F59E0B"
      />
      <Path d="M7 24.6552L13 30.6552L25 18.6552" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Figma skipped streak — 32×32 rose circle with X. */
export function StreakDaySkipped({ size = FIGMA_STREAK.daySize }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect width="32" height="32" rx="16" fill="#F43F5E" />
      <Path d="M9 23L23 9" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
      <Path d="M23 23L9 9" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
    </Svg>
  );
}
