import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { gardenCopy } from '@/i18n/world/garden.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useThemeColors } from '@/theme/colors';
import type { GardenHistoryResponse } from '@/lib/mediWorld/types';

export default function GardenHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
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
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} className="active:opacity-75" style={{ width: 44, height: 44, justifyContent: 'center' }}>
          <ArrowLeft size={22} color={colors.text100} />
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={{ ...fontTitle, fontSize: 26, color: colors.text100, marginTop: 16 }}>{copy.history}</Text>
        {(page?.items || []).length === 0 ? (
          <Text style={{ ...fontBody, color: colors.text300, marginTop: 16 }}>{copy.historyEmpty}</Text>
        ) : (
          (page?.items || []).map((item) => (
            <View key={item.id} style={{ marginTop: 12, borderRadius: 16, backgroundColor: colors.surface, padding: 14 }}>
              <Text style={{ ...fontTitle, color: colors.text100 }}>{labels[item.type] || item.type}</Text>
              <Text style={{ ...fontBody, color: colors.text300, marginTop: 4 }}>{item.createdAt}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
