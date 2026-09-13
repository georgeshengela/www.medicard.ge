import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorldHeader, useWorldLocale } from '@/components/world/WorldChrome';
import { gardenCopy } from '@/i18n/world/garden.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';
import { useWorldStitch } from '@/theme/worldStitch';
import type { GardenHistoryResponse } from '@/lib/mediWorld/types';

export default function GardenHistoryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useWorldStitch();
  const { locale } = useWorldLocale();
  const copy = useMemo(() => gardenCopy(locale), [locale]);
  const [page, setPage] = useState<GardenHistoryResponse | null>(null);
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  useEffect(() => {
    void mediWorldApi.gardenHistory({ take: 20 }).then(setPage).catch(() => setPage({ enabled: true, rulesetId: 'medi-world-garden-v1', nextCursor: null, items: [] }));
  }, []);

  const labels: Record<string, string> = {
    planted: copy.planted,
    moved: copy.moved,
    stored: copy.storedEvent,
    restored: copy.restoredEvent,
    plot_unlocked: copy.plotUnlocked,
    stage_changed: copy.stageChanged,
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader title={copy.history} backLabel={copy.back} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}>
        {(page?.items || []).length === 0 ? (
          <Text style={{ ...fontBody, color: colors.text300, marginTop: 16 }}>{copy.historyEmpty}</Text>
        ) : (
          (page?.items || []).map((item) => (
            <View
              key={item.id}
              style={{
                marginTop: 12,
                borderRadius: QUEST.radius,
                borderWidth: 1,
                borderColor: colors.bg300,
                backgroundColor: colors.surface,
                padding: 14,
              }}
            >
              <Text style={{ ...fontTitle, color: colors.text100 }}>{labels[item.type] || item.type}</Text>
              <Text style={{ ...fontBody, color: colors.text300, marginTop: 4 }}>{item.createdAt}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
