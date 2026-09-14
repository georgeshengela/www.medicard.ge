import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  label?: string;
  value: T | null;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
  error?: string | null;
  hint?: string;
};

/** Gender / theme track: one row of options, selected fill is brand. */
export function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
  hint,
}: Props<T>) {
  const auth = useFigmaAuth();

  return (
    <View className="w-full">
      {label ? <Text className="mb-1.5 text-sm font-semibold text-text-200">{label}</Text> : null}

      <View
        accessibilityRole="radiogroup"
        className={`flex-row rounded-2xl border bg-bg-200 p-1 ${error ? 'border-state-danger' : 'border-bg-300'}`}
      >
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => onChange(option.value)}
              className="flex-1 items-center justify-center rounded-xl px-1 py-2.5 active:opacity-70"
              style={selected ? { backgroundColor: auth.primaryBg } : undefined}
            >
              <Text
                style={{ fontSize: 14, lineHeight: 20, textAlign: 'center' }}
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
