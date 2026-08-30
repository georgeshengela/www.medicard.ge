import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { CycleRing } from '@/components/cycle/CycleRing';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import type { CycleBundle } from '@/lib/api';
import { cycleHonestyFlags, displayPhaseLabel, nextPeriodConfidenceCopy } from '@/lib/cycleHonesty';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { bleedingIsUncertain } from '@/lib/cycleContraception';
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
};

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
}: Props) {
  const c = useCycleColors();
  const next = bundle.predictions?.nextPeriodStart ?? null;
  const confidence = bundle.predictions?.confidence ?? 'low';
  const todayLog = bundle.logs.find((l) => l.date === today);
  const onPeriod = isBleedFlow(todayLog?.flow);
  const predictedToday = Boolean(
    bundle.predictions?.calendar?.[today]?.period && bundle.predictions.calendar[today].predicted,
  );

  const flags = cycleHonestyFlags({
    confidence,
    isIrregular: bundle.profile.isIrregular,
    conditions: bundle.profile.conditions,
  });
  const confidenceCopy = nextPeriodConfidenceCopy(flags);
  const phaseHint = displayPhaseLabel(phase ?? 'unknown', phaseKa, { loggedPeriod: onPeriod });

  return (
    <View
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        paddingBottom: 16,
      }}
    >
      <CycleRing
        day={day}
        cycleLength={cycleLength}
        label={ka.cycle.cycleDay}
        phaseHint={phaseHint}
        periodActive={onPeriod}
      />

      <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
        {onPeriod ? (
          <Text
            style={{
              color: c.period,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {bleedingIsUncertain(bundle) ? ka.cycle.loggedBleedingToday : ka.cycle.currentlyOnPeriod}
          </Text>
        ) : predictedToday ? (
          <Text
            style={{
              color: c.muted,
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {ka.cycle.predictedPeriodToday}
          </Text>
        ) : null}

        {next && bundle.profile.mode !== 'PREGNANCY' ? (
          <View style={{ marginTop: 12 }}>
            <Text
              style={{
                color: c.muted,
                fontSize: 11,
                textAlign: 'center',
                fontFamily: 'NotoSansGeorgian_500Medium',
              }}
            >
              {bleedingIsUncertain(bundle) ? ka.cycle.estimatedNextBleeding : ka.cycle.estimatedNextPeriod}
            </Text>
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 18,
                textAlign: 'center',
                marginTop: 4,
              }}
            >
              {formatCycleDateKa(next)}
            </Text>
            {confidence === 'high' ? (
              <Text
                style={{
                  color: c.mutedSoft,
                  fontSize: 11,
                  textAlign: 'center',
                  marginTop: 6,
                }}
              >
                {confidenceCopy}
              </Text>
            ) : (
              <Text
                style={{
                  color: c.muted,
                  fontSize: 12,
                  lineHeight: 17,
                  textAlign: 'center',
                  marginTop: 6,
                  fontFamily: 'NotoSansGeorgian_400Regular',
                }}
              >
                {confidenceCopy}
              </Text>
            )}
            {flags.pcos ? (
              <Text
                style={{
                  color: c.muted,
                  fontSize: 11,
                  lineHeight: 16,
                  textAlign: 'center',
                  marginTop: 8,
                  fontFamily: 'NotoSansGeorgian_400Regular',
                }}
              >
                {ka.cycle.pcosFertilityCaution}
              </Text>
            ) : null}
          </View>
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
                  borderRadius: 14,
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
                  borderRadius: 14,
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
              <Text
                style={{
                  color: c.mutedSoft,
                  fontSize: 11,
                  textAlign: 'center',
                  lineHeight: 16,
                }}
              >
                {ka.cycle.periodEndHint}
              </Text>
            </>
          ) : (
            <Pressable
              onPress={onStart}
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.quickLogStart}
              style={{
                minHeight: 48,
                borderRadius: 14,
                backgroundColor: c.cta,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: c.white, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
                {ka.cycle.quickLogStart}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
