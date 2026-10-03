import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { CycleBundle } from '@/lib/api';
import { cycleToday } from '@/lib/cycleCanonical';
import { bleedingIsUncertain, showFertilityUi, showOvulationUi } from '@/lib/cycleContraception';
import { needsCycleOnboarding } from '@/lib/cycleExperience';
import { FERTILITY_STATUS, fertilityGateFromBundle, forecastPresentationAllowed } from '@/lib/cycleForecastEligibility';
import { ovulationSourceLabel, wideWindowLabel } from '@/lib/cycleForecastCopy';
import { CycleLearningBadge } from '@/components/cycle/CycleLearningBadge';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { formatYmd } from '@/lib/format';
import { cycleAheadModel, type AheadEvent, type AheadKind } from '@/lib/home/homeCycle';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { useCycleColors } from '@/theme/cycle';
import { HUB, hubText } from '@/theme/hub';
import type { HomeCycleData } from './HomeCycleHero';

export type HomeCycleAheadProps = {
  cycle: HomeCycleData;
  locked: boolean | null;
};

/**
 * „წინ რა გელის“ — the next estimated period, fertile days and ovulation with their dates, so a
 * woman can plan around them without opening the calendar. Each row carries its day in the cycle
 * grammar (dashed rose = expected period, turquoise = fertile / ovulation) and how soon it is.
 * Same gates as the cycle screen: classic overview only, forecast allowed, fertility and ovulation
 * only where they may be shown; nothing while locked or before the cycle is set up.
 */
