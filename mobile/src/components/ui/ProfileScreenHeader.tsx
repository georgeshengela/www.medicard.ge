import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import type { ModuleBrandId } from '@/theme/moduleBrand';

export function ProfileScreenHeader({
  title,
  brand,
  subtitle,
  onBack,
  right,
  fallbackHref = '/(tabs)/profile',
}: {
  title: string;
  /** MEDI module wordmark in place of the title, with `subtitle` as the one muted line under it. */
  brand?: ModuleBrandId;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  fallbackHref?: '/(tabs)/profile' | '/pets';
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
          accessibilityLabel={tx('უკან', 'Back')}
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
        {brand ? (
          <View style={{ flex: 1, minWidth: 0 }}>
            <ModuleWordmark module={brand} />
            {subtitle ? (
              <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 15, color: colors.text300 }}>{subtitle}</Text>
            ) : null}
          </View>
        ) : (
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 24, color: colors.text100 }}
          >
            {title}
          </Text>
        )}
        {right || <View style={{ width: 40 }} />}
      </View>
    </View>
  );
}
