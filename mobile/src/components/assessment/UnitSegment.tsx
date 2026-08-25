import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { isLatinUnitLabel, unitLabelFontFamily } from '@/components/assessment/unitLabelFont';
import { ASSESSMENT } from '@/constants/assessmentLayout';

export type UnitOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  options: UnitOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

/** Figma Tab — 4pt inset, 16pt track, 12pt active pill. */
export function UnitSegment({ value, options, onChange, disabled }: Props) {
  return (
    <View
      style={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: ASSESSMENT.track,
        borderRadius: 16,
        padding: 4,
      }}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 40,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: active ? ASSESSMENT.surface : 'transparent',
              shadowColor: active ? '#000000' : 'transparent',
              shadowOpacity: active ? 0.08 : 0,
              shadowRadius: active ? 14 : 0,
              shadowOffset: { width: 0, height: 6 },
              elevation: active ? 3 : 0,
            }}
          >
            <Text
              style={{
                fontFamily: unitLabelFontFamily(option.label, active),
                fontWeight: isLatinUnitLabel(option.label) && active ? '600' : undefined,
                fontSize: 14,
                lineHeight: 20,
                color: active ? ASSESSMENT.textPrimary : ASSESSMENT.textSecondary,
                textAlign: 'center',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
