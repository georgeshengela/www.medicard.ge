import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';

type Props = {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

/** Figma forgot-password method row card. */
export function AuthMethodCard({ icon: Icon, iconBg, iconColor, label, onPress, disabled }: Props) {
  const auth = useFigmaAuth();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 18,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: auth.inputBorder,
        backgroundColor: auth.inputBg,
        opacity: disabled ? 0.5 : 1,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={22} color={iconColor} strokeWidth={2.2} />
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 16,
          color: auth.fieldText,
        }}
      >
        {label}
      </Text>
      <ChevronRight size={20} color={auth.iconMuted} strokeWidth={2.2} />
    </Pressable>
  );
}
