import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CycleGaugeExplainSheet, type GaugeExplain } from '@/components/cycle/CycleGaugeExplainSheet';
import { CycleStatusGauge } from '@/components/cycle/CycleStatusGauge';
import { PredictionBadge, ConfidenceHint } from '@/components/cycle/CycleBadges';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
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
import { bleedingIsUncertain, showFertilityUi } from '@/lib/cycleContraception';
import { confidencePresentation, gaugeA11ySummary } from '@/lib/cyclePresentation.js';
import { useCycleColors } from '@/theme/cycle';

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
 * Phase 5 Overview hero (docs/CYCLE_DESIGN.md §4.1):
 * CycleStatusGauge → status line → PredictionBadge + ConfidenceHint → CTA.
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
  const hidePredicted = predViz.hidePredictedOverlays;
  const phaseHint = displayPhaseLabel(phase ?? 'unknown', phaseKa, { loggedPeriod: onPeriod });
  const [explain, setExplain] = useState<GaugeExplain | null>(null);

  const cycleStart = day != null && day > 0 ? addDaysToKey(today, -(day - 1)) : null;
  const dateForCycleDay = (cycleDay: number) =>
    cycleStart ? addDaysToKey(cycleStart, cycleDay - 1) : null;

  const overlays = useMemo(() => {
    if (!cycleStart || !cycleLength || hidePredicted) {
      return { fertileDays: null as { from: number; to: number } | null };
    }
    const toDay = (dateKey: string | null | undefined) => {
      if (!dateKey) return null;
      const idx = daysBetween(cycleStart, dateKey) + 1;
      if (idx < 1 || idx > cycleLength) return null;
      return idx;
    };
    const fw = fertilityVisible ? bundle.predictions?.fertileWindow : null;
    const from = toDay(fw?.start);
    const to = toDay(fw?.end);
    return {
      fertileDays: from != null && to != null ? { from, to } : null,
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
    if (hidePredicted) return null;
    if (predictedToday) return ka.cycle.predictedPeriodToday;
    if (!next || bundle.profile.mode === 'PREGNANCY') return null;
    const inDays = daysBetween(today, next);
    if (inDays < 0) return null; // Late state is carried by the alerts banner.
    if (inDays === 0) return ka.cycle.predictedPeriodToday;
    return uncertainBleed
      ? ka.cycle.statusNextBleedingIn(inDays)
      : ka.cycle.statusNextPeriodIn(inDays);
  }, [onPeriod, hidePredicted, predictedToday, next, bundle.profile.mode, today, uncertainBleed]);

  const gaugeA11y = gaugeA11ySummary({
    dayLabel: day != null ? `${ka.cycle.cycleDay} ${day}` : null,
    phaseLabel: phaseHint,
    nextPeriodLabel: statusLine,
  });

  return (
    <View style={{ paddingBottom: 8 }}>
      <CycleStatusGauge
        day={day}
        cycleLength={cycleLength}
        phaseHint={phaseHint}
        periodActive={onPeriod}
        fertileDays={overlays.fertileDays}
        a11yLabel={gaugeA11y}
        onInfo={onInfo}
        onPressFertile={overlays.fertileDays ? openFertile : undefined}
      />
      <CycleGaugeExplainSheet visible={Boolean(explain)} explain={explain} onClose={() => setExplain(null)} />

      <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
        {statusLine ? (
          <Text
            style={{
              color: onPeriod ? c.period : c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 18,
              lineHeight: 25,
              textAlign: 'center',
            }}
          >
            {statusLine}
          </Text>
        ) : next && bundle.profile.mode !== 'PREGNANCY' && !hidePredicted ? (
          <Text
            style={{
              color: c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 16,
              lineHeight: 23,
              textAlign: 'center',
            }}
          >
            {uncertainBleed ? ka.cycle.estimatedNextBleeding : ka.cycle.estimatedNextPeriod}:{' '}
            {formatCycleDateKa(next)}
          </Text>
        ) : (
          <Text
            style={{
              color: c.muted,
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 14,
              lineHeight: 20,
              textAlign: 'center',
            }}
          >
            {ka.cycle.statusLearning}
          </Text>
        )}

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
            marginTop: 12,
          }}
        >
          {next && bundle.profile.mode !== 'PREGNANCY' && !onPeriod && !hidePredicted ? (
            <PredictionBadge date={next} />
          ) : null}
          <ConfidenceHint label={confidenceCopy} />
        </View>

        {flags.pcos && fertilityVisible ? (
          <Text
            style={{
              color: c.muted,
              fontSize: 11,
              lineHeight: 16,
              textAlign: 'center',
              marginTop: 10,
              fontFamily: 'NotoSansGeorgian_400Regular',
            }}
          >
            {ka.cycle.pcosFertilityCaution}
          </Text>
        ) : null}

        <View style={{ marginTop: 14, gap: 8 }}>
          {onPeriod ? (
            <>
              <Pressable
                onPress={onLog}
                accessibilityRole="button"
                accessibilityLabel={ka.cycle.logTodayFlow}
                style={{
                  minHeight: 48,
                  borderRadius: 18,
                  backgroundColor: c.cta,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: c.white, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
                  {ka.cycle.logTodayFlow}
                </Text>
              </Pressable>
              <Pressable
                onPress={onEnd}
                accessibilityRole="button"
                accessibilityLabel={ka.cycle.periodEndCta}
                style={{
                  minHeight: 48,
                  borderRadius: 18,
                  backgroundColor: c.cardSoft,
                  borderWidth: 1,
                  borderColor: c.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
                  {ka.cycle.periodEndCta}
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={onLog}
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.logTodayCta}
              style={{
                minHeight: 48,
                borderRadius: 18,
                backgroundColor: c.cta,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: c.white, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
                {ka.cycle.logTodayCta}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
