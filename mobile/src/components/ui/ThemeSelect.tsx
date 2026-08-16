import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Monitor, Moon, Sun } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';
import { useTheme, type ThemePreference } from '@/store/ThemeContext';

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: ka.profile.themeLight, Icon: Sun },
  { value: 'dark', label: ka.profile.themeDark, Icon: Moon },
  { value: 'system', label: ka.profile.themeSystem, Icon: Monitor },
];

export function ThemeSelect() {
  const { preference, setPreference } = useTheme();
  const colors = useThemeColors();

  return (
    <View className="w-full">
      <Text className="mb-1.5 text-sm font-semibold text-text-200">{ka.profile.appearance}</Text>

      <View
        accessibilityRole="radiogroup"
        className="flex-row rounded-2xl border border-bg-300 bg-surface p-1"
      >
        {OPTIONS.map((option) => {
          const selected = preference === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => setPreference(option.value)}
              className={`flex-1 items-center rounded-xl py-2.5 active:opacity-70 ${
                selected ? 'bg-primary-200' : ''
              }`}
            >
              <option.Icon
                size={16}
                color={selected ? colors.onPrimary : colors.text200}
                strokeWidth={2.2}
              />
              <Text
                style={{ fontSize: 13, lineHeight: 18 }}
                className={`mt-1 font-semibold ${selected ? 'text-white' : 'text-text-200'}`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="mt-1.5 text-sm text-text-300">{ka.profile.themeHint}</Text>
    </View>
  );
}
