import React from 'react';
import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColors, type Palette } from '@/theme/colors';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const tones = (colors: Palette): Record<BadgeTone, { container: string; label: string; icon: string }> => ({
  neutral: { container: 'bg-bg-200 border-bg-300', label: 'text-text-200', icon: colors.text200 },
  brand: { container: 'bg-accent-100/60 border-accent-200/60', label: 'text-primary-100', icon: colors.primary200 },
  success: { container: 'bg-state-successBg border-state-success/20', label: 'text-state-success', icon: colors.success },
  warning: { container: 'bg-state-warningBg border-state-warning/20', label: 'text-state-warning', icon: colors.warning },
  danger: { container: 'bg-state-dangerBg border-state-danger/20', label: 'text-state-danger', icon: colors.danger },
});

export function Badge({
  label,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
}) {
  const styles = tones(useThemeColors())[tone];

  return (
    <View className={`flex-row items-center self-start rounded-full border px-2.5 py-1 ${styles.container}`}>
      {Icon ? <Icon size={12} color={styles.icon} strokeWidth={2.4} /> : null}
      <Text className={`text-xs font-semibold ${styles.label} ${Icon ? 'ml-1' : ''}`}>{label}</Text>
    </View>
  );
}
