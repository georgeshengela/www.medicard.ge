import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import { CyclePregnancyPayload } from '@/lib/api';
import { pregnancyEmptyCopyAllowed, pregnancyQueryPending } from '@/lib/cyclePregnancyQuery';
import { pregnancyObservationLines } from '@/lib/pregnancyObservationPresent';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { PregnancyWeekMetrics, PregnancyWeekOpenCta } from '@/components/cycle/CyclePregnancyWeekVisual';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  pregnancy: CyclePregnancyPayload | null;
  status?: string;
  errorKind?: string | null;
  onRetry?: () => void;
  onLog?: () => void;
  onOpenWeek?: () => void;
};

function weekLine(age: CyclePregnancyPayload['estimatedGestationalAge']) {
  if (!age) return null;
  return ka.cycle.pregnancyWeekDay(age.week, age.day);
}

export function CyclePregnancyCard({
  pregnancy,
  status,
  errorKind,
  onRetry,
  onLog,
  onOpenWeek,
}: Props) {
  const c = useCycleColors();
  const pending = pregnancyQueryPending(status);
  const canEmpty = pregnancyEmptyCopyAllowed(status);

  if (pending && !pregnancy) {
    return (
      <View
        accessibilityRole="summary"
        accessibilityLabel={ka.common.loading}
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          padding: 16,
        }}
      >
        <ActivityIndicator color={c.ink} />
        <Text style={{ color: c.muted, marginTop: 10, fontSize: 13 }}>{ka.common.loading}</Text>
      </View>
    );
  }

  if (status === 'error' && !pregnancy) {
    return (
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          padding: 16,
        }}
      >
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>
          {ka.cycle.pregnancyModeTitle}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
          {errorKind === 'network' ? ka.cycle.offlineBanner : ka.common.error}
        </Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={ka.common.retry}
            style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}
          >
            <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.common.retry}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const age = pregnancy?.estimatedGestationalAge ?? null;
  const due = pregnancy?.estimatedDueDate?.date ?? null;
  const source =
    pregnancy?.referenceType === 'LMP'
      ? ka.cycle.pregnancySourceLmp
      : pregnancy?.referenceType === 'USER_SELECTED'
        ? ka.cycle.pregnancySourceSelected
        : null;
  const today = pregnancy?.todayObservations;
  const todayBits = today ? pregnancyObservationLines(today, { includeIntimate: false }) : [];
  const hasToday = todayBits.length > 0;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={ka.cycle.pregnancyModeTitle}
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        padding: 16,
      }}
    >
      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 16,
          lineHeight: 22,
        }}
      >
        {ka.cycle.pregnancyModeTitle}
      </Text>
      {pregnancy?.reviewRequired ? (
        <Text
          accessibilityLabel={ka.cycle.pregnancyReviewRequired}
          style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}
        >
          {ka.cycle.pregnancyReviewRequired}
        </Text>
      ) : age ? (
        <Text
          accessibilityLabel={ka.cycle.pregnancyWeekA11y(age.week, age.day)}
          style={{
            color: c.ink,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 22,
            lineHeight: 28,
            marginTop: 8,
          }}
        >
          {weekLine(age)}
        </Text>
      ) : null}
      {due && !pregnancy?.reviewRequired ? (
        <Text
          accessibilityLabel={ka.cycle.pregnancyDueA11y(formatCycleDateKa(due))}
          style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}
        >
          {ka.cycle.pregnancyEstimatedDue}: {formatCycleDateKa(due)}
        </Text>
      ) : null}
      {source ? (
        <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{source}</Text>
      ) : null}
      {pregnancy?.weekDevelopment && !pregnancy?.reviewRequired ? (
        <View style={{ marginTop: 14 }}>
          <PregnancyWeekMetrics development={pregnancy.weekDevelopment} />
          {onOpenWeek ? <PregnancyWeekOpenCta onPress={onOpenWeek} /> : null}
        </View>
      ) : null}
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 10 }}>
        {ka.cycle.pregnancyNotDiagnosis}
      </Text>
      <View style={{ marginTop: 12 }}>
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
          {ka.cycle.pregnancyTodayTitle}
        </Text>
        {canEmpty && !hasToday ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
            {ka.cycle.pregnancyTodayEmpty}
          </Text>
        ) : hasToday ? (
          <View style={{ marginTop: 6, gap: 2 }}>
            {todayBits.map((bit) => (
              <Text key={bit} style={{ color: c.ink, fontSize: 13, lineHeight: 19 }}>
                {bit}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      {onLog ? (
        <Pressable
          onPress={onLog}
          accessibilityRole="button"
          accessibilityLabel={ka.cycle.logFab}
          style={{
            minHeight: 44,
            marginTop: 12,
            borderRadius: 14,
            backgroundColor: c.cta,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.logFab}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
