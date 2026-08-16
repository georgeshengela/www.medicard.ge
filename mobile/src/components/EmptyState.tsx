import React from 'react';
import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';

export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  const colors = useThemeColors();

  return (
    <View className="items-center px-6 py-12">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-bg-200">
        <Icon size={28} color={colors.primary300} strokeWidth={1.8} />
      </View>
      <Text className="text-center text-lg font-bold text-text-100">{title}</Text>
      {body ? <Text className="mt-1.5 text-center text-base text-text-300">{body}</Text> : null}
      {children ? <View className="mt-5 w-full">{children}</View> : null}
    </View>
  );
}
