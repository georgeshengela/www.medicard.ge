import React from 'react';
import { Pressable, Text } from 'react-native';
import { useFigmaHomeDashboard } from '@/constants/figmaHomeDashboardLayout';
import { usePlanUsage } from '@/lib/planUsage';

type Props = {
  onPress?: () => void;
};

/** Compact remaining/limit pill for home header — no label text. */
export function HomePackageQuotaBadge({ onPress }: Props) {
  const FIGMA_HOME_DASHBOARD = useFigmaHomeDashboard();
  const { unlimited, remaining, limit, exhausted, usage } = usePlanUsage();
  if (!usage) return null;

  const accent = exhausted ? '#F43F5E' : FIGMA_HOME_DASHBOARD.brand;
  const borderColor = exhausted ? FIGMA_HOME_DASHBOARD.badgeBorderExhausted : FIGMA_HOME_DASHBOARD.borderTertiary;

  const valueLabel = unlimited ? '∞' : `${remaining ?? 0}/${limit}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={exhausted ? 'AI ლიმიტი ამოიწურა' : `${remaining ?? 0} ${limit}-დან`}
      onPress={onPress}
      style={{
        minWidth: 52,
        height: 40,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: exhausted ? FIGMA_HOME_DASHBOARD.badgeBgExhausted : FIGMA_HOME_DASHBOARD.badgeBg,
        borderWidth: 1,
        borderColor,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 12,
          lineHeight: 16,
          color: accent,
          letterSpacing: -0.2,
        }}
      >
        {valueLabel}
      </Text>
    </Pressable>
  );
}
