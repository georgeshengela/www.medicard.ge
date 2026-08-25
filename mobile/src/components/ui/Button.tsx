import React from 'react';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColors, type Palette } from '@/theme/colors';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
};

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-primary-200',
  secondary: 'bg-bg-200 border border-bg-300',
  ghost: 'bg-transparent',
  danger: 'bg-state-dangerBg border border-state-danger/20',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-text-100',
  ghost: 'text-primary-200',
  danger: 'text-state-danger',
};

const iconColor = (colors: Palette): Record<Variant, string> => ({
  primary: colors.onPrimary,
  secondary: colors.text100,
  ghost: colors.primary200,
  danger: colors.danger,
});

const SIZING: Record<Size, { container: string; label: string; icon: number }> = {
  sm: { container: 'h-10 px-4 rounded-2xl', label: 'text-sm', icon: 16 },
  md: { container: 'h-12 px-5 rounded-2xl', label: 'text-base', icon: 18 },
  lg: { container: 'h-14 px-6 rounded-2xl', label: 'text-lg', icon: 20 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = true,
  ...rest
}: Props) {
  const colors = useThemeColors();
  const inactive = disabled || loading;
  const sizing = SIZING[size];
  const tint = iconColor(colors)[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={label}
      onPress={inactive ? undefined : onPress}
      className={[
        'flex-row items-center justify-center',
        sizing.container,
        CONTAINER[variant],
        fullWidth ? 'w-full' : 'self-start',
        inactive ? 'opacity-45' : 'active:opacity-80',
      ].join(' ')}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <View className="flex-row items-center">
          {Icon ? <Icon size={sizing.icon} color={tint} strokeWidth={2.2} /> : null}
          <Text className={`font-sans-semibold ${sizing.label} ${LABEL[variant]} ${Icon ? 'ml-2' : ''}`}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
