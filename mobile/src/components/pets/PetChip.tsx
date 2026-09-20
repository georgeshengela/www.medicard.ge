import React from 'react';
import { Pressable, Text } from 'react-native';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { useThemeColors } from '@/theme/colors';

export function PetChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const auth = useFigmaAuth();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className="active:opacity-80"
      style={{
        minHeight: 40,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: selected ? auth.primaryBg : colors.bg300,
        backgroundColor: selected ? auth.primaryBg : colors.bg200,
        marginRight: 8,
        marginBottom: 8,
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 14,
          lineHeight: 20,
          color: selected ? colors.onPrimary : colors.text200,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
