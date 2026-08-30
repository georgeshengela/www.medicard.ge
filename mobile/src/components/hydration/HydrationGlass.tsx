import React, { useId, useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { HydrationCheck } from '@/components/hydration/HydrationIcons';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { HYDRATION_GLASS_MAX_ML } from '@/types/hydration';

/** Figma 9017:196790 / assets/figma/hydration/glass-filled.svg */
const GLASS =
  'M69.6309 4.26092C69.4732 3.06305 70.4056 2 71.6138 2H356.026C357.234 2 358.166 3.06306 358.009 4.26093L309.235 374.902C307.14 390.824 293.568 402.727 277.509 402.727H150.131C134.071 402.727 120.499 390.824 118.404 374.902L69.6309 4.26092Z';

const WAVE_TOP =
  'M-196.432 -66.9535L-161.313 -68.6889C-126.087 -70.4243 -55.8481 -73.8951 14.4967 -51.9855C82.0994 -30.9436 142.741 10.7064 212.243 25.8912C288.388 42.4862 363.901 14.9364 436.355 -6.21395C505.961 -26.6051 576.622 -42.7661 647.284 -58.8187V137.717C366.01 137.717 84.8415 137.717 -196.432 137.717V-66.9535Z';
const WAVE_MID =
  'M-109.952 -4.61328L-74.8321 4.93149C-39.607 14.5847 30.6323 33.6743 100.977 35.5182C171.322 37.3621 241.561 21.7434 311.906 24.8888C381.724 27.9258 449.221 48.6423 517.773 60.1394C577.571 70.2265 638.108 73.0466 698.644 74.0227L733.764 74.5651V159.167C452.49 159.167 171.322 159.167 -109.952 159.167V-4.61328Z';
const WAVE_DEEP =
  'M-109.952 79.4625L-74.8321 82.8373C-39.607 86.1067 30.6323 92.8565 100.977 86.5286C206.758 77.0368 308.531 43.0772 414.839 35.2729C510.812 28.3122 604.781 41.1789 698.644 59.7406L733.764 66.8067V413.249C452.49 413.249 171.322 413.249 -109.952 413.249V79.4625Z';

const TICKS = ['2.5k', '2k', '1.5k', '1k', '500'] as const;
const GLASS_ASPECT = 289 / 401;

type Props = {
  ml: number;
  goalMl: number;
  maxMl?: number;
  height?: number;
};

export function HydrationGlass({ ml, goalMl, maxMl = HYDRATION_GLASS_MAX_ML, height }: Props) {
  const T = useFigmaHydration();
  const uid = useId().replace(/:/g, '');
  const fill = Math.max(0, Math.min(1, ml / maxMl));
  const waterY = useMemo(() => 403 - fill * 399, [fill]);
  const done = ml >= goalMl && goalMl > 0;
  const [size, setSize] = useState({ width: 289, height: 401 });

  const onInnerLayout = (e: LayoutChangeEvent) => {
    const { width, height: availH } = e.nativeEvent.layout;
    const availW = Math.max(80, width - 42);
    const fitH = Math.max(80, availH);
    let w = availW;
    let h = w / GLASS_ASPECT;
    if (h > fitH) {
      h = fitH;
      w = h * GLASS_ASPECT;
    }
    if (Math.abs(w - size.width) > 1 || Math.abs(h - size.height) > 1) {
      setSize({ width: w, height: h });
    }
  };

  return (
    <View
      style={{
        flex: height ? undefined : 1,
        height,
        paddingHorizontal: 8,
        paddingVertical: 24,
      }}
    >
      <View
        onLayout={onInnerLayout}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <View style={{ width: 32, height: size.height, justifyContent: 'space-between' }}>
          {TICKS.map((tick) => (
            <Text
              key={tick}
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 12,
                lineHeight: 16,
                color: T.textSecondary,
                textAlign: 'right',
              }}
            >
              {tick}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: size.width, height: size.height, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size.width} height={size.height} viewBox="0 0 427 430">
              <Defs>
                <LinearGradient id={`${uid}-empty`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={T.waterSoft} stopOpacity="0.55" />
                  <Stop offset="1" stopColor={T.waterSoft} stopOpacity="0.12" />
                </LinearGradient>
                <LinearGradient id={`${uid}-stroke`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={T.brandLight} />
                  <Stop offset="1" stopColor="#7DD3FC" />
                </LinearGradient>
                <LinearGradient id={`${uid}-w1`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#7DD3FC" />
                  <Stop offset="1" stopColor="#38BDF8" />
                </LinearGradient>
                <LinearGradient id={`${uid}-w2`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#38BDF8" />
                  <Stop offset="1" stopColor="#0EA5E9" />
                </LinearGradient>
                <LinearGradient id={`${uid}-w3`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#0284C7" />
                  <Stop offset="1" stopColor="#0369A1" />
                </LinearGradient>
                <ClipPath id={`${uid}-glass`}>
                  <Path d={GLASS} />
                </ClipPath>
                <ClipPath id={`${uid}-water`}>
                  <Rect x="0" y={waterY} width="427" height="430" />
                </ClipPath>
              </Defs>
              {TICKS.map((_, i) => {
                const y = 18 + i * 80;
                return <Path key={i} d={`M 8 ${y} H 419`} stroke={T.border} strokeWidth="1" />;
              })}
              <Path d={GLASS} fill={`url(#${uid}-empty)`} />
              <G clipPath={`url(#${uid}-glass)`}>
                <G clipPath={`url(#${uid}-water)`}>
                  <Path d={WAVE_TOP} fill={`url(#${uid}-w1)`} opacity={0.72} />
                  <Path d={WAVE_MID} fill={`url(#${uid}-w2)`} opacity={0.82} />
                  <Path d={WAVE_DEEP} fill={`url(#${uid}-w3)`} />
                </G>
              </G>
              <Path d={GLASS} fill="none" stroke={`url(#${uid}-stroke)`} strokeWidth="2" />
            </Svg>
            {done ? (
              <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
                <View
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                    backgroundColor: '#FFFFFF',
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.12,
                    shadowRadius: 16,
                    elevation: 6,
                  }}
                >
                  <HydrationCheck size={72} />
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
