import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { ChevronRight, Scale } from 'lucide-react-native';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HomeWeightLogSheet } from '@/components/home/HomeWeightLogSheet';
import type { HomeNutritionState } from '@/components/home/sections/HomeEnergyCard';
import { isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { formatYmd } from '@/lib/format';
import {
  SPARKLINE_MIN_POINTS,
  latestUserLog,
  pickCurrentWeight,
  sparklinePoints,
  weighInWhen,
  weightEta,
  weightGoalView,
  weightSeries,
} from '@/lib/home/weightProgress';
import { daysBetween, loadWeightGoal, loadWeightLogs, todayYmd, withUpdatedWeight } from '@/lib/weightGoal';
import { startWeightGoalWizard } from '@/lib/weightNav';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import type { WeightGoal, WeightLog } from '@/types/weightGoal';
import { tx } from '@/i18n/locale';

const CHART_H = 56;
const kgText = (kg: number) => kg.toFixed(1);

type Local = { goal: WeightGoal | null; logs: WeightLog[]; ready: boolean };

/**
 * „წონა და მიზანი“ — where the person stands, and a weigh-in in a sheet without leaving Home.
 *
 * Data: the local weight goal and logs (AsyncStorage, no network, re-read on focus so a goal edited on
 * the weight page shows on return) plus the shared nutrition dashboard (`facts.current` with its date
 * and source, `facts.weightHistory`, `projection`). No `useHealthMetrics` — it re-reads native data.
 * Tone: no percent text, nothing red, moving away is never a negative number, the ETA is "around".
 */
/**
 * The weight state Home shows — shared by „წონა და მიზანი“ and the women's MEDIFOOD card: the local
 * goal and logs (re-read on focus), the dashboard facts, the current weight and goal view, and the
 * weigh-in sheet's open state and save handler. Null `current` = nothing honest to show yet.
 */
export function useHomeWeight(nutrition: HomeNutritionState) {
  const { user, healthProfile, setHealthProfile } = useAuth();
  const accountId = user?.id ?? null;
  const [local, setLocal] = useState<Local>({ goal: null, logs: [], ready: false });
  // A weigh-in saved here, shown until the dashboard answer that includes it replaces `data`.
  const [saved, setSaved] = useState<{ kg: number; date: string; data: unknown } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([loadWeightGoal(), loadWeightLogs()])
        .then(([goal, logs]) => {
          if (alive) setLocal({ goal, logs, ready: true });
        })
        .catch(() => {
          if (alive) setLocal((prev) => ({ ...prev, ready: true }));
        });
      return () => {
        alive = false;
      };
    }, [accountId]),
  );

  const data = nutrition.data;
  const today = todayYmd();
  const current = pickCurrentWeight({
    server: data?.facts?.current,
    logs: local.logs,
    profileKg: healthProfile?.weightKg,
    saved: saved && saved.data === data ? saved : null,
    today,
  });
  const goal = local.goal ?? data?.facts?.weightGoal ?? null;
  const view = current ? weightGoalView(goal, current.kg) : null;

  const onSaved = () => {
    const dataAtSave = nutrition.data;
    void (async () => {
      const [logs, nextGoal] = await Promise.all([loadWeightLogs(), loadWeightGoal()]);
      const latest = latestUserLog(logs, todayYmd());
      if (latest) {
        setHealthProfile(withUpdatedWeight(healthProfile, latest.kg) ?? healthProfile);
        setSaved({ kg: latest.kg, date: latest.date, data: dataAtSave });
      }
      setLocal({ goal: nextGoal, logs, ready: true });
      // Weight writes do not invalidate ['nutrition','dashboard'] (queryInvalidation.ts): refresh it once.
      void nutrition.load();
    })().catch(() => undefined);
  };

  return { ready: local.ready || Boolean(data), logs: local.logs, today, current, view, sheetOpen, setSheetOpen, onSaved, healthProfile };
}

