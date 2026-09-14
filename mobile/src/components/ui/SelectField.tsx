import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, type LucideIcon } from 'lucide-react-native';
import { FIGMA_AUTH_SHADOW, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { useThemeColors } from '@/theme/colors';

type Props = {
  label?: string;
  value: string;
  placeholder?: string;
  onPress: () => void;
  error?: string | null;
  hint?: string;
  icon?: LucideIcon;
};

/** Figma 11358:72329 InputDropdownBase — radius 14, min-h 48, 20px icon + chevron. */
export function SelectField({ label, value, placeholder, onPress, error, hint, icon: Icon }: Props) {
  const colors = useThemeColors();
  const auth = useFigmaAuth();
  const shown = value.trim();

  return (
    <View className="w-full">
      {label ? (
        <Text
          style={{
            marginBottom: 8,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 14,
            lineHeight: 20,
            color: auth.labelColor,
          }}
        >
          {label}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={{
          minHeight: auth.inputMinHeight,
          borderRadius: auth.inputRadius,
          backgroundColor: auth.inputBg,
          borderWidth: 1,
          borderColor: error ? colors.danger : auth.inputBorder,
          paddingHorizontal: auth.inputPaddingX,
          paddingVertical: auth.inputPaddingY,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          ...FIGMA_AUTH_SHADOW,
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {Icon ? (
            <Icon size={20} color={shown ? auth.primaryBg : auth.iconMuted} strokeWidth={2} />
          ) : null}
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 16,
              lineHeight: 22,
              color: shown ? auth.fieldText : auth.placeholder,
            }}
          >
            {shown || placeholder || ''}
          </Text>
        </View>
        <ChevronDown size={20} color={auth.iconMuted} strokeWidth={2} />
      </Pressable>

      {error ? (
        <Text className="mt-1.5 text-sm text-state-danger">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 text-sm text-text-300">{hint}</Text>
      ) : null}
    </View>
  );
}
