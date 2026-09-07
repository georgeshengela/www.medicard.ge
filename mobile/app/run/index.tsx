import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Flame, Footprints, MapPin, Play, Route, Target, Timer } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { BetaPill } from '@/components/run/HomeRunSection';
import { RunnerHeroVideo } from '@/components/run/RunnerHeroVideo';
import { RunTargetSheet } from '@/components/run/RunTargetSheet';
import { ka } from '@/i18n/ka';
import { formatClock, formatKm, formatThousands, type RunTarget } from '@/lib/run/geo';
import { loadRunHistory, runTotals, type RunSummary } from '@/lib/run/history';
import { prepareRun } from '@/lib/run/store';
import { useAuth } from '@/store/AuthContext';
import { useIsDark, useThemeColors } from '@/theme/colors';

export default function RunHubScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const { healthProfile } = useAuth();
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [sheet, setSheet] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadRunHistory().then((list) => alive && setHistory(list));
      return () => {
        alive = false;
      };
    }, []),
  );

  const totals = runTotals(history);

  const onConfirm = (target: RunTarget) => {
    setSheet(false);
    void prepareRun(target, { weightKg: healthProfile?.weightKg, heightCm: healthProfile?.heightCm });
    router.push('/run/active' as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: tabInset }} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52, gap: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color={colors.text100} strokeWidth={2.2} />
          </Pressable>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>{ka.run.title}</Text>
          <BetaPill />
        </View>

        {/* hero */}
        <View style={{ marginHorizontal: 16, marginTop: 8, height: 420, borderRadius: 28, overflow: 'hidden', backgroundColor: '#0B1F2A' }}>
          <RunnerHeroVideo />
          <LinearGradient
            colors={['rgba(3,7,18,0.05)', 'rgba(3,7,18,0.28)', 'rgba(3,7,18,0.92)']}
            locations={[0, 0.45, 1]}
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 22, paddingBottom: 22 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,0.8)' }}>
              {ka.run.heroBody}
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => setSheet(true)}
              style={{
                marginTop: 14,
                height: 56,
                borderRadius: 18,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                backgroundColor: '#FFFFFF',
              }}
            >
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F766E' }}>
                <Play size={15} color="#FFFFFF" strokeWidth={2.8} style={{ marginLeft: 2 }} />
              </View>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16.5, color: '#0F766E' }}>{ka.run.start}</Text>
            </Pressable>
          </View>
        </View>

        {/* totals */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 14 }}>
          {[
            { icon: Route, value: formatKm(totals.distanceM, 1), label: ka.run.totalKm },
            { icon: Target, value: String(totals.runs), label: ka.run.totalRuns },
            { icon: MapPin, value: String(totals.pins), label: ka.run.totalPins },
            { icon: Flame, value: formatThousands(totals.calories), label: ka.run.totalKcal },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: 3,
                paddingVertical: 12,
                borderRadius: 18,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.bg300,
              }}
            >
              <s.icon size={15} color={dark ? '#5EEAD4' : colors.primary100} strokeWidth={2.3} />
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17, color: colors.text100 }}>
                {s.value}
              </Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10.5, color: colors.text300 }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* history */}
        {history.length ? (
          <View style={{ marginHorizontal: 16, marginTop: 20 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text100, marginBottom: 8 }}>{ka.run.history}</Text>
            <View style={{ gap: 8 }}>
              {history.slice(0, 10).map((r) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatKm(r.distanceM)} ${ka.run.km}`}
                  onPress={() => router.push(`/run/${r.id}` as never)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderRadius: 18,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.bg300,
                  }}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: r.reachedPin ? (dark ? '#064E3B' : '#D1FAE5') : (dark ? '#1F2937' : colors.bg200),
                    }}
                  >
                    <MapPin size={18} color={r.reachedPin ? (dark ? '#34D399' : '#059669') : colors.text300} strokeWidth={2.3} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text100 }}>
                      {formatKm(r.distanceM)} {ka.run.km}
                      <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>
                        {'  '}· {r.target.kind === 'km' ? `${r.target.value} ${ka.run.km}` : `${formatThousands(r.target.value)} ${ka.run.steps}`}
                      </Text>
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Timer size={11} color={colors.text300} strokeWidth={2.3} />
                        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11.5, color: colors.text300 }}>{formatClock(r.movingMs)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Flame size={11} color={colors.text300} strokeWidth={2.3} />
                        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11.5, color: colors.text300 }}>{r.calories} {ka.run.kcal}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Footprints size={11} color={colors.text300} strokeWidth={2.3} />
                        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11.5, color: colors.text300 }}>{formatThousands(r.steps)}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: colors.text300 }}>
                      {new Date(r.startedAt).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' })}
                    </Text>
                    <ChevronRight size={16} color={colors.text300} strokeWidth={2.2} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={{ marginHorizontal: 20, marginTop: 20, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11.5, lineHeight: 17, color: colors.text300, textAlign: 'center' }}>
          {ka.run.disclaimer}
        </Text>
      </ScrollView>

      <RunTargetSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        onConfirm={onConfirm}
        heightCm={healthProfile?.heightCm}
        weightKg={healthProfile?.weightKg}
      />
    </View>
  );
}
