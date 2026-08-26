import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, ChevronDown } from 'lucide-react-native';
import { StepsHistoryRow } from '@/components/health/StepsHistoryRow';
import { FIGMA_STEPS } from '@/constants/figmaStepsLayout';
import { useStepsMetrics } from '@/hooks/useStepsMetrics';
import { ka } from '@/i18n/ka';
import { filterHistoryByMonth, monthLabelKa } from '@/lib/stepsMetrics.shared';

/** Figma 8850:134246 — steps history by day. */
export default function StepsHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bundle, loading, refresh } = useStepsMetrics('1m');
  const [refreshing, setRefreshing] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const filtered = useMemo(
    () => filterHistoryByMonth(bundle?.historyByDay ?? [], year, month),
    [bundle?.historyByDay, year, month],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh('1m');
    setRefreshing(false);
  }, [refresh]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, minHeight: 56, justifyContent: 'center' }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12} style={{ width: 40 }}>
          <ArrowLeft size={24} color={FIGMA_STEPS.textPrimary} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 30,
            lineHeight: 38,
            color: FIGMA_STEPS.textPrimary,
            letterSpacing: -0.25,
          }}
        >
          {ka.steps.historyPageTitle}
        </Text>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 16,
            lineHeight: 26,
            color: FIGMA_STEPS.textSecondary,
          }}
        >
          {ka.steps.historyPageSubtitle}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18, color: FIGMA_STEPS.textPrimary }}>
          {ka.steps.allLogs}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => shiftMonth(1)}
          onLongPress={() => shiftMonth(-1)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Calendar size={18} color={FIGMA_STEPS.brand} strokeWidth={2.2} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: FIGMA_STEPS.brand }}>
            {monthLabelKa(year, month)}
          </Text>
          <ChevronDown size={18} color={FIGMA_STEPS.brand} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FIGMA_STEPS.brand} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {loading && !bundle ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={FIGMA_STEPS.brand} />
          </View>
        ) : filtered.length ? (
          filtered.map((group) => (
            <View key={group.ymd} style={{ paddingTop: 8 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 16,
                  color: FIGMA_STEPS.textPrimary,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
              >
                {group.title}
              </Text>
              <View style={{ paddingHorizontal: 16, gap: 8 }}>
                {group.logs.map((log) => (
                  <StepsHistoryRow key={log.id} log={log} />
                ))}
              </View>
            </View>
          ))
        ) : (
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 14,
              color: FIGMA_STEPS.textSecondary,
              textAlign: 'center',
              paddingVertical: 32,
              paddingHorizontal: 24,
            }}
          >
            {ka.healthMetrics.noData}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
