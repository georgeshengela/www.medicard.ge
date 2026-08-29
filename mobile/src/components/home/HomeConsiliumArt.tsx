import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useIsDark } from '@/theme/colors';

/** Figma 11416:93615 — 108×130 graphic cluster. */
const ART_W = 108;
const ART_H = 130;

function Ring({
  size,
  opacity,
  left,
  top,
  id,
}: {
  size: number;
  opacity: number;
  left: number;
  top: number;
  id: string;
}) {
  const r = size / 2 - 0.5;
  const c = size / 2;
  return (
    <View style={{ position: 'absolute', left, top, width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id={`${id}-fill`} x1={c} y1={0} x2={c} y2={size} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#14B8A6" />
            <Stop offset="1" stopColor="#14B8A6" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id={`${id}-stroke`} x1={c} y1={0} x2={c} y2={size} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={r} fill={`url(#${id}-fill)`} stroke={`url(#${id}-stroke)`} opacity={opacity} />
      </Svg>
    </View>
  );
}

/** Filled Nightingale chat-dot with glow box — Figma 11416:93622, 32×32 leaf inside 86×86 overflow. */
function ConsiliumChatDot() {
  const dark = useIsDark();
  return (
    <View style={{ position: 'absolute', left: 13, top: 23, width: 32, height: 32 }}>
      <View style={{ position: 'absolute', left: -26.83, top: -9.5, width: 85.67, height: 85.67 }}>
        <Svg width={85.67} height={85.67} viewBox="0 0 85.6667 85.6671">
          <Path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M52.1667 13.8333C54.1917 13.8333 55.8333 15.475 55.8333 17.5V30.8333C55.8333 32.8584 54.1917 34.5 52.1667 34.5H37.2708C36.829 34.5001 36.4049 34.6758 36.0925 34.9883L31.5404 39.5404C31.2544 39.8263 30.8242 39.9125 30.4505 39.7578C30.0768 39.603 29.8333 39.2378 29.8333 38.8333V17.5C29.8333 15.475 31.475 13.8333 33.5 13.8333H52.1667ZM37.1667 22.8333C36.4303 22.8333 35.8333 23.4303 35.8333 24.1667C35.8333 24.903 36.4303 25.5 37.1667 25.5C37.903 25.5 38.5 24.903 38.5 24.1667C38.5 23.4303 37.903 22.8333 37.1667 22.8333ZM42.8333 22.8333C42.097 22.8333 41.5 23.4303 41.5 24.1667C41.5 24.903 42.097 25.5 42.8333 25.5C43.5697 25.5 44.1667 24.903 44.1667 24.1667C44.1667 23.4303 43.5697 22.8333 42.8333 22.8333ZM48.5 22.8333C47.7636 22.8333 47.1667 23.4303 47.1667 24.1667C47.1667 24.903 47.7636 25.5 48.5 25.5C49.2364 25.5 49.8333 24.903 49.8333 24.1667C49.8333 23.4303 49.2364 22.8333 48.5 22.8333Z"
            fill={dark ? '#FFFFFF' : '#1F2937'}
            stroke={dark ? '#374151' : '#E5E7EB'}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  );
}

/** Solid plus-fat 32×32 — Figma 11416:93623, fill #F43F5E. */
function ConsiliumPlusFat() {
  return (
    <View style={{ position: 'absolute', left: 54, top: 73, width: 32, height: 32 }}>
      <Svg width={32} height={32} viewBox="0 0 32 32">
        <Path
          d="M18.6667 3C19.219 3 19.6667 3.44772 19.6667 4V12.3333H28C28.5523 12.3333 29 12.781 29 13.3333V18.6667C29 19.219 28.5523 19.6667 28 19.6667H19.6667V28C19.6667 28.5523 19.219 29 18.6667 29H13.3333C12.781 29 12.3333 28.5523 12.3333 28V19.6667H4C3.44772 19.6667 3 19.219 3 18.6667V13.3333C3 12.781 3.44772 12.3333 4 12.3333H12.3333V4C12.3333 3.44772 12.781 3 13.3333 3H18.6667Z"
          fill="#F43F5E"
        />
      </Svg>
    </View>
  );
}

export function HomeConsiliumArt() {
  return (
    <View style={{ width: ART_W, height: ART_H }}>
      <Ring size={160} opacity={0.08} left={-26} top={-15} id="c160" />
      <Ring size={128} opacity={0.12} left={-10} top={1} id="c128" />
      <Ring size={96} opacity={0.16} left={6} top={17} id="c96" />
      <ConsiliumChatDot />
      <ConsiliumPlusFat />
    </View>
  );
}
