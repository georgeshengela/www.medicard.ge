import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { CycleExpectationLine } from '@/components/cycle/CycleExpectationLine';
import { CycleGaugeExplainSheet, type GaugeExplain } from '@/components/cycle/CycleGaugeExplainSheet';
import { CyclePhaseLegend } from '@/components/cycle/CyclePhaseLegend';
import { CycleStatusGauge, type GaugeCenter } from '@/components/cycle/CycleStatusGauge';
import { PredictionBadge, ConfidenceHint } from '@/components/cycle/CycleBadges';
import { CyclePrimaryButton, formatCycleDateKa } from '@/components/cycle/CycleUI';
import { Check, Droplet, Heart, Plus } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { MONTHS_KA } from '@/constants/cycle';
import type { CycleBundle } from '@/lib/api';
import {
  cycleHonestyFlags,
  displayPhaseLabel,
  fertileInsightCopy,
  nextPeriodConfidenceCopy,
} from '@/lib/cycleHonesty';
import { expectationLine, expectationsFromBundle } from '@/lib/cycleExpectations';
import { cycleCenterText } from '@/lib/cycleCenterCopy';
import { cycleCenter, cycleSpreadModel } from '@/lib/home/homeCycle';
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
  /** One tap: log sex for today (Flo's quick "log sex"); when already logged it opens the details. */
  onSex?: () => void;
  sexLogged?: boolean;
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
  onSex,
  sexLogged,
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
  // Her own pattern, read on the device (brief §9 item 11): one quiet „სავარაუდოა“ line, never a diagnosis.
  const expectation = useMemo(
    () => (hideLengthChrome ? null : expectationLine(expectationsFromBundle(bundle, today), todayLog)),
    [bundle, today, todayLog, hideLengthChrome],
  );

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
  // Variable cycles (brief §9 item 12): the single server date widens into a window from her last cycles.
  const spread = cycleSpreadModel({
    isIrregular: bundle.profile.isIrregular,
    usedCycleLength: cycleLength,
    cycleLengths: bundle.trends?.cycleLengths,
  });
  /** One number in the ring (research brief §1): bleeding day, "today", the countdown or window; else cycle day. */
  const centerModel = cycleCenter({ hideLengthChrome, hidePredicted, onPeriod, predictedToday, forecastOn, inDays, day, cycleLength, spread });
  const center: GaugeCenter | undefined =
    centerModel.kind === 'none' || centerModel.kind === 'cycleDay' ? undefined : cycleCenterText(centerModel, uncertainBleed);
  /** The estimate badge's end date — the window's last day for a variable cycle, else nothing. */
  const rangeUntil =
    next && spread && (centerModel.kind === 'countdownRange' || centerModel.kind === 'windowOpen')
      ? addDaysToKey(next, spread.after)
      : null;
  const rangeFrom = rangeUntil && next && centerModel.kind === 'countdownRange' ? addDaysToKey(next, -spread!.before) : next;
  /** Finger on the dial → that day's date, cycle day and (estimated or logged) phase. */
  const describeDay = (d: number): GaugeCenter | null => {
    const date = dateForCycleDay(d);
    if (!date) return null;
    const [, mm, dd] = date.split('-').map(Number);
    const mark = bundle.predictions?.calendar?.[date];
    const logged = bundle.logs.some((l) => l.date === date && isBleedFlow(l.flow));
    const phaseText = logged
      ? ka.cycle.dialLoggedPeriod
      : !hidePredicted && mark?.phaseKa && mark.phase !== 'unknown'
        ? ka.cycle.dialEstimated(mark.phaseKa)
        : null;
    return {
      top: date === today ? ka.cycle.heroToday : `${dd} ${MONTHS_KA[mm - 1]}`,
      value: String(d),
      bottom: phaseText ?? ka.cycle.cycleDay,
      tone: logged ? 'period' : 'ink',
    };
  };

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
        periodLength={bundle.averages?.usedPeriodLength ?? bundle.profile?.avgPeriodLength ?? 5}
        describeDay={hideLengthChrome ? undefined : describeDay}
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
            {next && forecastOn && !onPeriod ? <PredictionBadge date={rangeFrom ?? next} until={rangeUntil} /> : null}
            <ConfidenceHint label={confidenceCopy} />
          </View>
        ) : null}

        {expectation ? (
          <View style={{ marginTop: 12 }}>
            <CycleExpectationLine text={expectation} />
          </View>
        ) : null}

        {!hideLengthChrome && (overlays.fertileDays || cycleStart) ? (
          <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ marginTop: 12 }}>
            {/* Brief §8.2 items 3 + 10: the shared legend, phases only under the ring, with the closing line. */}
            <CyclePhaseLegend look="dense" phases marks={false} closingLine showFertility={Boolean(overlays.fertileDays)} />
          </View>
        ) : null}

        {!hideLengthChrome ? (
          <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 6 }}>{ka.cycle.dialHint}</Text>
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
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><HeroSecondary label={ka.cycle.periodEndCta} onPress={onEnd} /></View>
                {onSex ? <SexButton logged={Boolean(sexLogged)} onPress={onSex} /> : null}
              </View>
            </>
          ) : startLeads ? (
            <>
              <CyclePrimaryButton label={startLabel} onPress={onStart} icon={Droplet} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><HeroSecondary label={ka.cycle.logTodayCta} onPress={onLog} icon={Plus} /></View>
                {onSex ? <SexButton logged={Boolean(sexLogged)} onPress={onSex} /> : null}
              </View>
            </>
          ) : (
            <>
              <CyclePrimaryButton label={ka.cycle.logTodayCta} onPress={onLog} icon={Plus} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><HeroSecondary label={startLabel} onPress={onStart} icon={Droplet} /></View>
                {onSex ? <SexButton logged={Boolean(sexLogged)} onPress={onSex} /> : null}
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

/** Rose heart button next to the secondary action — one tap logs sex for today. */
function SexButton({ logged, onPress }: { logged: boolean; onPress: () => void }) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={logged ? ka.cycle.sexLoggedA11y : ka.cycle.sexLogA11y}
      style={{ minHeight: 46, borderRadius: 23, paddingHorizontal: 14, backgroundColor: logged ? c.period : c.periodSoft, flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      {logged ? <Check size={15} color={c.onPeriod} strokeWidth={3} /> : <Heart size={16} color={c.period} strokeWidth={2.4} fill={c.period} />}
      <Text style={{ color: logged ? c.onPeriod : c.period, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>{ka.cycle.sexShort}</Text>
    </Pressable>
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
      <Text numberOfLines={2} style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 17, textAlign: 'center', flexShrink: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}
