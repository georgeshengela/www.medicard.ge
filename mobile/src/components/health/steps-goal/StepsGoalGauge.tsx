import React from 'react';
import { Image, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';
import { formatStepsCount } from '@/lib/stepsMetrics.shared';
import { GoalFootSteps } from '@/components/health/steps-goal/StepsGoalIcons';

const SIZE = 312;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 132;
const STROKE = 18;

function polar(angle: number, radius: number) {
  return {
    x: CX + radius * Math.cos(angle),
    y: CY - radius * Math.sin(angle),
  };
}

function arc(fromT: number, toT: number, radius: number) {
  const a0 = Math.PI * (1 - fromT);
  const a1 = Math.PI * (1 - toT);
  const start = polar(a0, radius);
  const end = polar(a1, radius);
  const large = toT - fromT > 0.5 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

type Props = {
  current: number;
  target: number;
  percent: number;
  daysLeft: number;
};

export function StepsGoalGauge({ current, target, percent, daysLeft }: Props) {
  const FIGMA_STEPS = useFigmaSteps();
  const t = Math.min(1, Math.max(0, target > 0 ? current / target : 0));
  const needle = polar(Math.PI * (1 - t), R);

  return (
    <View style={{ width: SIZE, height: 319, alignSelf: 'center' }}>
      <Image
        source={require('../../../../assets/figma/steps-goal/gauge-ticks.png')}
        style={{ position: 'absolute', width: 300, height: 261, left: 6, top: 15 }}
        resizeMode="contain"
      />
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute', top: 3.5, left: 0 }}>
        <Path
          d={arc(0, 1, R)}
          stroke="#E5E7EB"
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
        {t > 0 ? (
          <Path
            d={arc(0, t, R)}
            stroke={FIGMA_STEPS.brand}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
      </Svg>
      {t > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: needle.x - 3,
            top: needle.y + 3.5 - 16,
            width: 6,
            height: 32,
            borderRadius: 4,
            backgroundColor: FIGMA_STEPS.brand,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            transform: [{ rotate: `${90 - t * 180}deg` }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 3,
          }}
        />
      ) : null}

      <View
        style={{
          position: 'absolute',
          left: 75,
          top: 76,
          width: 226,
          alignItems: 'center',
          gap: 16,
        }}
      >
        <GoalFootSteps size={48} />
        <View style={{ alignItems: 'center', gap: 8, width: '100%' }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 48,
              lineHeight: 56,
              letterSpacing: -0.75,
              color: FIGMA_STEPS.textPrimary,
              textAlign: 'center',
            }}
          >
            {formatStepsCount(current)}
          </Text>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 18,
              lineHeight: 24,
              color: FIGMA_STEPS.textSecondary,
              textAlign: 'center',
            }}
          >
            {ka.stepsGoal.outOf(formatStepsCount(target))}{' '}
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold' }}>({percent}%)</Text>
          </Text>
        </View>
        <View
          style={{
            backgroundColor: FIGMA_STEPS.brandQuaternary,
            borderWidth: 1,
            borderColor: FIGMA_STEPS.brandLight,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            ...FIGMA_STEPS.shadowXs,
          }}
        >
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 14,
              lineHeight: 20,
              color: FIGMA_STEPS.brand,
            }}
          >
            {ka.stepsGoal.daysLeft(daysLeft)}
          </Text>
        </View>
      </View>

      <Text
        style={{
          position: 'absolute',
          left: 79,
          top: 284,
          width: 32,
          fontFamily: 'NotoSansGeorgian_500Medium',
          fontSize: 12,
          lineHeight: 16,
          color: '#9CA3AF',
          textAlign: 'center',
        }}
      >
        0
      </Text>
      <Text
        style={{
          position: 'absolute',
          left: 263,
          top: 284,
          width: 40,
          fontFamily: 'NotoSansGeorgian_500Medium',
          fontSize: 12,
          lineHeight: 16,
          color: '#9CA3AF',
          textAlign: 'center',
        }}
      >
        {formatStepsCount(target)}
      </Text>
    </View>
  );
}
