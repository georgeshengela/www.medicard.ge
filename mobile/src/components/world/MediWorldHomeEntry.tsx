import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { worldCopy } from '@/i18n/world/catalog.js';
import { useMediWorldAvailable } from '@/lib/mediWorld/enabled';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * Feature-gated sibling under the existing Quest home slot.
 * Does not add a HomeSectionId or change buildHomeSectionOrder.
 */
export function MediWorldHomeEntry({ locale = 'ka' }: { locale?: string }) {
  const router = useRouter();
  const colors = useThemeColors();
  const dark = useIsDark();
  const copy = worldCopy(locale);
  const available = useMediWorldAvailable();

  if (!available) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8, marginTop: 8 }}>
      <HomeSectionTitle title={copy.title} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.openWorld}
        onPress={() => router.push('/medi-world' as never)}
        className="active:opacity-75"
        style={{
          minHeight: 72,
          borderRadius: QUEST.radius,
          borderWidth: 1,
          borderColor: colors.bg300,
          backgroundColor: dark ? colors.surface : '#FFFFFF',
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
          }}
        >
          <Sparkles size={18} color={colors.primary200} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: colors.text100 }}
          >
            {copy.awakening}
          </Text>
          <Text
            numberOfLines={2}
            style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: colors.text300, marginTop: 2 }}
          >
            {copy.homeHint}
          </Text>
        </View>
        <ChevronRight size={20} color={colors.primary200} strokeWidth={2.3} />
      </Pressable>
    </View>
  );
}
