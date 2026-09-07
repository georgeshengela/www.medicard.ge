import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Flame, Footprints, Gauge, MapPin, Route, Sparkles, Target, Timer } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StepsGoalConfetti } from '@/components/health/steps-goal/StepsGoalConfetti';
import { BetaPill } from '@/components/run/HomeRunSection';
import { RunMap, type RunMapHandle } from '@/components/run/RunMap';
import { ka } from '@/i18n/ka';
import { formatClock, formatKm, formatPace, formatThousands } from '@/lib/run/geo';
import { targetLabel } from '@/lib/run/labels';
import { cancelRun, useRunSession } from '@/lib/run/store';
import { useIsDark, useThemeColors } from '@/theme/colors';

export default function RunSummaryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const s = useRunSession();
  const summary = s.summary;
  const map = useRef<RunMapHandle>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!summary) router.replace('/run' as never);
    else if (summary.reachedPin || summary.completedTarget) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapReady || !summary?.origin) return;
    map.current?.send({ type: 'init', origin: summary.origin, pin: summary.pin, route: null, radiusM: 28, fit: false });
    if (summary.path.length >= 2) {
      map.current?.send({ type: 'trail', coords: summary.path.map((pt) => [pt.lng, pt.lat] as [number, number]) });
    }
    if (summary.reachedPin) map.current?.send({ type: 'reached' });
    setTimeout(() => map.current?.send({ type: 'fit', bottom: 60 }), 250);
  }, [mapReady, summary]);

  if (!summary) return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;

  const celebrate = summary.reachedPin || summary.completedTarget;
  const pct = summary.targetMeters > 0 ? Math.min(100, Math.round((summary.distanceM / summary.targetMeters) * 100)) : 100;
  const accent = dark ? '#5EEAD4' : colors.primary100;

  const leave = (to: '/run' | '/(tabs)/home') => {
    cancelRun();
    router.replace(to as never);
  };

  const stats = [
    { icon: Route, value: formatKm(summary.distanceM), unit: ka.run.km, label: ka.run.distance },
    { icon: Timer, value: formatClock(summary.movingMs), unit: '', label: ka.run.time },
    { icon: Gauge, value: formatPace(summary.paceSecPerKm), unit: ka.run.paceUnit, label: ka.run.pace },
    { icon: Flame, value: String(summary.calories), unit: ka.run.kcal, label: ka.run.calories },
    { icon: Footprints, value: formatThousands(summary.steps), unit: '', label: ka.run.stepsLabel },
    { icon: Target, value: `${pct}%`, unit: '', label: targetLabel(summary.target) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {/* map header */}
        <View style={{ height: 300 + insets.top, backgroundColor: dark ? '#030712' : '#e5eef0' }}>
          {summary.origin ? <RunMap ref={map} center={summary.origin} onReady={() => setMapReady(true)} /> : null}
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', colors.bg100]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }}
          />
          <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BetaPill />
          </View>
        </View>

        {celebrate ? <StepsGoalConfetti /> : null}

        <Animated.View entering={FadeInUp.duration(420)} style={{ paddingHorizontal: 20, marginTop: -26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: summary.reachedPin ? (dark ? '#064E3B' : '#D1FAE5') : (dark ? '#422006' : '#FEF3C7') }}>
              <MapPin size={20} color={summary.reachedPin ? (dark ? '#34D399' : '#059669') : (dark ? '#FBBF24' : '#D97706')} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 30, letterSpacing: -0.4, color: colors.text100 }}>
                {ka.run.summaryTitle}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, color: summary.reachedPin ? (dark ? '#34D399' : '#059669') : colors.text300 }}>
                {summary.reachedPin ? ka.run.summaryPinYes : ka.run.summaryPinNo}
                {'  ·  '}
                {summary.completedTarget ? ka.run.summaryTargetYes : ka.run.summaryTargetPct(pct)}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* stats grid */}
        <Animated.View entering={FadeInDown.delay(80).duration(420)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 18 }}>
          {stats.map((st) => (
            <View
              key={st.label}
              style={{
                width: '31.5%',
                flexGrow: 1,
                alignItems: 'center',
                gap: 3,
                paddingVertical: 14,
                borderRadius: 18,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.bg300,
              }}
            >
              <st.icon size={15} color={accent} strokeWidth={2.3} />
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 19, color: colors.text100, letterSpacing: -0.3 }}>
                  {st.value}
                </Text>
                {st.unit ? <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 10, color: colors.text300 }}>{st.unit}</Text> : null}
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10.5, color: colors.text300 }}>
                {st.label}
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* Medi line */}
        <Animated.View
          entering={FadeInDown.delay(160).duration(420)}
          style={{
            marginHorizontal: 16,
            marginTop: 14,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            padding: 14,
            borderRadius: 18,
            backgroundColor: dark ? '#042F2E' : colors.accent100,
          }}
        >
          <Sparkles size={16} color={accent} strokeWidth={2.4} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 19, color: dark ? '#99F6E4' : colors.primary100 }}>
            {ka.run.summaryMedi(formatKm(summary.distanceM), summary.calories)}
          </Text>
        </Animated.View>

        <Text style={{ marginHorizontal: 24, marginTop: 10, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: colors.text300, textAlign: 'center' }}>
          {ka.run.estimated} · {ka.run.disclaimer}
        </Text>

        {/* actions */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 18 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => leave('/run')}
            style={{ flex: 1, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg200, borderWidth: 1, borderColor: colors.bg300 }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: colors.text200 }}>{ka.run.summaryAgain}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => leave('/(tabs)/home')}
            style={{ flex: 1.3, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#0D9488' : colors.primary200 }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: '#FFFFFF' }}>{ka.run.summaryDone}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
