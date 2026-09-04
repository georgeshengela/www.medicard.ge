import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { HydrationContainer } from '@/types/hydration';

export function HydrationDrop({ size = 40, color = '#38BDF8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.5C12 2.5 5.5 10.2 5.5 15.2C5.5 18.8 8.4 21.5 12 21.5C15.6 21.5 18.5 18.8 18.5 15.2C18.5 10.2 12 2.5 12 2.5Z"
        fill={color}
      />
    </Svg>
  );
}

/** Figma 9283:202570 / assets/figma/hydration/water-drop-9283.svg — outer 32, leaf 20.67×25.31 */
const FIGMA_DROP =
  'M8.57682 0.796823C9.50645 -0.265609 11.1602 -0.265606 12.0898 0.796823L17.7852 7.30594C19.6427 9.42886 20.6667 12.1543 20.6667 14.9752C20.6667 16.3322 20.3995 17.676 19.8802 18.9296C19.3609 20.1833 18.6002 21.323 17.6406 22.2825C16.6811 23.242 15.5414 24.0028 14.2878 24.5221C13.0341 25.0414 11.6903 25.3085 10.3333 25.3085C8.97635 25.3085 7.63259 25.0414 6.37891 24.5221C5.12522 24.0028 3.98557 23.242 3.02604 22.2825C2.06651 21.323 1.30576 20.1833 0.786458 18.9296C0.267171 17.676 6.93905e-06 16.3322 0 14.9752C2.46608e-07 12.1543 1.02396 9.42886 2.88151 7.30594L8.57682 0.796823Z';

export function FigmaHydrationDrop({ color = '#14B8A6' }: { color?: string }) {
  return (
    <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={20.6667} height={25.3085} viewBox="0 0 20.6667 25.3085" fill="none">
        <Path d={FIGMA_DROP} fill={color} />
      </Svg>
    </View>
  );
}

/** Figma 9283:202587 / assets/figma/hydration/hatch-a-9283.svg — 173×97, rotate 60° in the fill. */
export function FigmaHydrationHatch({ color = '#0D9488' }: { color?: string }) {
  return (
    <Svg width={173} height={97} viewBox="0 0 173 97" fill="none">
      {Array.from({ length: 13 }, (_, i) => (
        <Path key={i} d={`M0 ${0.5 + i * 8}H173`} stroke={color} />
      ))}
    </Svg>
  );
}

const SMALL_BODY =
  'M53.6482 9H18.3518C16.5638 9 15.1727 10.5542 15.3701 12.3313L20.407 57.6626C20.7446 60.7012 23.313 63 26.3703 63H45.6297C48.687 63 51.2554 60.7012 51.593 57.6626L56.6299 12.3313C56.8273 10.5542 55.4362 9 53.6482 9Z';
const SMALL_FILL =
  'M11 22.4056L13.0812 22.6548C15.1688 22.8963 19.3313 23.3949 23.5 22.9275C29.7688 22.2264 35.8 19.7181 42.1 19.1416C47.7875 18.6275 53.3563 19.5779 58.9188 20.9489L61 21.4708V65C44.3312 65 27.6688 65 11 65V22.4056Z';
const MEDIUM_BODY =
  'M48.2922 21.2912C49.6424 22.6415 50.4016 24.4734 50.4016 26.383V61.2006C50.4016 65.177 47.178 68.4006 43.2016 68.4006H28.8016C24.8251 68.4006 21.6016 65.177 21.6016 61.2006V26.383C21.6016 24.4734 22.3607 22.6415 23.7109 21.2912L30.6016 14.4006V7.20059C30.6016 5.21236 32.2133 3.60059 34.2016 3.60059H37.8016C39.7898 3.60059 41.4016 5.21236 41.4016 7.20059V14.4006L48.2922 21.2912Z';
