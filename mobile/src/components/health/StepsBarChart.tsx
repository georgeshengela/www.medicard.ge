import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { formatStepsCount } from '@/lib/stepsMetrics.shared';
import type { StepsChartBar } from '@/types/stepsMetrics';

type Props = {
  bars: StepsChartBar[];
  goalLine?: number;
};

export function StepsBarChart({ bars, goalLine }: Props) {
  const FIGMA_STEPS = useFigmaSteps();
  const [width, setWidth] = useState(0);
  const max = useMemo(() => Math.max(...bars.map((b) => b.value), goalLine ?? 0, 1), [bars, goalLine]);
  const [selected, setSelected] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const chartH = 180;
  const barGap = 4;
  const barW = width > 0 ? (width - barGap * (bars.length - 1)) / bars.length : 0;

  return (
    <View onLayout={onLayout} style={{ height: chartH + 28, paddingTop: 8 }}>
      {goalLine != null && goalLine > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 8 + chartH * (1 - goalLine / max),
            borderTopWidth: 1,
            borderStyle: 'dashed',
            borderColor: FIGMA_STEPS.border,
            zIndex: 1,
          }}
        >
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: -10,
              backgroundColor: FIGMA_STEPS.textPrimary,
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 10, color: '#FFF' }}>
              {formatStepsCount(goalLine)}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartH, gap: barGap }}>
        {bars.map((bar, idx) => {
          const h = (bar.value / max) * chartH;
          const active = selected === idx;
          return (
            <Pressable
              key={`${bar.label}-${idx}`}
              accessibilityRole="button"
              onPress={() => setSelected(active ? null : idx)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}
            >
              {active && bar.value > 0 ? (
                <View
                  style={{
                    marginBottom: 4,
                    backgroundColor: FIGMA_STEPS.textPrimary,
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, color: '#FFF' }}>
                    {formatStepsCount(bar.value)}
                  </Text>
                </View>
              ) : null}
              <View
                style={{
                  width: barW || '100%',
                  height: Math.max(4, h),
                  borderRadius: 6,
                  backgroundColor: bar.value > 0 ? FIGMA_STEPS.barActive : FIGMA_STEPS.barDim,
                  opacity: active ? 1 : bar.value > 0 ? 0.85 : 0.5,
                }}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', marginTop: 6, gap: barGap }}>
        {bars.map((bar, idx) => (
          <Text
            key={`lbl-${bar.label}-${idx}`}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 11,
              color: FIGMA_STEPS.textSecondary,
            }}
          >
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
