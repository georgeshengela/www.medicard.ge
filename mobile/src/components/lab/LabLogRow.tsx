import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FlaskConical } from 'lucide-react-native';
import { LabChevronRight } from '@/components/lab/LabIcons';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { ka } from '@/i18n/ka';
import type { LabFlag } from '@/types/lab';

type Props = {
  title: string;
  subtitle: string;
  flag: LabFlag;
  onPress: () => void;
  onLongPress?: () => void;
};

export function LabLogRow({ title, subtitle, flag, onPress, onLongPress }: Props) {
  const T = useFigmaLab();
  const badge = badgeFor(flag, T);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        backgroundColor: T.cardBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        ...T.shadowXs,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: T.iconWell,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FlaskConical size={18} color={T.iconWellInk} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: T.textPrimary }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: T.textSecondary }}
        >
          {subtitle}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: badge.bg,
          borderWidth: 1,
          borderColor: badge.border,
          borderRadius: 8,
          paddingHorizontal: 6,
          paddingVertical: 4,
        }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, color: badge.fg }}>
          {badge.label}
        </Text>
      </View>
      <LabChevronRight color={T.textMuted} />
    </Pressable>
  );
}

function badgeFor(flag: LabFlag, T: ReturnType<typeof useFigmaLab>) {
  if (flag === 'H') return { label: ka.lab.above, bg: T.destructiveSoft, border: T.destructiveBorder, fg: T.destructive };
  if (flag === 'L') return { label: ka.lab.below, bg: T.destructiveSoft, border: T.destructiveBorder, fg: T.destructive };
  if (flag === 'N') return { label: ka.lab.normal, bg: T.brandSoft, border: T.brandLight, fg: T.brand };
  return { label: ka.lab.unknown, bg: T.cardBg, border: T.border, fg: T.textSecondary };
}
