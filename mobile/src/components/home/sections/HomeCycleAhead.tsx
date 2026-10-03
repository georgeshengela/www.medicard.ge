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
 * woman can plan around them without opening the calendar. A compact list (owner 2026-10-03: the
 * three columns wrapped and cut their dates): one row per event — its first day in the cycle
 * grammar (dashed rose = expected period, turquoise = fertile / ovulation), the name, the whole
 * date range with its source note, and how soon it is as a tinted pill.
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

  // Each source note belongs to its own row (no loose footnotes under the list).
  const noteOf = (kind: AheadKind) =>
    kind === 'fertile' && wide ? wideWindowLabel() : kind === 'ovulation' && ovulationSource ? ovulationSource : null;

  return (
    <View style={s.section}>
      <HomeSectionHeading title={tx('წინ რა გელის', 'Coming up')} linkLabel={tx('კალენდარი', 'Calendar')} onLink={openCycle} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${tx('წინ რა გელის', 'Coming up')}. ${events
          .map((e) => `${titleOf(e.kind)}, ${ka.cycle.heroLikely} ${dateRange(e)}, ${soonLabel(e)}${noteOf(e.kind) ? `, ${noteOf(e.kind)}` : ''}`)
          .join('; ')}`}
        onPress={openCycle}
        style={[s.card, { backgroundColor: theme.surface }]}
      >
        {events.map((event, i) => {
          const period = event.kind === 'period';
          const note = noteOf(event.kind);
          return (
            <View key={event.kind}>
              {i > 0 ? <View style={[s.divider, { backgroundColor: theme.bg200 }]} /> : null}
              <View style={s.row}>
                <DayGlyph kind={event.kind} date={event.start} surface={theme.surface} />
                <View style={s.text}>
                  <Text numberOfLines={1} style={[s.title, { color: theme.text100 }]}>
                    {titleOf(event.kind)}
                  </Text>
                  {/* „სავარაუდო“ is said once, under the list (and by the dashed / tinted day). */}
                  <Text numberOfLines={2} style={[s.date, { color: theme.text200 }]}>
                    {`${dateRange(event)}${note ? ` · ${note}` : ''}`}
                  </Text>
                </View>
                <View style={[s.pill, { backgroundColor: period ? c.periodSoft : c.fertilitySoft }]}>
                  <Text numberOfLines={1} style={[s.pillText, { color: period ? (dark ? c.period : c.ctaPressed) : c.fertile }]}>
                    {soonLabel(event)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
        {learning ? (
          <View style={s.badge}>
            <CycleLearningBadge done={gate.completedCycles} required={gate.requiredCycles} surface={theme.bg200} />
          </View>
        ) : null}
      </Pressable>
      <Text style={[hubText.small, s.foot, { color: c.mutedSoft }]}>
        {tx('სავარაუდო თარიღებია, ბოლო ციკლების მიხედვით.', 'Estimated dates, based on your recent cycles.')}
      </Text>
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
    <View style={[s.glyph, style]} importantForAccessibility="no" accessibilityElementsHidden>
      <Text style={[s.glyphText, { color: kind === 'period' ? c.period : c.fertile }]}>{Number(date.slice(8, 10))}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { borderRadius: HUB.cardRadius, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  divider: { height: StyleSheet.hairlineWidth * 2, marginLeft: 50 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14.5, lineHeight: 20 },
  date: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12.5, lineHeight: 17 },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  pillText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, lineHeight: 17, fontVariant: ['tabular-nums'] },
  glyph: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  glyphText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 19, fontVariant: ['tabular-nums'] },
  badge: { paddingVertical: 8, alignItems: 'flex-start' },
  foot: { marginTop: 6, paddingHorizontal: 4 },
});
