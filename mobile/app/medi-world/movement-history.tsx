import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorldHeader, useWorldLocale } from '@/components/world/WorldChrome';
import { movementCopy } from '@/i18n/world/movement.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useMediWorldMovementAvailable } from '@/lib/mediWorld/enabled';
import type { MovementSession } from '@/lib/mediWorld/types';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';
import { useWorldStitch } from '@/theme/worldStitch';

export default function MovementHistoryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useWorldStitch();
  const enabled = useMediWorldMovementAvailable();
  const { locale } = useWorldLocale();
  const copy = useMemo(() => movementCopy(locale), [locale]);
  const [items, setItems] = useState<MovementSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    setRefreshing(true);
    try {
      const page = await mediWorldApi.movementHistory({ take: 20 });
      setItems(page.items);
    } catch {
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader title={copy.history} backLabel={copy.back} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} tintColor={colors.primary200} />}
      >
        {items.map((row) => (
          <View key={row.id} style={{ marginTop: 12, borderRadius: QUEST.radius, borderWidth: 1, borderColor: colors.bg300, backgroundColor: colors.surface, padding: QUEST.pad }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: colors.text100 }}>{row.movementMode} · {row.status}</Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: colors.text200, marginTop: 6 }}>
              {copy.verifiedTime}: {Math.floor((row.acceptedDurationSec || 0) / 60)} {copy.minutes}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text300, marginTop: 4 }}>
              {row.distanceBand} · {Math.round((row.completionRatioBps || 0) / 100)}%
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
