import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { velvetField, velvetLift, type VelvetPalette } from '@/theme/velvet';

type Props = {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Velvet screens: the row rests lightly on the page, its icon sits in a small pressed well. */
  palette?: VelvetPalette;
};

/** Figma forgot-password method row card. */
export function AuthMethodCard({ icon: Icon, iconBg, iconColor, label, onPress, disabled, palette: p }: Props) {
  const auth = useFigmaAuth();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      style={
        p
          ? {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingHorizontal: 14,
              paddingVertical: 14,
              borderRadius: 22,
              backgroundColor: p.surface,
              boxShadow: velvetLift(p),
              opacity: disabled ? 0.5 : 1,
            }
          : {
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
            }
      }
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: p ? 16 : 12,
          backgroundColor: p ? p.field : iconBg,
          ...(p ? { boxShadow: velvetField(p) } : null),
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
          color: p ? p.text : auth.fieldText,
        }}
      >
        {label}
      </Text>
      <ChevronRight size={20} color={p ? p.inkOff : auth.iconMuted} strokeWidth={2.2} />
    </Pressable>
  );
}