const MEDIUM_FILL =
  'M4.80469 25.6873L7.30219 25.9864C9.80719 26.2762 14.8022 26.8744 19.8047 26.3136C27.3272 25.4723 34.5647 22.4623 42.1247 21.7705C48.9497 21.1536 55.6322 22.294 62.3072 23.9392L64.8047 24.5655V72.0006C44.8022 72.0006 24.8072 72.0006 4.80469 72.0006V25.6873Z';
const LARGE_BODY =
  'M43.1984 14.3996C51.1513 14.3996 57.5984 20.8467 57.5984 28.7996V56.75C57.5983 63.1838 52.3827 68.3995 45.9488 68.3996C44.1402 68.3996 42.3563 67.978 40.7387 67.1691L39.2188 66.4098C37.1918 65.3963 34.8051 65.3963 32.7781 66.4098L31.2582 67.1691C29.6406 67.978 27.8566 68.3996 26.048 68.3996C19.6142 68.3995 14.3986 63.1838 14.3984 56.75V28.7996C14.3984 20.8467 20.8455 14.3996 28.7984 14.3996V7.19961C28.7984 5.21138 30.4102 3.59961 32.3984 3.59961H39.5984C41.5867 3.59961 43.1984 5.21138 43.1984 7.19961V14.3996Z';
const LARGE_FILL =
  'M7.19531 24.2925L9.59291 24.5773C11.9977 24.8533 16.7929 25.4231 21.5953 24.8889C28.8169 24.0877 35.7649 21.221 43.0225 20.5622C49.5745 19.9747 55.9897 21.0608 62.3977 22.6277L64.7953 23.2241V68.4004C45.5929 68.4004 26.3977 68.4004 7.19531 68.4004V24.2925Z';

export function HydrationContainerIcon({
  type,
  size = 72,
}: {
  type: HydrationContainer;
  size?: number;
}) {
  const uid = `${type}-${size}`;
  const body = type === 'small' ? SMALL_BODY : type === 'large' ? LARGE_BODY : MEDIUM_BODY;
  const fill = type === 'small' ? SMALL_FILL : type === 'large' ? LARGE_FILL : MEDIUM_FILL;
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <Defs>
        <LinearGradient id={`${uid}-fill`} x1="36" y1="20" x2="36" y2="68">
          <Stop offset="0" stopColor="#14B8A6" />
          <Stop offset="1" stopColor="#14B8A6" stopOpacity="0" />
        </LinearGradient>
        <ClipPath id={`${uid}-clip`}>
          <Path d={body} />
        </ClipPath>
      </Defs>
      <Path d={body} fill="#CCFBF1" />
      <G clipPath={`url(#${uid}-clip)`}>
        <Path d={fill} fill={`url(#${uid}-fill)`} />
      </G>
    </Svg>
  );
}

export function HydrationMiniBottle({ size = 40, color = '#14B8A6' }: { size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <Rect x="16" y="4" width="8" height="5" rx="1.5" fill={color} opacity={0.45} />
        <Path
          d="M13 12C13 10.9 13.9 10 15 10H25C26.1 10 27 10.9 27 12V14.5C29 16 30 18.5 30 22V31C30 33.2 28.2 35 26 35H14C11.8 35 10 33.2 10 31V22C10 18.5 11 16 13 14.5V12Z"
          fill="#CCFBF1"
        />
        <Path d="M12 22C14 26 26 26 28 22V31C28 32.1 27.1 33 26 33H14C12.9 33 12 32.1 12 31V22Z" fill={color} />
      </Svg>
    </View>
  );
}

