import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/theme/colors';

type Props = {
  message: string;
  onDismiss?: () => void;
};

/** Figma auth error — rose banner pinned above home indicator. */
export function AuthErrorBanner({ message, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 12,
        zIndex: 50,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: colors.dangerBg,
          borderWidth: 1,
          borderColor: colors.danger,
          borderRadius: 16,
          paddingHorizontal: 14,
          paddingVertical: 12,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <AlertTriangle size={20} color={colors.danger} strokeWidth={2.2} />
        <Text
          style={{
            flex: 1,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 13,
            lineHeight: 18,
            color: colors.danger,
          }}
        >
          {message}
        </Text>
        {onDismiss ? (
          <Pressable accessibilityRole="button" hitSlop={10} onPress={onDismiss}>
            <X size={18} color={colors.danger} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
