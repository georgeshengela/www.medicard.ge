import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { CycleGaugeExplainSheet, type GaugeExplain } from '@/components/cycle/CycleGaugeExplainSheet';
import { CycleStatusGauge, type GaugeCenter } from '@/components/cycle/CycleStatusGauge';
import { PredictionBadge, ConfidenceHint } from '@/components/cycle/CycleBadges';
import { CyclePrimaryButton, formatCycleDateKa } from '@/components/cycle/CycleUI';
import { Droplet, Plus } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import type { CycleBundle } from '@/lib/api';
import {
  cycleHonestyFlags,
  displayPhaseLabel,
  fertileInsightCopy,
  nextPeriodConfidenceCopy,
} from '@/lib/cycleHonesty';
import { addDaysToKey, daysBetween } from '@/lib/cyclePhase';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { bleedingIsUncertain, showFertilityUi } from '@/lib/cycleContraception';
import { confidencePresentation, gaugeA11ySummary } from '@/lib/cyclePresentation.js';
import {
  forecastPresentationAllowed,
  isPostpartumReturnLearning,
  suppressCycleLengthChrome,
} from '@/lib/cycleForecastEligibility';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';
import { hasPmsPattern } from '@/lib/cycleAnalytics';

type Props = {
  bundle: CycleBundle;
  day: number | null;
  cycleLength: number;
  phaseKa: string;
  phase?: string;
  today: string;
  onLog: () => void;
  onStart: () => void;
  onEnd: () => void;
  onInfo?: () => void;
};

/**
 * Overview hero (2026-09-28 redesign): bead ring with one number in the centre → cycle-day line →
 * PredictionBadge + ConfidenceHint → two contextual actions ("period started" leads when it is near).
 * All facts are server-derived; this component only maps them to visuals.
 */
