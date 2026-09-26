import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';

type Props = {
  icon: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
  danger?: boolean;
  /** Tile colour from the hub palette; danger overrides it. */
  ink?: HubInk;
};

/** One settings row in the hub language: tinted icon tile, label, optional value, chevron. */
export function ProfileMenuRow({ icon: Icon, label, value, onPress, isLast, danger, ink = 'teal' }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const tint = danger ? colors.danger : hubInk(ink, dark);

  return (
    <>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={value ? `${label}: ${value}` : label}
        onPress={onPress}
        disabled={!onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 58,
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 12,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: danger ? colors.dangerBg : hubTint(tint, dark),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={19} color={tint} strokeWidth={1.9} />
        </View>
        <Text
          numberOfLines={2}
          style={[hubText.cardTitle, { flex: 1, fontSize: 14, lineHeight: 20, color: danger ? colors.danger : colors.text100 }]}
        >
          {label}
        </Text>
        {value ? (
          <Text numberOfLines={1} style={[hubText.caption, { maxWidth: 130, color: colors.text300 }]}>
            {value}
          </Text>
        ) : null}
        {onPress ? <ChevronRight size={17} color={colors.text300} strokeWidth={2} /> : null}
      </Pressable>
      {isLast ? null : <View style={{ height: 1, backgroundColor: colors.bg300, marginLeft: 68 }} />}
    </>
  );
}
