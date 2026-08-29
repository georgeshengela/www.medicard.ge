import React from 'react';
import { Pressable, View } from 'react-native';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';

type Props = {
  value: boolean;
  onValueChange: (next: boolean) => void;
};

/** Figma 5550:11570 — 48×28 brand toggle, 24pt thumb. */
export function GoalToggle({ value, onValueChange }: Props) {
  const FIGMA_STEPS = useFigmaSteps();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        paddingHorizontal: 2,
        paddingVertical: 2,
        backgroundColor: value ? FIGMA_STEPS.brand : FIGMA_STEPS.barDim,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: value ? 'flex-end' : 'flex-start',
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: '#FFFFFF',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 2,
        }}
      />
    </Pressable>
  );
}
