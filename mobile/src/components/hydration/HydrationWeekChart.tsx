import React, { useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { ka } from '@/i18n/ka';

type Props = {
  values?: number[];
  compareValues?: number[];
  height?: number;
};

/** Figma 9017:209858 — assets/figma/hydration/violin-a.svg (286×190) */
const FIGMA_VIOLIN_A =
  'M0 95C15.0311 95 37.4326 64.9159 57.5945 64.9159C77.7558 64.9156 73.802 48.9892 85.4107 49.0841C97.3091 49.1817 101.714 59.5327 113.613 59.5327C125.511 59.5312 129.748 19 141.792 19C153.836 19.0003 158.835 39.5835 169.619 39.5841C180.403 39.5841 186.553 25.3341 197.81 25.3341C209.068 25.3345 212.834 48.7664 226.332 48.7664C239.83 48.7679 256.421 95 286 95C256.421 95 239.83 141.232 226.332 141.234C212.834 141.234 209.068 164.666 197.81 164.666C186.553 164.666 180.403 150.416 169.619 150.416C158.835 150.417 153.836 171 141.792 171C129.748 171 125.511 130.469 113.613 130.467C101.714 130.467 97.3091 140.818 85.4107 140.916C73.802 141.011 77.7558 125.084 57.5945 125.084C37.4326 125.084 15.0311 95 0 95Z';

/** Figma 9017:209860 — assets/figma/hydration/violin-b.svg (286×190) */
const FIGMA_VIOLIN_B =
  'M286 95C267.588 95 165.959 96.6373 140.141 115.317C118.151 131.228 115.445 171 94.9522 171C74.4591 171 70.942 105.959 61.6862 105.959C48.2626 105.96 52.198 148.05 33.2468 148.05C15.6375 148.049 24.4084 95 0 95C24.4084 95 15.6375 41.951 33.2468 41.9498C52.198 41.9498 48.2626 84.0402 61.6862 84.0411C70.942 84.0411 74.4591 19 94.9522 19C115.445 19.0002 118.151 58.7723 140.141 74.6826C165.959 93.3627 267.588 95 286 95Z';

const PLOT_W = 286;
const PLOT_H = 190;
const TICKS = [70, 60, 50, 40, 30, 20, 10] as const;
const Y_W = 24;

/** Figma 9017:209643 — two overlapping teal violins, Y 10–70, Mon–Sun. */
export function HydrationWeekChart({ height = 220 }: Props) {
  const T = useFigmaHydration();
  const [width, setWidth] = useState(0);
  const labels = ka.hydration.weekdayMon;

  return (
    <View style={{ height }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', height: PLOT_H }}>
        <View style={{ width: Y_W, height: PLOT_H, justifyContent: 'space-between' }}>
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
        <View style={{ flex: 1, marginLeft: 8, height: PLOT_H }}>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 8, bottom: 8, justifyContent: 'space-between' }}>
            {TICKS.map((tick) => (
              <View key={tick} style={{ height: 1, backgroundColor: T.border }} />
            ))}
          </View>
          {width > 0 ? (
            <Svg width="100%" height={PLOT_H} viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}>
              <Path d={FIGMA_VIOLIN_B} fill="#14B8A6" fillOpacity={0.6} />
              <Path d={FIGMA_VIOLIN_A} fill="#14B8A6" fillOpacity={0.6} />
            </Svg>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', paddingLeft: Y_W + 8, height: 16, marginTop: 6 }}>
        {labels.map((label) => (
          <Text
            key={label}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              lineHeight: 16,
              color: T.textSecondary,
            }}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
