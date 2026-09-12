import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Asset } from 'expo-asset';
import { CycleAtmosphere, cycleNavHeader } from '@/components/cycle/CycleUI';
import { CyclePregnancyWeekSelector } from '@/components/cycle/CyclePregnancyWeekSelector';
import { PregnancySizeIllustration, PregnancyWeekMetrics } from '@/components/cycle/CyclePregnancyWeekVisual';
import { ka } from '@/i18n/ka';
import { api, ApiError } from '@/lib/api';
import { loadCycleView } from '@/lib/cycleOffline';
import { supportsCycleCapability } from '@/lib/cycleModes';
import { pregnancyFactText } from '@/lib/pregnancyWeekCopy.js';
import { pregnancySizeAsset } from '@/lib/pregnancySizeAssets';
import {
  PREGNANCY_WEEK_CATALOG_MAX,
  PREGNANCY_WEEK_CATALOG_MIN,
  weekDevelopmentForCompletedWeek,
} from '@/lib/pregnancyWeekData.js';
import { useAuth } from '@/store/AuthContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useCycleColors } from '@/theme/cycle';

function clampWeek(value: unknown) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(n)) return null;
  if (n < PREGNANCY_WEEK_CATALOG_MIN) return PREGNANCY_WEEK_CATALOG_MIN;
  if (n > PREGNANCY_WEEK_CATALOG_MAX) return PREGNANCY_WEEK_CATALOG_MAX;
  return n;
}

function preloadNeighbors(week: number) {
  const keys = [week - 1, week, week + 1]
    .map((item) => weekDevelopmentForCompletedWeek(item)?.illustrationKey)
    .filter(Boolean);
  const unique = [...new Set(keys)];
  if (!unique.length) return;
  Asset.loadAsync(unique.map((key) => pregnancySizeAsset(key))).catch(() => undefined);
}

export default function CyclePregnancyWeekScreen() {
  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = usePrefersReducedMotion();
  const params = useLocalSearchParams<{ week?: string }>();
  const week = clampWeek(params.week) ?? 8;
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);

  const development = useMemo(() => weekDevelopmentForCompletedWeek(week), [week]);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.pregnancyWeekTitle(week)));
  }, [navigation, c, week]);

  useEffect(() => {
    preloadNeighbors(week);
  }, [week]);

  useEffect(() => {
    let alive = true;
    if (!user?.id) return undefined;
    loadCycleView(user.id)
      .then((view) => {
        if (!alive) return null;
        if (!supportsCycleCapability(view.display?.profile?.mode, 'showPregnancyOverview')) {
          router.replace('/cycle');
          return null;
        }
        return api.cycle.pregnancy();
      })
      .then((payload) => {
        if (!alive || !payload) return;
        const age = payload.estimatedGestationalAge;
        setCurrentWeek(age && !payload.reviewRequired ? age.week : null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setCurrentWeek(null);
      });
    return () => {
      alive = false;
    };
  }, [router, user?.id]);

  const isCurrent = currentWeek != null && week === currentWeek;
  const isFuture = currentWeek != null && week > currentWeek;
  const facts = development?.developmentFactKeys || [];

  function go(next: number) {
    if (next < PREGNANCY_WEEK_CATALOG_MIN || next > PREGNANCY_WEEK_CATALOG_MAX) return;
    router.replace(`/cycle/week/${next}`);
  }

  const body = (
    <>
      {isCurrent ? (
        <Text style={{ color: c.rose, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, marginBottom: 6 }}>
          {ka.cycle.pregnancyYouAreNow}
        </Text>
      ) : (
        <Text
          style={{
            color: c.ink,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 22,
            lineHeight: 28,
            marginBottom: 6,
          }}
        >
          {ka.cycle.pregnancyWeekTitle(week)}
        </Text>
      )}
      {isCurrent ? (
        <Text
          style={{
            color: c.ink,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 22,
            lineHeight: 28,
            marginBottom: 8,
          }}
        >
          {ka.cycle.pregnancyWeekTitle(week)}
        </Text>
      ) : null}
      {isFuture ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
          {ka.cycle.pregnancyWeekFuture}
        </Text>
      ) : null}
      {development?.beyondCatalog ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginBottom: 10 }}>
          {ka.cycle.pregnancyWeekBeyond}
        </Text>
      ) : null}

      <PregnancyWeekMetrics development={development} />

      {facts.length ? (
        <View style={{ marginTop: 22 }}>
          <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, marginBottom: 8 }}>
            {ka.cycle.pregnancyDevelopmentTitle}
          </Text>
          {facts.map((key) => (
            <Text key={key} style={{ color: c.muted, fontSize: 15, lineHeight: 22, marginTop: 8 }}>
              {pregnancyFactText(key)}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 18, marginTop: 20 }}>
        {ka.cycle.pregnancySizeDisclaimer}
      </Text>
      <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 18, marginTop: 6 }}>
        {ka.cycle.pregnancyDevelopmentDisclaimer}
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, gap: 12 }}>
        <Pressable
          onPress={() => go(week - 1)}
          disabled={week <= PREGNANCY_WEEK_CATALOG_MIN}
          accessibilityRole="button"
          accessibilityLabel={ka.cycle.pregnancyPrevWeek}
          style={{
            flex: 1,
            minHeight: 44,
            justifyContent: 'center',
            opacity: week <= PREGNANCY_WEEK_CATALOG_MIN ? 0.4 : 1,
          }}
        >
          <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.pregnancyPrevWeek}</Text>
        </Pressable>
        <Pressable
          onPress={() => go(week + 1)}
          disabled={week >= PREGNANCY_WEEK_CATALOG_MAX}
          accessibilityRole="button"
          accessibilityLabel={ka.cycle.pregnancyNextWeek}
          style={{
            flex: 1,
            minHeight: 44,
            justifyContent: 'center',
            alignItems: 'flex-end',
            opacity: week >= PREGNANCY_WEEK_CATALOG_MAX ? 0.4 : 1,
          }}
        >
          <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.pregnancyNextWeek}</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 20 }}>
        <CyclePregnancyWeekSelector week={week} currentWeek={currentWeek} onSelect={go} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }}>
        {[8, 12, 20, 28, 36, 40].map((item) => {
          const row = weekDevelopmentForCompletedWeek(item);
          return (
            <Pressable
              key={item}
              onPress={() => go(item)}
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.pregnancyWeekTitle(item)}
              style={{ alignItems: 'center', width: 48 }}
            >
              <PregnancySizeIllustration comparisonKey={row?.illustrationKey} week={item} size={40} />
              <Text style={{ color: item === week ? c.ink : c.muted, fontSize: 11, marginTop: 4 }}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 18, marginTop: 22 }}>
        {ka.cycle.pregnancySourcesTitle}
      </Text>
      <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
        {ka.cycle.pregnancySourcesBody}
      </Text>
    </>
  );

  return (
    <CycleAtmosphere>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {reduced ? (
          <View key={week}>{body}</View>
        ) : (
          <Animated.View key={week} entering={FadeIn.duration(280)}>
            {body}
          </Animated.View>
        )}
      </ScrollView>
    </CycleAtmosphere>
  );
}
