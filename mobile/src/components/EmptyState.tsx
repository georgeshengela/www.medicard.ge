import React from 'react';
import { Image, Text, View, type ImageSourcePropType } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';

export function EmptyState({
  icon: Icon,
  art,
  title,
  body,
  children,
}: {
  icon?: LucideIcon;
  /** 3D artwork shown at 120×120 instead of the icon tile. */
  art?: ImageSourcePropType;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  const colors = useThemeColors();

  return (
    <View className="items-center px-6 py-12">
      {art ? (
        <Image
          source={art}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          style={{ width: 120, height: 120, marginBottom: 12 }}
        />
      ) : Icon ? (
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-bg-200">
          <Icon size={28} color={colors.primary300} strokeWidth={1.8} />
        </View>
      ) : null}
      <Text className="text-center text-lg font-bold text-text-100" style={{ fontFamily: 'NotoSansGeorgian_700Bold' }}>
        {title}
      </Text>
      {body ? (
        <Text className="mt-1.5 text-center text-base text-text-300" style={{ fontFamily: 'NotoSansGeorgian_400Regular' }}>
          {body}
        </Text>
      ) : null}
      {children ? <View className="mt-5 w-full">{children}</View> : null}
    </View>
  );
}
