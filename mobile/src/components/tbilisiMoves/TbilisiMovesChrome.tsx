import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { useThemeColors } from '@/theme/colors';

export function TbilisiMovesChrome({
  title,
  onBack,
  right,
  fallbackHref = '/(tabs)/profile',
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  fallbackHref?: '/(tabs)/profile' | '/pets' | '/tbilisi-moves';
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const goBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  };

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.bg100 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 56,
          paddingHorizontal: 16,
          gap: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="უკან"
          hitSlop={12}
          onPress={goBack}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.bg300,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontFamily: GEO.title, fontSize: 18, lineHeight: 24, color: colors.text100 }}
        >
          {title}
        </Text>
        {right || <View style={{ width: 40 }} />}
      </View>
    </View>
  );
}

export function TbilisiMovesIconWell({
  children,
  size = 40,
  backgroundColor,
}: {
  children: React.ReactNode;
  size?: number;
  backgroundColor?: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: backgroundColor || colors.accent100,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </View>
  );
}
