import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import type { Gender } from '@/lib/api';

type Props = {
  label?: string;
  value: Gender | null;
  onChange: (gender: Gender) => void;
  error?: string | null;
  hint?: string;
};

const OPTIONS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: ka.auth.genderMale },
  { value: 'FEMALE', label: ka.auth.genderFemale },
  { value: 'OTHER', label: ka.auth.genderOther },
];

export function GenderSelect({ label, value, onChange, error, hint }: Props) {
  return (
    <View className="w-full">
      {label ? <Text className="mb-1.5 text-sm font-semibold text-text-200">{label}</Text> : null}

      <View
        accessibilityRole="radiogroup"
        className={`flex-row rounded-2xl border bg-surface p-1 ${error ? 'border-state-danger' : 'border-bg-300'}`}
      >
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => onChange(option.value)}
              className={`flex-1 items-center rounded-xl py-2.5 active:opacity-70 ${selected ? 'bg-primary-200' : ''}`}
            >
              <Text
                // Georgian descenders clip at the default line height.
                style={{ fontSize: 15, lineHeight: 22 }}
                className={`font-semibold ${selected ? 'text-white' : 'text-text-200'}`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text className="mt-1.5 text-sm text-state-danger">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-sm text-text-300">{hint}</Text>
      ) : null}
    </View>
  );
}