export function HomeCycleAhead({ cycle, locked }: HomeCycleAheadProps) {
  const router = useRouter();
  const theme = useThemeColors();
  const dark = useIsDark();
  const c = useCycleColors();
  const cycleOn = isFeatureOn('cycle', useFeatureState());
  const bundle: CycleBundle | null = locked === false && cycleOn ? (cycle.view?.display ?? null) : null;
  if (!bundle) return null;

  const caps = cycleModeCapabilities(bundle.profile.mode);
  if (!caps.showClassicCycleOverview) return null;
  if (needsCycleOnboarding(bundle.profile.mode, bundle.profile.lastPeriodStart ?? null)) return null;

  const today = cycleToday(bundle, todayKey());
  const forecastAllowed = forecastPresentationAllowed(bundle);
  const next = bundle.predictions?.nextPeriodStart ?? null;
  const fertility = showFertilityUi(bundle) && caps.showFertileEstimates && forecastAllowed;
  const uncertainBleed = bleedingIsUncertain(bundle);
  const events = cycleAheadModel({
    today,
    phases: bundle.predictions?.phases,
    nextPeriodStart: next,
    nextPeriodEnd: bundle.predictions?.nextPeriodEnd ?? null,
    nextPeriodRange: bundle.predictions?.nextPeriodRange ?? null,
    onPeriod: isBleedFlow(bundle.logs.find((l) => l.date === today)?.flow),
    showPeriod: Boolean(next) && caps.showNextPeriodForecast && forecastAllowed,
    showFertility: fertility,
    showOvulation: fertility && showOvulationUi(bundle),
  });
  // Forecast honesty (brief §9 item 13): before 3 cycles the fertile stop is a quiet badge, never a guess.
  const gate = fertilityGateFromBundle(bundle);
  const hasFertile = events.some((e) => e.kind === 'fertile');
  const learning = fertility && gate.status === FERTILITY_STATUS.LEARNING && !hasFertile;
  const wide = events.some((e) => e.kind === 'fertile' && e.wide);
  const ovulationSource = events.some((e) => e.kind === 'ovulation') ? ovulationSourceLabel(gate.ovulationSource) : null;
  if (!events.length) return null;

  const titleOf = (kind: AheadKind) =>
    kind === 'period'
      ? uncertainBleed
        ? tx('სისხლდენა', 'Bleeding')
        : tx('მენსტრუაცია', 'Period')
      : kind === 'fertile'
        ? tx('ნაყოფიერი დღეები', 'Fertile days')
        : tx('ოვულაცია', 'Ovulation');
  const openCycle = () => router.push('/cycle' as never);

  return (
    <View style={s.section}>
      <HomeSectionHeading title={tx('წინ რა გელის', 'Coming up')} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${tx('წინ რა გელის', 'Coming up')}. ${events
          .map((e) => `${titleOf(e.kind)}, ${ka.cycle.heroLikely} ${dateRange(e)}, ${soonLabel(e)}${e.wide ? `, ${wideWindowLabel()}` : ''}`)
          .join('; ')}`}
        onPress={openCycle}
        style={[s.card, { backgroundColor: theme.surface }]}
      >
        {/* A timeline: the days ahead in order, each on the same line. */}
        <View style={s.track}>
          {events.length > 1 ? <View style={[s.line, { backgroundColor: theme.bg300, left: `${50 / events.length}%`, right: `${50 / events.length}%` }]} /> : null}
          {events.map((event) => (
            <View key={event.kind} style={s.stop}>
              <DayGlyph kind={event.kind} date={event.start} surface={theme.surface} />
              <Text numberOfLines={1} style={[s.soon, { color: event.kind === 'period' ? (dark ? c.brand : c.ctaPressed) : c.fertile }]}>
                {soonLabel(event)}
              </Text>
              <Text numberOfLines={2} style={[s.title, { color: theme.text100 }]}>
                {titleOf(event.kind)}
              </Text>
              <Text numberOfLines={1} style={[hubText.small, { color: theme.text200, textAlign: 'center' }]}>
                {`~ ${dateRange(event, true)}`}
              </Text>
            </View>
          ))}
        </View>
        {learning ? <CycleLearningBadge done={gate.completedCycles} required={gate.requiredCycles} surface={theme.bg200} /> : null}
        {wide ? <Text style={[hubText.small, s.note, { color: c.fertile }]}>{`${tx('ნაყოფიერი დღეები', 'Fertile days')}: ${wideWindowLabel()}`}</Text> : null}
        {ovulationSource ? (
          <Text style={[hubText.small, s.note, { color: c.fertile }]}>{`${tx('ოვულაცია', 'Ovulation')} · ${ovulationSource}`}</Text>
        ) : null}
        <Text style={[hubText.small, s.note, { color: c.mutedSoft }]}>
          {tx('სავარაუდო თარიღებია, ბოლო ციკლების მიხედვით.', 'Estimated dates, based on your recent cycles.')}
        </Text>
      </Pressable>
    </View>
  );
}

/** „6 ოქტომბერი“ / „6 ოქტ“. */
function dayMonth(ymd: string, short: boolean): string {
  const full = formatYmd(ymd);
  if (!short) return full;
  const [day, ...month] = full.split(' ');
  return `${day} ${month.join(' ').slice(0, 3)}`;
}

/** „6–10 ოქტომბერი“ inside one month, „28 ოქტომბერი – 2 ნოემბერი“ across two (`short`: three-letter months). */
function dateRange(event: AheadEvent, short = false): string {
  if (!event.end || event.end === event.start) return dayMonth(event.start, short);
  if (event.start.slice(0, 7) === event.end.slice(0, 7)) return `${Number(event.start.slice(8, 10))}–${dayMonth(event.end, short)}`;
  return `${dayMonth(event.start, short)} – ${dayMonth(event.end, short)}`;
}

function soonLabel(event: AheadEvent): string {
  if (event.ongoing) return tx('ახლა', 'Now');
  if (event.inDays === 0) return ka.cycle.heroToday;
  if (event.inDays === 1) return tx('ხვალ', 'Tomorrow');
  return tx(`${event.inDays} დღეში`, `in ${event.inDays} days`);
}

/** The event's first day as a calendar circle — the same marks as the cycle calendar. */
function DayGlyph({ kind, date, surface }: { kind: AheadKind; date: string; surface: string }) {
  const c = useCycleColors();
  const style =
    kind === 'period'
      ? { backgroundColor: surface, borderWidth: 1.5, borderColor: c.period, borderStyle: 'dashed' as const }
      : kind === 'ovulation'
        ? { backgroundColor: c.fertilitySoft, borderWidth: 1.5, borderColor: c.fertile }
        : { backgroundColor: c.fertilitySoft };
  return (
    <View style={[s.glyphWrap, { backgroundColor: surface }]} importantForAccessibility="no" accessibilityElementsHidden>
      <View style={[s.glyph, style]}>
        <Text style={[s.glyphText, { color: kind === 'period' ? c.period : c.fertile }]}>{Number(date.slice(8, 10))}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { borderRadius: HUB.cardRadius, paddingHorizontal: 10, paddingTop: 18, paddingBottom: 14, gap: 12 },
  track: { flexDirection: 'row', alignItems: 'flex-start' },
  line: { position: 'absolute', top: 23, height: 1.5, borderRadius: 1 },
  stop: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, paddingHorizontal: 4 },
  glyphWrap: { paddingHorizontal: 6, marginBottom: 5 },
  glyph: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  glyphText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 21, fontVariant: ['tabular-nums'] },
  soon: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  title: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12.5, lineHeight: 17, textAlign: 'center' },
  note: { textAlign: 'center' },
});
