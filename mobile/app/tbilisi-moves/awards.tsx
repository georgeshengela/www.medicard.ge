import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Award } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { ka } from '@/i18n/ka';
import { api } from '@/lib/api';
import { formatYmdKa } from '@/lib/tbilisiMoves/format';
import { loadAwardsCache, saveAwardsCache } from '@/lib/tbilisiMoves/storage';
import type { TbilisiMovesAward } from '@/lib/tbilisiMoves/types';
import { useThemeColors } from '@/theme/colors';

export default function TbilisiMovesAwardsScreen() {
  const colors = useThemeColors();
  const [awards, setAwards] = useState<TbilisiMovesAward[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const page = await api.tbilisiMoves.awards({ limit: 50, offset: 0 });
      setAwards(page.awards);
      await saveAwardsCache(page.awards);
    } catch {
      const stored = await loadAwardsCache<TbilisiMovesAward[]>();
      if (stored) setAwards(stored);
      setError(ka.tbilisiMoves.loadError);
    } finally {
      setReady(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
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
      data={awards}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
      ListHeaderComponent={
        <Text style={{ marginBottom: 12, color: colors.text300, fontFamily: GEO.regular }}>{ka.tbilisiMoves.todayProvisionalHint}</Text>
      }
      ListEmptyComponent={<EmptyState icon={Award} title={ka.tbilisiMoves.awardsEmpty} body={error || undefined} />}
      renderItem={({ item }) => (
        <View style={{ marginBottom: 10 }}>
          <Card>
            <Text style={{ fontFamily: GEO.title, fontSize: 18, color: colors.text100 }}>{item.titleKa}</Text>
            <Text style={{ marginTop: 4, color: colors.text200, fontFamily: GEO.regular }}>
              {formatYmdKa(item.date)} · {item.districtNameKa}
            </Text>
            <Text style={{ marginTop: 6, color: colors.text200, fontFamily: GEO.regular }}>{item.reasonKa}</Text>
            <Text style={{ marginTop: 8, fontFamily: GEO.semibold, color: item.status === 'REVOKED' ? colors.warning : colors.primary200 }}>
              {item.status === 'REVOKED' ? ka.tbilisiMoves.awardRevoked : ka.tbilisiMoves.awardActive}
            </Text>
          </Card>
        </View>
      )}
    />
  );
}
