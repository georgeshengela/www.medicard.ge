import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, Footprints } from 'lucide-react-native';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { formatStepLogDate, formatStepLogTime, formatStepsCount } from '@/lib/stepsMetrics.shared';
import { ka } from '@/i18n/ka';
import type { StepLogEntry } from '@/types/stepsMetrics';

type Props = {
  log: StepLogEntry;
  onPress?: () => void;
};

export function StepsHistoryRow({ log, onPress }: Props) {
  const FIGMA_STEPS = useFigmaSteps();
  const body = (
    <View
      style={{
        backgroundColor: FIGMA_STEPS.cardBg,
        borderRadius: FIGMA_STEPS.cardRadius,
        borderWidth: 1,
        borderColor: FIGMA_STEPS.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: FIGMA_STEPS.brandQuaternary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Footprints size={18} color={FIGMA_STEPS.brand} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: FIGMA_STEPS.textPrimary }}>
          {ka.steps.logSteps(formatStepsCount(log.count))}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: FIGMA_STEPS.textSecondary }}>
          {formatStepLogDate(log.at)}
        </Text>
      </View>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: FIGMA_STEPS.textSecondary }}>
        {formatStepLogTime(log.at)}
      </Text>
      {onPress ? <ChevronRight size={18} color="#9CA3AF" strokeWidth={2} /> : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  );
}
