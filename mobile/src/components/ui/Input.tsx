import React, { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: LucideIcon;
  secure?: boolean;
};

export function Input({ label, error, hint, icon: Icon, secure = false, style, ...rest }: Props) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderClass = error ? 'border-state-danger' : focused ? 'border-primary-200' : 'border-bg-300';

  return (
    <View className="w-full">
      {label ? <Text className="mb-1.5 text-sm font-semibold text-text-200">{label}</Text> : null}

      <View className={`flex-row items-center rounded-2xl border bg-surface px-4 ${borderClass}`}>
        {Icon ? <Icon size={18} color={focused ? colors.primary200 : colors.text300} strokeWidth={2} /> : null}

        <TextInput
          className={`flex-1 py-3.5 text-base text-text-100 ${Icon ? 'ml-3' : ''}`}
          placeholderTextColor={colors.text300}
          secureTextEntry={secure && !revealed}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // NativeWind cannot express these on TextInput reliably across platforms.
          style={[{ fontSize: 15, lineHeight: 20 }, style]}
          {...rest}
        />

        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'პაროლის დამალვა' : 'პაროლის ჩვენება'}
            hitSlop={10}
            onPress={() => setRevealed((value) => !value)}
          >
            {revealed ? (
              <EyeOff size={18} color={colors.text300} strokeWidth={2} />
            ) : (
              <Eye size={18} color={colors.text300} strokeWidth={2} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text className="mt-1.5 text-sm text-state-danger">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-sm text-text-300">{hint}</Text>
      ) : null}
    </View>
  );
}