export function HydrationCheck({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Circle cx="28" cy="28" r="28" fill="#22C55E" />
      <Path d="M16 29.2L24.2 37L40 20" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Figma 8851:187189 / assets/figma/hydration/day-check.svg — 32×32 */
const DAY_CHECK =
  'M16 3C23.1797 3 29 8.8203 29 16C29 23.1797 23.1797 29 16 29C8.8203 29 3 23.1797 3 16C3 8.8203 8.8203 3 16 3ZM22.707 11.9596C22.3165 11.5691 21.6835 11.5691 21.293 11.9596L14 19.2526L10.707 15.9596C10.3165 15.5691 9.68349 15.5691 9.29297 15.9596C8.90244 16.3502 8.90244 16.9832 9.29297 17.3737L13.293 21.3737C13.6835 21.7642 14.3165 21.7642 14.707 21.3737L22.707 13.3737C23.0976 12.9832 23.0976 12.3502 22.707 11.9596Z';

/** Figma 8851:187189 / assets/figma/hydration/day-miss.svg — 32×32 */
const DAY_MISS =
  'M16 3C23.1797 3 29 8.8203 29 16C29 23.1797 23.1797 29 16 29C8.8203 29 3 23.1797 3 16C3 8.8203 8.8203 3 16 3ZM20.707 11.293C20.3165 10.9024 19.6835 10.9024 19.293 11.293L16 14.5859L12.707 11.293C12.3165 10.9024 11.6835 10.9024 11.293 11.293C10.9024 11.6835 10.9024 12.3165 11.293 12.707L14.5859 16L11.293 19.293C10.9024 19.6835 10.9024 20.3165 11.293 20.707C11.6835 21.0976 12.3165 21.0976 12.707 20.707L16 17.4141L19.293 20.707C19.6835 21.0976 20.3165 21.0976 20.707 20.707C21.0976 20.3165 21.0976 19.6835 20.707 19.293L17.4141 16L20.707 12.707C21.0976 12.3165 21.0976 11.6835 20.707 11.293Z';

/** Figma 8851:187189 / assets/figma/hydration/day-empty.svg — 32×32 */
const DAY_EMPTY =
  'M16 3C23.1797 3 29 8.8203 29 16C29 23.1797 23.1797 29 16 29C8.8203 29 3 23.1797 3 16C3 8.8203 8.8203 3 16 3ZM16 5C9.92487 5 5 9.92487 5 16C5 22.0751 9.92487 27 16 27C22.0751 27 27 22.0751 27 16C27 9.92487 22.0751 5 16 5Z';

export function HydrationDayCheck({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d={DAY_CHECK} fill="#22C55E" fillRule="evenodd" />
    </Svg>
  );
}

export function HydrationDayMiss({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d={DAY_MISS} fill="#F43F5E" fillRule="evenodd" />
    </Svg>
  );
}

export function HydrationDayEmpty({ size = 32, color = '#4B5563' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d={DAY_EMPTY} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export function DrinkTypeIcon({
  type,
  size = 20,
  color = '#14B8A6',
}: {
  type: 'water' | 'coffee' | 'tea' | 'other';
  size?: number;
  color?: string;
}) {
  if (type === 'coffee') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M5 8H15V15C15 17.2 13.2 19 11 19H9C6.8 19 5 17.2 5 15V8Z" stroke={color} strokeWidth="1.8" />
        <Path d="M15 10H17.5C18.9 10 20 11.1 20 12.5C20 13.9 18.9 15 17.5 15H15" stroke={color} strokeWidth="1.8" />
        <Path d="M8 4.5C8.4 5.2 8.4 6 8 6.6M11 4.5C11.4 5.2 11.4 6 11 6.6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </Svg>
    );
  }
  if (type === 'tea') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 4C10 7 8 8.5 8 11.2C8 13.4 9.8 15.2 12 15.2C14.2 15.2 16 13.4 16 11.2C16 8.5 14 7 12 4Z" fill={color} />
        <Path d="M7 19H17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
    );
  }
  if (type === 'other') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 4L15.5 10H8.5L12 4Z" fill={color} />
        <Rect x="5" y="13" width="6" height="6" rx="1" fill={color} />
        <Circle cx="17" cy="16" r="3" fill={color} />
      </Svg>
    );
  }
  return <HydrationDrop size={size} color={color} />;
}

export function MiniSpark({ values, color, width = 56, height = 28 }: { values: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`);
  const area = `${pts.join(' ')} L ${width} ${height} L 0 ${height} Z`;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={area} fill={color} opacity={0.18} />
      <Path d={pts.join(' ')} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </Svg>
  );
}
