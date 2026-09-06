import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, ChevronDown, ChevronRight, Scale } from 'lucide-react-native';
import { WeightAppBar, WeightSwipeDelete } from '@/components/weight/WeightChrome';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';
import { useAuth } from '@/store/AuthContext';
import { ka } from '@/i18n/ka';
import { bmiFromWeight } from '@/lib/bmi';
import { loadWeightLogs, removeWeightLog, todayYmd } from '@/lib/weightGoal';
import type { WeightLog } from '@/types/weightGoal';

export default function WeightHistoryScreen() {
  const T = useFigmaWeight();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { healthProfile } = useAuth();
  const [logs, setLogs] = useState<WeightLog[]>([]);

  useFocusEffect(
    useCallback(() => {
      void loadWeightLogs().then(setLogs);
    }, []),
  );

  const groups = useMemo(() => groupLogs(logs), [logs]);

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <WeightAppBar title="" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, letterSpacing: -0.25, color: T.textPrimary }}>
          {ka.weight.historyTitle}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, lineHeight: 26, color: T.textSecondary }}>
          {ka.weight.historySubtitle}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary }}>{ka.weight.allLogs}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.brand }}>{ka.weight.newestFirst}</Text>
          <Calendar size={16} color={T.brand} strokeWidth={2} />
          <ChevronDown size={16} color={T.brand} strokeWidth={2} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}>
        {groups.map((group) => (
          <View key={group.label} style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.textSecondary }}>{group.label}</Text>
            {group.rows.map((log) => {
              const bmi = bmiFromWeight(log.kg, healthProfile?.heightCm);
              return (
                <WeightSwipeDelete
                  key={log.id}
                  onDelete={() => {
                    void removeWeightLog(log.id).then(setLogs);
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: T.border,
                      backgroundColor: T.surface,
                    }}
                  >
                    <Scale size={32} color={T.brand} strokeWidth={1.8} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary }}>
                        {`${log.kg.toFixed(1)}${ka.weight.kg}`}
                      </Text>
                      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textSecondary }}>
                        {bmi != null ? `${bmi.toFixed(1)} BMI` : ka.home.bmi.noHeight}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textTertiary }}>
                      {new Date(log.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                    <ChevronRight size={18} color={T.textTertiary} />
                  </View>
                </WeightSwipeDelete>
              );
            })}
          </View>
        ))}
        {!logs.length ? (
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, color: T.textSecondary }}>{ka.weight.emptyLogs}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function groupLogs(logs: WeightLog[]) {
  const today = todayYmd();
  const map = new Map<string, WeightLog[]>();
  for (const log of logs) {
    const list = map.get(log.date) ?? [];
    list.push(log);
    map.set(log.date, list);
  }
  return [...map.entries()].map(([date, rows]) => ({
    label:
      date === today
        ? ka.common.today
        : new Date(`${date}T12:00:00`).toLocaleDateString('ka-GE', { weekday: 'long', month: 'short', day: 'numeric' }),
    rows,
  }));
}
