import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import {
  StreakDayCompleted,
  StreakDaySkipped,
  StreakFlameHighlight,
  StreakFlameShape,
  StreakGlowInner,
  StreakGlowMid,
  StreakGlowOuter,
} from '@/components/check-in/StreakAssets';
import { FIGMA_STREAK, useFigmaStreak } from '@/constants/figmaStreakLayout';
import type { CheckInDayStatus } from '@/lib/api';

const WEEKDAYS = ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'] as const;

export function StreakFlameHero({ weekStreak }: { weekStreak: number }) {
  const FIGMA = useFigmaStreak();

  return (
    <View style={{ width: '100%', height: FIGMA.heroHeight, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
      <View
        style={{
          position: 'absolute',
          width: FIGMA.glowOuter,
          height: FIGMA.glowOuter,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StreakGlowOuter />
      </View>
      <View
        style={{
          position: 'absolute',
          width: FIGMA.glowMid,
          height: FIGMA.glowMid,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StreakGlowMid />
      </View>
      <View
        style={{
          position: 'absolute',
          width: FIGMA.glowInner,
          height: FIGMA.glowInner,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StreakGlowInner />
      </View>

      <Animated.View entering={ZoomIn.springify().damping(14)} style={{ width: FIGMA.flameWidth, height: FIGMA.flameHeight }}>
        <StreakFlameShape />
        <View
          style={{
            position: 'absolute',
            left: 25.5,
            top: 55.37,
            width: FIGMA.highlightWidth,
            height: FIGMA.highlightHeight,
          }}
        >
          <StreakFlameHighlight />
        </View>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 40,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 72,
              lineHeight: 80,
              letterSpacing: -1.5,
              color: FIGMA.onFlame,
            }}
          >
            {weekStreak}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

export function StreakWeekRow({
  days,
}: {
  days: { date: string; status: CheckInDayStatus }[];
}) {
  const FIGMA = useFigmaStreak();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        width: '100%',
        overflow: 'visible',
      }}
    >
      {days.map((day, index) => (
        <View key={day.date} style={{ flex: 1, alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={{
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 11,
              lineHeight: 14,
              letterSpacing: -0.2,
              color: FIGMA.weekday,
              textAlign: 'center',
            }}
          >
            {WEEKDAYS[index]}
          </Text>
          <View style={{ width: FIGMA.daySize, height: FIGMA.daySize, overflow: 'visible' }}>
            {day.status === 'completed' ? (
              <StreakDayCompleted />
            ) : day.status === 'skipped' ? (
              <StreakDaySkipped />
            ) : (
              <View
                style={{
                  width: FIGMA.daySize,
                  height: FIGMA.daySize,
                  borderRadius: 999,
                  backgroundColor: FIGMA.emptyDot,
                }}
              />
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

export function StreakBonusChip({ label }: { label: string }) {
  return (
    <Animated.View
      entering={FadeIn.delay(200)}
      style={{
        alignSelf: 'center',
        backgroundColor: '#F59E0B',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 5,
      }}
    >
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 12,
          lineHeight: 16,
          color: '#FFFFFF',
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
