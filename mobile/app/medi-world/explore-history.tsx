import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { exploreCopy } from '@/i18n/world/explore.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useMediWorldExploreAvailable } from '@/lib/mediWorld/enabled';
import type { ExploreCollectionItem } from '@/lib/mediWorld/types';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

export default function ExploreHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const enabled = useMediWorldExploreAvailable();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
  const copy = useMemo(() => exploreCopy(locale), [locale]);
  const [items, setItems] = useState<ExploreCollectionItem[]>([]);
  const [count, setCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (reset = true) => {
    if (!enabled) return;
    setRefreshing(true);
    try {
      const page = await mediWorldApi.exploreCollections({ take: 20, locale, cursor: reset ? undefined : cursor || undefined });
      setCount(page.discoveryCount);
      setCursor(page.nextCursor);
      setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
    } catch {
      if (reset) setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, [cursor, enabled, locale]);

  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [locale, enabled]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary200} />}
      >
        <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={() => router.back()} className="active:opacity-75" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, color: colors.text100, marginTop: 12 }}>{copy.history}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 15, color: colors.text200, marginTop: 8 }}>
          {copy.foundCount}: {count}
        </Text>
        {!enabled ? <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, color: colors.text200, marginTop: 12 }}>{copy.featureOff}</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={{ marginTop: 12, borderRadius: QUEST.radius, borderWidth: 1, borderColor: colors.bg300, backgroundColor: dark ? colors.surface : '#FFFFFF', padding: QUEST.pad }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: colors.text100 }}>
              {locale === 'en' ? item.placeNameEn : item.placeNameKa}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text300, marginTop: 6 }}>
              {new Date(item.collectedAt).toLocaleString(locale === 'en' ? 'en-US' : 'ka-GE')}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
