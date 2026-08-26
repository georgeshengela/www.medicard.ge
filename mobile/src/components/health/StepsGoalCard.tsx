import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Flag } from 'lucide-react-native';
import { FIGMA_STEPS } from '@/constants/figmaStepsLayout';
import { formatStepsCount } from '@/lib/stepsMetrics.shared';
import { ka } from '@/i18n/ka';

type Props = {
  goal: number;
  current: number;
  remaining: number;
};

export function StepsGoalCard({ goal, current, remaining }: Props) {
  const progress = Math.min(1, current / Math.max(goal, 1));
  const size = 72;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);

  return (
    <View
      style={{
        backgroundColor: FIGMA_STEPS.cardBg,
        borderRadius: FIGMA_STEPS.cardRadius,
        borderWidth: 1,
        borderColor: FIGMA_STEPS.border,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: FIGMA_STEPS.textPrimary }}>
          {ka.steps.goalSteps(formatStepsCount(goal))}
        </Text>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 13,
            lineHeight: 18,
            color: FIGMA_STEPS.textSecondary,
          }}
        >
          {remaining > 0 ? ka.steps.goalRemaining(formatStepsCount(remaining)) : ka.steps.goalReached}
        </Text>
      </View>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={FIGMA_STEPS.border} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={FIGMA_STEPS.brand}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <Flag size={22} color={FIGMA_STEPS.brand} strokeWidth={2.2} />
      </View>
    </View>
  );
}

type SectionProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
};

export function StepsSection({ title, actionLabel, onAction, children }: SectionProps) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18, color: FIGMA_STEPS.textPrimary }}>
          {title}
        </Text>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: FIGMA_STEPS.brand }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}
