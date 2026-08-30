import React from 'react';
import { Text, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { GoalFootSteps } from '@/components/health/steps-goal/StepsGoalIcons';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';
import { formatStepsCount } from '@/lib/stepsMetrics.shared';

/** Figma 8924:166603 — 24px horseshoe track. */
const TRACK_D =
  'M54.1767 257.823C34.0379 237.685 20.3233 212.026 14.767 184.093C9.21072 156.16 12.0624 127.206 22.9614 100.894C33.8604 74.581 52.3173 52.0913 75.998 36.2684C99.6786 20.4455 127.52 12 156 12C184.481 12 212.322 20.4455 236.002 36.2684C259.683 52.0913 278.14 74.581 289.039 100.894C299.938 127.206 302.789 156.16 297.233 184.093C291.677 212.026 277.962 237.685 257.823 257.823';

/** Figma 8924:166604 — 8px inner rail. */
const RAIL_D =
  'M48.5198 263.48C27.2623 242.223 12.7857 215.139 6.92071 185.654C1.05575 156.169 4.06586 125.606 15.5704 97.8321C27.0749 70.0577 46.5571 46.3186 71.5534 29.6166C96.5497 12.9146 125.937 4 156 4C186.063 4 215.45 12.9146 240.447 29.6166C265.443 46.3186 284.925 70.0578 296.43 97.8321C307.934 125.606 310.944 156.169 305.079 185.654C299.214 215.139 284.738 242.223 263.48 263.48';

/** Figma 8924:166606 — 10px dashed ticks (`1 64`). */
const TICKS_D =
  'M49.0781 254.116C29.0792 234.117 15.4597 208.637 9.94204 180.898C4.42435 153.159 7.25623 124.406 18.0796 98.2763C28.9029 72.1464 47.2316 49.8129 70.7478 34.0998C94.264 18.3868 121.912 10 150.194 10C178.477 10 206.125 18.3868 229.641 34.0998C253.157 49.8129 271.486 72.1464 282.309 98.2763C293.132 124.406 295.964 153.159 290.447 180.898C284.929 208.637 271.31 234.117 251.311 254.116';

const CX = 156;
const CY = 156;
const R = 144;
const TRACK_LEN = 679;
const START_DEG = 135;
const SWEEP_DEG = 270;

type Props = {
  current: number;
  target: number;
  percent: number;
  daysLeft: number;
};

export function StepsGoalGauge({ current, target, percent, daysLeft }: Props) {
  const FIGMA_STEPS = useFigmaSteps();
  const t = Math.min(1, Math.max(0, target > 0 ? current / target : 0));
  const rail = FIGMA_STEPS.border === '#E5E7EB' ? '#D1D5DB' : '#6B7280';
  const deg = START_DEG + t * SWEEP_DEG;
  const rad = (deg * Math.PI) / 180;
  const needleX = CX + R * Math.cos(rad);
  const needleY = CY + R * Math.sin(rad);

  return (
    <View style={{ width: 375, maxWidth: '100%', height: 319, alignSelf: 'center' }}>
      <Svg width={312} height={266.309} style={{ position: 'absolute', left: 32, top: 15 }}>
        <Path d={TRACK_D} stroke={FIGMA_STEPS.border} strokeWidth={24} strokeLinecap="round" fill="none" />
        <Path d={RAIL_D} stroke={rail} strokeWidth={8} strokeLinecap="round" fill="none" />
        <G transform="translate(5.81, 3)">
          <Path d={TICKS_D} stroke={rail} strokeWidth={10} strokeDasharray="1 64" fill="none" />
        </G>
        {t > 0 ? (
          <>
            <Path
              d={TRACK_D}
              stroke={FIGMA_STEPS.brand}
              strokeWidth={24}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${TRACK_LEN * t} ${TRACK_LEN}`}
            />
            <Path
              d={RAIL_D}
              stroke={FIGMA_STEPS.brand}
              strokeWidth={8}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${TRACK_LEN * t} ${TRACK_LEN}`}
            />
            <G transform={`translate(${needleX}, ${needleY}) rotate(${deg - 90})`}>
              <Rect
                x={-3}
                y={-16}
                width={6}
                height={32}
                rx={4}
                fill={FIGMA_STEPS.brand}
                stroke={FIGMA_STEPS.pageBg}
                strokeWidth={2}
              />
            </G>
          </>
        ) : null}
      </Svg>

      <View
        style={{
          position: 'absolute',
          left: 75,
          top: 76,
          width: 226,
          height: 196,
          alignItems: 'center',
          gap: 16,
        }}
      >
        <GoalFootSteps size={48} color={FIGMA_STEPS.brand} />
        <View style={{ alignItems: 'center', gap: 8, width: '100%' }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 48,
              lineHeight: 56,
              letterSpacing: -0.75,
              color: FIGMA_STEPS.textPrimary,
              textAlign: 'center',
              width: '100%',
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
              width: '100%',
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
              textAlign: 'center',
            }}
          >
            {ka.stepsGoal.daysLeft(daysLeft)}
          </Text>
        </View>
      </View>

      <Text
        style={{
          position: 'absolute',
          left: 75,
          top: 284,
          width: 40,
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
          left: 239,
          top: 284,
          width: 80,
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
