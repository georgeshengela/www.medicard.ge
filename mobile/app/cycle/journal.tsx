import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CycleAtmosphere, CycleLoading, cycleNavHeader, formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { ApiError, type CycleBundle } from '@/lib/api';
import { loadCycleView } from '@/lib/cycleOffline';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

export default function CycleJournalScreen() {
  const { user } = useAuth();
  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.journalTitle));
  }, [navigation, c]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    loadCycleView(user.id)
      .then((view) => setBundle(view.display))
      .catch((err) => setError(err instanceof ApiError ? err.message : ka.common.error))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (bundle?.logs ?? [])
      .filter((log) => Boolean(log.notes?.trim()))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .filter((log) => !q || (log.notes || '').toLowerCase().includes(q));
  }, [bundle, query]);

  if (loading) return <CycleLoading />;

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
          {ka.cycle.journalHint}
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={ka.cycle.journalSearch}
          placeholderTextColor={c.mutedSoft}
          accessibilityLabel={ka.cycle.journalSearch}
          style={{
            minHeight: 48,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.card,
            color: c.ink,
            paddingHorizontal: 14,
            marginBottom: 16,
          }}
        />
        {error ? <Text style={{ color: c.danger, marginBottom: 12 }}>{error}</Text> : null}
        {!entries.length ? (
          <Text style={{ color: c.muted, lineHeight: 20 }}>{ka.cycle.journalEmpty}</Text>
        ) : (
          entries.map((log) => (
            <Pressable
              key={log.date}
              onPress={() =>
                router.push({ pathname: '/cycle/log', params: { date: log.date, tab: 'more' } } as never)
              }
              accessibilityRole="button"
              accessibilityLabel={`${formatCycleDateKa(log.date)} ${ka.cycle.journalTitle}`}
              style={{
                backgroundColor: c.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.border,
                padding: 14,
                marginBottom: 10,
              }}
            >
              <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>
                {formatCycleDateKa(log.date)}
              </Text>
              <Text style={{ color: c.ink, marginTop: 6, lineHeight: 20 }} numberOfLines={4}>
                {log.notes}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </CycleAtmosphere>
  );
}
