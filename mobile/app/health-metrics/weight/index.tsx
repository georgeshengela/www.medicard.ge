import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Check,
  Clock,
  Flame,
  MessageCircle,
  Scale,
  Share2,
  Target,
  User,
} from 'lucide-react-native';
import { HomeWeightLogSheet } from '@/components/home/HomeWeightLogSheet';
import { QuotaSheet } from '@/components/QuotaSheet';
import { WeightAppBar, WeightPrimaryButton } from '@/components/weight/WeightChrome';
import { WeightCircleProgress } from '@/components/weight/WeightCircleProgress';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';
import { useHealthMetrics } from '@/hooks/useHealthMetrics';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { bmiCategory, bmiFromWeight } from '@/lib/bmi';
import { usePlanUsage } from '@/lib/planUsage';
import {
  averageKg,
  buildWeightProgress,
  estimatedKcalFromPace,
  loadCachedWeightAdvice,
  loadWeightGoal,
  loadWeightLogs,
  localWeightBlurb,
  localWeightTips,
  monthChangePct,
  resolveCurrentWeightKg,
  saveCachedWeightAdvice,
  seedWeightLogs,
  todayYmd,
  upsertTodayWeight,
  withUpdatedWeight,
} from '@/lib/weightGoal';
import { goToGoalProgress, startWeightGoalWizard } from '@/lib/weightNav';
import { useAuth } from '@/store/AuthContext';
import type { CachedWeightAdvice } from '@/lib/weightGoal';
import type { WeightGoal, WeightLog } from '@/types/weightGoal';