export function HomeWeightProgress({ nutrition, first = false }: { nutrition: HomeNutritionState; first?: boolean }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const router = useRouter();
  const features = useFeatureState();
  const { ready, logs, today, current, view, sheetOpen, setSheetOpen, onSaved, healthProfile } = useHomeWeight(nutrition);
  const [chartWidth, setChartWidth] = useState(0);

  if (!isHrefAvailable('/health-metrics/weight', features)) return null;

  const data = nutrition.data;
  // Nothing honest to show yet: local storage not read and no dashboard (a few ms on cold start).
  if (!ready) return null;

  const series = weightSeries({ history: data?.facts?.weightHistory, logs, current });
  const eta = view ? weightEta(data, view) : null;

  const when = current ? weighInWhen(current, today) : null;
  const whenLabel =
    when?.kind === 'profile'
      ? tx('პროფილიდან', 'From your profile')
      : when?.kind === 'today'
        ? tx('ბოლო აწონვა · დღეს', 'Last weigh-in · today')
        : when?.kind === 'yesterday'
          ? tx('ბოლო აწონვა · გუშინ', 'Last weigh-in · yesterday')
          : when?.kind === 'date'
            ? tx(`ბოლო აწონვა · ${formatYmd(when.date)}`, `Last weigh-in · ${formatYmd(when.date)}`)
            : '';

  const points = chartWidth > 0 && series.length >= SPARKLINE_MIN_POINTS ? sparklinePoints(series.map((p) => p.kg), chartWidth, CHART_H) : [];
  const etaDate = eta ? formatYmd(eta.date, daysBetween(today, eta.date) > 300) : '';
  const showSources = view != null && view.kind !== 'none';

  return (
    <View style={{ paddingHorizontal: HUB.gutter, marginTop: first ? 22 : HUB.sectionGap }}>
      <HomeSectionHeading title={tx('წონა და მიზანი', 'Weight and goal')} linkLabel={tx('ყველა', 'All')} onLink={() => router.push('/health-metrics/weight' as never)} />
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <View style={s.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {current ? (
              <>
                <Text style={[hubText.caption, { color: c.text200 }]}>{whenLabel}</Text>
                <Text accessibilityLabel={tx(`${kgText(current.kg)} კილოგრამი`, `${kgText(current.kg)} kilograms`)} style={[s.value, { color: c.text100 }]}>
                  {kgText(current.kg)}
                  <Text style={[s.unit, { color: c.text200 }]}> {tx('კგ', 'kg')}</Text>
                </Text>
              </>
            ) : (
              <Text style={[hubText.body, { color: c.text100 }]}>{tx('აიწონე — პროგრესს აქ ნახავ.', 'Weigh in — your progress will show here.')}</Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('წონის ჩაწერა', 'Log your weight')}
            onPress={() => setSheetOpen(true)}
            style={[s.pill, { backgroundColor: accent.soft }]}
          >
            <Scale size={16} color={accent.ink} strokeWidth={2} />
            <Text style={[hubText.link, { color: accent.ink }]}>{tx('აწონვა', 'Weigh in')}</Text>
          </Pressable>
        </View>

        {view && (view.kind === 'progress' || view.kind === 'reached') ? (
          <View style={{ gap: 6 }}>
            <View style={[s.track, { backgroundColor: c.bg200 }]}>
              <View style={[s.fill, { width: `${view.kind === 'reached' ? 100 : view.percent}%`, backgroundColor: accent.ink }]} />
            </View>
            <View style={s.ends}>
              <Text style={[hubText.small, { color: c.text200 }]}>{tx(`${kgText(view.startKg)} · დაწყება`, `${kgText(view.startKg)} · start`)}</Text>
              <Text style={[hubText.small, { color: c.text200 }]}>{tx(`${kgText(view.targetKg)} · მიზანი`, `${kgText(view.targetKg)} · goal`)}</Text>
            </View>
          </View>
        ) : null}

        {view?.kind === 'progress' ? (
          <Text style={[hubText.body, { color: c.text100 }]}>
            {view.movedKg > 0 ? (
              <>
                {tx('გავლილია ', '')}
                <Text style={s.bold}>{tx(`${kgText(view.movedKg)} კგ`, `${kgText(view.movedKg)} kg`)}</Text>
                {tx(' · მიზნამდე ', ' done · ')}
              </>
            ) : (
              tx('მიზნამდე ', '')
            )}
            <Text style={s.bold}>{tx(`${kgText(view.remainingKg)} კგ`, `${kgText(view.remainingKg)} kg`)}</Text>
            {tx('', ' to go')}
          </Text>
        ) : view?.kind === 'reached' ? (
          <Text style={[hubText.body, { color: c.text100 }]}>{tx(`მიზანს მიაღწიე · ${kgText(view.targetKg)} კგ`, `Goal reached · ${kgText(view.targetKg)} kg`)}</Text>
        ) : view?.kind === 'maintain' ? (
          <Text style={[hubText.body, { color: c.text100 }]}>{tx(`შენარჩუნების მიზანი · ${kgText(view.targetKg)} კგ`, `Maintaining · ${kgText(view.targetKg)} kg`)}</Text>
        ) : null}

        {current && series.length >= SPARKLINE_MIN_POINTS ? (
          <View
            accessible
            accessibilityLabel={tx(
              `წონის ტენდენცია: ${kgText(series[0].kg)}-დან ${kgText(series[series.length - 1].kg)} კგ-მდე`,
              `Weight trend: from ${kgText(series[0].kg)} to ${kgText(series[series.length - 1].kg)} kg`,
            )}
            onLayout={(e) => setChartWidth(Math.round(e.nativeEvent.layout.width))}
            style={{ height: CHART_H }}
          >
            {points.length ? (
              <Svg width={chartWidth} height={CHART_H}>
                <Polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={accent.ink}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {points.map((p, i) => {
                  const last = i === points.length - 1;
                  if (!last && points.length > 10) return null;
                  return <Circle key={i} cx={p.x} cy={p.y} r={last ? 4.5 : 2.5} fill={last ? accent.ink : c.surface} stroke={accent.ink} strokeWidth={2} />;
                })}
              </Svg>
            ) : null}
          </View>
        ) : current ? (
          <Text style={[hubText.caption, { color: c.text200 }]}>
            {tx('აიწონე კვირაში ერთხელ ან ორჯერ — ტენდენცია გამოჩნდება.', 'Weigh in once or twice a week and a trend will appear.')}
          </Text>
        ) : null}

        {eta ? (
          <Text style={[hubText.caption, { color: c.text200 }]}>
            {eta.kind === 'trend'
              ? tx(`ორიენტირი მიმდინარე ტემპით — დაახლოებით ${etaDate}.`, `A guide at your current pace — around ${etaDate}.`)
              : tx(`ორიენტირი გეგმის ტემპით — დაახლოებით ${etaDate}.`, `A guide at your plan's pace — around ${etaDate}.`)}
          </Text>
        ) : null}

        {current && view?.kind === 'none' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('წონის მიზნის დასახვა', 'Set a weight goal')}
            onPress={() => startWeightGoalWizard(router)}
            style={s.quiet}
          >
            <Text style={[hubText.link, { color: accent.ink }]}>{tx('მიზნის დასახვა', 'Set a goal')}</Text>
            <ChevronRight size={15} color={accent.ink} />
          </Pressable>
        ) : null}
      </View>
      {showSources ? <MedicalSourcesLink sourceIds={['bodyWeightPlanner', 'weightPace']} /> : null}

      <HomeWeightLogSheet
        visible={sheetOpen}
        profile={healthProfile}
        initialKg={current?.kg ?? healthProfile?.weightKg ?? 70}
        onClose={() => setSheetOpen(false)}
        onSaved={onSaved}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, letterSpacing: -0.4 },
  unit: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, letterSpacing: 0 },
  pill: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  ends: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  bold: { fontFamily: 'NotoSansGeorgian_700Bold' },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, alignSelf: 'flex-start' },
});
