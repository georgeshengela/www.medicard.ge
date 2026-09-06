import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { useIsDark } from '@/theme/colors';
import { ka } from '@/i18n/ka';

export const CHECKUP_FREQUENCY_KEYS = ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'YEARLY'] as const;
export type CheckupFrequencyKey = (typeof CHECKUP_FREQUENCY_KEYS)[number];

type Props = {
  value: string | null;
  onSelect: (value: CheckupFrequencyKey) => void;
};

/** Nightingale _PickerItem — Figma 9217:164946. */
const PICKER = {
  gap: 12,
  pad: 16,
  itemPadX: 16,
  itemPadY: 12,
  radius: 18,
  fontSize: 24,
  lineHeight: 32,
  letterSpacing: -0.25,
  selectedBg: '#F0FDFA',
  selectedBorder: '#14B8A6',
  selectedText: '#14B8A6',
  nearText: '#4B5563',
  farText: '#9CA3AF',
} as const;

const PICKER_DARK = {
  selectedBg: '#042F2E',
  nearText: '#D1D5DB',
  farText: '#6B7280',
} as const;

/** Figma 9217:164946 picker — 5 rows, 12pt gap, selected Monthly chrome. Taps write the value. */
export function CheckupFrequencyList({ value, onSelect }: Props) {
  const dark = useIsDark();
  const theme = dark ? { ...PICKER, ...PICKER_DARK } : PICKER;
  const selected = (value && CHECKUP_FREQUENCY_KEYS.includes(value as CheckupFrequencyKey)
    ? value
    : 'MONTHLY') as CheckupFrequencyKey;
  const selectedIndex = CHECKUP_FREQUENCY_KEYS.indexOf(selected);

  useEffect(() => {
    if (!value) onSelect('MONTHLY');
  }, [value, onSelect]);

  return (
    <View style={{ width: '100%', padding: PICKER.pad, gap: PICKER.gap }}>
      {CHECKUP_FREQUENCY_KEYS.map((key, index) => {
        const active = selected === key;
        const distance = Math.abs(index - selectedIndex);
        const color = active ? theme.selectedText : distance <= 1 ? theme.nearText : theme.farText;

        return (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={ka.assessment.options.checkupFrequency[key]}
            onPress={() => {
              if (key !== value) pickerSelectionTick();
              onSelect(key);
            }}
            style={{
              width: '100%',
              paddingHorizontal: PICKER.itemPadX,
              paddingVertical: PICKER.itemPadY,
              borderRadius: PICKER.radius,
              borderWidth: 1,
              borderColor: active ? theme.selectedBorder : 'transparent',
              backgroundColor: active ? theme.selectedBg : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: PICKER.fontSize,
                lineHeight: PICKER.lineHeight,
                letterSpacing: PICKER.letterSpacing,
                color,
                textAlign: 'center',
              }}
            >
              {ka.assessment.options.checkupFrequency[key]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
