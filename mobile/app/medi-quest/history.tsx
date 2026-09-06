import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Clock3 } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { QuestIcon } from '@/components/quest/QuestIcon';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { QuestReward } from '@/components/quest/QuestReward';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { questApi, type QuestItem } from '@/lib/quest/api';
import { historyGroupKey, questKind } from '@/lib/quest/logic.js';
import { q, questTitles } from '@/lib/quest/copy';
import { buildQuestDevHistory, getQuestDevScenario, isQuestDevEnabled } from '@/lib/quest/devFixture';
import { QUEST } from '@/theme/questTokens';

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatHistoryDay(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return key;
  return new Date(year, month - 1, day).toLocaleDateString('ka-GE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function QuestHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const copy = q('ka');
  const [items, setItems] = useState<QuestItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (next?: string | null) => {
    if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') {
      setItems(buildQuestDevHistory());
      setCursor(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const page = await questApi.history({ take: 20, cursor: next || undefined });
      setItems((prev) => (next ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch {
      if (!next) setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const today = ymd(new Date());
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = ymd(y);
    const map = new Map<string, QuestItem[]>();
    for (const quest of items) {
      const key = historyGroupKey(quest, today) || today;
      const label = key === today ? copy.today : key === yesterday ? copy.yesterday : formatHistoryDay(key);
      const list = map.get(label) || [];
      list.push(quest);
      map.set(label, list);
    }
    return Array.from(map.entries());
  }, [items, copy.today, copy.yesterday]);

  const statusLabel = (status: string) => {
    if (status === 'CLAIMED') return copy.claimed;
    if (status === 'COMPLETED') return copy.completed;
    if (status === 'EXPIRED') return copy.expired;
    return status;
  };

  let rowIndex = 0;

  return (
    <View className="flex-1 bg-bg-100" style={{ paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          hitSlop={8}
          onPress={() => router.back()}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: colors.text100 }}>
          {copy.history}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {loading && !items.length ? (
          <ListRowsSkeleton rows={5} padded={false} />
        ) : !items.length ? (
          <View
            style={{
              backgroundColor: dark ? colors.surface : '#FFFFFF',
              borderWidth: 1,
              borderColor: colors.bg300,
              borderRadius: QUEST.radius,
              padding: QUEST.pad,
            }}
          >
            <QuestMediLine text={copy.historyEmpty} />
          </View>
        ) : (
          groups.map(([label, rows]) => (
            <View key={label} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18, color: colors.text300 }}>{label}</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.bg300 }} />
              </View>
              {rows.map((quest) => {
                const titles = questTitles(quest, 'ka');
                const expired = quest.status === 'EXPIRED';
                const claimed = quest.status === 'CLAIMED';
                const kind = questKind(quest) === 'weekly' ? 'weekly' : questKind(quest);
                const i = rowIndex++;
                return (
                  <Animated.View
                    key={quest.id}
                    entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(Math.min(i, 8) * 45)}
                  >
                    {/* Static opacity on an inner View so the entering animation never fights it. */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        borderRadius: QUEST.rowRadius,
                        backgroundColor: dark ? colors.surface : '#FFFFFF',
                        borderWidth: 1,
                        borderColor: colors.bg300,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        opacity: expired ? 0.7 : 1,
                      }}
                    >
                      <QuestIcon kind={kind} done={claimed} ready={quest.status === 'COMPLETED'} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 20, color: colors.text100 }}
                        >
                          {titles.title}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          {expired ? <Clock3 size={11} color={colors.text300} strokeWidth={2.3} /> : null}
                          <Text
                            numberOfLines={1}
                            style={{
                              fontFamily: 'NotoSansGeorgian_500Medium',
                              fontSize: 12,
                              lineHeight: 16,
                              color: claimed ? colors.success : colors.text300,
                            }}
                          >
                            {statusLabel(quest.status)}
                          </Text>
                        </View>
                        {!expired ? (
                          <View style={{ marginTop: 8 }}>
                            <QuestReward xp={quest.rewardXp} coins={quest.rewardCoins} locale="ka" muted={!claimed} size="sm" />
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          ))
        )}
        {cursor ? <Button label={copy.loadMore} size="sm" variant="secondary" loading={loading} onPress={() => void load(cursor)} /> : null}
      </ScrollView>
    </View>
  );
}