export function CycleHero({
  bundle,
  day,
  cycleLength,
  phaseKa,
  phase,
  today,
  onLog,
  onStart,
  onEnd,
  onInfo,
}: Props) {
  const c = useCycleColors();
  const caps = cycleModeCapabilities(bundle.profile.mode);
  const next = bundle.predictions?.nextPeriodStart ?? null;
  const confidence = bundle.predictions?.confidence ?? 'low';
  const todayLog = bundle.logs.find((l) => l.date === today);
  const onPeriod = isBleedFlow(todayLog?.flow);
  const predictedToday = Boolean(
    bundle.predictions?.calendar?.[today]?.period && bundle.predictions.calendar[today].predicted,
  );
  const uncertainBleed = bleedingIsUncertain(bundle);
  const fertilityVisible = showFertilityUi(bundle);

  const flags = cycleHonestyFlags({
    confidence,
    isIrregular: bundle.profile.isIrregular,
    conditions: bundle.profile.conditions,
  });
  const confidenceCopy = nextPeriodConfidenceCopy(flags);
  const predViz = confidencePresentation(confidence);
  const hidePredicted = predViz.hidePredictedOverlays || !forecastPresentationAllowed(bundle);
  const hideLengthChrome = suppressCycleLengthChrome(bundle);
  const forecastLearning = isPostpartumReturnLearning(bundle);
  const phaseHint = hideLengthChrome
    ? ka.cycle.postpartumReturnGathering
    : displayPhaseLabel(phase ?? 'unknown', phaseKa, { loggedPeriod: onPeriod });
  const [explain, setExplain] = useState<GaugeExplain | null>(null);

  const cycleStart = day != null && day > 0 ? addDaysToKey(today, -(day - 1)) : null;
  const dateForCycleDay = (cycleDay: number) =>
    cycleStart ? addDaysToKey(cycleStart, cycleDay - 1) : null;

  const overlays = useMemo(() => {
    if (!cycleStart || !cycleLength || hidePredicted) {
      return { fertileDays: null as { from: number; to: number } | null };
    }
    const toDay = (dateKey: string | null | undefined) => (dateKey ? daysBetween(cycleStart, dateKey) + 1 : null);
    const fw = fertilityVisible ? bundle.predictions?.fertileWindow : null;
    const rawFrom = toDay(fw?.start);
    const rawTo = toDay(fw?.end);
    // Clip to this cycle instead of dropping a window that crosses its edge.
    const from = rawFrom != null ? Math.max(1, rawFrom) : null;
    const to = rawTo != null ? Math.min(cycleLength, rawTo) : null;
    return {
      fertileDays: from != null && to != null && from <= to ? { from, to } : null,
    };
  }, [bundle.predictions, cycleStart, cycleLength, fertilityVisible, hidePredicted]);

  const openFertile = () => {
    if (!overlays.fertileDays) return;
    const copy = fertileInsightCopy(flags, bundle.profile.mode);
    const from = dateForCycleDay(overlays.fertileDays.from);
    const to = dateForCycleDay(overlays.fertileDays.to);
    setExplain({
      title: copy.title,
      range: from && to ? ka.cycle.gaugeFertileRange(formatCycleDateKa(from), formatCycleDateKa(to)) : undefined,
      body: copy.body,
      accent: 'purple',
    });
  };

  /** Status line (§4.1): estimate wording always; window copy when cautious. */
  const statusLine = useMemo(() => {
    if (onPeriod) {
      return uncertainBleed ? ka.cycle.loggedBleedingToday : ka.cycle.currentlyOnPeriod;
    }
    if (caps.showPregnancyOverview) {
      const age = bundle.pregnancy?.age;
      if (bundle.pregnancy?.reviewRequired) return ka.cycle.pregnancyReviewRequired;
      if (age) return ka.cycle.pregnancyWeekDay(age.week, age.day);
      return ka.cycle.pregnancyModeTitle;
    }
    if (hidePredicted) return null;
    if (predictedToday) return ka.cycle.predictedPeriodToday;
    if (!next || !caps.showNextPeriodForecast) return null;
    const inDays = daysBetween(today, next);
    if (inDays < 0) return null; // Late state is carried by the alerts banner.
    if (inDays === 0) return ka.cycle.predictedPeriodToday;
    return uncertainBleed
      ? ka.cycle.statusNextBleedingIn(inDays)
      : ka.cycle.statusNextPeriodIn(inDays);
  }, [onPeriod, hidePredicted, predictedToday, next, caps, bundle.pregnancy, today, uncertainBleed]);

  const gaugeA11y = hideLengthChrome
    ? gaugeA11ySummary({
        dayLabel: null,
        phaseLabel: ka.cycle.postpartumReturnGathering,
        nextPeriodLabel: ka.cycle.postpartumReturnLearning,
      })
    : gaugeA11ySummary({
        dayLabel: day != null ? `${ka.cycle.cycleDay} ${day}` : null,
        phaseLabel: phaseHint,
        nextPeriodLabel: statusLine,
      });

  const inDays = next ? daysBetween(today, next) : null;
  const forecastOn = Boolean(next) && caps.showNextPeriodForecast && !hidePredicted;
  /** One number in the ring (research brief §1): bleeding day, "today", or the countdown; else cycle day. */
  const center: GaugeCenter | undefined = hideLengthChrome
    ? undefined
    : onPeriod
      ? { top: uncertainBleed ? ka.cycle.heroBleedingDay : ka.cycle.heroPeriodDay, value: day != null ? String(day) : '—', bottom: null, tone: 'period' }
      : !hidePredicted && (predictedToday || (forecastOn && inDays === 0))
        ? { top: ka.cycle.heroLikely, value: ka.cycle.heroToday, bottom: ka.cycle.legendPeriodPredicted, tone: 'period' }
        : forecastOn && inDays != null && inDays > 0
          ? { top: uncertainBleed ? ka.cycle.heroUntilBleeding : ka.cycle.heroUntilPeriod, value: String(inDays), bottom: ka.cycle.heroDaysEstimated }
          : forecastOn && inDays != null && inDays < 0 && day != null
            ? { top: ka.cycle.cycleDay, value: String(day), bottom: ka.cycle.heroLateBy(-inDays) }
            : undefined;
  /** "Period started" leads when it is plausible soon (or the rhythm is still unknown / late). */
  const startLeads = !onPeriod && (!forecastOn || predictedToday || (inDays != null && inDays <= 3));
  const startLabel = uncertainBleed ? ka.cycle.heroBleedingStarted : ka.cycle.heroPeriodStarted;

  return (
    <View style={{ paddingTop: 18, paddingBottom: 16, borderRadius: 28, backgroundColor: c.card }}>
      <CycleStatusGauge
        day={hideLengthChrome ? null : day}
        cycleLength={cycleLength}
        hideLengthChrome={hideLengthChrome}
        phaseHint={phaseHint}
        periodActive={onPeriod}
        recordedPeriodDays={cycleStart && !hideLengthChrome ? bundle.logs.filter(log => isBleedFlow(log.flow)).map(log => daysBetween(cycleStart, log.date) + 1).filter(d => d >= 1 && d <= Math.max(cycleLength, day ?? 0)) : []}
        pmsPattern={hasPmsPattern(bundle) && !hidePredicted && phase === 'luteal'}
        fertileDays={overlays.fertileDays}
        a11yLabel={gaugeA11y}
        center={center}
        phase={phase}
        onInfo={hideLengthChrome ? undefined : onInfo}
        onPressFertile={overlays.fertileDays ? openFertile : undefined}
      />
      <CycleGaugeExplainSheet visible={Boolean(explain)} explain={explain} onClose={() => setExplain(null)} />

      <View style={{ paddingHorizontal: 18, marginTop: 2 }}>
        {center && day != null ? (
          <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
            {day > (Math.round(cycleLength) || 28)
              ? ka.cycle.heroUsualLength(Math.round(cycleLength) || 28)
              : ka.cycle.heroCycleDayOf(day, Math.round(cycleLength) || 28)}
          </Text>
        ) : (
          <Text style={{ color: statusLine ? c.ink : c.muted, fontFamily: statusLine ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 21, textAlign: 'center' }}>
            {statusLine ?? (forecastLearning ? ka.cycle.postpartumReturnLearning : ka.cycle.statusLearning)}
          </Text>
        )}

        {forecastOn || (caps.showNextPeriodForecast && !hidePredicted) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 10 }}>
            {next && forecastOn && !onPeriod ? <PredictionBadge date={next} /> : null}
            <ConfidenceHint label={confidenceCopy} />
          </View>
        ) : null}

        {!hideLengthChrome && (overlays.fertileDays || cycleStart) ? (
          <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 10, rowGap: 4, marginTop: 12 }}>
            <LegendDot fill={c.todayRing} label={ka.cycle.gaugeLegendToday} />
            <LegendDot fill={c.period} label={ka.cycle.legendPeriod} />
            {overlays.fertileDays ? <LegendDot fill={c.fertileFill} label={ka.cycle.legendFertile} /> : null}
            {overlays.fertileDays ? <LegendDot fill={cycleHexAlpha(c.luteal, 0.35)} label={ka.cycle.adviceLutealTitle} /> : null}
          </View>
        ) : null}

        {flags.pcos && fertilityVisible ? (
          <Text style={{ color: c.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 10, fontFamily: 'NotoSansGeorgian_400Regular' }}>
            {ka.cycle.pcosFertilityCaution}
          </Text>
        ) : null}

        <View style={{ marginTop: 16, gap: 8 }}>
          {onPeriod ? (
            <>
              <CyclePrimaryButton label={ka.cycle.logTodayFlow} onPress={onLog} icon={Droplet} />
              <HeroSecondary label={ka.cycle.periodEndCta} onPress={onEnd} />
            </>
          ) : startLeads ? (
            <>
              <CyclePrimaryButton label={startLabel} onPress={onStart} icon={Droplet} />
              <HeroSecondary label={ka.cycle.logTodayCta} onPress={onLog} icon={Plus} />
            </>
          ) : (
            <>
              <CyclePrimaryButton label={ka.cycle.logTodayCta} onPress={onLog} icon={Plus} />
              <HeroSecondary label={startLabel} onPress={onStart} icon={Droplet} />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function LegendDot({ fill, ring, label }: { fill: string; ring?: string; label: string }) {
  const c = useCycleColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: fill, borderWidth: ring ? 1.5 : 0, borderColor: ring }} />
      <Text style={{ color: c.mutedSoft, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, lineHeight: 15 }}>{label}</Text>
    </View>
  );
}

function HeroSecondary({ label, a11y, onPress, icon: Icon }: { label: string; a11y?: string; onPress: () => void; icon?: typeof Plus }) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      style={{ minHeight: 46, borderRadius: 23, backgroundColor: c.cardSoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 10 }}
    >
      {Icon ? <Icon size={16} color={c.ink} strokeWidth={2.3} /> : null}
      <Text numberOfLines={1} style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, flexShrink: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}
