import React from 'react';
import { Text, View } from 'react-native';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import type { CyclePerimenopausePayload } from '@/lib/api';
import { cycleChipLabel } from '@/lib/cycleLabels';
import { energyLabel, formatPainEntry, sleepLabel } from '@/lib/cycleObservations';
import { CyclePerimenopauseObservationSummaries } from '@/components/cycle/CyclePerimenopauseObservationSummaries';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  peri: CyclePerimenopausePayload | null | undefined;
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

export function CyclePerimenopauseJournalSection({ peri }: Props) {
  const c = useCycleColors();
  const episodes = peri?.recentBleedingEpisodes ?? [];
  const recents = peri?.recentObservations ?? [];

  return (
    <View style={{ marginBottom: 20, gap: 12 }}>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>
        {ka.cycle.periJournalTitle}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>{ka.cycle.periNotDiagnosis}</Text>

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          padding: 16,
        }}
      >
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
          {ka.cycle.periRecentBleeding}
        </Text>
        {episodes.length === 0 ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
            {ka.cycle.periNoBleeding}
          </Text>
        ) : (
          episodes
            .slice()
            .reverse()
            .map((row) => (
              <View key={row.start} style={{ marginTop: 10 }}>
                <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
                  {formatCycleDateKa(row.start)}
                  {row.durationDays ? ` · ${ka.cycle.periDuration(row.durationDays)}` : ''}
                </Text>
                {row.intervalDays ? (
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                    {ka.cycle.periInterval(row.intervalDays)}
                  </Text>
                ) : null}
                {row.flowFacts.length ? (
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                    {row.flowFacts.map((flow) => cycleChipLabel(flow)).join(' · ')}
                  </Text>
                ) : null}
              </View>
            ))
        )}
      </View>

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          padding: 16,
        }}
      >
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
          {ka.cycle.periVariability}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
          {peri ? variabilityCopy(peri) : ka.cycle.periVariabilityNeedMore}
        </Text>
      </View>

      <CyclePerimenopauseObservationSummaries payload={peri?.observationSummaries} />

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          padding: 16,
        }}
      >
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
          {ka.cycle.periBodyChanges}
        </Text>
        {recents.length === 0 ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
            {ka.cycle.periBodyChangesEmpty}
          </Text>
        ) : (
          recents.map((row) => {
            const bits = [
              ...row.symptoms.map((key) => cycleChipLabel(key)),
              ...row.moods.map((key) => cycleChipLabel(key)),
              row.energy ? `${ka.cycle.energy}: ${energyLabel(row.energy)}` : null,
              row.sleepQuality ? `${ka.cycle.sleep}: ${sleepLabel(row.sleepQuality)}` : null,
              ...row.pain.map((entry) => formatPainEntry(entry as never)),
            ].filter(Boolean);
            return (
              <View key={row.date} style={{ marginTop: 10 }}>
                <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
                  {formatCycleDateKa(row.date)}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
                  {bits.join(' · ')}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
