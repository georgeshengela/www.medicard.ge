import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { useThemeColors } from '@/theme/colors';

export type ChoiceTileOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
};

type Props<T extends string> = {
  label?: string;
  value: T | null;
  options: Array<ChoiceTileOption<T>>;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
  error?: string | null;
  hint?: string;
};

/** Wrapped option tiles for lists that do not fit a GenderSelect track. */
export function ChoiceTiles<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 2,
  error,
  hint,
}: Props<T>) {
  const auth = useFigmaAuth();
  const colors = useThemeColors();
  const width = columns === 1 ? '100%' : columns === 3 ? '33.333%' : '50%';

  return (
    <View className="w-full">
      {label ? <Text className="mb-1.5 text-sm font-semibold text-text-200">{label}</Text> : null}

      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}
      >
        {options.map((option) => {
          const selected = value === option.value;
          const Icon = option.icon;
          return (
            <View key={option.value} style={{ width, padding: 4 }}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                onPress={() => onChange(option.value)}
                className="active:opacity-80"
                style={{
                  minHeight: 48,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: selected ? auth.primaryBg : colors.bg300,
                  backgroundColor: selected ? auth.primaryBg : colors.bg200,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {Icon ? (
                  <Icon size={18} color={selected ? colors.onPrimary : colors.primary200} strokeWidth={2.2} />
                ) : null}
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 14,
                    lineHeight: 20,
                    textAlign: 'center',
                    color: selected ? colors.onPrimary : colors.text200,
                    flexShrink: 1,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            </View>
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
