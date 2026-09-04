import React, { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { FigmaHydrationDrop, FigmaHydrationHatch } from '@/components/hydration/HydrationIcons';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { ka } from '@/i18n/ka';
import { formatMlTight } from '@/lib/hydration';

const BAR_H = 50;
const SEP_W = 4;
const SEP_H = 42;
const GAP = 2;
const HATCH_W = 173;
const HATCH_H = 97;

type Props = {
  todayMl: number;
  goalMl: number;
  remainingMl: number;
  updatedLabel: string;
  onPress: () => void;
};

/** Figma 9283:202564 — Nightingale hydration card (hatched teal progress). */
export function HydrationFigmaCard({ todayMl, goalMl, remainingMl, updatedLabel, onPress }: Props) {
  const T = useFigmaHydration();
  const [barW, setBarW] = useState(0);
  const progress = goalMl > 0 ? Math.min(1, Math.max(0, todayMl / goalMl)) : 0;
  const onBar = (e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width);

  const usable = Math.max(0, barW - SEP_W - GAP * 2);
  const fillW = progress <= 0 ? 0 : progress >= 1 ? barW : Math.max(8, Math.round(usable * progress));
  const showRest = progress > 0 && progress < 1 && barW > 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        backgroundColor: T.cardBg,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: T.border,
        padding: 24,
        gap: 20,
        overflow: 'hidden',
        ...T.shadowXs,
      }}
    >
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_500Medium',
                fontSize: 16,
                lineHeight: 22,
                color: T.textSecondary,
              }}
            >
              {updatedLabel}
            </Text>
          </View>
          <FigmaHydrationDrop color={T.brand} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4, minWidth: 0 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 48,
                lineHeight: 56,
                letterSpacing: -0.75,
                color: T.textPrimary,
              }}
            >
              {Math.round(todayMl).toLocaleString('en-US')}
            </Text>
            <View style={{ paddingBottom: 3 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_500Medium',
                  fontSize: 24,
                  lineHeight: 32,
                  letterSpacing: -0.25,
                  color: T.textSecondary,
                }}
              >
                {ka.hydration.unit}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ padding: 1 }}>
                <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: T.destructive }} />
              </View>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_500Medium',
                  fontSize: 14,
                  lineHeight: 20,
                  color: T.textPrimary,
                }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.hydration.goalColon}</Text>
                {` ${formatMlTight(goalMl)}`}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 14,
                lineHeight: 20,
                color: T.textSecondary,
              }}
            >
              {ka.hydration.leftAmount(formatMlTight(remainingMl))}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: T.border }} />

      <View style={{ height: 68 }}>
        <Text
          style={{
            position: 'absolute',
            left: 1,
            top: 0,
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 10,
            lineHeight: 14,
            color: T.textPrimary,
          }}
        >
          {ka.hydration.barLow}
        </Text>
        <Text
          style={{
            position: 'absolute',
            right: 1,
            top: 0,
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 10,
            lineHeight: 14,
            color: T.textPrimary,
          }}
        >
          {ka.hydration.barLow}
        </Text>
        <View
          onLayout={onBar}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 18,
            height: BAR_H,
            flexDirection: 'row',
            alignItems: 'center',
            gap: GAP,
          }}
        >
          {fillW > 0 ? (
            <View
              style={{
                width: fillW,
                height: BAR_H,
                borderRadius: 8,
                backgroundColor: T.brand,
                overflow: 'hidden',
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  ...absoluteFill,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View style={{ width: HATCH_W, height: HATCH_H, transform: [{ rotate: '60deg' }] }}>
                  <FigmaHydrationHatch />
                </View>
              </View>
            </View>
          ) : null}
          {showRest ? (
            <View
              style={{
                width: SEP_W,
                height: SEP_H,
                borderRadius: 1234,
                backgroundColor: T.brand,
              }}
            />
          ) : null}
          {progress < 1 ? (
            <View
              style={{
                flex: 1,
                height: BAR_H,
                borderRadius: 8,
                backgroundColor: T.border,
              }}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const absoluteFill = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};