export default function WeightHubScreen() {
  const T = useFigmaWeight();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { healthProfile, setHealthProfile, applyUsage } = useAuth();
  const plan = usePlanUsage();
  const { bundle, refresh } = useHealthMetrics(healthProfile);
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [goal, setGoal] = useState<WeightGoal | null>(null);
  const [advice, setAdvice] = useState<CachedWeightAdvice | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quota, setQuota] = useState<number | undefined>(undefined);

  const weight = bundle?.metrics.find((metric) => metric.key === 'weight');
  const logged = weight?.source != null && weight.source !== 'none';
  const value = resolveCurrentWeightKg(logs, logged ? weight?.value : null, healthProfile?.weightKg);
  const heightCm = healthProfile?.heightCm ?? null;
  const bmi = value != null ? bmiFromWeight(value, heightCm) : null;
  const category = bmi != null ? bmiCategory(bmi) : null;
  const initialKg = value ?? healthProfile?.weightKg ?? 70;
  const latest = logs[0];
  const progress = goal && value != null ? buildWeightProgress(goal, value) : null;
  const monthPct = value != null ? monthChangePct(logs, value) : null;
  const avg = averageKg(logs);

  const hydrate = useCallback(async () => {
    const week = weight?.weekValues ?? [];
    const existing = await loadWeightLogs();
    if (!existing.length) {
      await seedWeightLogs(
        week
          .map((kg, i) => {
            if (kg == null) return null;
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return { kg, date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
          })
          .filter((row): row is { kg: number; date: string } => Boolean(row)),
      );
    }
    let nextLogs = await loadWeightLogs();
    if (!nextLogs.length && healthProfile?.weightKg) {
      nextLogs = await seedWeightLogs([{ kg: healthProfile.weightKg, date: todayYmd() }]);
    }
    const current = resolveCurrentWeightKg(nextLogs, logged ? weight?.value : null, healthProfile?.weightKg);
    if (current != null) {
      const today = nextLogs.find((row) => row.date === todayYmd());
      const todayIsUserLog = Boolean(today?.id.startsWith('wlog-'));
      if (!todayIsUserLog && Math.abs((today?.kg ?? 0) - current) > 0.05) {
        try {
          nextLogs = await upsertTodayWeight(current);
        } catch (error) {
          console.warn('[weight] upsert today failed', error);
        }
      }
    }
    setLogs(nextLogs);
    setGoal(await loadWeightGoal());
    const cached = await loadCachedWeightAdvice();
    if (cached && cached.ymd === todayYmd() && current != null && Math.abs(cached.kg - current) < 0.15) {
      setAdvice(cached);
    } else {
      const fallbackBmi = current != null ? bmiFromWeight(current, healthProfile?.heightCm) : null;
      setAdvice({
        blurb: localWeightBlurb(fallbackBmi),
        tips: localWeightTips(fallbackBmi),
        kg: current ?? 0,
        ymd: todayYmd(),
        fromAi: false,
      });
    }
  }, [healthProfile?.heightCm, healthProfile?.weightKg, logged, weight?.value]);

  useFocusEffect(
    useCallback(() => {
      void hydrate();
      void refresh();
    }, [hydrate, refresh]),
  );

  const when = useMemo(() => {
    if (!latest) return { date: '—', time: '—' };
    const d = new Date(latest.at);
    return {
      date: d.toLocaleDateString('ka-GE', { weekday: 'long', month: 'short', day: 'numeric' }),
      time: d.toLocaleTimeString('ka-GE', { hour: 'numeric', minute: '2-digit' }),
    };
  }, [latest]);

  const fetchAdvice = async () => {
    if (value == null) return;
    if (!plan.unlimited && plan.remaining != null && plan.remaining < 1) {
      setQuota(plan.usage?.resetsInMs);
      return;
    }
    try {
      const response = await api.ai.weightAdvice({
        weightKg: value,
        heightCm: heightCm ?? undefined,
        bmi: bmi ?? undefined,
        category: category ?? undefined,
        targetKg: goal?.targetKg,
      });
      applyUsage(response.usage);
      const next = { blurb: response.blurb, tips: response.tips, kg: value, ymd: todayYmd(), fromAi: true };
      setAdvice(next);
      await saveCachedWeightAdvice(next);
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuota(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
      }
    }
  };

  const share = () => {
    if (value == null) return;
    void Share.share({ message: ka.weight.shareMessage(value.toFixed(1)) });
  };

  const circlePct = progress?.percent ?? 0;
  const circleLabel = progress ? `+${progress.percent}%` : '—';
  const circleCopy = progress
    ? ka.weight.progressToward(progress.percent)
    : ka.weight.progressEmpty;

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <WeightAppBar title={ka.weight.detailsTitle} onBack={() => router.back()} onEdit={() => setSheetOpen(true)} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingHorizontal: 16, paddingVertical: 24, gap: 8 }}>
          <Scale size={48} color={T.brand} strokeWidth={1.8} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 40, lineHeight: 48, color: T.textPrimary }}>
            {value != null ? `${value.toFixed(1)}${ka.weight.kg}` : '—'}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary }}>
            {category ? ka.home.bmi.categories[category] : ka.weight.withinBmi}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Calendar size={16} color={T.textTertiary} strokeWidth={2} />
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: T.textTertiary }}>{when.date}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Clock size={16} color={T.textTertiary} strokeWidth={2} />
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: T.textTertiary }}>{when.time}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: T.textSecondary, textAlign: 'center' }}>
            {advice?.blurb ?? localWeightBlurb(bmi)}
          </Text>
        </View>

        <Section title={ka.weight.recommendation} T={T}>
          <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 16, padding: 16, gap: 12 }}>
            {(advice?.tips ?? localWeightTips(bmi)).map((tip) => (
              <View key={tip} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
                <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: T.textSecondary }}>
                  {tip}
                </Text>
              </View>
            ))}
            <Pressable onPress={() => router.push('/health-metrics/weight/history' as never)} style={{ alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: T.border }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.brand }}>{ka.weight.seeImprovements}</Text>
            </Pressable>
          </View>
        </Section>

        <Section title={ka.weight.keyStats} T={T}>
          <View style={{ backgroundColor: T.cardBg, borderWidth: 1, borderColor: T.border, borderRadius: 16, paddingHorizontal: 16 }}>
            <StatRow icon={<Target size={24} color={T.brand} strokeWidth={2} />} title={ka.weight.goalProgress} value={progress ? `+${progress.percent}%` : '—'} label={ka.weight.dailyGoal} T={T} />
            <StatRow icon={<User size={24} color={T.brand} strokeWidth={2} />} title={ka.home.bmi.bmiTitle} value={bmi != null ? bmi.toFixed(1) : '—'} label={ka.weight.currentIndex} T={T} />
            <StatRow
              icon={<Calendar size={24} color={T.brand} strokeWidth={2} />}
              title={ka.weight.monthChange}
              value={monthPct == null ? '—' : `${monthPct > 0 ? '+' : ''}${monthPct}%`}
              label={monthPct == null ? '—' : monthPct > 0 ? ka.weight.gain : monthPct < 0 ? ka.weight.loss : ka.weight.same}
              T={T}
            />
            <StatRow icon={<BarChart3 size={24} color={T.brand} strokeWidth={2} />} title={ka.weight.average} value={avg != null ? String(avg) : '—'} label={ka.weight.kg} T={T} />
            <StatRow
              icon={<Flame size={24} color={T.brand} strokeWidth={2} />}
              title={ka.weight.calorie}
              value={goal ? String(estimatedKcalFromPace(goal.paceKgPerWeek)) : '—'}
              label={ka.weight.kcal}
              T={T}
              last
            />
          </View>
        </Section>

        <Section title={ka.weight.goalProgress} T={T}>
          <Pressable
            onPress={() => (goal ? goToGoalProgress(router) : startWeightGoalWizard(router))}
            style={{ backgroundColor: T.cardBg, borderWidth: 1, borderColor: T.border, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 24 }}
          >
            <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: T.textSecondary }}>
              {circleCopy}
            </Text>
            <WeightCircleProgress percent={circlePct} label={circleLabel} />
          </Pressable>
        </Section>

        <View style={{ padding: 16, gap: 10 }}>
          <WeightPrimaryButton
            label={ka.weight.seeImprovements}
            onPress={() => router.push('/health-metrics/weight/history' as never)}
            icon={<ArrowRight size={20} color="#FFFFFF" strokeWidth={2.2} />}
          />
          <Pressable
            onPress={() => void fetchAdvice()}
            style={{
              height: 48,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: T.brandLight,
              backgroundColor: T.brandSoft,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 10,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.brand }}>{ka.weight.consultMedi}</Text>
            <MessageCircle size={20} color={T.brand} strokeWidth={2} />
          </Pressable>
          <Pressable onPress={share} style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 8 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.brand }}>{ka.weight.share}</Text>
            <Share2 size={16} color={T.brand} strokeWidth={2} />
          </Pressable>
        </View>
      </ScrollView>

      <HomeWeightLogSheet
        visible={sheetOpen}
        profile={healthProfile}
        initialKg={initialKg}
        onClose={() => setSheetOpen(false)}
        onSaved={() => {
          void (async () => {
            const latestLogs = await loadWeightLogs();
            const kg = latestLogs[0]?.kg;
            if (kg != null) {
              setHealthProfile(withUpdatedWeight(healthProfile, kg) ?? healthProfile);
            }
            await hydrate();
            await refresh();
          })();
        }}
      />
      <QuotaSheet
        visible={quota != null}
        resetsInMs={quota}
        onClose={() => setQuota(undefined)}
        onUpgrade={() => {
          setQuota(undefined);
          router.push('/package');
        }}
      />
    </View>
  );
}

function Section({ title, T, children }: { title: string; T: ReturnType<typeof useFigmaWeight>; children: React.ReactNode }) {
  return (
    <View style={{ paddingTop: 8 }}>
      <Text style={{ paddingHorizontal: 16, paddingVertical: 8, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary }}>
        {title}
      </Text>
      <View style={{ paddingHorizontal: 16 }}>{children}</View>
    </View>
  );
}

function StatRow({
  icon,
  title,
  value,
  label,
  T,
  last,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  label: string;
  T: ReturnType<typeof useFigmaWeight>;
  last?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.border }}>
      {icon}
      <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.textPrimary }}>{title}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 24, lineHeight: 32, color: T.textPrimary }}>{value}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary }}>{label}</Text>
      </View>
    </View>
  );
}
