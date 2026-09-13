import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorldButton, WorldHeader, useWorldLocale } from '@/components/world/WorldChrome';
import { gardenCopy } from '@/i18n/world/garden.js';
import { GARDEN_INTRO_KEY } from '@/hooks/useGarden';
import { setPreference } from '@/lib/storage';
import { useThemeColors } from '@/theme/colors';
import { useWorldStitch } from '@/theme/worldStitch';

export default function GardenIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useWorldStitch();
  const { locale } = useWorldLocale();
  const copy = useMemo(() => gardenCopy(locale), [locale]);
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  async function enter() {
    await setPreference(GARDEN_INTRO_KEY, '1');
    router.replace('/medi-world/garden' as never);
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader title={copy.introTitle} backLabel={copy.back} />
      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
        <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 17, lineHeight: 26, color: colors.text200, marginTop: 8 }}>
          {copy.introBody}
        </Text>
        <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.primary200, marginTop: 18 }}>
          {copy.promise}
        </Text>
        <View style={{ marginTop: 'auto' }}>
          <WorldButton label={copy.introCta} onPress={() => void enter()} />
        </View>
      </View>
    </View>
  );
}
