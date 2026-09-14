import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import { formatYmdKa } from '@/lib/tbilisiMoves/format';
import { loadHistoryCache, saveHistoryCache } from '@/lib/tbilisiMoves/storage';
import type { TbilisiMovesHistoryItem } from '@/lib/tbilisiMoves/types';
import { useThemeColors } from '@/theme/colors';

export default function TbilisiMovesHistoryScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [items, setItems] = useState<TbilisiMovesHistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { before?: string; append?: boolean }) => {
    setError(null);
    try {
      const page = await api.tbilisiMoves.history({ limit: 20, before: opts?.before });
      const next = opts?.append ? [...items, ...page.items] : page.items;
      setItems(next);
      setCursor(page.nextCursor);
      if (!opts?.append) await saveHistoryCache(page);
    } catch {
      if (!opts?.append) {
        const stored = await loadHistoryCache<{ items: TbilisiMovesHistoryItem[]; nextCursor: string | null }>();
        if (stored?.items) {
          setItems(stored.items);
          setCursor(stored.nextCursor);
        }
      }
      setError(ka.tbilisiMoves.loadError);
    } finally {
      setReady(true);
    }
  }, [items]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, []),
  );

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary200} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg100 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      data={items}
      keyExtractor={(item) => item.date}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
      onEndReached={() => {
        if (cursor) void load({ before: cursor, append: true });
      }}
      ListHeaderComponent={
        error ? <Text style={{ marginBottom: 12, color: colors.warning, fontFamily: GEO.regular }}>{error}</Text> : null
      }
      ListEmptyComponent={
        <EmptyState icon={CalendarDays} title={ka.tbilisiMoves.historyEmpty} body={error || undefined} />
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/tbilisi-moves/history/${item.date}`)} style={{ marginBottom: 10 }}>
          <Card>
            <Text style={{ fontFamily: GEO.title, fontSize: 18, color: colors.text100 }}>{formatYmdKa(item.date)}</Text>
            <Text style={{ marginTop: 6, color: colors.text200, fontFamily: GEO.regular }}>
              {item.lifecycle === 'FINALIZED'
                ? ka.tbilisiMoves.resultFinal
                : item.lifecycle === 'GRACE'
                  ? ka.tbilisiMoves.resultGrace
                  : item.lifecycle === 'READY'
                    ? ka.tbilisiMoves.resultAwaiting
                    : ka.tbilisiMoves.provisional}
            </Text>
            {item.corrected ? (
              <Text style={{ marginTop: 4, color: colors.primary200, fontFamily: GEO.regular }}>{ka.tbilisiMoves.resultCorrected}</Text>
            ) : null}
            <Text style={{ marginTop: 8, color: colors.text300, fontFamily: GEO.regular }}>
              {ka.tbilisiMoves.myAwards}: {item.awardCount}
            </Text>
          </Card>
        </Pressable>
      )}
    />
  );
}
