import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { QuestIcon } from '@/components/quest/QuestIcon';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { QuestReward } from '@/components/quest/QuestReward';
import { useThemeColors } from '@/theme/colors';
import { questApi, type QuestItem } from '@/lib/quest/api';
import { historyGroupKey, questKind } from '@/lib/quest/logic.js';
import { q, questTitles } from '@/lib/quest/copy';
import { buildQuestDevHistory, getQuestDevScenario, isQuestDevEnabled } from '@/lib/quest/devFixture';

function dayKey(quest: QuestItem, today: string) {
  return historyGroupKey(quest, today);
}

function todayYmd() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatHistoryDay(ymd: string) {
  const [year, month, day] = ymd.split('-').map(Number);
  if (!year || !month || !day) return ymd;
  return new Date(year, month - 1, day).toLocaleDateString('ka-GE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function yesterdayYmd() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function QuestHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
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
    const today = todayYmd();
    const yesterday = yesterdayYmd();
    const map = new Map<string, QuestItem[]>();
    for (const quest of items) {
      const key = dayKey(quest, today) || today;
      const label =
        key === today ? copy.today : key === yesterday ? copy.yesterday : formatHistoryDay(key);
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

  return (
    <View className="flex-1 bg-bg-100" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          hitSlop={12}
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] justify-center"
        >
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text className="font-sans-bold text-lg text-text-100">{copy.history}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 28, gap: 16 }}>
        {!items.length && !loading ? (
          <QuestMediLine text={copy.historyEmpty} />
        ) : (
          groups.map(([label, rows]) => (
            <View key={label} style={{ gap: 8 }}>
              <Text className="font-sans-semibold text-sm text-text-300">{label}</Text>
              {rows.map((quest) => {
                const titles = questTitles(quest, 'ka');
                const muted = quest.status === 'EXPIRED';
                return (
                  <View
                    key={quest.id}
                    className="flex-row items-center rounded-2xl bg-surface px-3 py-3"
                    style={{ borderWidth: 1, borderColor: colors.bg300 }}
                  >
                    <QuestIcon kind={questKind(quest) === 'weekly' ? 'weekly' : questKind(quest)} done={quest.status === 'CLAIMED'} />
                    <View className="ml-3 min-w-0 flex-1">
                      <Text className={`font-sans-semibold text-[15px] ${muted ? 'text-text-200' : 'text-text-100'}`}>
                        {titles.title}
                      </Text>
                      <Text className={`mt-0.5 font-sans text-xs ${muted ? 'text-text-200' : 'text-text-300'}`}>
                        {statusLabel(quest.status)}
                      </Text>
                      {quest.status !== 'EXPIRED' ? (
                        <View className="mt-1">
                          <QuestReward xp={quest.rewardXp} coins={quest.rewardCoins} locale="ka" muted={muted} />
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
        {cursor ? (
          <Button label={copy.loadMore} size="sm" loading={loading} onPress={() => void load(cursor)} />
        ) : null}
      </ScrollView>
    </View>
  );
}
