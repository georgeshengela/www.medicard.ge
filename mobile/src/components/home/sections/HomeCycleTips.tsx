import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Baby, Footprints, Leaf, Moon, Smile, Sparkles, type LucideIcon } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { tx } from '@/i18n/locale';
import { buildCycleAdvice } from '@/lib/cycleAdvice';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { cycleToday, phaseFromBundle } from '@/lib/cycleCanonical';
import { showPhaseAsBiological } from '@/lib/cycleContraception';
import { needsCycleOnboarding } from '@/lib/cycleExperience';
import { forecastPresentationAllowed, suppressCycleLengthChrome } from '@/lib/cycleForecastEligibility';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { cycleTipsAllowed, homeTipCards } from '@/lib/home/homeCycle';
import { useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import type { HomeCycleData } from './HomeCycleHero';

export type HomeCycleTipsProps = {
  cycle: HomeCycleData;
  locked: boolean | null;
  first?: boolean;
};

const TONE_ICON: Record<string, LucideIcon> = {
  care: Leaf,
  calm: Moon,
  energy: Footprints,
  mood: Smile,
  fertile: Sparkles,
  pregnancy: Baby,
};

/**
 * „დღის რჩევები“ — three everyday tips for the current phase, built on the device from the cached
 * view (`buildCycleAdvice` → DAILY_TIPS; no AI route, no consent prompt). Shown only where the cycle
 * screen shows its tips (classic overview, forecast allowed), never as biology under hormonal
 * contraception, never while the cycle is locked or not set up. Nothing honest to show → null.
 */
export function HomeCycleTips({ cycle, locked, first }: HomeCycleTipsProps) {
  const router = useRouter();
  const theme = useThemeColors();
  const accent = useHomeAccent();
  const cycleOn = isFeatureOn('cycle', useFeatureState());
  const bundle = locked === false && cycleOn ? (cycle.view?.display ?? null) : null;

  const tips = useMemo(() => {
    if (!bundle) return [];
    const today = cycleToday(bundle, todayKey());
    const phase = phaseFromBundle(bundle, today);
    const caps = cycleModeCapabilities(bundle.profile.mode);
    const allowed = cycleTipsAllowed({
      locked,
      classicOverview: caps.showClassicCycleOverview,
      forecastAllowed: forecastPresentationAllowed(bundle),
      phaseBiological: showPhaseAsBiological(bundle),
      setupNeeded: needsCycleOnboarding(bundle.profile.mode, bundle.profile.lastPeriodStart ?? null),
      phase: phase.phase,
    });
    if (!allowed) return [];
    const cards = buildCycleAdvice({
      phase: suppressCycleLengthChrome(bundle) ? { ...phase, day: null } : phase,
      mode: bundle.profile.mode,
      conditions: bundle.profile.conditions,
      log: null,
      confidence: bundle.predictions?.confidence,
      isIrregular: bundle.profile.isIrregular,
    });
    return homeTipCards(cards);
  }, [bundle, locked]);

  if (!tips.length) return null;

  return (
    <View style={{ paddingHorizontal: HUB.gutter, marginTop: first ? 22 : HUB.sectionGap }}>
      <HomeSectionHeading
        title={tx('დღის რჩევები', "Today's tips")}
        linkLabel={tx('ციკლში', 'Cycle')}
        onLink={() => router.push('/cycle' as never)}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.scroller}
        contentContainerStyle={s.scrollContent}
      >
        {tips.map((tip) => {
          const Icon = TONE_ICON[tip.tone] ?? Leaf;
          return (
            <View
              key={tip.id}
              accessible
              accessibilityLabel={`${tip.title}. ${tip.body}`}
              style={[s.tile, { backgroundColor: theme.surface }]}
            >
              <View style={[s.icon, { backgroundColor: accent.tint }]}>
                <Icon size={21} color={accent.ink} strokeWidth={1.8} />
              </View>
              <Text numberOfLines={2} style={[hubText.cardTitle, { color: theme.text100 }]}>
                {tip.title}
              </Text>
              <Text numberOfLines={4} style={[hubText.body, { color: theme.text200 }]}>
                {tip.body}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <Text style={[hubText.small, { color: theme.text200, marginTop: 10 }]}>
        {tx('ზოგადი რჩევებია შენი ფაზის მიხედვით — არა დიაგნოზი.', 'General tips for your phase — not a diagnosis.')}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  scroller: { marginHorizontal: -HUB.gutter },
  scrollContent: { paddingHorizontal: HUB.gutter, gap: 10 },
  tile: { width: 236, borderRadius: HUB.cardRadius, padding: 16, gap: 10 },
  icon: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
});
