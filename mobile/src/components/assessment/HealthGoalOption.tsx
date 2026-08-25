import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { FIGMA_ASSESSMENT_SHADOW } from '@/constants/figmaAssessmentIntro';

const TEAL = '#14B8A6';

type Props = {
  title: string;
  selected: boolean;
  onPress: () => void;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

/** Figma List Item — health goal row (9217:164462). */
export function HealthGoalOption({ title, selected, onPress, icon: Icon }: Props) {
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
          borderColor: selected ? TEAL : '#E5E7EB',
          backgroundColor: selected ? '#F0FDFA' : '#F9FAFB',
          ...FIGMA_ASSESSMENT_SHADOW,
        }}
      >
        <Icon size={24} color="#1F2937" strokeWidth={2} />
        <Text
          style={{
            flex: 1,
            fontFamily: selected ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_500Medium',
            fontSize: 16,
            lineHeight: 22,
            color: '#1F2937',
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
            borderColor: '#D1D5DB',
            backgroundColor: selected ? TEAL : '#FFFFFF',
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
