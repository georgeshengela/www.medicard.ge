import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';

type Props = {
  icon: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
  danger?: boolean;
};

export function ProfileMenuRow({ icon: Icon, label, value, onPress, isLast, danger }: Props) {
  const colors = useThemeColors();
  const tint = danger ? colors.danger : colors.primary200;

  return (
    <>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        onPress={onPress}
        disabled={!onPress}
        className="active:opacity-70"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 54,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: `${tint}14`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={18} color={tint} strokeWidth={2.1} />
        </View>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            marginLeft: 12,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 15,
            color: danger ? colors.danger : colors.text100,
          }}
        >
          {label}
        </Text>
        {value ? (
          <Text
            numberOfLines={1}
            style={{
              maxWidth: 120,
              marginRight: 6,
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 13,
              color: colors.text300,
            }}
          >
            {value}
          </Text>
        ) : null}
        {onPress ? <ChevronRight size={18} color={colors.text300} strokeWidth={2.1} /> : null}
      </Pressable>
      {isLast ? null : <View style={{ height: 1, backgroundColor: colors.bg300, marginLeft: 60 }} />}
    </>
  );
}
