import React, { useLayoutEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChartNoAxesColumn, PencilLine } from 'lucide-react-native';
import { CycleObservationTrends } from '@/components/cycle/CycleObservationTrends';
import { CycleTrendsCharts } from '@/components/cycle/CycleTrendsChart';
import { CycleAtmosphere, CycleCard, CycleLoading, CyclePrimaryButton, cycleNavHeader } from '@/components/cycle/CycleUI';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { ApiError } from '@/lib/api';
import { cycleToday } from '@/lib/cycleCanonical';
import { useCycleObservationTrends } from '@/lib/cycleQueries';
import { cycleTrendsScreenState } from '@/lib/cycleTrendsState';
import { useCycleView } from '@/lib/cycleViewCache';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';
import { useIsDark } from '@/theme/colors';
import { HUB, hubTint } from '@/theme/hub';

export default function CycleTrendsScreen() {
  const { user } = useAuth();
  const c = useCycleColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.trendsTitle));
  }, [navigation, c]);

  // Shared cached view (['cycle','view'], read through the offline overlay) + cached observations:
  // a revisit draws at once and re-reads only when stale or after a cycle write.
  const viewQuery = useCycleView(user?.id);
  const view = viewQuery.data;
  const bundle = view?.canonical ?? null;
  const observations = useCycleObservationTrends();
  const state = cycleTrendsScreenState({
    bundle,
    observations: observations.data,
    observationsSettled: observations.data !== undefined || observations.isError,
  });

  if (!user?.id) return <CycleLoading />;
  if (!view && !viewQuery.isError) return <CycleLoading />;

  const error =
    !view && viewQuery.error
      ? viewQuery.error instanceof ApiError
        ? viewQuery.error.message
        : ka.common.error
      : null;

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Text style={{ color: c.danger, fontWeight: '600', marginBottom: 12 }}>{error}</Text>
        ) : null}
        {view?.stale ? (
          <Text style={{ color: c.muted, marginBottom: 12, lineHeight: 20 }}>
            {ka.cycle.offlineRefreshHint}
          </Text>
        ) : null}
        {bundle && state === 'empty' ? (
          <CycleTrendsEmpty today={cycleToday(bundle, todayKey())} />
        ) : null}
        {bundle && state === 'content' ? (
          <>
            <CycleObservationTrends
              showEmpty={
                (bundle.analytics?.completedCycleCount ?? 0) < 2 &&
                !(bundle.trends?.cycleLengths && bundle.trends.cycleLengths.length >= 3)
              }
            />
            <CycleTrendsCharts bundle={bundle} />
          </>
        ) : null}
      </ScrollView>
    </CycleAtmosphere>
  );
}

/** Too little data for any chart or observation: one calm card that says why and how to start. */
function CycleTrendsEmpty({ today }: { today: string }) {
  const c = useCycleColors();
  const dark = useIsDark();
  const router = useRouter();
  return (
    <CycleCard>
      <View
        style={{
          width: HUB.tile,
          height: HUB.tile,
          borderRadius: HUB.tileRadius,
          backgroundColor: hubTint(c.ink, dark),
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <ChartNoAxesColumn size={20} color={c.ink} strokeWidth={2.2} />
      </View>
      <Text
        accessibilityRole="header"
        style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 23 }}
      >
        {tx('ტრენდებისთვის ჯერ ცოტა ჩანაწერია', 'Not enough entries for trends yet')}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 6 }}>
        {tx(
          'აქ გამოჩნდება შენი ციკლის ხანგრძლივობა, მენსტრუაციამდე დღეები და ის დაკვირვებები, რომლებიც მეორდება. ამისთვის რამდენიმე დღის და სულ მცირე ორი ციკლის აღრიცხვაა საჭირო.',
          'Your cycle length, the days before your period and observations that repeat will show here. It takes a few logged days and at least two cycles.',
        )}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 16 }}>
        {tx('დღეში ერთი შეხებაც საკმარისია.', 'One tap a day is enough.')}
      </Text>
      <CyclePrimaryButton
        label={ka.cycle.logToday}
        icon={PencilLine}
        onPress={() => router.push({ pathname: '/cycle/log', params: { date: today } } as never)}
      />
    </CycleCard>
  );
}
