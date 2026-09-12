import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gardenCopy } from '@/i18n/world/garden.js';
import { GARDEN_INTRO_KEY } from '@/hooks/useGarden';
import { setPreference } from '@/lib/storage';
import { useThemeColors } from '@/theme/colors';

export default function GardenIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
  const copy = useMemo(() => gardenCopy(locale), [locale]);
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  async function enter() {
    await setPreference(GARDEN_INTRO_KEY, '1');
    router.replace('/medi-world/garden' as never);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100, paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => setLocale('ka')} className="active:opacity-75" style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: locale === 'ka' ? colors.bg200 : 'transparent' }}>
          <Text style={{ ...fontBody, color: colors.text100 }}>ქარ</Text>
        </Pressable>
        <Pressable onPress={() => setLocale('en')} className="active:opacity-75" style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: locale === 'en' ? colors.bg200 : 'transparent' }}>
          <Text style={{ ...fontBody, color: colors.text100 }}>EN</Text>
        </Pressable>
      </View>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={{ ...fontTitle, fontSize: 30, lineHeight: 38, color: colors.text100, marginTop: 36 }}>
        {copy.introTitle}
      </Text>
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 17, lineHeight: 26, color: colors.text200, marginTop: 14 }}>
        {copy.introBody}
      </Text>
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.primary200, marginTop: 18 }}>
        {copy.promise}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.introCta}
        onPress={() => void enter()}
        className="active:opacity-75"
        style={{ marginTop: 'auto', minHeight: 52, borderRadius: 16, backgroundColor: colors.primary200, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ ...fontTitle, fontSize: 16, color: '#042F2E' }}>{copy.introCta}</Text>
      </Pressable>
    </View>
  );
}
