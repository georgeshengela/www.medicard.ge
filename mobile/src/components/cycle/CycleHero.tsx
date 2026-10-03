import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { CycleExpectationLine } from '@/components/cycle/CycleExpectationLine';
import { CycleExplainSheet } from '@/components/cycle/CycleExplainSheet';
import { CyclePhaseLegend } from '@/components/cycle/CyclePhaseLegend';
import { CycleStillBleedingRow } from '@/components/cycle/CycleStillBleedingRow';
import { CycleStatusGauge, type GaugeCenter } from '@/components/cycle/CycleStatusGauge';
import { PredictionBadge, ConfidenceHint } from '@/components/cycle/CycleBadges';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { Check, Droplet, Heart, Plus, type LucideIcon } from 'lucide-react-native';
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
import { cycleCenter, cycleHeroActions, cycleSpreadModel, startLeads, type CycleHeroActionId } from '@/lib/home/homeCycle';
import { addDaysToKey, daysBetween } from '@/lib/cyclePhase';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { heroPeriodState, heroPlanWhileAsking } from '@/lib/cyclePeriodStatus';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { bleedingIsUncertain, showFertilityUi, showOvulationUi } from '@/lib/cycleContraception';
import { confidencePresentation, gaugeA11ySummary } from '@/lib/cyclePresentation.js';
import {
  forecastPresentationAllowed,
  isPostpartumReturnLearning,
  suppressCycleLengthChrome,
  FERTILITY_STATUS,
  fertilityGateFromBundle,
} from '@/lib/cycleForecastEligibility';
import { ovulationBandLine, wideWindowLabel } from '@/lib/cycleForecastCopy';
import { CycleLearningBadge } from '@/components/cycle/CycleLearningBadge';
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
  /** „ჯერ კიდევ გაქვს?“ → „კი“ (period auto-end, brief §9 wave 2 item 3). */
  onStillBleeding?: () => void;
  /** A period write is in flight (the question's buttons wait). */
  busy?: boolean;
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
  onStillBleeding,
  busy = false,
  onInfo,
  onSex,
  sexLogged,
}: Props) {
  const c = useCycleColors();
  const caps = cycleModeCapabilities(bundle.profile.mode);
  const next = bundle.predictions?.nextPeriodStart ?? null;
  const confidence = bundle.predictions?.confidence ?? 'low';
  const todayLog = bundle.logs.find((l) => l.date === today);
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
  // Period auto-end (brief §9 wave 2 item 3) — the same rule as Home's hero: an open period stays a
  // period day through its usual length, the day after asks „ჯერ კიდევ გაქვს?“ once, then back to normal.
  const periodState = heroPeriodState({
    status: bundle.periodStatus,
    statusToday: bundle.meta?.today,
    today,
    todayFlow: todayLog?.flow,
    enabled: caps.showClassicCycleOverview && !hideLengthChrome && !uncertainBleed,
  });
  const onPeriod = periodState.onPeriod;
  const phaseHint = hideLengthChrome
    ? ka.cycle.postpartumReturnGathering
    : displayPhaseLabel(onPeriod ? 'period' : (phase ?? 'unknown'), phaseKa, { loggedPeriod: periodState.loggedToday });
  /** The ring's fertile-arc explanation — the one cycle explain sheet with the ring's own legend rows. */
  const [explain, setExplain] = useState<{ title: string; range?: string; body: string } | null>(null);
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

  // Forecast honesty (brief §9 item 13): the 3-cycle gate, TTC's wide window, the ovulation band's source.
  const fertilityGate = fertilityGateFromBundle(bundle);
  const wideWindow = fertilityGate.status === FERTILITY_STATUS.WIDE && fertilityGate.window === 'wide';
  const learningBadge =
    fertilityVisible &&
    caps.showFertileEstimates &&
    !hidePredicted &&
    !hideLengthChrome &&
    !overlays.fertileDays &&
    Boolean(cycleStart) &&
    fertilityGate.status === FERTILITY_STATUS.LEARNING;
  const ovulationRange = showOvulationUi(bundle) ? bundle.predictions?.ovulationRange ?? null : null;
  // No fertile arc yet: the ring still turns luteal where the server's phase words do (never a fertile guess).
  const lutealFrom = useMemo(() => {
    if (!learningBadge || !cycleStart || !cycleLength) return null;
    for (let d = 1; d <= Math.max(cycleLength, day ?? 0); d += 1) {
      const key = addDaysToKey(cycleStart, d - 1);
      if (bundle.predictions?.calendar?.[key]?.phase === 'luteal') return d;
    }
    return null;
  }, [learningBadge, cycleStart, cycleLength, day, bundle.predictions?.calendar]);

  const openFertile = () => {
    if (!overlays.fertileDays) return;
    const copy = fertileInsightCopy(flags, bundle.profile.mode);
    const from = dateForCycleDay(overlays.fertileDays.from);
    const to = dateForCycleDay(overlays.fertileDays.to);
    const lines = [
      from && to ? ka.cycle.gaugeFertileRange(formatCycleDateKa(from), formatCycleDateKa(to)) : null,
      wideWindow ? wideWindowLabel() : null,
      ovulationRange ? ovulationBandLine(ovulationRange, fertilityGate.ovulationSource) : null,
    ].filter(Boolean);
    setExplain({
      title: copy.title,
      range: lines.length ? lines.join('\n') : undefined,
      body: copy.body,
    });
  };

  /** Status line (§4.1): estimate wording always; window copy when cautious. */
  const statusLine = useMemo(() => {
    if (onPeriod) {
      if (!periodState.loggedToday) return ka.cycle.legendPeriodPredicted;
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
  }, [onPeriod, periodState.loggedToday, hidePredicted, predictedToday, next, caps, bundle.pregnancy, today, uncertainBleed]);

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
    nextPeriodStart: next,
    serverRange: bundle.predictions?.nextPeriodRange ?? null,
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

  /**
   * The same action plan as Home's hero (brief §8.2 item 12): „მენსტრუაცია დაიწყო“ leads when it is
   * plausible soon (or the rhythm is unknown / late); on bleeding days „დასრულება“ leads, except on
   * day 1 where today's flow is the only action (ending day 1 would erase the start — undo is in the toast).
   */
  const leads = startLeads({ onPeriod, forecastOn, predictedToday, inDays });
  const dayOne = bundle.profile.lastPeriodStart === today || (onPeriod && day === 1);
  const plan = heroPlanWhileAsking(cycleHeroActions({ onPeriod, dayOne, leadsWithStart: leads }), periodState.askStill && Boolean(onStillBleeding));
  const startLabel = uncertainBleed ? ka.cycle.heroBleedingStarted : ka.cycle.heroPeriodStarted;
  const action = (id: CycleHeroActionId, filled: boolean) => {
    if (id === 'start') return <HeroButton key={id} filled={filled} label={startLabel} icon={Droplet} onPress={onStart} />;
    if (id === 'end') return <HeroButton key={id} filled={filled} label={ka.cycle.periodEndCta} icon={filled ? Check : undefined} onPress={onEnd} />;
    if (id === 'logFlow') return <HeroButton key={id} filled={filled} label={ka.cycle.logTodayFlow} icon={Droplet} onPress={onLog} />;
    return <HeroButton key={id} filled={filled} label={ka.cycle.logTodayCta} icon={Plus} onPress={onLog} />;
  };

  return (
    <View style={{ paddingTop: 18, paddingBottom: 18, borderRadius: 22, backgroundColor: c.card }}>
      <CycleStatusGauge
        day={hideLengthChrome ? null : day}
        cycleLength={cycleLength}
        hideLengthChrome={hideLengthChrome}
        phaseHint={phaseHint}
        periodActive={onPeriod}
        recordedPeriodDays={cycleStart && !hideLengthChrome ? bundle.logs.filter(log => isBleedFlow(log.flow)).map(log => daysBetween(cycleStart, log.date) + 1).filter(d => d >= 1 && d <= Math.max(cycleLength, day ?? 0)) : []}
        pmsPattern={hasPmsPattern(bundle) && !hidePredicted && phase === 'luteal'}
        fertileDays={overlays.fertileDays}
        lutealFrom={lutealFrom}
        a11yLabel={gaugeA11y}
        center={center}
        phase={phase}
        periodLength={bundle.averages?.usedPeriodLength ?? bundle.profile?.avgPeriodLength ?? 5}
        describeDay={hideLengthChrome ? undefined : describeDay}
        onInfo={hideLengthChrome ? undefined : onInfo}
        onPressFertile={overlays.fertileDays ? openFertile : undefined}
      />
      <CycleExplainSheet
        visible={Boolean(explain)}
        title={explain?.title ?? ''}
        body={explain?.body}
        accent={c.fertile}
        sourceIds={['menstrualCycle']}
        caption={ka.cycle.gaugeRingCaption}
        onClose={() => setExplain(null)}
      >
        {explain?.range ? (
          <Text style={{ color: c.fertile, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 22, marginBottom: 12 }}>
            {explain.range}
          </Text>
        ) : null}
        {/* Same grammar as the ring and the calendar (brief §8.2 item 3): the fertile arc and its day marks. */}
        <CyclePhaseLegend look="plain" phases only={['fertilePhase', 'fertile', 'ovulation']} showFertility showOvulation={!wideWindow} />
      </CycleExplainSheet>

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
            <CyclePhaseLegend
              look="dense"
              phases
              marks={false}
              closingLine
              showFertility={Boolean(overlays.fertileDays)}
              showLuteal={Boolean(overlays.fertileDays) || lutealFrom != null}
            />
          </View>
        ) : null}

        {/* Brief §9 item 13: before 3 cycles the fertile arc is not drawn — this quiet badge stands in its place. */}
        {learningBadge ? (
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <CycleLearningBadge done={fertilityGate.completedCycles} required={fertilityGate.requiredCycles} />
          </View>
        ) : null}
        {wideWindow && overlays.fertileDays ? (
          <Text style={{ color: c.fertile, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 8 }}>
            {`${ka.cycle.legendFertile} · ${wideWindowLabel()}`}
          </Text>
        ) : null}

        {!hideLengthChrome ? (
          <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 6 }}>{ka.cycle.dialHint}</Text>
        ) : null}

        {flags.pcos && fertilityVisible ? (
          <Text style={{ color: c.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 10, fontFamily: 'NotoSansGeorgian_400Regular' }}>
            {ka.cycle.pcosFertilityCaution}
          </Text>
        ) : null}

        {periodState.askStill && onStillBleeding ? (
          <View style={{ marginTop: 16 }}>
            <CycleStillBleedingRow onYes={onStillBleeding} onEnded={onEnd} disabled={busy} />
          </View>
        ) : null}

        {/* Home's pattern: the leading action full width, then the other one beside „♥ სექსი“. */}
        <View style={{ marginTop: 16, gap: 10 }}>
          {action(plan.primary, true)}
          {plan.secondary || onSex ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {plan.secondary ? action(plan.secondary, false) : null}
              {onSex ? <SexButton logged={Boolean(sexLogged)} wide={!plan.secondary} onPress={onSex} /> : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** The hero's buttons in Home's sizes: filled 50 pt rose pill, tonal 46 pt (flat, no border, no shadow). */
function HeroButton({ label, icon: Icon, filled, onPress }: { label: string; icon?: LucideIcon; filled: boolean; onPress: () => void }) {
  const c = useCycleColors();
  const fg = filled ? c.onPrimary : c.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: filled ? undefined : 1,
        minHeight: filled ? 50 : 46,
        borderRadius: filled ? 25 : 23,
        paddingHorizontal: filled ? 10 : 12,
        paddingVertical: filled ? 6 : 0,
        backgroundColor: filled ? c.cta : c.cardSoft,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {Icon ? <Icon size={17} color={fg} strokeWidth={2.2} /> : null}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={{ color: fg, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: filled ? 14 : 13, lineHeight: filled ? 19 : 18, textAlign: 'center', flexShrink: 1 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** „♥ სექსი“ — one tap logs it for today; logged, it shows a tick and opens the private details sheet. */
function SexButton({ logged, wide, onPress }: { logged: boolean; wide: boolean; onPress: () => void }) {
  const c = useCycleColors();
  const fg = logged ? c.onPeriod : c.period;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={logged ? ka.cycle.sexLoggedA11y : ka.cycle.sexLogA11y}
      style={{
        flex: wide ? 1 : undefined,
        minHeight: 46,
        borderRadius: 23,
        paddingHorizontal: 16,
        backgroundColor: logged ? c.period : c.periodSoft,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {logged ? <Check size={15} color={fg} strokeWidth={3} /> : <Heart size={16} color={fg} strokeWidth={2.4} fill={fg} />}
      <Text numberOfLines={1} style={{ color: fg, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18 }}>{ka.cycle.sexShort}</Text>
    </Pressable>
  );
}
