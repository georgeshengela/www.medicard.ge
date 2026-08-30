import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Trash2 } from 'lucide-react-native';
import { HydrationAppBar } from '@/components/hydration/HydrationChrome';
import { HydrationContainerIcon } from '@/components/hydration/HydrationIcons';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { useHydration } from '@/hooks/useHydration';
import { ka } from '@/i18n/ka';
import { formatMl, todayYmd } from '@/lib/hydration';
import type { HydrationLog } from '@/types/hydration';

export default function HydrationHistoryScreen() {
  const T = useFigmaHydration();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logs, deleteLog } = useHydration();
  const groups = useMemo(() => groupLogs(logs), [logs]);

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <HydrationAppBar onBack={() => router.back()} title={ka.hydration.historyTitle} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, color: T.textSecondary }}>
          {ka.hydration.historySubtitle}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary }}>{ka.hydration.allLogs}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.brand }}>{ka.hydration.newestFirst}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        {groups.map((group) => (
          <View key={group.label} style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.textSecondary }}>{group.label}</Text>
            {group.rows.map((log) => (
              <Swipeable
                key={log.id}
                renderRightActions={() => (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void deleteLog(log.id)}
                    style={{
                      width: 64,
                      marginLeft: 8,
                      borderRadius: 16,
                      backgroundColor: T.destructive,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Trash2 size={20} color="#FFFFFF" />
                  </Pressable>
                )}
              >
                <Pressable
                  onPress={() => router.push(`/health-metrics/hydration/details?id=${log.id}` as never)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: T.border,
                    backgroundColor: T.pageBg,
                  }}
                >
                  <HydrationContainerIcon type={log.container} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary }}>{formatMl(log.ml)}</Text>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textSecondary }}>
                      {log.container === 'small' ? ka.hydration.glassOf : ka.hydration.bottleOf}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textTertiary }}>
                    {new Date(log.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  <ChevronRight size={18} color={T.textTertiary} />
                </Pressable>
              </Swipeable>
            ))}
          </View>
        ))}
        {!logs.length ? (
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, color: T.textSecondary }}>{ka.hydration.emptyHistory}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function groupLogs(logs: HydrationLog[]) {
  const today = todayYmd();
  const map = new Map<string, HydrationLog[]>();
  for (const log of logs) {
    const list = map.get(log.date) ?? [];
    list.push(log);
    map.set(log.date, list);
  }
  return [...map.entries()].map(([date, rows]) => ({
    label:
      date === today
        ? ka.common.today
        : new Date(`${date}T12:00:00`).toLocaleDateString('ka-GE', { month: 'short', day: 'numeric', year: 'numeric' }),
    rows,
  }));
}
