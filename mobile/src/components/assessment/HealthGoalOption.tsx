import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { FIGMA_ASSESSMENT_SHADOW } from '@/constants/figmaAssessmentIntro';
import { useAssessment } from '@/constants/assessmentLayout';

const TEAL = '#14B8A6';

type Props = {
  title: string;
  selected: boolean;
  onPress: () => void;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

/** Figma List Item — health goal row (9217:164462). */
export function HealthGoalOption({ title, selected, onPress, icon: Icon }: Props) {
  const ASSESSMENT = useAssessment();
  return (
    <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: selected }} activeOpacity={0.88} onPress={onPress}>
      <View
        pointerEvents="none"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: selected ? TEAL : ASSESSMENT.border,
          backgroundColor: selected ? ASSESSMENT.selectedSoft : ASSESSMENT.surfaceMuted,
          ...FIGMA_ASSESSMENT_SHADOW,
        }}
      >
        <Icon size={24} color={ASSESSMENT.textPrimary} strokeWidth={2} />
        <Text
          style={{
            flex: 1,
            fontFamily: selected ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_500Medium',
            fontSize: 16,
            lineHeight: 22,
            color: ASSESSMENT.textPrimary,
          }}
        >
          {title}
        </Text>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            borderWidth: selected ? 0 : 1,
            borderColor: ASSESSMENT.border,
            backgroundColor: selected ? TEAL : ASSESSMENT.surface,
            alignItems: 'center',
            justifyContent: 'center',
            padding: selected ? 4 : 0,
          }}
        >
          {selected ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** Figma option order for node 9217:164456. */
export const HEALTH_GOAL_KEYS = ['overall', 'metrics', 'ai', 'sports', 'try'] as const;
