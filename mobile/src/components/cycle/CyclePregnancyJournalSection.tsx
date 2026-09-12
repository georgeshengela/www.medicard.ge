import React from 'react';
import { Text, View } from 'react-native';
import { CycleCard, formatCycleDateKa } from '@/components/cycle/CycleUI';
import { CyclePregnancyObservationTrends } from '@/components/cycle/CyclePregnancyObservationTrends';
import { CyclePregnancyJournalJourneyCta } from '@/components/cycle/CyclePregnancyTimelinePeek';
import { PregnancyWeekMetrics, PregnancyWeekOpenCta } from '@/components/cycle/CyclePregnancyWeekVisual';
import { ka } from '@/i18n/ka';
import type { CyclePregnancyPayload } from '@/lib/api';
import { pregnancyEmptyCopyAllowed, pregnancyQueryPending } from '@/lib/cyclePregnancyQuery';
import { pregnancyObservationLines } from '@/lib/pregnancyObservationPresent';
import { useRouter } from 'expo-router';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  pregnancy: CyclePregnancyPayload | null;
  status?: string;
  errorKind?: string | null;
};

function testLabel(result: string) {
  return ka.cycle.testResult[result as 'negative' | 'positive' | 'unclear'] ?? result;
}

export function CyclePregnancyJournalSection({ pregnancy, status, errorKind }: Props) {
  const c = useCycleColors();
  const router = useRouter();
  const pending = pregnancyQueryPending(status);
  const canEmpty = pregnancyEmptyCopyAllowed(status);
  const week = pregnancy?.estimatedGestationalAge?.week;

  return (
    <View style={{ marginBottom: 20 }}>
      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 16,
          marginBottom: 10,
        }}
      >
        {ka.cycle.pregnancyJournalTitle}
      </Text>
      <CycleCard>
        {pending && !pregnancy ? (
          <Text style={{ color: c.muted, fontSize: 13 }}>{ka.common.loading}</Text>
        ) : status === 'error' && !pregnancy ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
            {errorKind === 'network' ? ka.cycle.offlineBanner : ka.common.error}
          </Text>
        ) : (
          <>
            {pregnancy?.referenceDate ? (
              <Text style={{ color: c.ink, fontSize: 14, lineHeight: 20 }}>
                {ka.cycle.pregnancyReference}: {formatCycleDateKa(pregnancy.referenceDate)}
              </Text>
            ) : null}
            {pregnancy?.referenceType === 'LMP' ? (
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                {ka.cycle.pregnancySourceLmp}
              </Text>
            ) : pregnancy?.referenceType === 'USER_SELECTED' ? (
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                {ka.cycle.pregnancySourceSelected}
              </Text>
            ) : null}
            {pregnancy?.estimatedGestationalAge && !pregnancy.reviewRequired ? (
              <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, marginTop: 10 }}>
                {ka.cycle.pregnancyWeekDay(
                  pregnancy.estimatedGestationalAge.week,
                  pregnancy.estimatedGestationalAge.day,
                )}
              </Text>
            ) : pregnancy?.reviewRequired ? (
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
                {ka.cycle.pregnancyReviewRequired}
              </Text>
            ) : null}
            {pregnancy?.estimatedDueDate?.date && !pregnancy.reviewRequired ? (
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                {ka.cycle.pregnancyEstimatedDue}: {formatCycleDateKa(pregnancy.estimatedDueDate.date)}
              </Text>
            ) : null}

            {pregnancy?.weekDevelopment && !pregnancy.reviewRequired ? (
              <View style={{ marginTop: 16 }}>
                <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, marginBottom: 8 }}>
                  {ka.cycle.pregnancyJournalWeek}
                </Text>
                <PregnancyWeekMetrics development={pregnancy.weekDevelopment} compact />
                {week != null ? (
                  <PregnancyWeekOpenCta onPress={() => router.push(`/cycle/week/${week}`)} />
                ) : null}
              </View>
            ) : null}
            <CyclePregnancyJournalJourneyCta
              timeline={pregnancy?.timeline}
              onOpen={() => router.push('/cycle/pregnancy/timeline')}
            />

            <CyclePregnancyObservationTrends
              payload={pregnancy?.observationTrends}
              pending={pending}
              failed={status === 'error' && !pregnancy}
            />

            <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, marginTop: 14 }}>
              {ka.cycle.pregnancyRecordsTitle}
            </Text>
            {canEmpty && !(pregnancy?.recentObservations?.length) ? (
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                {ka.cycle.pregnancyRecordsEmpty}
              </Text>
            ) : (
              (pregnancy?.recentObservations || []).slice(0, 14).map((row) => {
                const bits = pregnancyObservationLines(row, { includeIntimate: true });
                if (!bits.length) return null;
                return (
                  <View key={row.date} style={{ marginTop: 10 }}>
                    <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
                      {formatCycleDateKa(row.date)}
                    </Text>
                    {bits.map((bit) => (
                      <Text key={`${row.date}-${bit}`} style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 2 }}>
                        {bit}
                      </Text>
                    ))}
                  </View>
                );
              })
            )}

            <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, marginTop: 14 }}>
              {ka.cycle.pregnancyTestHistory}
            </Text>
            {canEmpty && !(pregnancy?.pregnancyTestHistory?.length) ? (
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                {ka.cycle.pregnancyHistoryEmpty}
              </Text>
            ) : (
              (pregnancy?.pregnancyTestHistory || []).slice(0, 8).map((row) => (
                <Text key={`${row.date}-${row.result}`} style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
                  {formatCycleDateKa(row.date)} — {testLabel(row.result)}
                </Text>
              ))
            )}
            <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, marginTop: 12 }}>
              {ka.cycle.pregnancyTestNotMode}
            </Text>
          </>
        )}
      </CycleCard>
    </View>
  );
}
