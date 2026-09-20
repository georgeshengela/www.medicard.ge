import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CycleAtmosphere, CycleLoading, cycleNavHeader, formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { ApiError, type CycleBundle } from '@/lib/api';
import { loadCycleView } from '@/lib/cycleOffline';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';
import { ChatFormScroll, ChatScreenShell } from '@/components/chat/ChatScreenShell';

export default function CycleJournalScreen() {
  const { user } = useAuth();
  return <CycleJournalContent key={user?.id || 'anonymous'} />;
}

function CycleJournalContent() {
  const { user } = useAuth();
  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.journalTitle));
  }, [navigation, c]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    if (!user?.id) {
      setLoading(false);
      return;
    }
    loadCycleView(user.id)
      .then((view) => { if (active) setBundle(view.display); })
      .catch((err) => { if (active) setError(err instanceof ApiError ? err.message : ka.common.error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id, retry]);

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
      <ChatScreenShell header={null}>
      <ChatFormScroll
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
            borderColor: c.controlBorder,
            backgroundColor: c.card,
            color: c.ink,
            paddingHorizontal: 14,
            marginBottom: 16,
          }}
        />
        {error ? <View style={{ marginBottom: 12 }}>
          <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => setRetry((n) => n + 1)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: c.brand }}>{ka.common.retry}</Text>
          </Pressable>
        </View> : null}
        {!error && !entries.length ? (
          <Text style={{ color: c.muted, lineHeight: 20 }}>{query.trim() ? 'ამ ძებნით ჩანაწერი ვერ მოიძებნა.' : ka.cycle.journalEmpty}</Text>
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
      </ChatFormScroll>
      </ChatScreenShell>
    </CycleAtmosphere>
  );
}
