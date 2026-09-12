import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import type { CyclePerimenopausePayload } from '@/lib/api';
import { cycleChipLabel } from '@/lib/cycleLabels';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  peri: CyclePerimenopausePayload | null | undefined;
  onLog?: () => void;
};

function variabilityCopy(peri: CyclePerimenopausePayload) {
  const v = peri.variabilitySummary;
  if (v.intervalCount >= 2 && v.shortestDays != null && v.longestDays != null) {
    return ka.cycle.periVariabilityRange(v.shortestDays, v.longestDays);
  }
  if (v.intervalCount === 1 && v.recentIntervalDays != null) {
    return ka.cycle.periVariabilityOne(v.recentIntervalDays);
  }
  return ka.cycle.periVariabilityNeedMore;
}

function forecastCopy(peri: CyclePerimenopausePayload) {
  if (peri.forecast.showPreciseNextPeriod && peri.forecast.nextPeriodStart) {
    return ka.cycle.periForecastEst(formatCycleDateKa(peri.forecast.nextPeriodStart));
  }
  return ka.cycle.periForecastLow;
}

export function CyclePerimenopauseCard({ peri, onLog }: Props) {
  const c = useCycleColors();
  const last = peri?.lastRecordedBleeding?.date
    ? ka.cycle.periLastBleeding(formatCycleDateKa(peri.lastRecordedBleeding.date))
    : ka.cycle.periNoBleeding;
  const episodeCount = peri?.recentBleedingEpisodes.length ?? 0;
  const lastFlow = peri?.lastRecordedBleeding?.flow
    ? cycleChipLabel(peri.lastRecordedBleeding.flow)
    : null;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={ka.cycle.periModeTitle}
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        padding: 16,
      }}
    >
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22 }}>
        {ka.cycle.periModeTitle}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
        {ka.cycle.periNotDiagnosis}
      </Text>

      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 13,
          marginTop: 16,
        }}
      >
        {ka.cycle.periRecentBleeding}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>{last}</Text>
      {lastFlow ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }}>{lastFlow}</Text>
      ) : null}
      {episodeCount > 0 ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }}>
          {ka.cycle.periEpisodeCount(episodeCount)}
        </Text>
      ) : null}

      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 13,
          marginTop: 16,
        }}
      >
        {ka.cycle.periVariability}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
        {peri ? variabilityCopy(peri) : ka.cycle.periVariabilityNeedMore}
      </Text>

      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 13,
          marginTop: 16,
        }}
      >
        {ka.cycle.periBodyChanges}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
        {peri && peri.recentObservations[0]
          ? `${formatCycleDateKa(peri.recentObservations[0].date)} · ${[
              ...peri.recentObservations[0].symptoms.map((key) => cycleChipLabel(key)),
              ...peri.recentObservations[0].moods.map((key) => cycleChipLabel(key)),
            ]
              .filter(Boolean)
              .join(' · ')}`
          : ka.cycle.periBodyChangesEmpty}
      </Text>

      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 12 }}>
        {peri ? forecastCopy(peri) : ka.cycle.periForecastLow}
      </Text>

      {onLog ? (
        <Pressable
          onPress={onLog}
          accessibilityRole="button"
          accessibilityLabel={ka.cycle.periQuickLog}
          style={{
            marginTop: 16,
            minHeight: 44,
            borderRadius: 14,
            backgroundColor: c.cta,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
            {ka.cycle.periQuickLog}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
